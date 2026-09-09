import { randomInt, randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import { z } from "zod";
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
      "Google Maps/Street View ใช้งานไม่ได้ เปลี่ยนเป็น Demo Mode แล้ว เกมนี้ถูกยกเลิกเพื่อให้ทั้งสองคนเริ่มใหม่อย่างเท่าเทียม กรุณากดพร้อมอีกครั้ง";
    this.broadcast(room);
  }
  dispose() {
    clearInterval(this.cleanup);
    for (const room of this.rooms.values())
      this.close(room, "เซิร์ฟเวอร์กำลังปิด");
  }
  private state(room: Room, viewer?: Member): RoomState {
    return {
      code: room.code,
      hostId: room.hostId,
      players: room.players.map(
        ({ id, name, ready, connected, score, submitted, reconnectUntil }) => ({
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
      image: room.assets[room.round - 1]
        ? `/api/scene/${room.assets[room.round - 1]}`
        : null,
      ownGuess: viewer?.guess ?? null,
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
    }
  }
  private remove(room: Room, player: Member) {
    clearTimeout(player.expiry);
    if (player.socketId) this.members.delete(player.socketId);
    room.players = room.players.filter((p) => p.id !== player.id);
    if (!room.players.length) return this.close(room, "ห้องว่าง");
    if (room.hostId === player.id) room.hostId = room.players[0].id;
    if (room.phase !== "lobby" || room.loading) {
      const completed = room.phase === "finished";
      this.reset(room);
      room.message = completed
        ? `${player.name} ออกจากห้องหลังจบเกมแล้ว ชวนเพื่อนเข้าร่วมการเดินทางครั้งใหม่ได้เลย`
        : `${player.name} ออกจากเกมแล้ว การแข่งขันถูกยกเลิก รอเพื่อนเข้าร่วมใหม่`;
    }
    this.broadcast(room);
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
        usedPositions: room.locations.map((l) => ({ lat: l.lat, lng: l.lng })),
        recentKeys: new Set(recent.map((entry) => entry.key)),
        remainingRounds: room.settings.rounds - room.round,
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
          ? { kind: error.kind, message: error.message }
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
      player.submitted = false;
    }
    // Publish only the current round's opaque asset, never the future sequence or coordinates.
    const token = randomUUID();
    room.assets.push(token);
    this.assets.set(token, {
      location: room.locations[room.round - 1],
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
    const location = room.locations[room.round - 1];
    const guesses = room.players.map((player) => {
      const distance = player.guess ? haversine(player.guess, location) : null;
      const score = distance === null ? 0 : scoreDistance(distance);
      player.score += score;
      player.submitted = true;
      return { playerId: player.id, point: player.guess, distance, score };
    });
    const best = Math.max(...guesses.map((g) => g.score));
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
        image: `/api/scene/${room.assets[room.round - 1]}`,
      },
      guesses,
      winnerIds: guesses.filter((g) => g.score === best).map((g) => g.playerId),
    });
    room.phase = "reveal";
    room.deadline = null;
    this.broadcast(room, "round:reveal");
  }
  private finish(room: Room) {
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
      .catch((error) => {
        console.error("Could not persist match:", error);
        if (room.matchId === matchId) {
          room.persisted = false;
          room.message = "แสดงผลการแข่งขันได้ แต่บันทึกลงฐานข้อมูลไม่สำเร็จ";
          this.broadcast(room);
        }
      });
  }
  private connect(socket: GameSocket) {
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
    socket.on("room:create", (data, ack) =>
      run(ack, () => {
        if (this.members.has(socket.id)) throw new Error("คุณอยู่ในห้องแล้ว");
        if (this.rooms.size >= 300)
          throw new Error("เซิร์ฟเวอร์เต็ม กรุณาลองใหม่ภายหลัง");
        const name = nameSchema.parse(data?.name);
        const player = this.newPlayer(name),
          code = this.newCode();
        const room: Room = {
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
        if (room.players.length >= 2)
          throw new Error("ห้องนี้มีผู้เล่นครบ 2 คนแล้ว");
        if (room.phase !== "lobby") throw new Error("เกมเริ่มไปแล้ว");
        const player = this.newPlayer(name);
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
        room.settings = settingsSchema.parse(data);
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
          room.players.length !== 2 ||
          !room.players.every((p) => p.ready && p.connected)
        )
          throw new Error("ต้องมีผู้เล่น 2 คนที่เชื่อมต่อและพร้อมเล่น");
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
        if (player.submitted)
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
        if (!room.players.every((p) => p.connected))
          throw new Error("รอเพื่อนเชื่อมต่อกลับมาก่อน");
        if (room.round >= room.settings.rounds) this.finish(room);
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
          room.players.length !== 2 ||
          !room.players.every((p) => p.connected)
        )
          throw new Error(
            "ยืนยันได้เมื่อประวัติเกมล่าสุดทำให้สถานที่ไม่พอ และผู้เล่นทั้งสองเชื่อมต่ออยู่",
          );
        if (!room.historyResetVotes.includes(player.id))
          room.historyResetVotes.push(player.id);
        if (room.historyResetVotes.length === 2) {
          room.ignoreRecent = true;
          room.selectionIssue = undefined;
          room.message =
            "ทั้งสองคนยืนยันแล้ว: เกมนี้อนุญาตสถานที่จากเกมก่อน แต่ยังห้ามซ้ำภายในเกมนี้ ให้เจ้าของห้องกดเริ่มหรือรอบถัดไปอีกครั้ง";
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
      player.reconnectUntil = Date.now() + (this.options.graceMs ?? 60_000);
      player.expiry = setTimeout(
        () => this.remove(room, player),
        this.options.graceMs ?? 60_000,
      );
      this.broadcast(room);
    });
  }
}
