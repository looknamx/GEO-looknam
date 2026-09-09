"use client";
declare global {
  interface Window {
    wawGoogleReady?: () => void;
    gm_authFailure?: () => void;
  }
}
let loading: Promise<void> | undefined;
export function loadGoogleMaps(): Promise<void> {
  if (typeof google !== "undefined" && google.maps?.Map)
    return Promise.resolve();
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;
    if (!key) {
      reject(new Error("ยังไม่ได้ตั้ง Google browser key"));
      return;
    }
    const script = document.createElement("script");
    const fail = () => {
      clearTimeout(timer);
      reject(new Error("โหลด Google Maps ไม่สำเร็จ"));
      window.dispatchEvent(new Event("waw-google-error"));
    };
    const timer = setTimeout(fail, 12_000);
    window.gm_authFailure = fail;
    window.wawGoogleReady = () => {
      clearTimeout(timer);
      resolve();
    };
    script.src = `https://maps.googleapis.com/maps/api/js?${new URLSearchParams({ key, v: "quarterly", loading: "async", callback: "wawGoogleReady", language: "th" })}`;
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  });
  return loading;
}
