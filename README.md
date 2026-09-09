# Where Are We? 🧭

เว็บเกมทายสถานที่สำหรับเพื่อน **2 คน** UI ภาษาไทย รองรับมือถือ มืด/สว่าง ห้องส่วนตัว พร้อมก่อนเริ่ม รีเฟรชกลับเข้าห้อง เฉลยคะแนน และเล่นใหม่ ใช้ Next.js App Router + TypeScript + Tailwind + Framer Motion, Socket.IO และ Prisma/SQLite โดยเว็บกับ Socket ใช้ Node.js process และพอร์ตเดียวกัน

## เริ่มในเครื่อง

ใช้ Node.js 22.12+ และ npm (ตรวจบน Windows/Node.js 24)

```powershell
npm install
Copy-Item .env.example .env
npm run db:setup
npm run dev
```

อย่าเขียนทับ `.env` ที่มีอยู่ macOS/Linux ใช้ `cp` เปิด http://localhost:3000 คำสั่ง `npm run dev` เริ่มทั้งเว็บและ Socket ห้ามใช้ `next dev` แยก เพราะจะไม่มี multiplayer `db:setup` generate client → migrate → seed 24 ภาพโดยไม่ลบผลเกม

**ฐานข้อมูลจากเวอร์ชันเดิมที่สร้างด้วย `db push`:** หยุด server และสำรอง `prisma/dev.db` ก่อน รันคำสั่งต่อไปนี้เพียงครั้งเดียวเมื่อฐานข้อมูลเดิมมีตาราง `DemoLocation` และ `Match` ตรงกับ initial migration แต่ยังไม่มีประวัติ migration (ฐานข้อมูลใหม่ไม่ต้องทำ)

```powershell
Copy-Item prisma/dev.db prisma/dev.backup.db
npx prisma migrate resolve --applied 202609090001_initial
npm run db:setup
```

ฐานข้อมูลเดิมใน workspace นี้ดำเนินการแล้ว สำรองไว้ `artifacts/dev-before-history-migration.db` อย่ารัน reset หรือ db push ทับฐานข้อมูล production

## โหมดภาพและแผนที่

Host เลือก **Demo Mode / Google Street View** ใน lobby พร้อมจำนวนรอบ 3/5/10, เวลา 30/60/90 วินาที, ความยาก และหมวดสถานที่

- Demo: ภาพ Wikimedia ในโปรเจกต์ 24 แห่ง + Leaflet/OpenStreetMap ใช้ได้โดยไม่ต้องมี key ภาพคำถามผ่าน server ที่ลบ EXIF/GPS/XMP/IPTC; พิกัดเป็นจุดอ้างอิงสถานที่ ไม่ใช่จุดยืนช่างภาพ เครดิตอยู่ `/credits`
- Google: Google Maps สำหรับปักคำตอบ + **Street View Static API** ภาพจริงแบบนิ่ง มี attribution ของ Google อยู่ครบ ใช้ metadata ตรวจ panorama ปัจจุบันและใช้พิกัดที่ metadata คืนมาคำนวณคะแนน ไม่มีการหมุน/เดินใน panorama ในเวอร์ชันนี้
- ไม่มี key ทั้งคู่ หรือ metadata/API/network/quota ผิดพลาด: server เปลี่ยนใช้ Demo อัตโนมัติพร้อมข้อความ หาก Demo ตามตัวกรองไม่พอก็แจ้งตรง ๆ
- หากภาพ Google หรือแผนที่เสีย **หลังเริ่มรอบแล้ว** จะยกเลิกแมตช์ทั้งห้อง กลับ lobby แบบ Demo ให้ทั้งสองกดพร้อมใหม่ เพื่อไม่เปลี่ยนคำตอบระหว่างที่บางคนส่งไปแล้ว

Google ใช้ seed ที่เขียนไว้ใน `data/google-seeds.ts` แล้วค้นหา outdoor panorama ภายใน 500 เมตร ตรวจพิกัดที่ได้ไม่ห่าง seed เกิน 600 เมตร ไม่มีการค้นหาแบบไม่จำกัด ค่าเริ่มต้นลองไม่เกิน 8 seed/รอบ แต่ละ metadata request timeout 2.5 วินาที มีเวลาเลือกโดยรวม 22 วินาที ถ้าพบ ZERO_RESULTS จะลอง seed ถัดไป การจัดระดับความยากเป็น editorial heuristic; ยังไม่ได้ตรวจภาพทุก seed ด้วยบัญชี Google จริง

### ตั้งค่า Google Cloud

1. สร้าง Google Cloud project ผูก billing และเปิด **Maps JavaScript API** กับ **Street View Static API**
2. สร้าง browser key แยก ตั้ง Application restriction เป็น **Websites / HTTP referrers** เช่น `http://localhost:3000/*` และ `https://YOUR-DOMAIN/*` จำกัด API ให้ใช้ Maps JavaScript API เท่านั้น ใส่ `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`
3. สร้าง server key อีกอัน จำกัด API ให้ใช้ Street View Static API ใส่ `GOOGLE_MAPS_SERVER_KEY` จำกัด IP ฝั่ง server เมื่อมี static outbound IP อย่าใช้ HTTP referrer restriction กับ server key; ตรวจ outbound IP ของแพลตฟอร์มก่อนกำหนด
4. ถ้าเปิด URL signing ใส่ `GOOGLE_MAPS_SIGNING_SECRET` ฝั่ง server เท่านั้น ตั้ง quota และ billing alerts ใน Google Cloud
5. หลังเปลี่ยน `NEXT_PUBLIC_*` ต้อง **build/deploy ใหม่** เพราะค่าถูกฝังใน client build ส่วน server key อ่านตอนเริ่ม process

browser key มองเห็นได้ตามการออกแบบของ Google ต้องใช้ restrictions; server key และ signing secret ไม่ส่งผ่าน Socket/HTML/browser และไม่บันทึกฐานข้อมูล **ไม่มีช่องให้ Host กรอก secret** ใช้ environment ของผู้ดูแลเพื่อลดการรั่วใน browser/session/log

Metadata requests ไม่คิดค่าใช้จ่าย ส่วนการโหลด Maps และภาพ Static อาจมีค่าใช้จ่ายตาม billing ปัจจุบัน ผู้เล่นสองคนโหลดภาพแยกกัน และ refresh อาจโหลดใหม่ จำกัด scene Google สูงสุด 8 requests/รอบ ไม่ cache Google imagery บน disk/CDN/browser และไม่ตัด/แก้ attribution ดู [metadata](https://developers.google.com/maps/documentation/streetview/metadata), [Static API usage and billing](https://developers.google.com/maps/documentation/streetview/usage-and-billing), [Google policies](https://developers.google.com/maps/documentation/streetview/policies)

## ตัวแปรสภาพแวดล้อม

ดู `.env.example` ซึ่งไม่มี secret `.env*`, SQLite, key/pem และ artifacts ถูก ignore ไม่ต้อง commit `.env`

| ตัวแปร                                | ค่า/ความหมาย                                                                               |
| ------------------------------------- | ------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                        | local `file:./dev.db` สัมพันธ์กับ `prisma/`; Railway `file:/data/game.db`                  |
| `PORT`                                | local 3000; Railway ให้ระบบกำหนด                                                           |
| `BIND_HOST`                           | `0.0.0.0` รองรับ container/LAN; production ไม่ใช้ container `HOSTNAME`                     |
| `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY` | public Maps JavaScript key; เว้นว่างเล่น Demo                                              |
| `GOOGLE_MAPS_SERVER_KEY`              | secret Street View Static key; runtime เท่านั้น                                            |
| `GOOGLE_MAPS_SIGNING_SECRET`          | secret สำหรับเซ็น URL; optional                                                            |
| `NEXT_PUBLIC_SOCKET_URL`              | ว่าง = origin เดียวกับเว็บ แนะนำแบบนี้; ถ้าระบุ production ต้องเป็น `https://YOUR-DOMAIN`  |
| `CLIENT_ORIGIN`                       | allowed browser origins คั่น comma; production ต้อง HTTPS ไม่มี path; ว่างตรวจ same-origin |
| `LOCATION_HISTORY_STORAGE`            | `memory` (default) หรือ `database` เพื่อคงประวัติหลัง restart                              |
| `LOCATION_HISTORY_LIMIT`              | default 75, จำกัดสูงสุด 100 รายการ แนะนำ 50–100                                            |
| `GOOGLE_MAX_ATTEMPTS`                 | default 8, สูงสุด 12 ต่อการเลือกหนึ่งรอบ                                                   |
| `GOOGLE_MIN_DISTANCE_KM`              | default 1 กม. กัน Google panorama ที่อยู่ใกล้คำตอบก่อนหน้า                                 |
| `RECONNECT_GRACE_SECONDS`             | default 60 วินาที                                                                          |
| `ALLOWED_ORIGINS`, `HOSTNAME`         | รองรับ config local เดิม; ใช้ CLIENT_ORIGIN/BIND_HOST สำหรับ config ใหม่                   |

## เล่นสองคนและสถานที่หมด

1. เปิดแท็บแรก ตั้งชื่อ สร้างห้อง เปิดแท็บเปล่าใหม่แล้วพิมพ์ URL เพื่อเป็นผู้เล่นอีกคน (Duplicate Tab อาจคัดลอก session เดิม)
2. ใส่ชื่อและรหัสห้อง Host ตั้งค่า ทั้งคู่กดพร้อม Host เริ่มเกม การเปลี่ยน settings รีเซ็ต ready
3. ปักหมุดบนแผนที่ หรือกรอกพิกัด แล้วยืนยัน คำตอบล็อกหลังส่ง เฉลยเมื่อทั้งคู่ตอบหรือหมดเวลา
4. Host ไปต่อแต่ละรอบ รอบสุดท้ายดูสรุป ผลบันทึกลง SQLite แล้วเล่นใหม่ได้
5. รีเฟรชกลับเข้าผู้เล่นเดิมด้วย sessionStorage + private reconnect token เวลาเกมยังเดินต่อ หากไม่กลับภายใน grace period จะยกเลิกแมตช์

ตัวกรองหมวดและความยากเป็น **เงื่อนไขตายตัว** ไม่มีการลดระดับหรือข้ามหมวดอัตโนมัติ สถานที่ไม่ซ้ำตลอดแมตช์โดยตรวจ ID/pano ID; Google ตรวจระยะห่างพิกัดด้วย ไม่วนชุดเดิมแม้ตั้ง 10 รอบ ชุด Demo บางหมวดมีไม่ถึง 3 รอบ UI จะแจ้งให้ลดรอบ/เปลี่ยนตัวกรอง

ประวัติ recent ใช้ร่วมกันใน process ทุกห้อง ค่าเริ่มต้น 75 รายการ เก็บเฉพาะ ID และ timestamp ถ้าสถานที่สดไม่พอจะหยุดและแสดงปุ่มให้ **ผู้เล่นทั้งสองยืนยัน** ก่อนอนุญาตสถานที่จากเกมก่อนในแมตช์นี้ การโหวตคนเดียวหรือโหวตซ้ำไม่ปลดล็อก และการยืนยันไม่ล้างรายการที่ใช้ไปแล้วในแมตช์ปัจจุบัน ไม่ล้างประวัติส่วนกลางเงียบ ๆ เมื่อจบแมตช์ต้องขอ consent ใหม่หากจำเป็น

เล่น LAN: ใช้ IP เครื่อง server เช่น `http://192.168.1.10:3000` บนอุปกรณ์ทั้งสอง และเปิดพอร์ต Node.js ใน Windows Firewall เฉพาะเครือข่ายที่ใช้ ต้องมีอินเทอร์เน็ตโหลดแผนที่และ Google Fonts

## เตรียม Railway: หนึ่ง service + SQLite volume

**ยังไม่ได้ deploy, commit หรือ push** ขั้นตอนต่อไปนี้ให้เจ้าของโปรเจกต์ดำเนินการเมื่อพร้อม ไม่เหมาะกับ static hosting/serverless ที่ไม่มี long-running WebSocket process

1. ตรวจ `.gitignore` และรายการไฟล์ก่อนสร้าง private GitHub repository ด้วยตนเอง ห้ามเพิ่ม `.env`, DB, artifacts, server/signing keys ลง repository
2. Railway → New Project → Deploy from GitHub repo → เลือก repo โฟลเดอร์โปรเจกต์นี้มี `Dockerfile` ที่ build Next และรัน Node/Socket ใน service เดียว ใช้ Dockerfile detection; ไม่ต้องใช้ `railway.json` (Config as Code ถูกประกาศ deprecated)
3. เพิ่ม **Volume** mount path `/data` ให้ service นี้ แล้วตั้ง `DATABASE_URL=file:/data/game.db`, `BIND_HOST=0.0.0.0`, `LOCATION_HISTORY_STORAGE=database`, `LOCATION_HISTORY_LIMIT=75` ไม่ต้องกำหนด PORT เอง
4. Generate Domain ใน Networking ให้เป็น HTTPS แล้วตั้ง `CLIENT_ORIGIN=https://YOUR-DOMAIN` ไม่ใส่ slash/path ค่า `NEXT_PUBLIC_SOCKET_URL` เว้นว่างเพื่อใช้ origin เดียวกัน Socket.IO จะใช้ HTTPS และ upgrade เป็น WSS ผ่าน Railway proxy
5. ถ้าใช้ Google ใส่ keys ตามตารางใน Railway Variables จำกัด browser referrer ให้ตรง domain ใส่ browser key ก่อน build; Dockerfile ประกาศ ARG เฉพาะค่าที่เป็น public ไม่มี ARG/COPY สำหรับ server secret เปลี่ยน public vars/domain แล้ว deploy ใหม่
6. ตั้ง **Replicas = 1**, healthcheck path **`/health`**, timeout เช่น 120 วินาที, restart policy On Failure และเวลา graceful shutdown อย่างน้อย 10 วินาทีเมื่อมีการตั้งค่านี้ ปล่อย Start Command ว่างเพื่อใช้ Dockerfile CMD
7. CMD รัน `db:migrate` → `db:seed` → Node server ทุกครั้งที่เริ่ม หลัง volume mount แล้ว **อย่ารัน migrations ใน build/pre-deploy** เพราะ volume ไม่ได้ mount ในขั้นตอนเหล่านั้น migration เป็นไฟล์ versioned และ seed เป็น upsert
8. Deploy แล้วเปิด `https://YOUR-DOMAIN/health` ต้องได้ `{"ok":true}` เปิดสองเครื่องทดสอบสร้างห้อง พร้อม ส่งคำตอบครบเกม รีเฟรช reconnect และตรวจว่าบันทึกผลสำเร็จ
9. ทดสอบ redeploy: แมตช์ที่บันทึกและ recent history ต้องอยู่บน volume; ห้องที่กำลังเล่นจะหายเพราะเก็บใน memory สำรอง volume/SQLite ก่อนเปลี่ยน schema และติดตาม logs, disk, Google quota

`/health` (รองรับ `/api/health` เดิม) ตรวจ DB ด้วย `SELECT 1` และคืน 503 เมื่อ DB ใช้ไม่ได้หรือกำลัง shutdown; ไม่ตรวจ Google เพื่อให้ Demo ยังให้บริการได้ SIGTERM/SIGINT ปิดห้อง หยุดคำขอภาพ ปิด Socket/HTTP รอการบันทึก และ disconnect Prisma ภายในกรอบ 10 วินาที

Dockerfile ใช้ Node 22 Debian slim + OpenSSL มี Prisma CLI/tsx ใน runtime เพื่อ migrate/start ได้ ไม่ใช้ Next standalone ร่วมกับ custom server การตั้งหลาย replica ต้องเปลี่ยน SQLite/shared room state ก่อน เอกสาร: [Railway Dockerfiles](https://docs.railway.com/guides/dockerfiles), [Volumes](https://docs.railway.com/volumes), [Config as Code status](https://docs.railway.com/config-as-code/reference)

## สถาปัตยกรรมและความลับของคำตอบ

`LocationProvider.getNextLocation(options): Promise<GameLocation>` อยู่ `services/locations.ts` รับ settings, used IDs/positions, recent IDs, จำนวนรอบที่เหลือ และ AbortSignal มี Demo, Google และ fallback wrapper `GameServer` เรียกแบบ async ก่อนเปิดรอบ ป้องกัน start ซ้อนและผล async ที่กลับมาหลังออกจากห้อง

คำตอบจริง, pano ID, Google URLs/keys อยู่ server ก่อนเฉลย Client ได้เฉพาะ opaque `/api/scene/<random-token>` กับสถานะเกม จึงไม่สามารถอ่านพิกัดจาก Street View URL หรือ Socket payload ได้ Guess map เริ่มจากพิกัดกลางทั่วไป ไม่มีการส่ง panorama options ไป client ส่วน browser key เป็น public ตามการออกแบบ API

คะแนนคำนวณ server ด้วย Haversine รัศมี 6371.0088 กม. สูตร `round(5000 * exp(-distanceKm / 2000))` จำกัด 0–5000 ไม่ตอบได้ 0 ไม่รับคะแนน/เวลา/ตัวตนจาก payload ภาพรอบเก่า/อนาคตเรียกไม่ได้ public result เป็น whitelist ไม่มี pano/key แม้หลังเฉลย

SQLite มี `DemoLocation`, `Match`, `RecentLocation`; เกมสดอยู่ memory ผล Google ที่บันทึกเก็บคะแนน/คำตอบผู้เล่นและชื่อ/ID seed ที่เขียนเอง ไม่เก็บภาพหรือพิกัดคำตอบจาก Google ถ้า DB บันทึกไม่สำเร็จ UI แจ้งแต่ยังดูสรุปได้ ประวัติ recent ใน DB เก็บ pano ID ที่อนุญาตให้เก็บได้และ timestamp โดยจำกัดจำนวน ไม่มี Google image caching

ไฟล์สำคัญ:

```text
server/index.ts                 HTTP, Socket.IO, scene proxy, health, shutdown
server/game-server.ts           authoritative rooms, async rounds, consent
server/origin-policy.ts         production HTTPS/CORS checks
services/locations.ts           async provider interface + strict Demo/fallback
services/google-locations.ts    metadata retries, panorama dedup, signed static image
services/location-history.ts    bounded memory history
services/database.ts            Prisma persistence + bounded DB history
data/google-seeds.ts            authored candidate coordinates
components/adaptive-game-map.tsx Google/Leaflet selection
components/google-game-map.tsx  Google guess/reveal map
components/location-status.tsx  loading, exhaustion, two-player consent
lib/google-maps-client.ts       browser script loader/auth failure
app/terms, app/privacy          public terms/privacy pages
prisma/migrations/             initial schema + recent history
Dockerfile, .dockerignore       Railway container preparation
```

Socket client events เดิมคงอยู่ เพิ่ม `room:history-reset` และ `room:demo-fallback` ทุก command มี ack `{ok,error?,session?}` ไม่มี API key payload

## ตรวจสอบ

```powershell
npm run lint
npm run typecheck
npm test
node scripts/verify-migrations.mjs
npm run build
npm start
# อีก terminal ขณะ server ทำงาน
node scripts/smoke.mjs
```

หยุด dev ก่อน start เพื่อคืนพอร์ต หาก regenerate Prisma บน Windows ให้หยุด server เพื่อเลี่ยง DLL lock `verify-migrations` สร้าง DB ทดสอบแยกใน artifacts ไม่แตะ DB เกม; smoke สร้างผลเกมชื่อ Smoke A/B ใน DB ที่ server ใช้อยู่ ตั้ง `SMOKE_URL` เมื่อต้องการ URL อื่น

Production บังคับ browser origin เป็น HTTPS จึงต้องเปิดผ่าน HTTPS proxy/domain หากทดสอบ UI ของ production ในเครื่อง ใช้ `npm run dev` สำหรับ UI ที่ `http://localhost:3000`; smoke script ตรวจ production ผ่าน HTTP ภายในได้เพราะเป็น server client ที่ไม่มี browser Origin

ผลตรวจรอบนี้: lint, typecheck, 49 tests, production build ผ่าน; migrations + seed บน DB ใหม่ผ่าน; smoke ทั้ง dev/production ผ่าน HTTP ภาพจริง ผู้เล่นสองคนสามรอบ และ SQLite; ตรวจ UI สองแท็บเลือก Google โดยไม่มี keys แล้ว fallback เป็น Demo ผ่าน

Tests ครอบคลุม scoring/validation, image metadata, strict filtering, no key, Google metadata/API failure/quota/timeout, bounded retries, pano/proximity/history dedup, URL signing, CORS, และ Socket.IO จริงสอง client รวมถึงทั้งสองโหวต ไม่รับสถานที่ซ้ำจาก provider ที่ผิดพลาด และ async cancellation

ข้อจำกัดการตรวจ: ไม่มี Google keys ในเครื่อง จึงยังไม่ยืนยันภาพ/Maps ด้วย billing project จริง ใช้ mocked HTTP response ทดสอบ Google logic เครื่องนี้ไม่มี Docker CLI จึงยังไม่ได้ build/run container หรือทดสอบ Railway deployment จริง

## ข้อจำกัดที่ยังเหลือ

- ห้องสดหายเมื่อ server restart; ไม่มีหลาย replicas, Redis, บัญชีผู้ใช้ หรือ UI ประวัติย้อนหลัง SQLite volume เก็บเฉพาะข้อมูลถาวร
- จำนวน seed ไม่รับประกันว่าทุกจุดมี panorama หรือเปิดใช้ครบ 10 รอบตามตัวกรองได้ API จะตรวจตอนเล่นและแจ้งเมื่อหาไม่ได้ ต้องตรวจ seed/heading/ความยากเพิ่มก่อนเปิดบริการกว้าง
- การไม่ซ้ำ recent เป็น best effort ข้ามห้องที่เริ่มพร้อมกัน แต่ภายในแมตช์ตรวจซ้ำอย่างเคร่งครัด แมตช์ที่ยกเลิกยังนับสถานที่ที่เปิดไปใน recent history
- ภาพ Static ไม่มีการเดินหรือหมุน; ไม่มีการป้องกัน reverse image search หรือการโกงจากความรู้ dataset
- ผู้ดูแลต้องตรวจ `/terms` และ `/privacy` ให้ตรงบริการจริง รวมระยะเก็บข้อมูล ช่องทางติดต่อ และข้อกำหนด Google ก่อนเปิดสาธารณะ
- Demo ใช้ OSM สาธารณะพร้อม attribution; เลือก tile service ตามปริมาณการใช้งานหากเปิดกว้าง UI ภาษาไทยเป็นหลัก ยังไม่มีสวิตช์ภาษา

เครดิตภาพ Demo ดู `/credits` และ `data/locations.json` หากดาวน์โหลดใหม่ใช้ `node scripts/fetch-demo.mjs` ไม่ต้องรันเพื่อเริ่มเกม
#   G E O - l o o k n a m  
 