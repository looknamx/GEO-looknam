import { PrismaClient } from "@prisma/client";
import type { RoomState } from "../types/game";
import type { LocationHistory } from "./location-history";
export const prisma = new PrismaClient();
export async function saveMatch(id: string, state: RoomState) {
  await prisma.match.upsert({
    where: { id },
    update: {},
    create: {
      id,
      roomCode: state.code,
      settings: JSON.stringify({ ...state.settings, outcome: {
        roundsPlayed: state.round, winnerIds: state.winnerIds,
        teamScores: state.teamScores, teamHp: state.teamHp,
      } }),
      players: JSON.stringify(state.players),
      // Persist scores, not Google imagery/coordinates/attribution content.
      results: JSON.stringify(persistableResults(state)),
    },
  });
}
export function persistableResults(state: RoomState) {
  return state.results.map((result) =>
    result.location.mode === "google"
      ? {
          round: result.round,
          guesses: result.guesses,
          winnerIds: result.winnerIds,
          teamScores: result.teamScores,
          damage: result.damage,
          hpBefore: result.hpBefore,
          multiplier: result.multiplier,
          location: {
            mode: "google",
            id: result.location.id,
            name: result.location.name,
            country: result.location.country,
          },
        }
      : result,
  );
}
export class DatabaseLocationHistory implements LocationHistory {
  private queue: Promise<void> = Promise.resolve();
  constructor(private limit = 75) {}
  async list() {
    await this.queue;
    const rows = await prisma.recentLocation.findMany({
      orderBy: { usedAt: "desc" },
      take: this.limit,
    });
    return rows.map((row) => ({
      key: row.key,
      timestamp: row.usedAt.getTime(),
    }));
  }
  record(key: string) {
    const task = this.queue.then(() =>
      prisma.$transaction(async (tx) => {
        await tx.recentLocation.upsert({
          where: { key },
          create: { key },
          update: { usedAt: new Date() },
        });
        const keep = await tx.recentLocation.findMany({
          orderBy: { usedAt: "desc" },
          take: this.limit,
          select: { key: true },
        });
        await tx.recentLocation.deleteMany({
          where: { key: { notIn: keep.map((row) => row.key) } },
        });
      }),
    );
    this.queue = task.catch(() => {});
    return task;
  }
}
