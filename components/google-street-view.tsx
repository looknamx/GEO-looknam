"use client";
import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps } from "@/lib/google-maps-client";
import { Button } from "./ui/button";

export default function GoogleStreetView({ panoId, heading }: {
  panoId: string;
  heading: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const panorama = useRef<google.maps.StreetViewPanorama | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let disposed = false;
    let observer: ResizeObserver | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let viewer: google.maps.StreetViewPanorama | undefined;
    const fail = () => { if (!disposed) setStatus("error"); };
    window.addEventListener("waw-google-error", fail);
    void loadGoogleMaps().then(() => {
      if (disposed || !container.current) return;
      viewer = new google.maps.StreetViewPanorama(container.current, {
        pano: panoId,
        pov: { heading, pitch: 0 },
        zoom: 0,
        linksControl: true,
        clickToGo: true,
        panControl: true,
        zoomControl: true,
        addressControl: false,
        showRoadLabels: false,
        fullscreenControl: false,
        enableCloseButton: false,
        motionTracking: false,
        motionTrackingControl: false,
      });
      panorama.current = viewer;
      timer = setTimeout(fail, 15000);
      viewer.addListener("status_changed", () => {
        if (disposed) return;
        clearTimeout(timer);
        setStatus(viewer?.getStatus() === google.maps.StreetViewStatus.OK ? "ready" : "error");
      });
      observer = new ResizeObserver(() => {
        if (viewer) google.maps.event.trigger(viewer, "resize");
      });
      observer.observe(container.current);
    }).catch(fail);
    return () => {
      disposed = true;
      clearTimeout(timer);
      observer?.disconnect();
      window.removeEventListener("waw-google-error", fail);
      if (viewer) {
        google.maps.event.clearInstanceListeners(viewer);
        viewer.setVisible(false);
      }
      panorama.current = null;
    };
  }, [panoId, heading, attempt]);

  return <div className="street-view-container">
    <div ref={container} className="street-view-canvas" aria-label="Street View หมุนดูและเดินสำรวจได้" />
    {status === "ready" && <Button className="street-view-home" size="sm" variant="secondary" onClick={() => {
      panorama.current?.setPano(panoId);
      panorama.current?.setPov({ heading, pitch: 0 });
      panorama.current?.setZoom(0);
    }}>กลับจุดเริ่มต้น</Button>}
    {status !== "ready" && <div className="google-map-overlay" role={status === "error" ? "alert" : "status"}>
      <p>{status === "error" ? "โหลด Street View ไม่สำเร็จ" : "กำลังเปิด Street View…"}</p>
      {status === "error" && <Button variant="secondary" onClick={() => { setStatus("loading"); setAttempt(a => a + 1); }}>ลองอีกครั้ง</Button>}
    </div>}
  </div>;
}
