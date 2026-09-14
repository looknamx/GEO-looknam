"use client";
import { useEffect, useSyncExternalStore } from "react";
import { Compass, LogOut, Moon, Sun, X, WifiOff } from "lucide-react";
import { MotionConfig } from "framer-motion";
import { useGame } from "@/hooks/use-game";
import { Button } from "./ui/button";
import { Landing } from "./landing";
import { RoomLobby } from "./room-lobby";
import { GameRound } from "./game-round";
import { RoundResult } from "./round-result";
import { GameSummary } from "./game-summary";
import { LocationStatus } from "./location-status";
const subscribeTheme = (callback: () => void) => {
  window.addEventListener("waw-theme", callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener("waw-theme", callback);
    window.removeEventListener("storage", callback);
  };
};
const getTheme = () => localStorage.getItem("waw-theme") === "light";
export function GameApp() {
  const { room, connected, error, clearError, leave, pending } = useGame();
  const light = useSyncExternalStore(subscribeTheme, getTheme, () => false);
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
  }, [light]);
  const toggleTheme = () => {
    localStorage.setItem("waw-theme", light ? "dark" : "light");
    window.dispatchEvent(new Event("waw-theme"));
  };
  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <a className="skip-link" href="#main">
          ข้ามไปเนื้อหาหลัก
        </a>
        <header className="site-header">
          <a className="brand" href={room ? "#main" : "#"}>
            <span className="brand-icon">
              <Compass size={25} />
            </span>
            <span>
              where<span className="brand-light">are</span>we
              <span className="brand-dot">?</span>
              <small>GET LOST. TOGETHER.</small>
            </span>
          </a>
          <nav aria-label="เมนูหลัก">
            {room ? (
              <span className="header-room">
                ห้อง <b>{room.code}</b>
              </span>
            ) : (
              <>
                <a href="#how-to-play">วิธีเล่น</a>
                <a href="#play">
                  เล่นกับเพื่อน <span className="nav-new">2P</span>
                </a>
              </>
            )}
          </nav>
          <div className="header-actions">
            <span className={`connection ${connected ? "" : "offline"}`}>
              <span className="live-dot" />
              {connected ? "พร้อมออกสำรวจ" : "กำลังเชื่อมต่อ"}
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={light ? "เปลี่ยนเป็นโหมดมืด" : "เปลี่ยนเป็นโหมดสว่าง"}
            >
              {light ? <Moon size={19} /> : <Sun size={19} />}
            </Button>
            {room && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="ออกจากห้อง"
                disabled={!connected || pending}
                onClick={() => {
                  if (
                    window.confirm(
                      "ออกจากห้องนี้? หากกำลังเล่น การแข่งขันจะถูกยกเลิก",
                    )
                  )
                    void leave();
                }}
              >
                <LogOut size={19} />
              </Button>
            )}
          </div>
        </header>
        <main id="main">
          <LocationStatus />
          {error && (
            <div className="alert error-alert" role="alert">
              <span>{error}</span>
              <button onClick={clearError} aria-label="ปิดข้อความ">
                <X size={18} />
              </button>
            </div>
          )}
          {room && !connected && (
            <div className="alert" role="status">
              <WifiOff size={18} />
              ขาดการเชื่อมต่อ กำลังกลับเข้าห้องอัตโนมัติ เวลาในเกมยังเดินต่อ
            </div>
          )}
          {room?.message && (
            <div className="alert" role="status">
              {room.message}
            </div>
          )}
          {room?.players.some((p) => !p.connected && !p.forfeited) && connected && (
            <div className="alert" role="status">
              เพื่อนหลุดการเชื่อมต่อ กำลังรอกลับเข้าห้อง
              เวลาเดินต่อ หากไม่กลับมาภายในเวลาที่กำหนดจะถือว่าสละสิทธิ์ ผู้เล่นที่เหลือเล่นต่อได้
            </div>
          )}
          {!room ? (
            <Landing />
          ) : room.phase === "lobby" ? (
            <RoomLobby />
          ) : room.phase === "playing" ? (
            <GameRound key={`${room.code}-${room.round}`} />
          ) : room.phase === "reveal" ? (
            <RoundResult />
          ) : (
            <GameSummary />
          )}
        </main>
        <footer className="site-footer">
          <span>
            <Compass size={17} />
            <b>Where Are We?</b>
            <span>โลกใบเดิม มุมมองใหม่ เมื่อไปด้วยกัน</span>
          </span>
          <span>
            © 2026 looknam_x. สงวนลิขสิทธิ์ทั้งหมด <span className="footer-star">✦</span>
            <a href="/credits" target="_blank" rel="noreferrer">
              เครดิตภาพ
            </a>
            <a href="/terms" target="_blank" rel="noreferrer">
              เงื่อนไข
            </a>
            <a href="/privacy" target="_blank" rel="noreferrer">
              ความเป็นส่วนตัว
            </a>
          </span>
        </footer>
      </div>
    </MotionConfig>
  );
}
