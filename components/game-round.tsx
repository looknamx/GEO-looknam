"use client";
import { useState } from "react";
import dynamic from "next/dynamic";
import { Check, Expand, MapPin, ScanLine } from "lucide-react";
import { useGame } from "@/hooks/use-game";
import { Button } from "./ui/button";
import { CountdownTimer } from "./countdown-timer";
import { ScoreBoard } from "./score-board";
import { pointSchema } from "@/lib/game";
import type { Point } from "@/types/game";
import { sceneUrl } from "@/lib/client-urls";
const StreetView = dynamic(() => import("./google-street-view"), { ssr: false });
export const LazyMap = dynamic(() => import("./adaptive-game-map"), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <div className="loading-orbit" />
      กำลังเปิดแผนที่…
    </div>
  ),
});
export function GameRound() {
  const { room, playerId, connected, pending, request, clockOffset } =
    useGame();
  const [point, setPoint] = useState<Point | null>(null);
  const [lat, setLat] = useState(""),
    [lng, setLng] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [coordinateError, setCoordinateError] = useState("");
  if (!room || !room.deadline) return null;
  const self = room.players.find((p) => p.id === playerId),
    locked = !!self?.submitted || !!self?.eliminated || !!self?.forfeited || !connected;
  const selected = room.ownGuess || point;
  const pick = (value: Point) => {
    setPoint(value);
    setLat(value.lat.toFixed(5));
    setLng(value.lng.toFixed(5));
    setCoordinateError("");
  };
  return (
    <section className="game-page">
      <CountdownTimer key={`mobile:${room.deadline}`} compact deadline={room.deadline} clockOffset={clockOffset} initial={room.settings.seconds} />
      <div className="game-heading">
        <div>
          <div className="eyebrow">TRUST YOUR INSTINCT</div>
          <h1>ที่นี่… ที่ไหน?</h1>
        </div>
        <div className="round-progress">
          <span>
            รอบ <b>{room.round}</b> / {room.settings.victory === "hp" ? "∞" : room.settings.rounds}
          </span>
          <div>
            {Array.from({ length: room.settings.victory === "hp" ? 0 : room.settings.rounds }, (_, i) => (
              <i key={i} className={i < room.round ? "active" : ""} />
            ))}
          </div>
        </div>
        <CountdownTimer
          deadline={room.deadline}
          clockOffset={clockOffset}
          initial={room.settings.seconds}
        />
      </div>
      <ScoreBoard players={room.players} selfId={playerId} teams={room.settings.format === "teams"} hp={room.settings.victory === "hp"} />
      <div className="match-status" role="status">ตอบแล้ว {room.players.filter(p => !p.eliminated && !p.forfeited && p.submitted).length}/{room.players.filter(p => !p.eliminated && !p.forfeited).length} คน
        {room.settings.victory === "hp" && <span> · ความเสียหาย ×{room.round >= 9 ? 3 : room.round >= 5 ? 2 : 1}</span>}
        {self?.eliminated && <span> · คุณเป็นผู้ชมจนจบเกม</span>}
        {room.settings.format === "teams" && <p>ทีม A {room.settings.victory === "hp" ? `HP ${room.teamHp?.[0]}` : room.teamScores?.[0]} · ทีม B {room.settings.victory === "hp" ? `HP ${room.teamHp?.[1]}` : room.teamScores?.[1]}</p>}
      </div>
      <div className={`round-layout ${expanded ? "photo-expanded" : ""}`}>
        <div className="scene panel">
          <div className="scene-header">
            <span>
              <ScanLine size={16} /> สังเกตทุกเบาะแสในภาพ
            </span>
            <Button
              size="icon"
              variant="ghost"
              aria-label={expanded ? "ย่อภาพ" : "ขยายภาพ"}
              aria-pressed={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              <Expand size={18} />
            </Button>
          </div>
          <div className="scene-image">
            {room.mode === "google" && room.panorama ? (
              <StreetView key={`${room.round}:${room.panorama.panoId}`} {...room.panorama} movement={room.settings.movement} />
            ) : imageError ? (
              <div className="map-loading">
                <p>โหลดภาพไม่สำเร็จ</p>
                <Button
                  variant="secondary"
                  onClick={() => setImageError(false)}
                >
                  ลองโหลดอีกครั้ง
                </Button>
              </div>
            ) : (
              <img
                src={sceneUrl(room.image)}
                alt="ภาพปริศนาของรอบนี้ สังเกตภูมิประเทศและสิ่งปลูกสร้างเพื่อทายตำแหน่ง"
                onError={() => setImageError(true)}
              />
            )}
          </div>
          <div className="scene-footer">
            <span className="live-dot" /> {room.mode === "google" ? room.settings.movement === "walk" ? "ลากเพื่อหมุน · กดลูกศรเพื่อเดิน · ทายจุดเริ่มต้น" : room.settings.movement === "no-move" ? "หมุนและซูมได้ · ห้ามเดิน" : "มุมมองคงที่ · ห้ามเดิน หมุน และซูม" : "คุณและเพื่อนกำลังเห็นภาพเดียวกัน"}{" "}
            <span
              className={
                room.mode === "google" ? "google-attribution" : undefined
              }
              translate="no"
            >
              {room.mode === "google" ? "Google Maps" : "DEMO LOCATION"}
            </span>
          </div>
        </div>
        <div className="map-panel panel">
          <div className="scene-header">
            <span>
              <MapPin size={16} /> ปักหมุดคำตอบของคุณ
            </span>
            <span className="muted">คลิกเพื่อเลือก · เลื่อนเพื่อซูม</span>
          </div>
          <LazyMap point={selected} onPick={pick} locked={locked} />
          <div className="guess-controls">
            <div className="selected-coordinates">
              <MapPin size={18} />
              <span>
                {selected
                  ? `${selected.lat.toFixed(4)}°, ${selected.lng.toFixed(4)}°`
                  : "ยังไม่ได้เลือกตำแหน่ง"}
                <small>
                  {locked && self?.submitted
                    ? "ล็อกคำตอบแล้ว รอเฉลยพร้อมกัน"
                    : "เปลี่ยนหมุดได้จนกว่าจะกดยืนยัน"}
                </small>
              </span>
            </div>
            <details>
              <summary>หรือกรอกพิกัดด้วยคีย์บอร์ด</summary>
              <form
                className="coordinate-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  const parsed = pointSchema.safeParse({
                    lat: lat.trim() ? Number(lat) : NaN,
                    lng: lng.trim() ? Number(lng) : NaN,
                  });
                  if (parsed.success) pick(parsed.data);
                  else
                    setCoordinateError(
                      "ละติจูด −85 ถึง 85 และลองจิจูด −180 ถึง 180",
                    );
                }}
              >
                <label>
                  ละติจูด
                  <input
                    type="number"
                    step="any"
                    min={-85}
                    max={85}
                    value={lat}
                    disabled={locked}
                    onChange={(e) => setLat(e.target.value)}
                    required
                  />
                </label>
                <label>
                  ลองจิจูด
                  <input
                    type="number"
                    step="any"
                    min={-180}
                    max={180}
                    value={lng}
                    disabled={locked}
                    onChange={(e) => setLng(e.target.value)}
                    required
                  />
                </label>
                <Button type="submit" variant="secondary" disabled={locked}>
                  วางหมุด
                </Button>
              </form>
              {coordinateError && (
                <p className="error-text" role="alert">
                  {coordinateError}
                </p>
              )}
            </details>
            <Button
              className="w-full"
              disabled={!selected || locked || pending}
              onClick={() =>
                selected &&
                void request((socket, ack) =>
                  socket.emit(
                    "guess:submit",
                    { ...selected, round: room.round },
                    ack,
                  ),
                )
              }
            >
              <Check size={18} />
              {self?.submitted ? "ยืนยันคำตอบแล้ว" : "ยืนยันคำตอบ"}
            </Button>
          </div>
        </div>
      </div>
      <p className="game-tip">
        ดูให้ดี: รูปแบบอาคาร ภูเขา และพืชพรรณ อาจพาคุณเข้าใกล้คำตอบ
      </p>
    </section>
  );
}
