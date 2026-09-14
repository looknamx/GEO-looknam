"use client";
import { useEffect, useState } from "react";

export function HpBar({ value, initialValue, label = "HP" }: { value: number; initialValue?: number; label?: string }) {
  const clamp = (n: number) => Math.max(0, Math.min(10000, n));
  const [displayed, setDisplayed] = useState(clamp(initialValue ?? value));
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => { second = requestAnimationFrame(() => setDisplayed(Math.max(0, Math.min(10000, value)))); });
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second); };
  }, [value]);
  return <div className="hp-meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={10000} aria-valuenow={clamp(value)}>
    <div className="hp-caption">{label} <b>{Math.max(0, value).toLocaleString()} / 10,000</b></div>
    <div className="hp-track"><div className={`hp-fill ${value <= 2500 ? "hp-critical" : ""}`} style={{ width: `${displayed / 100}%` }} /></div>
  </div>;
}
