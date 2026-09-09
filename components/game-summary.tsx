"use client";
import { motion } from "framer-motion";
import { Home, RotateCcw, Trophy } from "lucide-react";
import { useGame } from "@/hooks/use-game";
import { Button } from "./ui/button";
export function GameSummary() {
  const { room, playerId, request, pending, connected, leave } = useGame();
  if (!room) return null;
  const best = Math.max(...room.players.map((p) => p.score));
  const winners = room.players.filter((p) => p.score === best);
  return (
    <section className="room-page summary">
      <motion.div
        className="summary-heading"
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="trophy-halo">
          <Trophy size={54} />
        </div>
        <div className="eyebrow">WHAT A JOURNEY!</div>
        <h1>
          {winners.length > 1
            ? "สองนักสำรวจ ใจตรงกัน!"
            : `${winners[0].name} คือนักสำรวจตัวจริง!`}
        </h1>
        <p>
          {winners.length > 1
            ? "จบทริปด้วยคะแนนเสมอกัน"
            : "ผู้ชนะการเดินทางครั้งนี้"}{" "}
          · {room.settings.rounds} รอบแห่งการค้นพบ
        </p>
      </motion.div>
      <div className="summary-players">
        {room.players.map((player, i) => {
          const guesses = room.results.flatMap((result) =>
            result.guesses.filter((g) => g.playerId === player.id),
          );
          const distances = guesses.flatMap((g) =>
            g.distance === null ? [] : [g.distance],
          );
          const closest = guesses.reduce<(typeof guesses)[number] | undefined>(
            (best, current) =>
              current.distance !== null &&
              (!best ||
                best.distance === null ||
                current.distance < best.distance)
                ? current
                : best,
            undefined,
          );
          const closestRound = closest ? guesses.indexOf(closest) + 1 : null;
          const wins = room.results.filter(
            (r) => r.winnerIds.length === 1 && r.winnerIds[0] === player.id,
          ).length;
          return (
            <div
              className={`panel summary-player ${player.score === best ? "winner" : ""}`}
              key={player.id}
            >
              <div className="summary-player-name">
                <span className={`avatar avatar-${i}`}>
                  {Array.from(player.name)[0]}
                </span>
                <h2>
                  {player.name} {player.id === playerId && <small>(คุณ)</small>}
                </h2>
                {player.score === best && <Trophy size={20} />}
              </div>
              <strong className="total-score">
                {player.score.toLocaleString()}
                <small>
                  {" "}
                  / {(room.settings.rounds * 5000).toLocaleString()} คะแนน
                </small>
              </strong>
              <div className="summary-stats">
                <div>
                  <span>ระยะห่างเฉลี่ย</span>
                  <b>
                    {distances.length
                      ? `${(distances.reduce((a, b) => a + b, 0) / distances.length).toFixed(1)} กม.`
                      : "—"}
                  </b>
                </div>
                <div>
                  <span>รอบที่ใกล้ที่สุด</span>
                  <b>
                    {closestRound
                      ? `รอบ ${closestRound} · ${closest?.distance?.toFixed(1)} กม.`
                      : "—"}
                  </b>
                </div>
                <div>
                  <span>รอบที่ชนะ</span>
                  <b>{wins} รอบ</b>
                </div>
                <div>
                  <span>ส่งคำตอบ</span>
                  <b>
                    {distances.length} / {room.settings.rounds} รอบ
                  </b>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="panel table-panel">
        <h2>ทุกหมุด มีเรื่องราว</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>รอบ</th>
                <th>จุดหมาย</th>
                {room.players.map((p) => (
                  <th key={p.id}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {room.results.map((result) => (
                <tr key={result.round}>
                  <td>{String(result.round).padStart(2, "0")}</td>
                  <td>{result.location.name}</td>
                  {result.guesses.map((g) => (
                    <td
                      key={g.playerId}
                      className={
                        result.winnerIds.includes(g.playerId)
                          ? "score-highlight"
                          : ""
                      }
                    >
                      {g.score.toLocaleString()}{" "}
                      <small>
                        {g.distance === null
                          ? "ไม่ตอบ"
                          : `${g.distance.toFixed(1)} กม.`}
                      </small>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted table-note">
          ระยะเฉลี่ยคิดจากรอบที่ส่งคำตอบเท่านั้น · รอบเสมอไม่นับเป็นรอบชนะ
        </p>
      </div>
      <div className="summary-actions">
        <Button
          disabled={room.hostId !== playerId || pending || !connected}
          onClick={() =>
            void request((socket, ack) => socket.emit("game:rematch", ack))
          }
        >
          <RotateCcw size={17} />
          เล่นอีกครั้ง
        </Button>
        <Button
          variant="secondary"
          disabled={pending || !connected}
          onClick={() => void leave()}
        >
          <Home size={17} />
          กลับหน้าแรก
        </Button>
      </div>
      <p className="form-note">
        {room.hostId !== playerId
          ? "เจ้าของห้องเป็นผู้เริ่มเล่นอีกครั้ง · "
          : ""}
        {room.persisted === true
          ? "บันทึกผลการแข่งขันแล้ว"
          : room.persisted === false
            ? "บันทึกผลไม่สำเร็จ"
            : "กำลังบันทึกผลการแข่งขัน…"}
      </p>
    </section>
  );
}
