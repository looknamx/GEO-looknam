"use client";
import { ArrowRight, MapPin, Trophy } from "lucide-react";
import { useGame } from "@/hooks/use-game";
import { Button } from "./ui/button";
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
          ROUND {room.round} / {room.settings.rounds} · THE REVEAL
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
            </div>
          ))}
          <Button
            className="w-full"
            disabled={
              room.hostId !== playerId ||
              pending ||
              room.loading ||
              !connected ||
              !room.players.every((p) => p.connected)
            }
            onClick={() =>
              void request((socket, ack) => socket.emit("round:next", ack))
            }
          >
            {room.round === room.settings.rounds
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
