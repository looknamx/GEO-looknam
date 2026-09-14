import type { z } from "zod";
import type { settingsSchema } from "../lib/game";
export type Settings = z.infer<typeof settingsSchema>;
export type Point = { lat: number; lng: number };
export type Location = Point & {
  mode?: "demo" | "google";
  id: string;
  name: string;
  country: string;
  category: "city" | "nature" | "landmark";
  difficulty: "easy" | "normal" | "hard";
  image: string;
  description: string;
  source: string;
  credit: string;
};
export type Player = {
  team?: number;
  hp?: number;
  eliminated?: boolean;
  forfeited?: boolean;
  id: string;
  name: string;
  ready: boolean;
  connected: boolean;
  score: number;
  submitted: boolean;
  reconnectUntil?: number;
};
export type RoundResult = {
  hpBefore?: Record<string, number>;
  multiplier?: number;
  damage?: Record<string, number>;
  teamScores?: number[];
  round: number;
  location: Location;
  guesses: {
    playerId: string;
    point: Point | null;
    distance: number | null;
    score: number;
  }[];
  winnerIds: string[];
};
export type RoomState = {
  teamScores?: number[];
  teamHp?: number[];
  winnerIds?: string[];
  supportedCapitals?: number;
  code: string;
  hostId: string;
  players: Player[];
  settings: Settings;
  phase: "lobby" | "playing" | "reveal" | "finished";
  round: number;
  deadline: number | null;
  serverNow: number;
  image: string | null;
  panorama?: { panoId: string; heading: number };
  ownGuess: Point | null;
  results: RoundResult[];
  message?: string;
  persisted?: boolean;
  mode: "demo" | "google";
  googleAvailable: boolean;
  loading: boolean;
  selectionIssue?: { kind: "history" | "pool" | "provider"; message: string };
  historyResetVotes: string[];
};
export type Session = { code: string; playerId: string; token: string };
export type Reply =
  | { ok: true; session?: Session }
  | { ok: false; error: string };
export type Ack = (response: Reply) => void;
export interface ClientToServerEvents {
  "room:kick": (data: { playerId: string }, ack: Ack) => void;
  "player:team": (data: { team: number; playerId?: string }, ack: Ack) => void;
  "usage:load": (data: { kind: "map" | "panorama" }, ack: Ack) => void;
  "room:create": (data: { name: string }, ack: Ack) => void;
  "room:join": (data: { name: string; code: string }, ack: Ack) => void;
  "room:settings": (data: Settings, ack: Ack) => void;
  "room:leave": (ack: Ack) => void;
  "player:ready": (data: { ready: boolean }, ack: Ack) => void;
  "player:reconnect": (data: Session, ack: Ack) => void;
  "game:start": (ack: Ack) => void;
  "round:next": (ack: Ack) => void;
  "guess:submit": (data: Point & { round: number }, ack: Ack) => void;
  "game:rematch": (ack: Ack) => void;
  "room:history-reset": (ack: Ack) => void;
  "room:demo-fallback": (ack: Ack) => void;
}
export interface ServerToClientEvents {
  "room:update": (state: RoomState) => void;
  "round:start": (state: RoomState) => void;
  "round:reveal": (state: RoomState) => void;
  "game:finish": (state: RoomState) => void;
  "room:closed": (reason: string) => void;
}
