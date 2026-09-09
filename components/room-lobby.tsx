"use client";
import { useState } from "react";
import { ArrowRight, Check, Copy, Settings2, Users } from "lucide-react";
import { useGame } from "@/hooks/use-game";
import { Button } from "@/components/ui/button";
import { PlayerCard } from "./player-card";
import { th } from "@/lib/i18n";
import type { Settings } from "@/types/game";
export function RoomLobby() {
  const { room, playerId, request, connected, pending } = useGame();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  if (!room) return null;
  const isHost = room.hostId === playerId,
    self = room.players.find((p) => p.id === playerId);
  const ready =
    room.players.length === 2 &&
    room.players.every((p) => p.ready && p.connected);
  const change = (key: keyof Settings, value: string) => {
    const settings = {
      ...room.settings,
      [key]: key === "rounds" || key === "seconds" ? Number(value) : value,
    };
    void request((socket, ack) => socket.emit("room:settings", settings, ack));
  };
  return (
    <section className="room-page">
      <div className="page-heading">
        <div className="eyebrow">THE ADVENTURE STARTS HERE</div>
        <h1>รวมพลนักสำรวจ</h1>
        <p>เตรียมตัวให้พร้อม โลกกำลังรอคุณอยู่</p>
      </div>
      <div className="lobby-grid">
        <div className="panel lobby-players">
          <div className="card-heading">
            <h2>
              <Users size={20} /> เพื่อนร่วมทาง
            </h2>
            <span className="pill">{room.players.length} / 2 คน</span>
          </div>
          <PlayerCard
            player={room.players[0]}
            index={0}
            hostId={room.hostId}
            selfId={playerId}
          />
          <PlayerCard
            player={room.players[1]}
            index={1}
            hostId={room.hostId}
            selfId={playerId}
          />
          <div className="invite-box">
            <span>ส่งรหัสนี้ให้เพื่อน</span>
            <div>
              <strong className="room-code">{room.code}</strong>
              <Button
                variant="secondary"
                size="icon"
                aria-label="คัดลอกรหัสห้อง"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(room.code);
                    setCopied(true);
                    setCopyError(false);
                    setTimeout(() => setCopied(false), 2500);
                  } catch {
                    setCopyError(true);
                  }
                }}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </Button>
            </div>
            <small>
              {copied
                ? "คัดลอกแล้ว ส่งให้เพื่อนได้เลย"
                : copyError
                  ? "คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกรหัสด้านบนแล้วคัดลอก"
                  : "ให้เพื่อนเปิดเว็บเดียวกัน แล้วเลือก “เข้าร่วมห้อง”"}
            </small>
          </div>
          <Button
            className="w-full"
            variant={self?.ready ? "secondary" : "default"}
            disabled={!connected || pending || !self}
            onClick={() =>
              void request((socket, ack) =>
                socket.emit("player:ready", { ready: !self?.ready }, ack),
              )
            }
          >
            <Check size={18} />
            {self?.ready ? "พร้อมแล้ว · ยกเลิกความพร้อม" : "ฉันพร้อมออกเดินทาง"}
          </Button>
        </div>
        <div className="panel lobby-settings">
          <div className="card-heading">
            <h2>
              <Settings2 size={20} /> ตั้งค่าการเดินทาง
            </h2>
            <span className="muted">
              {isHost ? "คุณเป็นเจ้าของห้อง" : "เจ้าของห้องเป็นผู้ตั้งค่า"}
            </span>
          </div>
          <div className="settings-grid">
            <label className="mode-setting">
              โหมดสถานที่
              <select
                value={room.settings.mode}
                onChange={(e) => change("mode", e.target.value)}
                disabled={!isHost || pending || !connected || room.loading}
              >
                <option value="demo">Demo Mode · ภาพในโปรเจกต์</option>
                <option value="google">Google Mode · Street View จริง</option>
              </select>
              <small>
                {room.googleAvailable
                  ? "พบการตั้งค่า Google · ตรวจสอบ API เมื่อเริ่มรอบ"
                  : "Google ยังไม่พร้อมตั้งค่า · ใช้ Demo ได้โดยไม่ต้องมี key"}
              </small>
            </label>
            <label>
              จำนวนรอบ
              <select
                value={room.settings.rounds}
                onChange={(e) => change("rounds", e.target.value)}
                disabled={!isHost || pending || !connected}
              >
                {[3, 5, 10].map((n) => (
                  <option key={n} value={n}>
                    {n} รอบ
                  </option>
                ))}
              </select>
            </label>
            <label>
              เวลาต่อรอบ
              <select
                value={room.settings.seconds}
                onChange={(e) => change("seconds", e.target.value)}
                disabled={!isHost || pending || !connected}
              >
                {[30, 60, 90].map((n) => (
                  <option key={n} value={n}>
                    {n} วินาที
                  </option>
                ))}
              </select>
            </label>
            <label>
              ความยาก
              <select
                value={room.settings.difficulty}
                onChange={(e) => change("difficulty", e.target.value)}
                disabled={!isHost || pending || !connected}
              >
                {Object.entries(th.difficulties).map(([key, value]) => (
                  <option value={key} key={key}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <label>
              จุดหมาย
              <select
                value={room.settings.category}
                onChange={(e) => change("category", e.target.value)}
                disabled={!isHost || pending || !connected}
              >
                {Object.entries(th.categories).map(([key, value]) => (
                  <option value={key} key={key}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="info-box">
            มองภาพเดียวกัน ปักหมุดคนละจุด
            <br />
            คะแนนสูงสุด 5,000 ต่อรอบ · เฉลยพร้อมกัน
            <br />
            <small>
              สถานที่ไม่ซ้ำภายในเกม · กรองหมวดและความยากตรงตามที่เลือก
              หากชุดสถานที่ไม่พอ ระบบจะแจ้งให้ลดรอบหรือเปลี่ยนตัวกรอง
            </small>
          </div>
          <Button
            className="w-full"
            disabled={
              !isHost || !ready || !connected || pending || room.loading
            }
            onClick={() =>
              void request((socket, ack) => socket.emit("game:start", ack))
            }
          >
            เริ่มการเดินทาง
            <ArrowRight size={18} />
          </Button>
          <p className="form-note">
            {!isHost
              ? "รอเจ้าของห้องเริ่มเกม"
              : ready
                ? "ทุกคนพร้อมแล้ว ออกเดินทางกันเลย!"
                : "ผู้เล่นทั้ง 2 คนต้องกดพร้อมก่อนเริ่มเกม"}
          </p>
        </div>
      </div>
    </section>
  );
}
