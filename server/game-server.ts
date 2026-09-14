import { randomInt, randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import { z } from "zod";
import { capitals } from "../data/capitals";
import { usage } from "../services/usage";
import {
  DEFAULT_SETTINGS,
  haversine,
  nameSchema,
  pointSchema,
  roomCodeSchema,
  scoreDistance,
  settingsSchema,
} from "../lib/game";
import type {
  Ack,
  ClientToServerEvents,
  Player,
  Point,
  RoomState,
  RoundResult,
  ServerToClientEvents,
  Session,
  Settings,
} from "../types/game";
import {
  PoolExhaustedError,
  type GameLocation,
  type LocationProvider,
} from "../services/locations";
import {
  MemoryLocationHistory,
  type LocationHistory,
} from "../services/location-history";

type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type Member = Player & {
  token: string;
  socketId: string | null;
  guess: Point | null;
  expiry?: ReturnType<typeof setTimeout>;
};
type Room = {
  teamScores: number[];
  teamHp: number[];
  winnerIds?: string[];
  code: string;
  hostId: string;
  players: Member[];
  settings: Settings;
  phase: RoomState["phase"];
  round: number;
  deadline: number | null;
  locations: GameLocation[];
  usedLocationKeys: Set<string>;
  ignoreRecent: boolean;
  historyResetVotes: string[];
  loading: boolean;
  selectionIssue?: RoomState["selectionIssue"];
  selectionAbort?: AbortController;
  mode: Settings["mode"];
  assets: string[];
  results: RoundResult[];
  timer?: ReturnType<typeof setTimeout>;
  matchId: string;
  updatedAt: number;
  message?: string;
  persisted?: boolean;
};
type Options = {
  googleAvailable?: boolean;
  history?: LocationHistory;
  graceMs?: number;
  save?: (id: string, state: RoomState) => Promise<void>;
};

export class GameServer {
  readonly rooms = new Map<string, Room>();
  private readonly assets = new Map<
    string,
    { location: GameLocation; room: Room; requests: number }
  >();
  private readonly history: LocationHistory;
  private readonly members = new Map<string, { room: Room; player: Member }>();
  private cleanup: ReturnType<typeof setInterval>;
  constructor(
    private io: Server<ClientToServerEvents, ServerToClientEvents>,
    private provider: LocationProvider,
    private options: Options = {},
  ) {
    this.history = options.history ?? new MemoryLocationHistory();
    io.on("connection", (socket) => this.connect(socket));
    this.cleanup = setInterval(() => {
      for (const room of this.rooms.values())
        if (Date.now() - room.updatedAt > 2 * 60 * 60 * 1000)
          this.close(room, "ห้องหมดอายุ กรุณาสร้างห้องใหม่");
    }, 30_000);
    this.cleanup.unref();
  }
  imagePath(token: string) {
    return this.assets.get(token)?.location.image;
  }
  scene(token: string) {
    const asset = this.assets.get(token);
    if (!asset || asset.room.phase !== "playing" || asset.room.assets.at(-1) !== token) return undefined;
    if (asset.location.mode === "google" && ++asset.requests > 8)
      return undefined;
    return asset.location;
  }
  sceneFailed(token: string) {
    const asset = this.assets.get(token);
    if (
      !asset ||
      asset.room.phase !== "playing" ||
      asset.room.assets.at(-1) !== token ||
      asset.location.mode !== "google"
    )
      return;
    this.demoFallback(asset.room);
  }
  private demoFallback(room: Room) {
    this.reset(room);
    room.settings.mode = "demo";
    room.mode = "demo";
    room.message =
      "Google Maps/Street View ใช้งานไม่ได้ เปลี่ยนเป็น Demo Mode แล้ว ทุกคนกรุณากดพร้อมเพื่อเริ่มใหม่";
    this.broadcast(room);
  }
  dispose() {
    clearInterval(this.cleanup);
    for (const room of this.rooms.values())
      this.close(room, "เซิร์ฟเวอร์กำลังปิด");
  }
  private state(room: Room, viewer?: Member): RoomState {
    const current = room.locations.at(-1);
    return {
      code: room.code,
      teamScores: room.teamScores,
      teamHp: room.teamHp,
      winnerIds: room.winnerIds,
      supportedCapitals: capitals.length,
      hostId: room.hostId,
      players: room.players.map(
        ({ id, name, ready, connected, score, submitted, reconnectUntil, team, hp, eliminated, forfeited }) => ({
          team, hp, eliminated, forfeited,
          id,
          name,
          ready,
          connected,
          score,
          submitted,
          reconnectUntil,
        }),
      ),
      settings: room.settings,
      phase: room.phase,
      round: room.round,
      deadline: room.deadline,
      serverNow: Date.now(),
      image: room.assets.at(-1)
        ? `/api/scene/${room.assets.at(-1)}`
        : null,
      ownGuess: viewer?.guess ?? null,
      // Interactive Street View needs the current pano ID in the browser.
      // Never expose server keys, answer coordinates, or future rounds here.
      panorama: room.phase === "playing" && current?.mode === "google" && current.panoId
        ? { panoId: current.panoId, heading: current.heading ?? 0 }
        : undefined,
      results: room.results,
      message: room.message,
      persisted: room.persisted,
      mode: room.mode,
      googleAvailable: this.options.googleAvailable ?? false,
      loading: room.loading,
      selectionIssue: room.selectionIssue,
      historyResetVotes: room.historyResetVotes,
    };
  }
  private broadcast(
    room: Room,
    event: keyof ServerToClientEvents = "room:update",
  ) {
    room.updatedAt = Date.now();
    for (const member of room.players)
      if (member.socketId) {
        const socket = this.io.sockets.sockets.get(member.socketId);
        if (socket) {
          const state = this.state(room, member);
          socket.emit("room:update", state);
          if (event !== "room:update" && event !== "room:closed")
            socket.emit(event, state);
        }
      }
  }
  private identify(socket: GameSocket) {
    const member = this.members.get(socket.id);
    if (!member) throw new Error("กรุณาเข้าห้องก่อน");
    return member;
  }
  private host(socket: GameSocket) {
    const member = this.identify(socket);
    if (member.room.hostId !== member.player.id)
      throw new Error("เฉพาะเจ้าของห้องเท่านั้น");
    return member.room;
  }
  private attach(socket: GameSocket, room: Room, player: Member): Session {
    clearTimeout(player.expiry);
    if (player.socketId && player.socketId !== socket.id) {
      this.io.sockets.sockets
        .get(player.socketId)
        ?.emit("room:closed", "เซสชันนี้เปิดอยู่ในอีกหน้าต่างแล้ว");
      this.members.delete(player.socketId);
    }
    player.socketId = socket.id;
    player.connected = true;
    if (!room.players.find(p => p.id === room.hostId)?.connected) room.hostId = player.id;
    delete player.reconnectUntil;
    this.members.set(socket.id, { room, player });
    return { code: room.code, playerId: player.id, token: player.token };
  }
  private newPlayer(name: string): Member {
    return {
      id: randomUUID(),
      token: randomUUID(),
      name,
      ready: false,
      connected: true,
      socketId: null,
      score: 0,
      submitted: false,
      guess: null,
      team: 0, hp: 10000, eliminated: false, forfeited: false,
    };
  }
  private newCode() {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ",
      digits = "23456789";
    let code: string;
    do {
      code =
        Array.from(
          { length: 4 },
          () => letters[randomInt(letters.length)],
        ).join("") +
        "-" +
        Array.from({ length: 4 }, () => digits[randomInt(digits.length)]).join(
          "",
        );
    } while (this.rooms.has(code));
    return code;
  }
  private reset(room: Room) {
    room.players.filter(p => p.forfeited).forEach(p => clearTimeout(p.expiry));
    room.players = room.players.filter(p => !p.forfeited);
    room.teamScores = [0, 0];
    room.teamHp = [10000, 10000];
    room.winnerIds = undefined;
    room.selectionAbort?.abort();
    room.loading = false;
    room.selectionIssue = undefined;
    room.usedLocationKeys.clear();
    room.ignoreRecent = false;
    room.historyResetVotes = [];
    room.mode = room.settings.mode;
    clearTimeout(room.timer);
    for (const token of room.assets) this.assets.delete(token);
    room.phase = "lobby";
    room.round = 0;
    room.deadline = null;
    room.locations = [];
    room.assets = [];
    room.results = [];
    room.persisted = undefined;
    room.matchId = randomUUID();
    for (const p of room.players) {
      p.score = 0;
      p.guess = null;
      p.ready = false;
      p.submitted = false;
      p.hp = 10000;
      p.eliminated = false;
    }
  }
  private remove(room: Room, player: Member) {
    clearTimeout(player.expiry);
    if (player.socketId) this.members.delete(player.socketId);
    player.socketId = null;
    player.connected = false;
    player.forfeited = true;
    player.eliminated = true;
    player.submitted = true;
    player.guess = null;
    delete player.reconnectUntil;
    if (room.hostId === player.id) room.hostId = room.players.find(p => p.connected && !p.forfeited)?.id ?? room.players.find(p => !p.forfeited)?.id ?? "";
    if (!room.players.some(p => !p.forfeited)) return this.close(room, "ห้องว่าง");
    if (room.phase !== "lobby") {
      room.message = `${player.name} ออกจากการแข่งขันแล้ว ผู้เล่นที่เหลือเล่นต่อได้`;
      if (room.phase !== "finished" && this.contenders(room) <= 1) {
        room.selectionAbort?.abort(); room.loading = false;
        if (room.phase === "playing") this.reveal(room);
        this.finish(room);
      } else if (room.phase === "playing" && room.players.every(p => p.submitted || p.eliminated)) this.reveal(room);
      this.broadcast(room);
      return;
    }
    room.players = room.players.filter((p) => p.id !== player.id);
    if (!room.players.length) return this.close(room, "ห้องว่าง");
    if (room.hostId === player.id) room.hostId = room.players[0].id;
    if (room.loading) {
      this.reset(room);
      room.message = `${player.name} ออกจากห้อง กรุณากดพร้อมใหม่`;
    }
    this.broadcast(room);
  }
  private contenders(room: Room) {
    const alive = room.players.filter(p => !p.forfeited && !p.eliminated);
    return room.settings.format === "teams" ? new Set(alive.map(p => p.team)).size : alive.length;
  }
  private close(room: Room, reason: string) {
    room.selectionAbort?.abort();
    clearTimeout(room.timer);
    for (const player of room.players) {
      clearTimeout(player.expiry);
      if (player.socketId) {
        this.io.sockets.sockets
          .get(player.socketId)
          ?.emit("room:closed", reason);
        this.members.delete(player.socketId);
      }
    }
    for (const token of room.assets) this.assets.delete(token);
    this.rooms.delete(room.code);
  }
  private async startRound(room: Room) {
    if (room.loading) throw new Error("กำลังตรวจสอบสถานที่ กรุณารอสักครู่");
    const matchId = room.matchId;
    const abort = new AbortController();
    room.selectionAbort = abort;
    room.loading = true;
    room.selectionIssue = undefined;
    this.broadcast(room);
    try {
      const recent = room.ignoreRecent ? [] : await this.history.list();
      const location = await this.provider.getNextLocation({
        settings: { ...room.settings, mode: room.mode },
        usedLocationKeys: room.usedLocationKeys,
        usedPositions: (room.settings.victory === "hp" ? room.locations.filter(l => room.usedLocationKeys.has(l.key)).slice(-75) : room.locations).map((l) => ({ lat: l.lat, lng: l.lng })),
        recentCountries: room.locations.slice(-2).map(l => l.country),
        recentKeys: new Set(recent.map((entry) => entry.key)),
        remainingRounds: room.settings.victory === "hp" ? 1 : room.settings.rounds - room.round,
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(22_000)]),
      });
      if (
        abort.signal.aborted ||
        room.matchId !== matchId ||
        !this.rooms.has(room.code)
      )
        return;
      if (room.usedLocationKeys.has(location.key))
        throw new PoolExhaustedError(
          "pool",
          "ผู้ให้บริการส่งสถานที่ซ้ำ ระบบปฏิเสธเพื่อไม่ให้ใช้คำตอบเดิมในเกมเดียวกัน",
        );
      await this.history.record(location.key);
      if (
        abort.signal.aborted ||
        room.matchId !== matchId ||
        !this.rooms.has(room.code)
      )
        return;
      room.usedLocationKeys.add(location.key);
      room.locations.push(location);
      if (room.settings.victory === "hp") {
        room.locations = room.locations.slice(-75);
        while (room.usedLocationKeys.size > 500) room.usedLocationKeys.delete(room.usedLocationKeys.values().next().value!);
      }
      usage.roundsSelected++;
      if (room.mode === "google" && location.mode === "demo")
        room.message =
          "Google ใช้งานไม่ได้หรือไม่พบ Street View ในจำนวนครั้งที่กำหนด เกมนี้เปลี่ยนเป็น Demo Mode อัตโนมัติ";
      room.mode = location.mode;
      this.activateRound(room);
    } catch (error) {
      if (
        abort.signal.aborted ||
        room.matchId !== matchId ||
        !this.rooms.has(room.code)
      )
        return;
      room.selectionIssue =
        error instanceof PoolExhaustedError
          ? { kind: room.settings.victory === "hp" ? "history" : error.kind, message: error.message }
          : {
              kind: "provider",
              message:
                "เตรียมสถานที่หรือบันทึกประวัติไม่สำเร็จ ลองใหม่อีกครั้ง",
            };
      room.historyResetVotes = [];
      throw new Error(room.selectionIssue.message);
    } finally {
      if (
        !abort.signal.aborted &&
        room.matchId === matchId &&
        this.rooms.has(room.code)
      ) {
        room.loading = false;
        this.broadcast(room);
      }
    }
  }
  private activateRound(room: Room) {
    room.round++;
    room.phase = "playing";
    room.deadline = Date.now() + room.settings.seconds * 1000;
    for (const player of room.players) {
      player.guess = null;
      player.submitted = !!player.eliminated || !!player.forfeited;
    }
    // Publish only the current round's opaque asset, never the future sequence or coordinates.
    const token = randomUUID();
    room.assets.forEach(asset => this.assets.delete(asset));
    room.assets = [];
    room.assets.push(token);
    this.assets.set(token, {
      location: room.locations.at(-1)!,
      room,
      requests: 0,
    });
    room.timer = setTimeout(
      () => this.reveal(room),
      room.settings.seconds * 1000,
    );
    this.broadcast(room, "round:start");
  }
  private reveal(room: Room) {
    if (room.phase !== "playing") return;
    clearTimeout(room.timer);
    const location = room.locations.at(-1)!;
    const competitors = room.players.filter(p => !p.forfeited && !p.eliminated);
    const hpBefore = Object.fromEntries(room.players.map(p => [p.id, p.hp ?? 10000]));
    const guesses = room.players.map((player) => {
      const distance = player.guess && !player.eliminated && !player.forfeited ? haversine(player.guess, location) : null;
      const score = distance === null ? 0 : scoreDistance(distance);
      player.score += score;
      player.submitted = true;
      return { playerId: player.id, point: player.guess, distance, score };
    });
    const best = Math.max(...guesses.map((g) => g.score));
    const teamScores = [0, 1].map(team => Math.max(0, ...guesses.filter(g => room.players.find(p => p.id === g.playerId)?.team === team).map(g => g.score)));
    if (room.settings.format === "teams") teamScores.forEach((score, i) => room.teamScores[i] += score);
    const multiplier = room.round >= 9 ? 3 : room.round >= 5 ? 2 : 1;
    const damage: Record<string, number> = {};
    if (room.settings.victory === "hp") {
      if (room.settings.format === "teams") {
        teamScores.forEach((score, team) => {
          const hit = (5000 - score) * multiplier;
          damage[`team-${team}`] = hit;
          room.teamHp[team] = Math.max(0, room.teamHp[team] - hit);
          room.players.filter(p => p.team === team).forEach(p => {
            p.hp = room.teamHp[team];
            if (p.hp === 0) p.eliminated = true;
          });
        });
      } else room.players.forEach(p => {
        if (p.eliminated || p.forfeited) return;
        const hit = (5000 - (guesses.find(g => g.playerId === p.id)?.score ?? 0)) * multiplier;
        damage[p.id] = hit;
        p.hp = Math.max(0, (p.hp ?? 10000) - hit);
        if (p.hp === 0) p.eliminated = true;
      });
    }
    room.results.push({
      round: room.round,
      location: {
        id: location.id,
        name: location.name,
        country: location.country,
        category: location.category,
        difficulty: location.difficulty,
        lat: location.lat,
        lng: location.lng,
        description: location.description,
        source: location.source,
        credit: location.credit,
        mode: location.mode,
        image: `/api/scene/${room.assets.at(-1)}`,
      },
      guesses,
      multiplier, damage, teamScores, hpBefore,
      winnerIds: room.settings.format === "teams"
        ? competitors.filter(p => teamScores[p.team ?? 0] === Math.max(...teamScores)).map(p => p.id)
        : guesses.filter(g => g.score === best && competitors.some(p => p.id === g.playerId)).map(g => g.playerId),
    });
    room.phase = "reveal";
    if (room.settings.victory === "hp") room.results = room.results.slice(-200);
    room.deadline = null;
    this.broadcast(room, "round:reveal");
  }
  private finish(room: Room) {
    if (room.phase === "finished") return;
    clearTimeout(room.timer);
    room.deadline = null;
    const eligible = room.players.filter(p => !p.forfeited);
    const active = eligible.filter(p => !p.eliminated);
    const rank = (p: Member) => room.settings.victory === "hp" && active.length ? (p.hp ?? 0) : room.settings.format === "teams" ? room.teamScores[p.team ?? 0] : p.score;
    const pool = this.contenders(room) <= 1 && active.length ? active : eligible;
    const best = Math.max(...pool.map(rank));
    room.winnerIds = pool.filter(p => rank(p) === best).map(p => p.id);
    room.phase = "finished";
    this.broadcast(room, "game:finish");
    const matchId = room.matchId;
    this.options
      .save?.(matchId, this.state(room))
      .then(() => {
        if (room.matchId === matchId) {
          room.persisted = true;
          this.broadcast(room);
        }
      })
      .catch(() => {
        console.error("Could not persist match");
        if (room.matchId === matchId) {
          room.persisted = false;
          room.message = "แสดงผลการแข่งขันได้ แต่บันทึกลงฐานข้อมูลไม่สำเร็จ";
          this.broadcast(room);
        }
      });
  }
  private connect(socket: GameSocket) {
    let reportedLoads = 0;
    let actions = 0,
      windowStart = Date.now();
    const run = async (
      ack: Ack,
      action: () => Session | void | Promise<Session | void>,
    ) => {
      if (typeof ack !== "function") return;
      try {
        if (Date.now() - windowStart > 10_000) {
          actions = 0;
          windowStart = Date.now();
        }
        if (++actions > 40) throw new Error("ส่งคำขอเร็วเกินไป กรุณารอสักครู่");
        const session = await action();
        ack({ ok: true, ...(session ? { session } : {}) });
      } catch (error) {
        ack({
          ok: false,
          error:
            error instanceof z.ZodError
              ? error.issues[0].message
              : error instanceof Error
                ? error.message
                : "เกิดข้อผิดพลาด กรุณาลองใหม่",
        });
      }
    };
    socket.on("usage:load", (data, ack) => run(ack, () => {
      const { room } = this.identify(socket);
      if (room.mode !== "google" || ++reportedLoads > 2000) return;
      const kind = z.enum(["map", "panorama"]).parse(data?.kind);
      if (kind === "map") usage.mapLoadsReported++;
      else usage.panoramaLoadsReported++;
    }));
    socket.on("player:team", (data, ack) => run(ack, () => {
      const { room, player } = this.identify(socket);
      if (room.phase !== "lobby" || room.loading || room.settings.format !== "teams") throw new Error("เลือกทีมได้ก่อนเริ่มเกม 2v2");
      const team = z.union([z.literal(0), z.literal(1)]).parse(data?.team);
      if (data.playerId && room.hostId !== player.id) throw new Error("เฉพาะเจ้าของห้องจัดทีมให้คนอื่นได้");
      const target = data.playerId ? room.players.find(p => p.id === data.playerId) : player;
      if (!target) throw new Error("ไม่พบผู้เล่น");
      if (target.team === team) return;
      target.team = team;
      room.players.forEach(p => p.ready = false);
      this.broadcast(room);
    }));
    socket.on("room:kick", (data, ack) => run(ack, () => {
      const room = this.host(socket);
      if (room.phase !== "lobby" || room.loading) throw new Error("นำผู้เล่นออกได้ในห้องรอก่อนเริ่มเกม");
      const id = z.uuid().parse(data?.playerId);
      if (id === room.hostId) throw new Error("ใช้ปุ่มออกจากห้องเพื่อออกเอง");
      const target = room.players.find(p => p.id === id);
      if (!target) throw new Error("ไม่พบผู้เล่น");
      if (target.socketId) this.io.sockets.sockets.get(target.socketId)?.emit("room:closed", "เจ้าของห้องนำคุณออก สามารถเข้าร่วมใหม่ด้วยรหัสเดิมได้");
      this.remove(room, target);
      room.players.forEach(p => p.ready = false);
      this.broadcast(room);
    }));
    socket.on("room:create", (data, ack) =>
      run(ack, () => {
        if (this.members.has(socket.id)) throw new Error("คุณอยู่ในห้องแล้ว");
        if (this.rooms.size >= 300)
          throw new Error("เซิร์ฟเวอร์เต็ม กรุณาลองใหม่ภายหลัง");
        const name = nameSchema.parse(data?.name);
        const player = this.newPlayer(name),
          code = this.newCode();
        const room: Room = {
          teamScores: [0, 0], teamHp: [10000, 10000],
          code,
          hostId: player.id,
          players: [player],
          settings: { ...DEFAULT_SETTINGS },
          phase: "lobby",
          round: 0,
          deadline: null,
          locations: [],
          usedLocationKeys: new Set(),
          ignoreRecent: false,
          historyResetVotes: [],
          loading: false,
          mode: "demo",
          assets: [],
          results: [],
          matchId: randomUUID(),
          updatedAt: Date.now(),
        };
        this.rooms.set(code, room);
        const session = this.attach(socket, room, player);
        this.broadcast(room);
        return session;
      }),
    );
    socket.on("room:join", (data, ack) =>
      run(ack, () => {
        if (this.members.has(socket.id)) throw new Error("คุณอยู่ในห้องแล้ว");
        const name = nameSchema.parse(data?.name),
          code = roomCodeSchema.parse(data?.code),
          room = this.rooms.get(code);
        if (!room) throw new Error("ไม่พบห้องนี้ ตรวจสอบรหัสอีกครั้ง");
        if (room.players.length >= room.settings.capacity)
          throw new Error("ห้องนี้มีผู้เล่นครบแล้ว");
        if (room.phase !== "lobby" || room.loading) throw new Error("เกมเริ่มไปแล้ว กรุณารอเกมถัดไป");
        const player = this.newPlayer(name);
        player.team = room.players.filter(p => p.team === 0).length <= room.players.filter(p => p.team === 1).length ? 0 : 1;
        room.players.push(player);
        room.message = undefined;
        const session = this.attach(socket, room, player);
        this.broadcast(room);
        return session;
      }),
    );
    socket.on("player:reconnect", (data, ack) =>
      run(ack, () => {
        const session = z
          .object({ code: roomCodeSchema, playerId: z.uuid(), token: z.uuid() })
          .parse(data);
        const room = this.rooms.get(session.code),
          player = room?.players.find(
            (p) => p.id === session.playerId && p.token === session.token,
          );
        if (
          !room ||
          !player ||
          player.forfeited ||
          (player.reconnectUntil && Date.now() >= player.reconnectUntil)
        )
          throw new Error("เซสชันหมดอายุหรือห้องถูกปิดแล้ว");
        const previous = this.members.get(socket.id);
        if (previous && previous.player.id !== player.id)
          throw new Error("กรุณาออกจากห้องเดิมก่อน");
        const result = this.attach(socket, room, player);
        this.broadcast(room);
        return result;
      }),
    );
    socket.on("room:settings", (data, ack) =>
      run(ack, () => {
        const room = this.host(socket);
        if (room.phase !== "lobby" || room.loading)
          throw new Error("เปลี่ยนการตั้งค่าระหว่างเกมไม่ได้");
        const settings = settingsSchema.parse(data);
        if (settings.format === "teams") settings.capacity = 4;
        if (settings.capacity < room.players.length) throw new Error("ความจุต้องไม่น้อยกว่าผู้เล่นในห้อง");
        room.settings = settings;
        room.mode = room.settings.mode;
        room.selectionIssue = undefined;
        room.ignoreRecent = false;
        room.historyResetVotes = [];
        room.message =
          room.mode === "google" && !this.options.googleAvailable
            ? "ยังไม่ได้ตั้ง Google keys ที่จำเป็น หากเริ่มตอนนี้จะใช้ Demo Mode อัตโนมัติ หรือเลือก Demo Mode ได้เลย"
            : undefined;
        room.players.forEach((p) => {
          p.ready = false;
        });
        this.broadcast(room);
      }),
    );
    socket.on("player:ready", (data, ack) =>
      run(ack, () => {
        const { room, player } = this.identify(socket);
        if (room.phase !== "lobby" || room.loading)
          throw new Error("เกมเริ่มไปแล้วหรือกำลังเตรียมสถานที่");
        player.ready = z.boolean().parse(data?.ready);
        this.broadcast(room);
      }),
    );
    socket.on("game:start", (ack) =>
      run(ack, async () => {
        const room = this.host(socket);
        if (
          room.phase !== "lobby" ||
          room.players.length < 2 ||
          (room.settings.format === "teams" && (room.players.length !== 4 || [0, 1].some(t => room.players.filter(p => p.team === t).length !== 2))) ||
          !room.players.every((p) => p.ready && p.connected)
        )
          throw new Error("ต้องมีผู้เล่นพร้อมอย่างน้อย 2 คน หรือครบทีมละ 2 คนสำหรับ 2v2");
        await this.startRound(room);
      }),
    );
    socket.on("guess:submit", (data, ack) =>
      run(ack, () => {
        const { room, player } = this.identify(socket);
        if (room.phase !== "playing" || data?.round !== room.round)
          throw new Error("รอบนี้ปิดรับคำตอบแล้ว");
        if (room.deadline !== null && Date.now() >= room.deadline) {
          this.reveal(room);
          throw new Error("หมดเวลาแล้ว");
        }
        if (player.submitted || player.eliminated || player.forfeited)
          throw new Error("ยืนยันคำตอบไปแล้ว ไม่สามารถแก้ไขได้");
        player.guess = pointSchema.parse(data);
        player.submitted = true;
        if (room.players.every((p) => p.submitted)) this.reveal(room);
        else this.broadcast(room);
      }),
    );
    socket.on("round:next", (ack) =>
      run(ack, async () => {
        const room = this.host(socket);
        if (room.phase !== "reveal") throw new Error("ยังไม่ถึงช่วงเปลี่ยนรอบ");
        if (this.contenders(room) <= 1 || (room.settings.victory === "points" && room.round >= room.settings.rounds)) this.finish(room);
        else await this.startRound(room);
      }),
    );
    socket.on("game:rematch", (ack) =>
      run(ack, () => {
        const room = this.host(socket);
        if (room.phase !== "finished") throw new Error("เกมยังไม่จบ");
        this.reset(room);
        room.message = undefined;
        this.broadcast(room);
      }),
    );
    socket.on("room:history-reset", (ack) =>
      run(ack, () => {
        const { room, player } = this.identify(socket);
        if (
          room.loading ||
          room.selectionIssue?.kind !== "history" ||
          !player.connected || player.forfeited || player.eliminated
        )
          throw new Error(
            "ยืนยันได้เมื่อสถานที่ไม่พอ และคุณยังอยู่ในการแข่งขัน",
          );
        if (!room.historyResetVotes.includes(player.id))
          room.historyResetVotes.push(player.id);
        if (room.players.filter(p => p.connected && !p.forfeited && !p.eliminated).every(p => room.historyResetVotes.includes(p.id))) {
          room.ignoreRecent = true;
          if (room.settings.victory === "hp") room.usedLocationKeys.clear();
          room.selectionIssue = undefined;
          room.message = room.settings.victory === "hp"
            ? "ผู้เล่นที่ยังแข่งขันและออนไลน์ยืนยันแล้ว: อนุญาตวนชุดโจทย์เพื่อเล่น HP ต่อ กดรอบถัดไป"
            : "ทุกคนที่ออนไลน์ยืนยันแล้ว: อนุญาตโจทย์จากเกมก่อน แต่ยังห้ามซ้ำในเกมนี้ กดเริ่มหรือรอบถัดไป";
        }
        this.broadcast(room);
      }),
    );
    socket.on("room:demo-fallback", (ack) =>
      run(ack, () => {
        const { room } = this.identify(socket);
        if (room.mode !== "google" && room.settings.mode !== "google")
          throw new Error("ห้องนี้ใช้ Demo Mode อยู่แล้ว");
        this.demoFallback(room);
      }),
    );
    socket.on("room:leave", (ack) =>
      run(ack, () => {
        const { room, player } = this.identify(socket);
        this.remove(room, player);
      }),
    );
    socket.on("disconnect", () => {
      const entry = this.members.get(socket.id);
      if (!entry) return;
      this.members.delete(socket.id);
      const { room, player } = entry;
      player.connected = false;
      player.socketId = null;
      if (room.hostId === player.id) room.hostId = room.players.find(p => p.connected && !p.forfeited)?.id ?? player.id;
      if (room.phase === "lobby" && room.loading) this.reset(room);
      player.reconnectUntil = Date.now() + (this.options.graceMs ?? 60_000);
      player.expiry = setTimeout(
        () => this.remove(room, player),
        this.options.graceMs ?? 60_000,
      );
      this.broadcast(room);
    });
  }
}
