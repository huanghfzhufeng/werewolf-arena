import type { Metadata } from "next";
import { Kalam, Patrick_Hand } from "next/font/google";
import "./globals.css";

const kalam = Kalam({
  variable: "--font-kalam",
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
});

const patrickHand = Patrick_Hand({
  variable: "--font-patrick",
  subsets: ["latin"],
  weight: ["400"],
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
      <body className={`${kalam.variable} ${patrickHand.variable}`}>
        {children}
      </body>
    </html>
  );
}
