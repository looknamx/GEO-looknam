# 🧭 Where Are We? (GEO-looknam)

<p align="center">
  <strong>เว็บเกมทายสถานที่ออนไลน์สำหรับผู้เล่น 2 คน (2-Player Real-time Geo-Guessing Web Game)</strong><br>
  UI ภาษาไทย รองรับ Responsive มือถือ/เดสก์ท็อป และโหมดมืด/สว่าง พัฒนาด้วย Next.js App Router, Socket.IO และ Prisma
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-22.12+-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Next.js-App_Router-black?style=flat-square&logo=next.js&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-Ready-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Socket.io-WebSocket-010101?style=flat-square&logo=socket.io&logoColor=white" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/Prisma-SQLite-2D3748?style=flat-square&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/TailwindCSS-Styled-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white" alt="Tailwind CSS" />
</p>

---

## ✨ ฟีเจอร์หลัก (Key Features)

- **1v1 Real-Time Multiplayer**: แข่งขันพร้อมกัน 2 คนแบบเรียลไทม์ผ่าน WebSockets (Socket.IO ฝังใน Node.js process เดียวกับ Web Server ไม่ต้องแยกเซิร์ฟเวอร์)
- **ระบบห้องส่วนตัว & การกู้คืนการเชื่อมต่อ (Resilient Rooms)**:
  - ระบบ Lobby ตรวจสอบความพร้อมของทั้งสองฝ่ายก่อนเริ่ม
  - รีเฟรชเบราว์เซอร์หรือหลุดชั่วคราวกลับเข้าห้องเดิมได้อัตโนมัติด้วย `sessionStorage` + Reconnect Token (Grace period สูงสุด 60 วินาที)
- **โหมดภาพและแผนที่แบบคู่ (Dual Provider)**:
  - **Demo Mode**: คลังภาพ Wikimedia 24 แห่ง พร้อมแผนที่ Leaflet / OpenStreetMap เล่นได้ทันทีโดยไม่ต้องใช้ API Key
  - **Google Mode**: ปักหมุดบน Google Maps พร้อมดึงภาพจริงผ่าน **Street View Static API**
- **สถาปัตยกรรมป้องกันการโกงขั้นสูง (Anti-Cheat & Zero Leakage)**:
  - คำนวณคะแนนและระยะห่างบน Server ทั้งหมด
  - Client ไม่ได้รับพิกัดเฉลย, Panorama ID หรือ Google API Key โดยตรง ภาพจะถูกส่งผ่าน Opaque Image Stream Token (`/api/scene/<token>`)
  - ภาพ Demo ถูกลบ EXIF, GPS Metadata, XMP และ IPTC ออกทั้งหมด
- **ระบบ Fallback & Consent อัจฉริยะ**:
  - สลับเป็น Demo Mode อัตโนมัติเมื่อ Google API ขัดข้อง, ไม่ได้ระบุคีย์ หรือโควตาหมด
  - ระบบขอมติยืนยัน (Consent Vote) จากผู้เล่นทั้งสองคน เมื่อสถานที่ใหม่ตามเงื่อนไขหมดลง

---

## 🚀 เริ่มต้นใช้งานในเครื่อง (Local Setup)

ต้องการ **Node.js 22.12+** (แนะนำ Node.js 24) และ `npm`

```bash
# 1. ติดตั้งแพ็กเกจ
npm install

# 2. คัดลอกไฟล์ Environment Variables
# Windows PowerShell: Copy-Item .env.example .env
# macOS/Linux:
cp .env.example .env

# 3. สร้าง Client, รัน Migrations และ Seed ภาพเริ่มต้น (24 สถานที่)
npm run db:setup

# 4. เริ่มระบบทั้ง Web และ Socket Server
npm run dev
```

> ⚠️ **คำเตือน**: ห้ามใช้คำสั่ง `next dev` แยกต่างหาก เพราะจะไม่มีระบบ Multiplayer Socket.IO ให้ใช้ `npm run dev` เท่านั้น

### สำหรับฐานข้อมูลเดิมที่เคยรันด้วย `db push`
หากคุณมีฐานข้อมูลเดิมที่มีตาราง `DemoLocation` และ `Match` แต่ยังไม่มีประวัติการ Migrate ให้รันคำสั่งต่อไปนี้เพื่อ Resolve History:

```bash
# สำรองข้อมูลเดิมก่อน
cp prisma/dev.db prisma/dev.backup.db

# ระบุ Migration ว่าได้รันไปแล้ว
npx prisma migrate resolve --applied 202609090001_initial

# อัปเดตโครงสร้าง
npm run db:setup
```

---

## ⚙️ ตัวแปรสภาพแวดล้อม (Environment Variables)

ดูตัวอย่างโครงสร้างได้ที่ `.env.example` (ห้าม Commit ไฟล์ `.env` หรือ Database ขึ้น Git)

| ตัวแปร | ค่าเริ่มต้น / แนะนำ | รายละเอียดและความหมาย |
| :--- | :--- | :--- |
| `DATABASE_URL` | `file:./dev.db` | Local ใช้ `file:./dev.db`; บน Railway แนะนำ `file:/data/game.db` |
| `PORT` | `3000` | พอร์ตเซิร์ฟเวอร์ (Railway จะจัดสรรให้อัตโนมัติ) |
| `BIND_HOST` | `0.0.0.0` | Bind IP รองรับ Container และระบบ LAN |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | *(ว่างไว้เพื่อเล่น Demo)* | Browser Key สำหรับโหลด Google Maps JS API บน Client |
| `GOOGLE_MAPS_SERVER_KEY` | *(Secret Key)* | Server Key สำหรับดึงภาพจาก Street View Static API |
| `GOOGLE_MAPS_SIGNING_SECRET` | *(Secret Key - ไม่บังคับ)* | Secret Key สำหรับเซ็น URL ฝั่ง Server เพิ่มความปลอดภัย |
| `NEXT_PUBLIC_SOCKET_URL` | *(ว่างไว้)* | เว้นว่างไว้เพื่อให้ Client เชื่อมต่อผ่าน Same Origin เดียวกับหน้าเว็บ |
| `CLIENT_ORIGIN` | `https://YOUR-DOMAIN` | โดเมนที่อนุญาตให้เชื่อมต่อ (Production ต้องเป็น HTTPS ไม่มี Slash ต่อท้าย) |
| `LOCATION_HISTORY_STORAGE` | `memory` | การเก็บประวัติกันซ้ำ: `memory` หรือ `database` เพื่อคงค่าหลัง Restart |
| `LOCATION_HISTORY_LIMIT` | `75` | ประวัติสถานที่ย้อนหลังที่ห้ามออกซ้ำ (แนะนำ 50–100 รายการ) |
| `GOOGLE_MAX_ATTEMPTS` | `8` | จำนวนการลองหา Panorama สูงสุดต่อ 1 รอบ (ไม่เกิน 12 ครั้ง) |
| `GOOGLE_MIN_DISTANCE_KM` | `1` | ระยะห่างขั้นต่ำ (กม.) เพื่อไม่ให้ภาพ Google อยู่ใกล้จุดที่เพิ่งเล่นไป |
| `RECONNECT_GRACE_SECONDS` | `60` | ระยะเวลาที่รอให้ผู้เล่นกลับเข้าห้องก่อนยกเลิกแมตช์ |

---

## 🗺️ การตั้งค่า Google Cloud Platform

หากต้องการเปิดใช้งานโหมด Google Street View ให้ปฏิบัติตามคำแนะนำดังนี้:

1. **สร้าง Project และเปิดใช้งาน API**:
   - เข้า Google Cloud Console และเปิดใช้งาน **Maps JavaScript API** และ **Street View Static API**
2. **สร้าง Browser Key**:
   - จำกัดสิทธิ์การใช้งาน (Application Restrictions) ให้เป็น **Websites / HTTP Referrers** เช่น `http://localhost:3000/*` และ `https://YOUR-DOMAIN/*`
   - จำกัดขอบเขต API (API Restrictions) ให้เรียกได้เฉพาะ **Maps JavaScript API**
   - นำคีย์ไปใส่ใน `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`
3. **สร้าง Server Key**:
   - จำกัดขอบเขต API เฉพาะ **Street View Static API**
   - ใส่ใน `GOOGLE_MAPS_SERVER_KEY` (ห้ามใช้ HTTP Referrer Restriction ฝั่งเซิร์ฟเวอร์ และไม่ส่งค่านี้ไปให้ Client)
4. **Build ใหม่เสมอเมื่อแก้ไข Client Key**:
   - ค่า `NEXT_PUBLIC_*` จะถูกประมวลผลและฝังลงใน Client Build ดังนั้นเมื่อแก้ไขต้องทำการ Rebuild/Redeploy เสมอ

---

## 📐 สถาปัตยกรรมและการคำนวณคะแนน (Architecture & Security)

### แผนภาพการไหลของข้อมูล (Data Flow)

```
[ Player A ] <==== WebSocket (Socket.IO) ====> [ Game Server (Authoritative) ]
[ Player B ] <==== WebSocket (Socket.IO) ====> [ (Node.js + Next.js Server)   ]
                                                        │
                      ┌─────────────────────────────────┴─────────────────────────────────┐
                      ▼                                                                   ▼
       [ LocationProvider (Async) ]                                            [ Prisma ORM & SQLite ]
       ├─ Demo: Wikimedia (Strip EXIF)                                         ├─ Matches
       └─ Google: Street View Static                                           ├─ DemoLocations
            (Opaque Proxy URL /api/scene/<token>)                              └─ RecentLocations History
```

### การคำนวณคะแนน (Haversine Formula)
คำนวณระยะทางบนผิวโลกด้วยสูตร Haversine บน Server โดยกำหนดรัศมีเฉลี่ยของโลก $R = 6371.0088 \text{ km}$:

$$\text{Score} = \text{round}\left(5000 \times \exp\left(-\frac{\text{distanceKm}}{2000}\right)\right)$$

- คะแนนเต็ม 5,000 คะแนนต่อรอบ
- ไม่มีการส่งพิกัดคำตอบหรือคะแนนจาก Client ไปยัง Server (Server เป็นผู้ตัดสินคนเดียว)

---

## 🚂 คู่มือการ Deploy บน Railway (Single Service + Persistent Volume)

ระบบนี้ใช้ Node.js รันทั้ง Next.js และ Socket.IO ในพอร์ตเดียวกัน จึงเหมาะกับการ deploy แบบ Container บน Platform อย่าง Railway

1. **สร้าง Project**: ไปที่ Railway → New Project → Deploy from GitHub Repo
2. **เพิ่ม Persistent Volume**:
   - เพิ่ม Volume ให้ Service และตั้ง Mount Path เป็น `/data`
   - กำหนด Environment Variable: `DATABASE_URL=file:/data/game.db`
3. **กำหนดตัวแปรสภาพแวดล้อม**:
   - `BIND_HOST=0.0.0.0`
   - `LOCATION_HISTORY_STORAGE=database`
   - `LOCATION_HISTORY_LIMIT=75`
   - สร้าง Domain ในเมนู Networking (HTTPS) แล้วนำมากำหนด `CLIENT_ORIGIN=https://YOUR-DOMAIN`
   - เว้นค่า `PORT` และ `NEXT_PUBLIC_SOCKET_URL` ไว้
4. **ตั้งค่า Service Settings**:
   - **Replicas**: ตั้งเป็น `1` (เนื่องจาก SQLite และ State ของห้องเล่นสดทำงานใน Memory เดียวกัน)
   - **Healthcheck Path**: `/health` (Timeout 120s)
   - **Graceful Shutdown**: ตั้งเวลา Timeout อย่างน้อย 10 วินาที
   - **Start Command**: เว้นว่างไว้เพื่อใช้ CMD จาก `Dockerfile` (ซึ่งจะสั่งรัน `db:migrate` → `db:seed` → `server` อัตโนมัติ)

---

## 🧪 การตรวจสอบและทดสอบระบบ (Verification)

```powershell
# ตรวจสอบ Code Style และ Type
npm run lint
npm run typecheck

# รัน Automated Test Suite (49+ Tests)
npm test

# ตรวจสอบ Migration บน DB ทดสอบ
node scripts/verify-migrations.mjs

# ทดสอบรัน Production Build
npm run build
npm start

# รัน Smoke Test (เปิดอีก Terminal เพื่อทดสอบการเล่นรอบจริงและการเชื่อมต่อ Socket)
node scripts/smoke.mjs
```

---

## 📁 ผังโครงสร้างโปรเจกต์ (Project Structure)

```text
├── server/
│   ├── index.ts                  # HTTP Server, Socket.IO, Scene Proxy และ Graceful Shutdown
│   ├── game-server.ts            # การจัดการสถานะห้อง, Turn Lifecycle และมติความยินยอม (Consent)
│   └── origin-policy.ts          # การตรวจสอบความปลอดภัย CORS และ Origin
├── services/
│   ├── locations.ts              # Abstract Location Provider Interface
│   ├── google-locations.ts       # ระบบดึงภาพ, คัดกรอง Panorama และลงนาม Street View URL
│   ├── location-history.ts       # ระบบบันทึกประวัติสถานที่กันซ้ำแบบจำกัดขนาด
│   └── database.ts               # Prisma Client สำหรับจัดการ SQLite
├── components/
│   ├── adaptive-game-map.tsx     # ตัวเลือกแผนที่ระหว่าง Google Maps และ Leaflet
│   ├── google-game-map.tsx       # แผนที่สำหรับเดาและเฉลยโหมด Google
│   └── location-status.tsx       # สถานะการโหลดภาพและกล่องขอมติกรณีภาพหมด
├── data/
│   ├── google-seeds.ts           # พิกัดเป้าหมายสำหรับการค้นหาภาพ Street View กลางแจ้ง
│   └── locations.json            # ข้อมูลพิกัดและรายละเอียดของภาพใน Demo Mode
├── prisma/
│   ├── schema.prisma             # โครงสร้างฐานข้อมูล
│   └── migrations/               # ประวัติการ Migrate
└── Dockerfile                    # การกำหนดค่า Container สำหรับ Production
```

---

## ⚠️ ข้อจำกัดและข้อควรระวัง

1. **State ของห้องในเกมสด**: ห้องที่กำลังเล่นอยู่จะถูกเก็บไว้ในหน่วยความจำ (RAM) หากรีสตาร์ตเซิร์ฟเวอร์ ห้องที่กำลังเล่นจะสิ้นสุดลงทันที (ข้อมูลที่คงอยู่คือผลแมตช์ที่เล่นจบแล้วบน Volume)
2. **Street View เป็นภาพนิ่ง**: ภาพในโหมด Google ให้บริการเป็นภาพนิ่ง ไม่สามารถแพนกล้องหรือเดินสำรวจรอบทิศทางได้
3. **จำนวน Seed ของ Google**: พิกัดใน `google-seeds.ts` เป็นเพียงพิกัดเป้าหมาย หาก Google ไม่มีภาพที่ผ่านเงื่อนไขในรัศมีที่กำหนด ระบบจะสลับไปใช้ภาพถัดไปหรือเปลี่ยนเป็น Demo Mode
4. **เครดิตภาพ Demo**: ข้อมูลลิขสิทธิ์และที่มาของภาพทั้งหมดใน Demo Mode สามารถตรวจสอบได้ที่เส้นทาง `/credits`
