// One-time asset preparation. Gameplay never calls Wikipedia or exposes filenames.
import { mkdir, writeFile, copyFile, readFile } from "node:fs/promises";
const entries = [
  [
    "Wat Arun",
    "วัดอรุณราชวราราม",
    "Thailand",
    "landmark",
    13.7437,
    100.4889,
    "easy",
    "พระปรางค์ริมแม่น้ำเจ้าพระยา กรุงเทพฯ",
  ],
  [
    "Wat Phra That Doi Suthep",
    "วัดพระธาตุดอยสุเทพ",
    "Thailand",
    "landmark",
    18.8049,
    98.9217,
    "normal",
    "วัดบนดอยทางตะวันตกของเมืองเชียงใหม่",
  ],
  [
    "James Bond Island",
    "เกาะตะปู พังงา",
    "Thailand",
    "nature",
    8.2745,
    98.5008,
    "easy",
    "แท่งหินปูนกลางทะเลในอ่าวพังงา ใกล้ภูเก็ต",
  ],
  [
    "Wat Mahathat (Ayutthaya)",
    "วัดมหาธาตุ อยุธยา",
    "Thailand",
    "landmark",
    14.3569,
    100.5675,
    "normal",
    "ซากวัดโบราณในอุทยานประวัติศาสตร์พระนครศรีอยุธยา",
  ],
  [
    "Railay Beach",
    "หาดไร่เลย์",
    "Thailand",
    "nature",
    8.0119,
    98.8371,
    "hard",
    "ชายหาดล้อมด้วยหน้าผาหินปูน จังหวัดกระบี่",
  ],
  [
    "Sukhothai Historical Park",
    "อุทยานประวัติศาสตร์สุโขทัย",
    "Thailand",
    "landmark",
    17.0171,
    99.7036,
    "hard",
    "ศูนย์กลางอาณาจักรสุโขทัยในอดีต",
  ],
  [
    "Phuket City",
    "เมืองเก่าภูเก็ต",
    "Thailand",
    "city",
    7.8845,
    98.3897,
    "normal",
    "ย่านเมืองเก่าที่มีอาคารสไตล์ชิโนโปรตุกีส",
  ],
  [
    "Eiffel Tower",
    "หอไอเฟล ปารีส",
    "France",
    "landmark",
    48.8584,
    2.2945,
    "easy",
    "หอคอยเหล็กริมแม่น้ำแซน สร้างสำหรับงานแสดงโลกปี 1889",
  ],
  [
    "Tower Bridge",
    "ทาวเวอร์บริดจ์ ลอนดอน",
    "United Kingdom",
    "landmark",
    51.5055,
    -0.0754,
    "easy",
    "สะพานเปิดข้ามแม่น้ำเทมส์ในกรุงลอนดอน",
  ],
  [
    "Statue of Liberty",
    "เทพีเสรีภาพ นิวยอร์ก",
    "United States",
    "landmark",
    40.6892,
    -74.0445,
    "easy",
    "อนุสาวรีย์บนเกาะลิเบอร์ตีในอ่าวนิวยอร์ก",
  ],
  [
    "Tokyo Tower",
    "โตเกียวทาวเวอร์",
    "Japan",
    "city",
    35.6586,
    139.7454,
    "easy",
    "หอคอยสีส้มขาวในเขตมินาโตะ กรุงโตเกียว",
  ],
  [
    "Mount Fuji",
    "ภูเขาไฟฟูจิ",
    "Japan",
    "nature",
    35.3606,
    138.7274,
    "normal",
    "ภูเขาไฟที่สูงที่สุดในญี่ปุ่น",
  ],
  [
    "Sydney Opera House",
    "ซิดนีย์โอเปราเฮาส์",
    "Australia",
    "landmark",
    -33.8568,
    151.2153,
    "easy",
    "อาคารศิลปะการแสดงริมอ่าวซิดนีย์",
  ],
  [
    "Golden Gate Bridge",
    "สะพานโกลเดนเกต",
    "United States",
    "landmark",
    37.8199,
    -122.4783,
    "normal",
    "สะพานแขวนเหนือช่องแคบโกลเดนเกต ซานฟรานซิสโก",
  ],
  [
    "Colosseum",
    "โคลอสเซียม กรุงโรม",
    "Italy",
    "landmark",
    41.8902,
    12.4922,
    "easy",
    "สนามกีฬากลางแจ้งขนาดใหญ่จากสมัยโรมัน",
  ],
  [
    "Taj Mahal",
    "ทัชมาฮาล",
    "India",
    "landmark",
    27.1751,
    78.0421,
    "easy",
    "สุสานหินอ่อนสีขาวริมแม่น้ำยมุนา เมืองอัครา",
  ],
  [
    "Machu Picchu",
    "มาชูปิกชู",
    "Peru",
    "landmark",
    -13.1631,
    -72.545,
    "hard",
    "นครโบราณของชาวอินคาบนเทือกเขาแอนดีส",
  ],
  [
    "Petra",
    "นครเปตรา",
    "Jordan",
    "landmark",
    30.3285,
    35.4444,
    "hard",
    "นครโบราณที่มีอาคารสลักเข้าไปในหน้าผาหินทราย",
  ],
  [
    "Grand Canyon",
    "แกรนด์แคนยอน",
    "United States",
    "nature",
    36.1069,
    -112.1129,
    "normal",
    "หุบผาลึกที่เกิดจากการกัดเซาะของแม่น้ำโคโลราโด",
  ],
  [
    "Santorini",
    "ซานโตรินี",
    "Greece",
    "city",
    36.4618,
    25.3753,
    "normal",
    "เกาะภูเขาไฟในทะเลอีเจียน มีอาคารสีขาวบนหน้าผา",
  ],
  [
    "Table Mountain",
    "ภูเขาเทเบิล",
    "South Africa",
    "nature",
    -33.9628,
    18.4098,
    "hard",
    "ภูเขายอดราบเหนือเมืองเคปทาวน์",
  ],
  [
    "Niagara Falls",
    "น้ำตกไนแอการา",
    "Canada",
    "nature",
    43.0799,
    -79.0747,
    "normal",
    "กลุ่มน้ำตกบนพรมแดนแคนาดาและสหรัฐอเมริกา",
  ],
  [
    "Burj Khalifa",
    "เบิร์จคาลิฟา ดูไบ",
    "United Arab Emirates",
    "city",
    25.1972,
    55.2744,
    "normal",
    "ตึกระฟ้าใจกลางเมืองดูไบ",
  ],
  [
    "Marina Bay Sands",
    "มารีนาเบย์แซนด์ส",
    "Singapore",
    "city",
    1.2834,
    103.8607,
    "normal",
    "อาคารสามหลังเชื่อมด้วยสวนลอยฟ้าริมอ่าวสิงคโปร์",
  ],
];
const headers = {
  "User-Agent": "WhereAreWeDemo/1.0 (educational local multiplayer demo)",
};
const api = async (host, params) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetch(
      `https://${host}/w/api.php?${new URLSearchParams({ format: "json", ...params })}`,
      { headers },
    );
    if (response.ok) return response.json();
    if (response.status !== 429) throw new Error(`API ${response.status}`);
    await new Promise((resolve) => setTimeout(resolve, 12000 * (attempt + 1)));
  }
  throw new Error("API rate limit");
};
await mkdir("data/images", { recursive: true });
await mkdir("public", { recursive: true });
const locations = JSON.parse(
  await readFile("data/locations.json", "utf8").catch(() => "[]"),
);
for (const [i, e] of entries.entries()) {
  if (locations[i]) continue;
  await new Promise((resolve) => setTimeout(resolve, 1700));
  const [title, name, country, category, lat, lng, difficulty, description] = e;
  const query = await api("en.wikipedia.org", {
    action: "query",
    titles: title,
    redirects: "1",
    prop: "pageimages",
    pithumbsize: "1280",
  });
  const page = Object.values(query.query.pages)[0];
  if (!page.thumbnail) throw new Error(`No photo: ${title}`);
  const meta = await api("commons.wikimedia.org", {
    action: "query",
    titles: `File:${page.pageimage}`,
    prop: "imageinfo",
    iiprop: "extmetadata",
  });
  const info = Object.values(meta.query.pages)[0].imageinfo?.[0]?.extmetadata;
  const plain = (s) =>
    (s || "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const credit = `${plain(info?.Artist?.value) || "Wikimedia Commons"} · ${plain(info?.LicenseShortName?.value) || "See source for license"}`;
  const response = await fetch(page.thumbnail.source, { headers });
  if (!response.ok) throw new Error(`Image ${response.status}: ${title}`);
  const id = String(i + 1).padStart(3, "0");
  await writeFile(
    `data/images/${id}.jpg`,
    Buffer.from(await response.arrayBuffer()),
  );
  locations.push({
    id,
    name,
    country,
    category,
    lat,
    lng,
    difficulty,
    description,
    image: `data/images/${id}.jpg`,
    source: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(page.pageimage)}`,
    credit,
  });
  await writeFile(
    "data/locations.json",
    JSON.stringify(locations, null, 2) + "\n",
  );
  console.log(`${id} ${title} (${credit.slice(-65)})`);
}
await writeFile(
  "data/locations.json",
  JSON.stringify(locations, null, 2) + "\n",
);
await copyFile("data/images/014.jpg", "public/hero.jpg");
await copyFile("data/images/003.jpg", "public/thailand.jpg");
await copyFile("data/images/008.jpg", "public/paris.jpg");
await copyFile("data/images/012.jpg", "public/fuji.jpg");
