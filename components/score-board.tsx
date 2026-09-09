import { Trophy } from "lucide-react";
import type { Player } from "@/types/game";
export function ScoreBoard({
  players,
  selfId,
}: {
  players: Player[];
  selfId: string | null;
}) {
  return (
    <div className="score-board">
      {players.map((player, i) => (
        <div key={player.id}>
          <span className={`avatar avatar-${i}`}>
            {Array.from(player.name)[0]}
          </span>
          <span>
            {player.name}
            {player.id === selfId ? " (คุณ)" : ""}
            <small>
              {!player.connected
                ? "หลุดการเชื่อมต่อ"
                : player.submitted
                  ? "✓ ยืนยันแล้ว"
                  : "กำลังเลือกตำแหน่ง…"}
            </small>
          </span>
          <strong>
            <Trophy size={14} />
            {player.score.toLocaleString()}
          </strong>
        </div>
      ))}
    </div>
  );
}
