import Link from "next/link";
import locations from "@/data/locations.json";
export default function Credits() {
  return (
    <main className="credits-page">
      <Link href="/">← กลับหน้าแรก</Link>
      <h1>เครดิตภาพและข้อมูลเดโม</h1>
      <p>
        ภาพจาก Wikimedia Commons ใช้ตามสัญญาอนุญาตของแต่ละภาพ
        ภาพย่อถูกปรับขนาดและแสดงด้วยการครอปในบางส่วนของหน้าเว็บ
        ข้อมูลสถานที่ใช้เพื่อการเล่นเดโม พิกัดเป็นจุดอ้างอิงของสถานที่
        ไม่ใช่พิกัดของช่างภาพ
      </p>
      <p>
        หน้านี้เปิดเผยรายการสถานที่ในชุดเดโม
        จึงควรอ่านก่อนหรือหลังการแข่งขันเท่านั้น
      </p>
      {locations.map((location) => (
        <article key={location.id}>
          <h2>{location.name}</h2>
          <p>{location.credit}</p>
          <a href={location.source} target="_blank" rel="noreferrer">
            ต้นฉบับและรายละเอียดสัญญาอนุญาต
          </a>
        </article>
      ))}
    </main>
  );
}
