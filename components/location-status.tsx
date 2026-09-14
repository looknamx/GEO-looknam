"use client";
import { useGame } from "@/hooks/use-game";
import { Button } from "./ui/button";
export function LocationStatus() {
  const { room, playerId, request, pending, connected } = useGame();
  if (!room) return null;
  if (room.loading)
    return (
      <div className="location-notice" role="status">
        <div className="loading-orbit" />
        <span>
          กำลังเลือกสถานที่ใหม่และตรวจสอบภาพ…
          เวลาต่อรอบจะเริ่มหลังเตรียมสถานที่แล้ว
        </span>
      </div>
    );
  if (!room.selectionIssue) return null;
  const voted = !!playerId && room.historyResetVotes.includes(playerId);
  return (
    <div className="location-notice" role="alert">
      <p>{room.selectionIssue.message}</p>
      {room.selectionIssue.kind === "history" && (
        <>
          <p>
            อนุญาตใช้สถานที่จากเกมก่อนเฉพาะเกมนี้ ไม่ล้างประวัติของห้องอื่น
            {room.settings.victory === "hp" ? "โหมด HP: อนุญาตวนชุดโจทย์ที่ใช้แล้วเพื่อเล่นต่อ" : "และไม่อนุญาตให้ซ้ำในเกมเดียวกัน"} ({room.historyResetVotes.length}/{room.players.filter(p => p.connected && !p.forfeited && !p.eliminated).length}
            คนยืนยัน)
          </p>
          <Button
            variant="secondary"
            disabled={
              pending || !connected || voted || !!room.players.find(p => p.id === playerId)?.eliminated
            }
            onClick={() =>
              void request((socket, ack) =>
                socket.emit("room:history-reset", ack),
              )
            }
          >
            {voted ? "คุณยืนยันแล้ว รอเพื่อน" : "ยืนยันให้ใช้สถานที่จากเกมก่อน"}
          </Button>
        </>
      )}
    </div>
  );
}
