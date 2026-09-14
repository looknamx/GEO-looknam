import { Check, Crown, WifiOff } from "lucide-react";
import type { Player } from "@/types/game";
export function PlayerCard({
  player,
  index,
  hostId,
  selfId,
  teamControl,
  kickControl,
}: {
  player?: Player;
  index: number;
  hostId: string;
  selfId: string | null;
  teamControl?: React.ReactNode;
  kickControl?: React.ReactNode;
}) {
  if (!player)
    return (
      <div className="player-card empty-player">
        <div className="avatar">?</div>
        <div>
          <strong>รอเพื่อนร่วมทาง</strong>
          <p>แชร์รหัสห้องให้เพื่อนเข้าร่วม</p>
        </div>
        <span className="waiting-dots">•••</span>
      </div>
    );
  return (
    <div className={`player-card ${player.ready ? "is-ready" : ""}`}>
      <div className={`avatar avatar-${index}`}>
        {Array.from(player.name)[0]}
      </div>
      <div>
        {teamControl}
        <strong>
          {player.name} {player.id === selfId && <small>(คุณ)</small>}{" "}
          {player.id === hostId && <Crown size={14} className="crown" />}
        </strong>
        <p>{player.id === hostId ? "เจ้าของห้อง" : "เพื่อนร่วมทาง"}</p>
      </div>
      <span className={`player-status ${player.ready ? "ready" : ""}`}>
        {!player.connected ? (
          <>
            <WifiOff size={14} /> หลุดการเชื่อมต่อ
          </>
        ) : player.ready ? (
          <>
            <Check size={14} /> พร้อมแล้ว
          </>
        ) : (
          "ยังไม่พร้อม"
        )}
      </span>
      {kickControl}
    </div>
  );
}
