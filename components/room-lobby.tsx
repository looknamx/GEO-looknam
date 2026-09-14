"use client";
import { useState } from "react";
import { ArrowRight, Check, Copy, Settings2, Users } from "lucide-react";
import { useGame } from "@/hooks/use-game";
import { Button } from "@/components/ui/button";
import { PlayerCard } from "./player-card";
import { RoomQr } from "./room-qr";
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
    room.players.length >= 2 &&
    (room.settings.format !== "teams" || (room.players.length === 4 && [0, 1].every(t => room.players.filter(p => p.team === t).length === 2))) &&
    room.players.every((p) => p.ready && p.connected);
  const change = (key: keyof Settings, value: string) => {
    const settings = {
      ...room.settings,
      [key]: ["rounds", "seconds", "capacity"].includes(key) ? Number(value) : value,
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
            <span className="pill">{room.players.length} / {room.settings.capacity} คน</span>
          </div>
          {Array.from({ length: room.settings.capacity }, (_, index) => <div key={index}>
            <PlayerCard player={room.players[index]} index={index} hostId={room.hostId} selfId={playerId}
              teamControl={room.settings.format === "teams" && room.players[index] ? room.players[index].id === playerId ? <select className="inline-team" aria-label="ทีมของคุณ" value={self?.team ?? 0} disabled={pending || !connected || room.loading} onChange={e => void request((socket, ack) => socket.emit("player:team", { team: Number(e.target.value) }, ack))}><option value={0}>ทีม A</option><option value={1}>ทีม B</option></select> : <span className="team-label">ทีม {room.players[index].team === 0 ? "A" : "B"} </span> : null}
              kickControl={isHost && room.players[index] && room.players[index].id !== playerId ? <Button size="sm" variant="ghost" disabled={pending || !connected || room.loading} onClick={() => {
                const target = room.players[index];
                if (window.confirm(`นำ ${target.name} ออกจากห้อง? ผู้เล่นสามารถเข้ากลับด้วยรหัสเดิมได้`)) void request((socket, ack) => socket.emit("room:kick", { playerId: target.id }, ack));
              }}>นำออก</Button> : null}
            />
          </div>)}
          {room.settings.format === "teams" && <p className="form-note">ทีม A {room.players.filter(p => p.team === 0).length} คน / ทีม B {room.players.filter(p => p.team === 1).length} คน · เริ่มได้เมื่อครบทีมละ 2 คน</p>}
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
          <RoomQr code={room.code} />
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
            <label>รูปแบบ<select value={room.settings.format} disabled={!isHost || pending || !connected || room.loading} onChange={e => change("format", e.target.value)}><option value="solo">แข่งเดี่ยว 2–4 คน</option><option value="teams">ทีม 2 vs 2</option></select></label>
            <label>ความจุห้อง<select value={room.settings.capacity} disabled={!isHost || pending || !connected || room.loading || room.settings.format === "teams"} onChange={e => change("capacity", e.target.value)}>{[2,3,4].map(n => <option key={n} value={n} disabled={n < room.players.length}>{n} คน</option>)}</select></label>
            <label>การตัดสิน<select value={room.settings.victory} disabled={!isHost || pending || !connected || room.loading} onChange={e => change("victory", e.target.value)}><option value="points">คะแนนรวมตามจำนวนรอบ</option><option value="hp">HP เอาตัวรอด · ไม่จำกัดรอบ</option></select></label>
            <label>การสำรวจ<select value={room.settings.movement} disabled={!isHost || pending || !connected || room.loading} onChange={e => change("movement", e.target.value)}><option value="walk">เดินและหมุนได้</option><option value="no-move">ห้ามเดิน · หมุนและซูมได้</option><option value="fixed">ห้ามเดิน หมุน และซูม</option></select></label>
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
                disabled={!isHost || pending || !connected || room.settings.victory === "hp"}
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
            <p>เมืองหลวงในชุดสุ่ม {room.supportedCapitals ?? 51} แห่ง · ลดประเทศซ้ำใน 2 รอบล่าสุดเมื่อมีตัวเลือก</p>
            <p>{room.settings.format === "teams" ? "ทีมใช้คะแนนสูงสุดของสมาชิกในแต่ละรอบ" : "ผู้เล่นแต่ละคนส่งคำตอบของตัวเอง"}</p>
            {room.settings.victory === "hp" && <p>HP 10,000 · เสียพลัง (5,000 − คะแนนรอบนี้) × ตัวคูณ แม้ได้ใกล้สุด · รอบ 5 ×2 / รอบ 9 ×3 · HP หมดดูเกมต่อได้ · หากหมดพร้อมกันตัดสินด้วยคะแนนสะสม</p>}
            <p>ห้ามซ้ำภายในเกมคะแนน / ตรวจประวัติล่าสุดตามที่ตั้งไว้ · โหมดสำรวจมีผลกับ Google Street View</p>
            {room.settings.mode === "google" && ["world", "city", "thailand"].includes(room.settings.category) && <p>สุ่มรอบเมืองหลวง · ง่าย 5 กม. / ปกติ 12 กม. / ยาก 25 กม. · ประเทศไทยสุ่มรอบกรุงเทพฯ</p>}
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
                : "ผู้เล่นทุกคนต้องกดพร้อม · เดี่ยวอย่างน้อย 2 คน / ทีมครบ 2v2"}
          </p>
        </div>
      </div>
    </section>
  );
}
