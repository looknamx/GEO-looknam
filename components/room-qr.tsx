"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function RoomQr({ code }: { code: string }) {
  const [qr, setQr] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const link = new URL("/", window.location.origin);
    link.searchParams.set("room", code);
    link.hash = "play";
    void QRCode.toDataURL(link.href, { width: 240, margin: 4, errorCorrectionLevel: "M" }).then(image => {
      if (!cancelled) { setQr(image); setUrl(link.href); }
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [code]);
  return <details className="room-qr"><summary>แสดง QR Code ชวนเพื่อน</summary>
    {qr ? <><img src={qr} width={240} height={240} alt={`QR เข้าห้อง ${code}`} /><p>สแกนด้วยกล้องมือถือ แล้วกรอกชื่อเพื่อเข้าห้อง</p><a href={qr} download={`room-${code}.png`}>บันทึก QR Code</a><p><a href={url}>เปิดลิงก์เข้าห้อง {code}</a></p></> : <p>{error ? "สร้าง QR ไม่สำเร็จ กรุณาแชร์รหัสห้องด้านบน" : "กำลังสร้าง QR…"}</p>}
  </details>;
}
