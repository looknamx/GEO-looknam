import "dotenv/config";
import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { GameServer } from "./game-server";
import {
  DemoLocationProvider,
  FallbackLocationProvider,
} from "../services/locations";
import { GoogleLocationProvider } from "../services/google-locations";
import { MemoryLocationHistory } from "../services/location-history";
import {
  DatabaseLocationHistory,
  prisma,
  saveMatch,
} from "../services/database";
import { loadScene } from "../services/scenes";
import { allowedOrigins, isOriginAllowed } from "./origin-policy";
import type { ClientToServerEvents, ServerToClientEvents } from "../types/game";

async function main() {
  const dev = process.env.NODE_ENV !== "production";
  const port = Number(process.env.PORT || 3000);
  // Docker/Railway sets HOSTNAME to the container ID; never bind to that value.
  const hostname =
    process.env.BIND_HOST ||
    (dev ? process.env.HOSTNAME : undefined) ||
    "0.0.0.0";
  const origins = allowedOrigins(
    process.env.CLIENT_ORIGIN || process.env.ALLOWED_ORIGINS || "",
    !dev,
  );
  const app = next({ dev, hostname, port });
  await app.prepare();
  const handler = app.getRequestHandler();
  const configured = Boolean(
    process.env.GOOGLE_MAPS_SERVER_KEY?.trim() &&
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY?.trim(),
  );
  const google = new GoogleLocationProvider({
    serverKey: process.env.GOOGLE_MAPS_SERVER_KEY?.trim(),
    signingSecret: process.env.GOOGLE_MAPS_SIGNING_SECRET?.trim(),
    maxAttempts: Math.min(
      12,
      Math.max(1, Number(process.env.GOOGLE_MAX_ATTEMPTS) || 8),
    ),
    minDistanceKm: Math.max(
      0.1,
      Number(process.env.GOOGLE_MIN_DISTANCE_KM) || 1,
    ),
  });
  const historyLimit = Math.min(
    100,
    Math.max(1, Number(process.env.LOCATION_HISTORY_LIMIT) || 75),
  );
  const history =
    process.env.LOCATION_HISTORY_STORAGE === "database"
      ? new DatabaseLocationHistory(historyLimit)
      : new MemoryLocationHistory(historyLimit);
  let stopping = false;
  const requests = new Set<AbortController>();
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url || "/", "http://internal.invalid")
        .pathname;
      if (stopping) {
        res.writeHead(503);
        res.end("Shutting down");
        return;
      }
      if (pathname === "/health" || pathname === "/api/health") {
        await prisma.$queryRaw`SELECT 1`;
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        res.end(JSON.stringify({ ok: true }));
        return;
      }
      if (pathname.startsWith("/api/scene/")) {
        res.setHeader("Cache-Control", "private, no-store, max-age=0");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Referrer-Policy", "no-referrer");
        if (req.method !== "GET") {
          res.writeHead(405);
          res.end();
          return;
        }
        const token = pathname.slice("/api/scene/".length);
        const location = game.scene(token);
        if (!location) {
          res.writeHead(404);
          res.end("Scene unavailable");
          return;
        }
        const abort = new AbortController();
        requests.add(abort);
        res.once("close", () => {
          if (!res.writableEnded) abort.abort();
        });
        try {
          const scene =
            location.mode === "google"
              ? await google.loadImage(location, abort.signal)
              : await loadScene(location.image);
          if (!res.destroyed) {
            res.setHeader("Content-Type", scene.contentType);
            res.end(scene.bytes);
          }
        } catch {
          if (!abort.signal.aborted && location.mode === "google")
            game.sceneFailed(token);
          if (!res.destroyed) {
            res.writeHead(502);
            res.end("Scene unavailable");
          }
        } finally {
          requests.delete(abort);
        }
        return;
      }
      await handler(req, res);
    } catch {
      // Do not log upstream errors or URLs: they can contain server credentials.
      if (!res.headersSent) res.writeHead(503);
      if (!res.destroyed) res.end("Service unavailable");
    }
  });
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(server, {
    maxHttpBufferSize: 16_384,
    cors: { origin: origins.length ? origins : true, methods: ["GET", "POST"] },
    allowRequest: (req, callback) =>
      callback(
        null,
        !stopping &&
          isOriginAllowed(req.headers.origin, req.headers.host, origins, !dev),
      ),
  });
  const saves = new Set<Promise<void>>();
  const game = new GameServer(
    io,
    new FallbackLocationProvider(
      google,
      new DemoLocationProvider(),
      configured,
    ),
    {
      googleAvailable: configured,
      history,
      graceMs:
        Math.max(1, Number(process.env.RECONNECT_GRACE_SECONDS) || 60) * 1000,
      save: (id, state) => {
        const task = saveMatch(id, state);
        saves.add(task);
        void task.then(
          () => saves.delete(task),
          () => saves.delete(task),
        );
        return task;
      },
    },
  );
  await prisma.$connect();
  server.listen(port, hostname, () =>
    console.log(
      `Where Are We? · ${dev ? "development" : "production"} · listening ${hostname}:${port}${dev ? `\nLocal: http://localhost:${port}` : ""}`,
    ),
  );
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(1), 10_000);
    timeout.unref();
    game.dispose();
    requests.forEach((controller) => controller.abort());
    await new Promise<void>((resolve) => io.close(() => resolve()));
    server.closeIdleConnections();
    await Promise.allSettled([...saves]);
    await prisma.$disconnect();
    await app.close();
    clearTimeout(timeout);
    process.exit(0);
  };
  process.once("SIGTERM", () => void stop());
  process.once("SIGINT", () => void stop());
}
main().catch(() => {
  console.error(
    "Server startup failed. Check runtime configuration and database migrations.",
  );
  process.exit(1);
});
