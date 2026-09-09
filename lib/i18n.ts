export const th = {
  brand: "Where Are We?",
  createRoom: "สร้างห้องใหม่",
  joinRoom: "เข้าร่วมห้อง",
  categories: {
    world: "ทั่วโลก",
    thailand: "ประเทศไทย",
    city: "เมือง",
    nature: "ธรรมชาติ",
    landmark: "แลนด์มาร์ก",
  },
  difficulties: { easy: "ง่าย", normal: "ปกติ", hard: "ยาก" },
};
export type Messages = typeof th;
export const messages: Record<string, Messages> = { th };
