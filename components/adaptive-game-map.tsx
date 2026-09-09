"use client";
import dynamic from "next/dynamic";
import { useCallback } from "react";
import { useGame } from "@/hooks/use-game";
import type { GameMapProps } from "./google-game-map";
const loading = () => (
  <div className="map-loading">
    <div className="loading-orbit" />
    กำลังเปิดแผนที่…
  </div>
);
const DemoMap = dynamic(() => import("./game-map"), { ssr: false, loading });
const GoogleMap = dynamic(() => import("./google-game-map"), {
  ssr: false,
  loading,
});
export default function AdaptiveGameMap(props: GameMapProps) {
  const { room, request } = useGame();
  const fallback = useCallback(() => {
    void request((socket, ack) => socket.emit("room:demo-fallback", ack));
  }, [request]);
  const mode = props.result?.location.mode ?? room?.mode ?? "demo";
  return mode === "google" ? (
    <GoogleMap {...props} onFailure={fallback} />
  ) : (
    <DemoMap {...props} />
  );
}
