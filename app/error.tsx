"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="loading-screen">
      <h1>การเดินทางสะดุดนิดหน่อย</h1>
      <p>ลองโหลดหน้านี้อีกครั้งเพื่อกลับเข้าเกม</p>
      <Button onClick={reset}>ลองอีกครั้ง</Button>
      <Button variant="secondary" onClick={() => location.reload()}>
        โหลดหน้าใหม่
      </Button>
    </main>
  );
}
