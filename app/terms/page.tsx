import Link from "next/link";
export default function Terms() {
  return (
    <main className="credits-page">
      <Link href="/">← กลับเกม</Link>
      <h1>ข้อตกลงการใช้เกม</h1>
      <p>
        Where Are We? เป็นเกมทายสถานที่เพื่อความบันเทิง
        พิกัดและคะแนนใช้เพื่อการเล่น
        ไม่ใช้สำหรับการนำทางหรือการตัดสินใจที่ต้องการความแม่นยำ
      </p>
      <p>
        เมื่อใช้ Google Maps หรือ Street View คุณต้องปฏิบัติตาม{" "}
        <a
          href="https://www.google.com/intl/th_US/help/terms_maps/"
          target="_blank"
          rel="noreferrer"
        >
          ข้อกำหนดเพิ่มเติมของ Google Maps/Google Earth
        </a>{" "}
        ข้อมูลและภาพเป็นของผู้ให้บริการตามเงื่อนไขนั้น ห้ามนำภาพไปเก็บ
        ทำสำเนาจำนวนมาก หรือซ่อนเครดิตของผู้ให้บริการ
      </p>
      <p>
        กรุณาใช้ชื่อสุภาพ ไม่รบกวนเซิร์ฟเวอร์หรือผู้เล่นอื่น
        ภาพเดโมมีเครดิตและสัญญาอนุญาตใน{" "}
        <Link href="/credits">หน้าเครดิตภาพ</Link> อ่านวิธีจัดการข้อมูลใน{" "}
        <Link href="/privacy">นโยบายความเป็นส่วนตัว</Link>
      </p>
    </main>
  );
}
