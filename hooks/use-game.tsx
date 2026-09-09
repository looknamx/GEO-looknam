"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, type Socket } from "socket.io-client";
import type {
  Ack,
  ClientToServerEvents,
  RoomState,
  ServerToClientEvents,
  Session,
} from "@/types/game";
type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
type GameContextValue = {
  socket: GameSocket | null;
  room: RoomState | null;
  playerId: string | null;
  connected: boolean;
  pending: boolean;
  error: string;
  clockOffset: number;
  clearError: () => void;
  request: (send: (socket: GameSocket, ack: Ack) => void) => Promise<boolean>;
  leave: () => Promise<void>;
};
const GameContext = createContext<GameContextValue | null>(null);
const SESSION_KEY = "where-are-we-session";
export function GameProvider({ children }: { children: React.ReactNode }) {
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [clockOffset, setClockOffset] = useState(0);
  const session = useRef<Session | null>(null);
  const busy = useRef(false);
  useEffect(() => {
    const client: GameSocket = io(process.env.NEXT_PUBLIC_SOCKET_URL || undefined, { autoConnect: false });
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      session.current = saved ? (JSON.parse(saved) as Session) : null;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
    client.on("connect", () => {
      setSocket(client);
      setConnected(true);
      setError("");
      if (session.current)
        client.emit("player:reconnect", session.current, (response) => {
          if (!response.ok) {
            session.current = null;
            sessionStorage.removeItem(SESSION_KEY);
            setRoom(null);
            setPlayerId(null);
            setError(response.error);
          } else if (response.session) setPlayerId(response.session.playerId);
        });
    });
    client.on("disconnect", () => setConnected(false));
    client.on("connect_error", () => {
      setConnected(false);
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กำลังลองเชื่อมต่ออีกครั้ง…");
    });
    client.on("room:update", (state) => {
      setRoom(state);
      setClockOffset(state.serverNow - Date.now());
    });
    client.on("room:closed", (message) => {
      session.current = null;
      sessionStorage.removeItem(SESSION_KEY);
      setRoom(null);
      setPlayerId(null);
      setError(message);
    });
    client.connect();
    return () => {
      client.removeAllListeners();
      client.disconnect();
    };
  }, []);
  const request = useCallback(
    async (send: (socket: GameSocket, ack: Ack) => void) => {
      if (!socket?.connected) {
        setError("ยังไม่ได้เชื่อมต่อเซิร์ฟเวอร์");
        return false;
      }
      if (busy.current) return false;
      busy.current = true;
      setPending(true);
      setError("");
      return new Promise<boolean>((resolve) => {
        let settled = false;
        const finish = (success: boolean) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          busy.current = false;
          setPending(false);
          resolve(success);
        };
        const timeout = setTimeout(() => {
          setError("เซิร์ฟเวอร์ไม่ตอบกลับ กรุณาตรวจสอบการเชื่อมต่อ");
          finish(false);
      }, 30_000);
        send(socket, (response) => {
          if (settled) return;
          if (!response.ok) {
            setError(response.error);
            finish(false);
            return;
          }
          if (response.session) {
            session.current = response.session;
            sessionStorage.setItem(
              SESSION_KEY,
              JSON.stringify(response.session),
            );
            setPlayerId(response.session.playerId);
          }
          finish(true);
        });
      });
    },
    [socket],
  );
  const leave = useCallback(async () => {
    if (await request((client, ack) => client.emit("room:leave", ack))) {
      session.current = null;
      sessionStorage.removeItem(SESSION_KEY);
      setRoom(null);
      setPlayerId(null);
    }
  }, [request]);
  return (
    <GameContext.Provider
      value={{
        socket,
        room,
        playerId,
        connected,
        pending,
        error,
        clockOffset,
        request,
        leave,
        clearError: () => setError(""),
      }}
    >
      {children}
    </GameContext.Provider>
  );
}
export function useGame() {
  const context = useContext(GameContext);
  if (!context) throw new Error("GameProvider is missing");
  return context;
}
