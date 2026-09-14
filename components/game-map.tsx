"use client";
import { Fragment, useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { Point, RoundResult } from "@/types/game";
import "leaflet/dist/leaflet.css";
const colors = ["#22d3ee", "#c084fc", "#fb923c", "#4ade80"];
export function GuessMarker({
  point,
  index = 0,
  label,
}: {
  point: Point;
  index?: number;
  label: string;
}) {
  return (
    <CircleMarker
      center={[point.lat, point.lng]}
      radius={9}
      pathOptions={{
        color: "#fff",
        weight: 3,
        fillColor: colors[index],
        fillOpacity: 1,
      }}
    >
      <Tooltip>{label}</Tooltip>
    </CircleMarker>
  );
}
function ClickHandler({
  onPick,
  locked,
}: {
  onPick?: (point: Point) => void;
  locked: boolean;
}) {
  useMapEvents({
    click: (event) => {
      if (!locked)
        onPick?.({
          lat: Math.max(-85, Math.min(85, event.latlng.lat)),
          lng: ((((event.latlng.lng + 180) % 360) + 360) % 360) - 180,
        });
    },
  });
  return null;
}
function FitResults({ result }: { result?: RoundResult }) {
  const map = useMap();
  useEffect(() => {
    if (result) {
      const points: [number, number][] = [
        [result.location.lat, result.location.lng],
        ...result.guesses.flatMap((g) =>
          g.point ? [[g.point.lat, g.point.lng] as [number, number]] : [],
        ),
      ];
      map.fitBounds(points, { padding: [45, 45], maxZoom: 12 });
    }
  }, [map, result]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);
  return null;
}
export default function GameMap({
  point,
  onPick,
  locked = false,
  result,
  playerNames = [],
}: {
  point?: Point | null;
  onPick?: (point: Point) => void;
  locked?: boolean;
  result?: RoundResult;
  playerNames?: string[];
}) {
  return (
    <MapContainer
      center={[20, 20]}
      zoom={2}
      minZoom={2}
      maxZoom={18}
      maxBounds={[
        [-85, -540],
        [85, 540],
      ]}
      scrollWheelZoom
      keyboard
      className="game-map"
      aria-label="แผนที่เลือกตำแหน่ง ใช้ปุ่มลูกศรเลื่อนและบวกหรือลบเพื่อซูม หรือกรอกพิกัดด้านล่าง"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onPick} locked={locked || !!result} />
      <FitResults result={result} />
      {point && !result && <GuessMarker point={point} label="คำตอบของคุณ" />}
      {result && (
        <>
          <CircleMarker
            center={[result.location.lat, result.location.lng]}
            radius={11}
            pathOptions={{
              color: "#fff",
              weight: 3,
              fillColor: "#fbbf24",
              fillOpacity: 1,
            }}
          >
            <Tooltip permanent direction="top">
              ตำแหน่งจริง
            </Tooltip>
          </CircleMarker>
          {result.guesses.map(
            (guess, i) =>
              guess.point && (
                <Fragment key={guess.playerId}>
                  <GuessMarker
                    point={guess.point}
                    index={i}
                    label={playerNames[i] || `ผู้เล่น ${i + 1}`}
                  />
                  <Polyline
                    positions={[
                      [guess.point.lat, guess.point.lng],
                      [result.location.lat, result.location.lng],
                    ]}
                    pathOptions={{
                      color: colors[i],
                      weight: 3,
                      dashArray: "7 8",
                    }}
                  />
                </Fragment>
              ),
          )}
        </>
      )}
    </MapContainer>
  );
}
