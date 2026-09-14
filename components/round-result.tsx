"use client";
import { ArrowRight, MapPin, Trophy } from "lucide-react";
import { useGame } from "@/hooks/use-game";
import { Button } from "./ui/button";
import { HpBar } from "./hp-bar";
import { LazyMap } from "./game-round";
import type { RoundResult as Result } from "@/types/game";
export function RoundResultMap({
  result,
  playerNames,
}: {
  result: Result;
  playerNames: string[];
}) {
  return (
    <div className="result-map panel">
      <LazyMap result={result} playerNames={playerNames} />
    </div>
  );
}
export function RoundResult() {
  const { room, playerId, request, pending, connected } = useGame();
  if (!room) return null;
  const result = room.results.at(-1);
  if (!result) return null;
  const winners = room.players.filter((p) => result.winnerIds.includes(p.id));
  return (
    <section className="room-page">
      <div className="page-heading">
        <div className="eyebrow">
          ROUND {room.round} / {room.settings.victory === "hp" ? "∞" : room.settings.rounds} · THE REVEAL
        </div>
        <h1>เฉลย: {result.location.name}</h1>
        <p>
          <MapPin size={16} />
          {result.location.country} · {result.location.description}
        </p>
      </div>
      <div className="result-grid">
        <RoundResultMap
          result={result}
          playerNames={room.players.map((p) => p.name)}
        />
        <div className="result-detail">
          {room.settings.format === "teams" && <div className="info-box">รอบนี้ ทีม A +{result.teamScores?.[0] ?? 0} / ทีม B +{result.teamScores?.[1] ?? 0}<br />สะสม A {room.teamScores?.[0]} / B {room.teamScores?.[1]}{room.settings.victory === "hp" && <p>HP A {room.teamHp?.[0]} / B {room.teamHp?.[1]}</p>}</div>}
          {room.settings.victory === "hp" && <div className="info-box">ความเสียหาย ×{result.multiplier}<br />{room.players.map(p => <p key={p.id}>{p.name}: HP {p.hp} (−{result.damage?.[room.settings.format === "teams" ? `team-${p.team}` : p.id] ?? 0}){p.eliminated ? " · ตกรอบ" : ""}</p>)}</div>}
          <div className="round-winner">
            <Trophy size={28} />
            <div>
              <small>
                {winners.length > 1 ? "เสมอกันในรอบนี้" : "ผู้ชนะรอบนี้"}
              </small>
              <h2>{winners.map((p) => p.name).join(" & ")}</h2>
            </div>
          </div>
          {result.guesses.map((guess, index) => (
            <div
              key={guess.playerId}
              className={`panel result-score ${result.winnerIds.includes(guess.playerId) ? "winner" : ""}`}
            >
              <div>
                <span className={`avatar avatar-${index}`}>
                  {Array.from(room.players[index].name)[0]}
                </span>
                <strong>
                  {room.players[index].name}
                  {guess.playerId === playerId ? " (คุณ)" : ""}
                </strong>
              </div>
              <h3>
                +{guess.score.toLocaleString()} <small>คะแนน</small>
              </h3>
              <p>
                {guess.distance === null
                  ? "ไม่ได้ส่งคำตอบ · 0 คะแนน"
                  : `ห่างจากคำตอบ ${guess.distance.toLocaleString("th-TH", { maximumFractionDigits: 1 })} กม.`}
              </p>
              <span className="muted">
                สะสม {room.players[index].score.toLocaleString()} คะแนน
              </span>
              {room.settings.victory === "hp" && <HpBar key={room.round} value={room.players[index].hp ?? 0} initialValue={result.hpBefore?.[guess.playerId]} label={room.settings.format === "teams" ? `ทีม ${room.players[index].team === 0 ? "A" : "B"} HP` : "HP"} />}
            </div>
          ))}
          <Button
            className="w-full"
            disabled={
              room.hostId !== playerId ||
              pending ||
              room.loading ||
              !connected
            }
            onClick={() =>
              void request((socket, ack) => socket.emit("round:next", ack))
            }
          >
            {(room.settings.victory === "points" && room.round >= room.settings.rounds) || (room.settings.format === "teams" ? new Set(room.players.filter(p => !p.eliminated && !p.forfeited).map(p => p.team)).size <= 1 : room.players.filter(p => !p.eliminated && !p.forfeited).length <= 1)
              ? "ดูผลการแข่งขัน"
              : "ออกเดินทางรอบถัดไป"}
            <ArrowRight size={18} />
          </Button>
          {room.hostId !== playerId && (
            <p className="form-note">รอเจ้าของห้องเปลี่ยนรอบ</p>
          )}
        </div>
      </div>
      <p className="photo-credit">
        ภาพ: {result.location.credit} ·{" "}
        <a href={result.location.source} target="_blank" rel="noreferrer">
          แหล่งที่มาและสัญญาอนุญาต
        </a>{" "}
        ·{" "}
        {result.location.mode === "google"
          ? "พิกัด panorama จาก Street View Metadata"
          : "พิกัดอ้างอิงจุดสำคัญของสถานที่ ไม่ใช่จุดยืนของช่างภาพ"}
      </p>
    </section>
  );
}
