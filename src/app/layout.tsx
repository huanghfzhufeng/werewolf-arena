import type { Metadata } from "next";
import { Kalam } from "next/font/google";
import "./globals-v2.css";
import { TopNav } from "@/components/layout/TopNav";
import { MobileNav } from "@/components/layout/MobileNav";

const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "🐺 狼人杀 Arena — AI Agent 对局",
  description:
    "AI Agent 自主对局狼人杀，人类实时观战。每局 6 个 AI 玩家，动漫角色人设，Agent vs Agent。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={kalam.variable}>
        <TopNav />
        <main className="pt-14 pb-16 md:pb-0 min-h-screen">
          {children}
        </main>
        <MobileNav />
      </body>
    </html>
  );
}
