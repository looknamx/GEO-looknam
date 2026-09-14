"use client";
import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
export function CountdownTimer({
  deadline,
  clockOffset,
  initial,
  compact = false,
}: {
  deadline: number;
  clockOffset: number;
  initial: number;
  compact?: boolean;
}) {
  const [seconds, setSeconds] = useState(initial);
  useEffect(() => {
    const update = () =>
        setSeconds(
          Math.max(0, Math.ceil((deadline - Date.now() - clockOffset) / 1000)),
        );
    const immediate = setTimeout(update, 0);
    const timer = setInterval(update, 200);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(immediate);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [deadline, clockOffset]);
  return (
    <div
      className={`${compact ? "mobile-round-timer" : "timer"} ${seconds <= 10 ? "timer-urgent" : ""}`}
      role="timer"
      aria-label={`เหลือ ${seconds} วินาที`}
    >
      <Clock3 size={21} />
      <span>
        {Math.floor(seconds / 60)
          .toString()
          .padStart(2, "0")}
        :{(seconds % 60).toString().padStart(2, "0")}
      </span>
      <small>เวลาที่เหลือ</small>
      {compact && <div className="round-time-track" aria-hidden="true"><div style={{ transform: `scaleX(${Math.min(1, seconds / Math.max(1, initial))})` }} /></div>}
    </div>
  );
}
