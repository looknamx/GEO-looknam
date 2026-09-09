"use client";
import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
export function CountdownTimer({
  deadline,
  clockOffset,
  initial,
}: {
  deadline: number;
  clockOffset: number;
  initial: number;
}) {
  const [seconds, setSeconds] = useState(initial);
  useEffect(() => {
    const timer = setInterval(
      () =>
        setSeconds(
          Math.max(0, Math.ceil((deadline - Date.now() - clockOffset) / 1000)),
        ),
      200,
    );
    return () => clearInterval(timer);
  }, [deadline, clockOffset]);
  return (
    <div
      className={`timer ${seconds <= 10 ? "timer-urgent" : ""}`}
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
    </div>
  );
}
