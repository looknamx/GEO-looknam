"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  Compass,
  Globe2,
  MapPin,
  Plus,
  ScanLine,
  Sparkles,
  Users,
  Flag,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGame } from "@/hooks/use-game";
import { nameSchema, roomCodeSchema } from "@/lib/game";
export function Landing() {
  const { request, connected, pending } = useGame();
  const [mode, setMode] = useState<"create" | "join">("create");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [validation, setValidation] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidation("");
    const parsed = nameSchema.safeParse(name);
    if (!parsed.success) return setValidation(parsed.error.issues[0].message);
    if (mode === "join") {
      const roomCode = roomCodeSchema.safeParse(code);
      if (!roomCode.success)
        return setValidation(roomCode.error.issues[0].message);
      await request((socket, ack) =>
        socket.emit(
          "room:join",
          { name: parsed.data, code: roomCode.data },
          ack,
        ),
      );
    } else
      await request((socket, ack) =>
        socket.emit("room:create", { name: parsed.data }, ack),
      );
  };
  return (
    <>
      <section className="hero">
        <div className="hero-grid" />
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65 }}
        >
          <div className="eyebrow">
            <span className="live-dot" /> TWO FRIENDS. ONE WORLD.
          </div>
          <h1>
            โลกกว้างแค่ไหน
            <br />
            <span className="gradient-text">ก็ทายให้เจอ.</span>
          </h1>
          <p className="hero-description">
            เห็นภาพเดียวกัน แต่จะคิดถึงที่เดียวกันไหม?
            <br />
            ชวนเพื่อนออกสำรวจ ปักหมุดคำตอบ
            <br className="mobile-break" /> แล้วมาดูกันว่าใครรู้จักโลกมากกว่า
          </p>
          <div className="hero-actions">
            <Button asChild>
              <a href="#play" onClick={() => setMode("create")}>
                <Plus size={18} /> สร้างห้องใหม่ <ArrowRight size={18} />
              </a>
            </Button>
            <Button variant="secondary" asChild>
              <a href="#play" onClick={() => setMode("join")}>
                <Users size={18} /> เข้าร่วมห้อง
              </a>
            </Button>
          </div>
          <div className="hero-points">
            <span>
              <Check size={14} /> ไม่ต้องสมัครสมาชิก
            </span>
            <span>
              <Check size={14} /> เล่นฟรีกับเพื่อน 2 คน
            </span>
          </div>
          <a className="text-link how-link" href="#how-to-play">
            พร้อมหลงทางหรือยัง? ดูวิธีเล่น <ArrowDown size={14} />
          </a>
        </motion.div>
        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
        >
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="coordinate coord-top">
            37°49′11.6″N &nbsp; 122°28′42.0″W
          </div>
          <div className="destination-main">
            <img src="/hero.jpg" alt="สะพานโกลเดนเกตเหนืออ่าวซานฟรานซิสโก" />
            <div className="photo-gradient" />
            <span className="photo-tag">
              <ScanLine size={14} /> EXPLORE THE UNKNOWN
            </span>
            <div className="destination-caption">
              <span>ที่นี่… ที่ไหน?</span>
              <p>
                YOUR NEXT ADVENTURE AWAITS <ArrowRight size={16} />
              </p>
            </div>
            <div className="crosshair" />
          </div>
          <div className="pin-bubble">
            <MapPin size={32} fill="currentColor" strokeWidth={1.5} />
            <span>จุดหมายต่อไป อยู่ที่คุณ</span>
          </div>
          <div className="destination-small">
            <img src="/thailand.jpg" alt="เกาะตะปูในอ่าวพังงา" />
            <span>
              <MapPin size={14} /> SOMEWHERE IN THAILAND
            </span>
          </div>
          <div className="versus-badge">
            <div className="avatar avatar-0">A</div>
            <b>VS</b>
            <div className="avatar avatar-1">B</div>
            <div>
              <strong>เพื่อนกัน… ท้ากันได้</strong>
              <small>แข่งขันแบบเรียลไทม์</small>
            </div>
          </div>
          <span className="coordinate coord-bottom">
            A LITTLE LOST. A LOT OF FUN. <Compass size={16} />
          </span>
        </motion.div>
      </section>
      <section className="world-strip">
        <span>
          <Globe2 size={21} />
          <b>24</b> จุดหมายทั่วโลก
        </span>
        <i />
        <span>
          <Users size={21} />
          <b>2</b> นักสำรวจ
        </span>
        <i />
        <span>
          <Flag size={21} />
          <b>5,000</b> คะแนนต่อรอบ
        </span>
        <i />
        <span>
          <Sparkles size={21} /> การเดินทางที่ไม่ซ้ำเดิม
        </span>
      </section>
      <section id="play" className="play-section">
        <div className="section-copy">
          <div className="eyebrow">LET’S GET LOST</div>
          <h2>
            การผจญภัยที่ดี
            <br />
            เริ่มจากเพื่อนหนึ่งคน
          </h2>
          <p>
            ตั้งชื่อของคุณ สร้างห้อง แล้วส่งรหัสให้เพื่อน
            <br />
            เลือกจุดหมาย ตั้งเวลา และออกเดินทางได้เลย
          </p>
          <div className="small-note">
            <span className="live-dot" /> ห้องส่วนตัวสำหรับคุณและเพื่อนเท่านั้น
          </div>
        </div>
        <form className="play-card panel" onSubmit={submit}>
          <div className="tabs" aria-label="วิธีเข้าเล่น">
            <button
              type="button"
              className={mode === "create" ? "active" : ""}
              onClick={() => {
                setMode("create");
                setValidation("");
              }}
            >
              <Plus size={17} />
              สร้างห้องใหม่
            </button>
            <button
              type="button"
              className={mode === "join" ? "active" : ""}
              onClick={() => {
                setMode("join");
                setValidation("");
              }}
            >
              <Users size={17} />
              เข้าร่วมห้อง
            </button>
          </div>
          <label htmlFor="player-name">
            ชื่อของนักสำรวจ <span>ไม่เกิน 20 ตัวอักษร</span>
          </label>
          <input
            id="player-name"
            value={name}
            maxLength={20}
            onChange={(e) => setName(e.target.value)}
            placeholder="เพื่อน ๆ เรียกคุณว่าอะไร?"
            autoComplete="nickname"
            required
            aria-describedby={validation ? "form-error" : undefined}
          />
          {mode === "join" && (
            <>
              <label htmlFor="room-code">รหัสห้องจากเพื่อน</label>
              <input
                id="room-code"
                className="code-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="ABCD-2345"
                maxLength={9}
                autoComplete="off"
                autoCapitalize="characters"
                required
              />
            </>
          )}
          {validation && (
            <p id="form-error" role="alert" className="error-text">
              {validation}
            </p>
          )}
          <Button
            className="w-full"
            disabled={!connected || pending}
            type="submit"
          >
            {pending
              ? "กำลังเตรียมการเดินทาง…"
              : mode === "create"
                ? "สร้างห้องและชวนเพื่อน"
                : "เข้าร่วมการเดินทาง"}
            <ArrowRight size={18} />
          </Button>
          <p className="form-note">
            {connected
              ? "ไม่ต้องสมัคร · ไม่มีค่าใช้จ่าย · เล่นผ่านเบราว์เซอร์"
              : "กำลังเชื่อมต่อเซิร์ฟเวอร์…"}
          </p>
        </form>
      </section>
      <section id="how-to-play" className="how-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">HOW TO PLAY</div>
            <h2>สามขั้นตอน แล้วเจอกันรอบโลก</h2>
          </div>
          <span className="muted">ไม่ต้องเก่งภูมิศาสตร์ ก็สนุกได้</span>
        </div>
        <div className="steps">
          {[
            {
              icon: Users,
              title: "ชวนเพื่อนเข้าห้อง",
              copy: "สร้างห้องส่วนตัว แล้วส่งรหัสให้เพื่อนอีกคน เลือกจำนวนรอบและเวลาที่อยากเล่น",
            },
            {
              icon: ScanLine,
              title: "มองภาพ แล้วปักหมุด",
              copy: "สังเกตตึก ถนน ภูเขา หรือเบาะแสในภาพ แล้วเลือกคำตอบของคุณบนแผนที่",
            },
            {
              icon: Flag,
              title: "ใครใกล้กว่า รับคะแนนไป",
              copy: "เฉลยพร้อมกันเมื่อทั้งคู่ตอบหรือหมดเวลา ยิ่งปักหมุดใกล้ ยิ่งได้คะแนนเยอะ",
            },
          ].map((step, i) => (
            <div className="step" key={step.title}>
              <div className="step-top">
                <step.icon size={24} />
                <span>0{i + 1}</span>
              </div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="destinations">
        <div className="section-heading">
          <div>
            <div className="eyebrow">A WORLD TO DISCOVER</div>
            <h2>วันนี้… จะหลงไปที่ไหนดี?</h2>
          </div>
          <span className="pill">DEMO COLLECTION</span>
        </div>
        <div className="destination-grid">
          {[
            {
              image: "thailand",
              title: "เสน่ห์เมืองไทย",
              subtitle: "จากวัดเก่า สู่ทะเลสีคราม",
              tag: "THAILAND",
            },
            {
              image: "paris",
              title: "เมืองที่เคยฝันถึง",
              subtitle: "เรื่องราวใหม่ในทุกมุมเมือง",
              tag: "LANDMARKS",
            },
            {
              image: "fuji",
              title: "ธรรมชาติที่น่าค้นหา",
              subtitle: "ตามรอยภูเขา ทะเล และฟ้ากว้าง",
              tag: "NATURE",
            },
          ].map((item) => (
            <a href="#play" className="destination-tile" key={item.image}>
              <img src={`/${item.image}.jpg`} alt={item.title} loading="lazy" />
              <div className="photo-gradient" />
              <span className="photo-tag">{item.tag}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.subtitle}</p>
              </div>
              <ArrowRight size={20} />
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
