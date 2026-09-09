"use client";
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps-client";
import type { Point, RoundResult } from "@/types/game";
import { Button } from "./ui/button";
export type GameMapProps = {
  point?: Point | null;
  onPick?: (point: Point) => void;
  locked?: boolean;
  result?: RoundResult;
  playerNames?: string[];
  onFailure?: () => void;
};
export default function GoogleGameMap({
  point,
  onPick,
  locked = false,
  result,
  playerNames = [],
  onFailure,
}: GameMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const [ready, setReady] = useState(false),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    let disposed = false;
    const fail = () => {
      if (!disposed) {
        setFailed(true);
        onFailure?.();
      }
    };
    window.addEventListener("waw-google-error", fail);
    void loadGoogleMaps()
      .then(() => {
        if (disposed || !container.current) return;
        map.current = new google.maps.Map(container.current, {
          center: { lat: 20, lng: 20 },
          zoom: 2,
          minZoom: 2,
          streetViewControl: false,
          mapTypeControl: false,
          clickableIcons: false,
          fullscreenControl: false,
          gestureHandling: "cooperative",
        });
        setReady(true);
      })
      .catch(fail);
    return () => {
      disposed = true;
      window.removeEventListener("waw-google-error", fail);
      if (map.current) google.maps.event.clearInstanceListeners(map.current);
      map.current = null;
    };
  }, [onFailure]);
  useEffect(() => {
    if (!ready || !map.current) return;
    const listener = map.current.addListener(
      "click",
      (event: google.maps.MapMouseEvent) => {
        if (!locked && !result && event.latLng)
          onPick?.({
            lat: Math.max(-85, Math.min(85, event.latLng.lat())),
            lng: event.latLng.lng(),
          });
      },
    );
    return () => listener.remove();
  }, [ready, locked, result, onPick]);
  useEffect(() => {
    const current = map.current;
    if (!ready || !current) return;
    const markers: google.maps.Circle[] = [],
      lines: google.maps.Polyline[] = [];
    const resize = () =>
      markers.forEach((circle) =>
        circle.setRadius(
          (9 *
            156543.03392 *
            Math.cos(((circle.getCenter()?.lat() ?? 0) * Math.PI) / 180)) /
            2 ** (current.getZoom() ?? 2),
        ),
      );
    const zoomListener = current.addListener("zoom_changed", resize);
    const marker = (position: Point, color: string) => {
      const circle = new google.maps.Circle({
        map: current,
        center: position,
        radius: 6000,
        clickable: false,
        strokeColor: "#fff",
        strokeWeight: 2,
        fillColor: color,
        fillOpacity: 1,
      });
      markers.push(circle);
      resize();
    };
    if (result) {
      marker(result.location, "#fbbf24");
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(result.location);
      result.guesses.forEach((guess, index) => {
        if (guess.point) {
          const color = index === 0 ? "#22d3ee" : "#c084fc";
          marker(guess.point, color);
          bounds.extend(guess.point);
          lines.push(
            new google.maps.Polyline({
              map: current,
              path: [guess.point, result.location],
              strokeColor: color,
              strokeWeight: 3,
            }),
          );
        }
      });
      current.fitBounds(bounds, 45);
      const listener = google.maps.event.addListenerOnce(
        current,
        "idle",
        () => {
          if ((current.getZoom() ?? 0) > 12) current.setZoom(12);
        },
      );
      return () => {
        listener.remove();
        zoomListener.remove();
        markers.forEach((m) => m.setMap(null));
        lines.forEach((l) => l.setMap(null));
      };
    }
    if (point) marker(point, "#22d3ee");
    return () => {
      zoomListener.remove();
      markers.forEach((m) => m.setMap(null));
    };
  }, [ready, point, result]);
  return (
    <div className="google-map-container">
      <div
        ref={container}
        className="game-map"
        aria-label="Google Maps สำหรับวางหมุดคำตอบ"
      />
      {!ready && !failed && (
        <div className="google-map-overlay" role="status">
          กำลังเปิด Google Maps…
        </div>
      )}
      {failed && (
        <div className="google-map-overlay" role="alert">
          <p>Google Maps ใช้งานไม่ได้</p>
          {onFailure && (
            <Button variant="secondary" onClick={onFailure}>
              เปลี่ยนเป็น Demo Mode
            </Button>
          )}
        </div>
      )}
      {result && (
        <div className="map-legend">
          <span>● ตำแหน่งจริง</span>
          {playerNames.map((name, i) => (
            <span key={i}>
              {i + 1}. {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
