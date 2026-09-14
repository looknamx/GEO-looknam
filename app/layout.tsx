import type { Metadata } from "next";
import { GameProvider } from "@/hooks/use-game";
import "./globals.css";
export const metadata: Metadata = {
  title: "Where Are We? — โลกกว้าง แค่ทายให้เจอ",
  description:
    "ชวนเพื่อนออกสำรวจโลก แข่งทายสถานที่ 2–4 คน ทีม 2v2 และโหมด HP เอาตัวรอด",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <GameProvider>{children}</GameProvider>
      </body>
    </html>
  );
}
