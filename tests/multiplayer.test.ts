import { createServer, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "socket.io";
import { io as client, type Socket } from "socket.io-client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GameServer } from "../server/game-server";
import type {
  Ack,
  ClientToServerEvents,
  Location,
  Reply,
  RoomState,
  ServerToClientEvents,
  Session,
} from "../types/game";
import { DEFAULT_SETTINGS } from "../lib/game";
import {
  PoolExhaustedError,
  type LocationProvider,
  type GameLocation,
} from "../services/locations";
type Client = Socket<ServerToClientEvents, ClientToServerEvents>;
const location: Location = {
  id: "private-answer",
  name: "Secret place",
  country: "Thailand",
  category: "landmark",
  difficulty: "easy",
  image: "data/images/001.jpg",
  lat: 13.7437,
  lng: 100.4889,
  description: "Secret description",
  source: "https://example.com",
  credit: "Test",
};
const command = (send: (ack: Ack) => void) =>
  new Promise<Reply>((resolve) => send(resolve));
const sessionOf = (reply: Reply): Session => {
  if (!reply.ok || !reply.session) throw new Error(JSON.stringify(reply));
  return reply.session;
};
describe("authoritative two-player Socket.IO flow", () => {
  let http: HttpServer,
    io: Server<ClientToServerEvents, ServerToClientEvents>,
    game: GameServer,
    url: string;
  let clients: Client[], states: Map<Client, RoomState>;
  const save = vi.fn(async () => {});
  let provider: LocationProvider;
  async function connect() {
    const socket: Client = client(url, {
      transports: ["websocket"],
      autoConnect: false,
      reconnection: false,
      forceNew: true,
    });
    socket.on("room:update", (state) => states.set(socket, state));
    clients.push(socket);
    await new Promise<void>((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
      socket.connect();
    });
    return socket;
  }
  beforeEach(async () => {
    clients = [];
    states = new Map();
    save.mockClear();
    http = createServer();
    io = new Server(http);
    provider = {
      getNextLocation: async ({ usedLocationKeys }) => ({
        ...location,
        mode: "demo",
        key: `demo:test-${usedLocationKeys.size}`,
      }),
    };
    game = new GameServer(io, provider, { graceMs: 100, save });
    await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
    url = `http://127.0.0.1:${(http.address() as AddressInfo).port}`;
  });
  afterEach(async () => {
    clients.forEach((c) => c.disconnect());
    game.dispose();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });
  async function lobby() {
    const a = await connect(),
      b = await connect();
    const sa = sessionOf(
      await command((ack) =>
        a.emit("room:create", { name: "นักสำรวจ A" }, ack),
      ),
    );
    const sb = sessionOf(
      await command((ack) =>
        b.emit("room:join", { name: "นักสำรวจ B", code: sa.code }, ack),
      ),
    );
    return { a, b, sa, sb };
  }
  async function start(a: Client, b: Client) {
    expect(
      (
        await command((ack) =>
          a.emit("room:settings", { ...DEFAULT_SETTINGS, rounds: 3 }, ack),
        )
      ).ok,
    ).toBe(true);
    await command((ack) => a.emit("player:ready", { ready: true }, ack));
    await command((ack) => b.emit("player:ready", { ready: true }, ack));
    expect((await command((ack) => a.emit("game:start", ack))).ok).toBe(true);
    await vi.waitFor(() => expect(states.get(b)?.phase).toBe("playing"));
  }
  it("requires both history votes without clearing current-match exclusions", async () => {
    const { a, b, sa } = await lobby();
    await start(a, b);
    await command((ack) =>
      a.emit("guess:submit", { lat: 0, lng: 0, round: 1 }, ack),
    );
    await command((ack) =>
      b.emit("guess:submit", { lat: 0, lng: 0, round: 1 }, ack),
    );
    provider.getNextLocation = async ({ usedLocationKeys, recentKeys }) => {
      expect(usedLocationKeys.has("demo:test-0")).toBe(true);
      if (recentKeys.size)
        throw new PoolExhaustedError("history", "Both players must confirm");
      return { ...location, mode: "demo", key: "demo:next" };
    };
    expect((await command((ack) => a.emit("round:next", ack))).ok).toBe(false);
    await command((ack) => a.emit("room:history-reset", ack));
    expect(game.rooms.get(sa.code)!.ignoreRecent).toBe(false);
    await command((ack) => a.emit("room:history-reset", ack));
    expect(game.rooms.get(sa.code)!.historyResetVotes).toHaveLength(1);
    await command((ack) => b.emit("room:history-reset", ack));
    expect(game.rooms.get(sa.code)!.ignoreRecent).toBe(true);
    expect((await command((ack) => a.emit("round:next", ack))).ok).toBe(true);
    expect(game.rooms.get(sa.code)!.usedLocationKeys.size).toBe(2);
  });
  it("rejects duplicate locations even from a defective provider", async () => {
    provider.getNextLocation = async () => ({
      ...location,
      mode: "demo",
      key: "same",
    });
    const { a, b } = await lobby();
    await start(a, b);
    await command((ack) =>
      a.emit("guess:submit", { lat: 0, lng: 0, round: 1 }, ack),
    );
    await command((ack) =>
      b.emit("guess:submit", { lat: 0, lng: 0, round: 1 }, ack),
    );
    expect((await command((ack) => a.emit("round:next", ack))).ok).toBe(false);
    expect(states.get(a)?.round).toBe(1);
    expect(states.get(a)?.selectionIssue?.kind).toBe("pool");
  });
  it("shares only the current interactive panorama and synchronizes failure to both players", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "server-secret-sentinel");
    provider.getNextLocation = async () => ({
      ...location,
      mode: "google",
      key: "google:private-pano",
      panoId: "private-pano",
    });
    const { a, b } = await lobby();
    await start(a, b);
    const state = states.get(a)!;
    expect(JSON.stringify(state)).not.toMatch(
      /13\.7437|private-answer|server-secret-sentinel/,
    );
    expect(state.panorama).toEqual({ panoId: "private-pano", heading: 0 });
    expect(states.get(b)?.panorama).toEqual(state.panorama);
    game.sceneFailed(state.image!.split("/").at(-1)!);
    await vi.waitFor(() => expect(states.get(b)?.mode).toBe("demo"));
    expect(states.get(b)?.phase).toBe("lobby");
    expect(states.get(b)?.panorama).toBeUndefined();
    expect(states.get(b)?.players.every((p) => !p.ready && p.score === 0)).toBe(
      true,
    );
    expect(game.scene(state.image!.split("/").at(-1)!)).toBeUndefined();
  });
  it("scores the original Google location and removes panorama data after reveal", async () => {
    provider.getNextLocation = async () => ({
      ...location, mode: "google", key: "google:start", panoId: "start-pano", heading: 70,
    });
    const { a, b } = await lobby();
    await start(a, b);
    expect(states.get(a)?.panorama).toEqual({ panoId: "start-pano", heading: 70 });
    await command(ack => a.emit("guess:submit", { lat: location.lat, lng: location.lng, round: 1 }, ack));
    await command(ack => b.emit("guess:submit", { lat: 0, lng: 0, round: 1 }, ack));
    await vi.waitFor(() => expect(states.get(a)?.phase).toBe("reveal"));
    expect(states.get(a)?.panorama).toBeUndefined();
    expect(states.get(a)?.results[0].guesses[0].score).toBe(5000);
  });
  it("does not activate a pending selection after a player leaves", async () => {
    let resolve!: (value: GameLocation) => void;
    provider.getNextLocation = () =>
      new Promise((done) => {
        resolve = done;
      });
    const { a, b, sa } = await lobby();
    await command((ack) => a.emit("player:ready", { ready: true }, ack));
    await command((ack) => b.emit("player:ready", { ready: true }, ack));
    const pending = command((ack) => a.emit("game:start", ack));
    await vi.waitFor(() => expect(game.rooms.get(sa.code)?.loading).toBe(true));
    expect((await command((ack) => a.emit("game:start", ack))).ok).toBe(false);
    await command((ack) => b.emit("room:leave", ack));
    resolve({ ...location, mode: "demo", key: "late" });
    await pending;
    expect(game.rooms.get(sa.code)?.phase).toBe("lobby");
    expect(game.rooms.get(sa.code)?.round).toBe(0);
    expect(game.rooms.get(sa.code)?.usedLocationKeys.size).toBe(0);
  });
  it("completes three rounds, persists, and rematches without leaking answers", async () => {
    const { a, b, sa } = await lobby();
    expect((await command((ack) => a.emit("game:start", ack))).ok).toBe(false);
    expect(
      (await command((ack) => b.emit("room:settings", DEFAULT_SETTINGS, ack)))
        .ok,
    ).toBe(false);
    const third = await connect();
    expect(
      (
        await command((ack) =>
          third.emit("room:join", { name: "Third", code: sa.code }, ack),
        )
      ).ok,
    ).toBe(false);
    await start(a, b);
    for (let round = 1; round <= 3; round++) {
      const state = states.get(a)!;
      expect(state.round).toBe(round);
      expect(state.results).toHaveLength(round - 1);
      if (round === 1) {
        const json = JSON.stringify(state);
        expect(json).not.toContain("Secret");
        expect(json).not.toContain("13.7437");
        expect(json).not.toContain("private-answer");
        expect(json).not.toContain("token");
      }
      expect(game.imagePath(state.image!.split("/").at(-1)!)).toBe(
        location.image,
      );
      expect(
        (
          await command((ack) =>
            a.emit("guess:submit", { lat: 99, lng: 0, round }, ack),
          )
        ).ok,
      ).toBe(false);
      expect(
        (
          await command((ack) =>
            a.emit(
              "guess:submit",
              { lat: location.lat, lng: location.lng, round },
              ack,
            ),
          )
        ).ok,
      ).toBe(true);
      await vi.waitFor(() =>
        expect(states.get(b)?.players[0].submitted).toBe(true),
      );
      expect(states.get(b)?.ownGuess).toBeNull();
      expect(states.get(b)?.results).toHaveLength(round - 1);
      expect(
        (
          await command((ack) =>
            a.emit("guess:submit", { lat: 0, lng: 0, round }, ack),
          )
        ).ok,
      ).toBe(false);
      expect(
        (
          await command((ack) =>
            b.emit("guess:submit", { lat: 0, lng: 0, round }, ack),
          )
        ).ok,
      ).toBe(true);
      await vi.waitFor(() => expect(states.get(a)?.phase).toBe("reveal"));
      expect(states.get(a)?.players[0].score).toBe(5000 * round);
      expect((await command((ack) => b.emit("round:next", ack))).ok).toBe(
        false,
      );
      expect((await command((ack) => a.emit("round:next", ack))).ok).toBe(true);
      expect(game.scene(state.image!.split("/").at(-1)!)).toBeUndefined();
    }
    await vi.waitFor(() => expect(states.get(a)?.persisted).toBe(true));
    expect(states.get(a)?.phase).toBe("finished");
    expect(save).toHaveBeenCalledTimes(1);
    expect((await command((ack) => a.emit("game:rematch", ack))).ok).toBe(true);
    expect(states.get(a)?.phase).toBe("lobby");
    expect(states.get(a)?.players.every((p) => p.score === 0 && !p.ready)).toBe(
      true,
    );
  });
  it("resumes the same player with a private token and transfers host after expiry", async () => {
    const { a, b, sa, sb } = await lobby();
    const stranger = await connect();
    expect(
      (
        await command((ack) =>
          stranger.emit("player:reconnect", { ...sb, token: sa.token }, ack),
        )
      ).ok,
    ).toBe(false);
    b.disconnect();
    await vi.waitFor(
      () => expect(states.get(a)?.players[1].connected).toBe(false),
      { interval: 5 },
    );
    const replacement = await connect();
    expect(
      (await command((ack) => replacement.emit("player:reconnect", sb, ack)))
        .ok,
    ).toBe(true);
    expect(states.get(replacement)?.players[1].id).toBe(sb.playerId);
    a.disconnect();
    await vi.waitFor(
      () => expect(states.get(replacement)?.hostId).toBe(sb.playerId),
      { interval: 10 },
    );
    expect(states.get(replacement)?.players).toHaveLength(1);
  });
  it("enforces the server deadline, awards zero for missing guesses, and reveals once", async () => {
    const { a, b, sa } = await lobby();
    await start(a, b);
    const room = game.rooms.get(sa.code)!;
    // Move only the authoritative deadline; this tests late packets without wall-clock sleeps.
    room.deadline = Date.now() - 1;
    expect(
      (
        await command((ack) =>
          a.emit("guess:submit", { lat: 0, lng: 0, round: 1 }, ack),
        )
      ).ok,
    ).toBe(false);
    expect(states.get(a)?.phase).toBe("reveal");
    expect(
      states
        .get(a)
        ?.results[0].guesses.every((g) => g.score === 0 && g.point === null),
    ).toBe(true);
    expect(
      (
        await command((ack) =>
          b.emit("guess:submit", { lat: 0, lng: 0, round: 1 }, ack),
        )
      ).ok,
    ).toBe(false);
    expect(states.get(a)?.results).toHaveLength(1);
  });
  it("automatically reveals when no player sends anything", async () => {
    const { a, b, sa } = await lobby();
    await command((ack) => a.emit("player:ready", { ready: true }, ack));
    await command((ack) => b.emit("player:ready", { ready: true }, ack));
    // Accelerate the internal room clock while still exercising the actual scheduled timeout.
    game.rooms.get(sa.code)!.settings.seconds = 0.04 as 30;
    await command((ack) => a.emit("game:start", ack));
    await vi.waitFor(() => expect(states.get(a)?.phase).toBe("reveal"), {
      interval: 10,
    });
    expect(states.get(a)?.results[0].guesses.every((g) => g.score === 0)).toBe(
      true,
    );
  });
  it("keeps submitted guesses on reconnect and cancels a game on explicit departure", async () => {
    const { a, b, sb } = await lobby();
    await start(a, b);
    await command((ack) =>
      b.emit("guess:submit", { lat: 20, lng: 30, round: 1 }, ack),
    );
    b.disconnect();
    const replacement = await connect();
    expect(
      (await command((ack) => replacement.emit("player:reconnect", sb, ack)))
        .ok,
    ).toBe(true);
    expect(states.get(replacement)?.ownGuess).toEqual({ lat: 20, lng: 30 });
    expect(
      (
        await command((ack) =>
          replacement.emit("guess:submit", { lat: 0, lng: 0, round: 1 }, ack),
        )
      ).ok,
    ).toBe(false);
    await command((ack) => replacement.emit("room:leave", ack));
    await vi.waitFor(() => expect(states.get(a)?.phase).toBe("lobby"));
    expect(states.get(a)?.message).toContain("ยกเลิก");
    expect(states.get(a)?.players).toHaveLength(1);
  });
});
