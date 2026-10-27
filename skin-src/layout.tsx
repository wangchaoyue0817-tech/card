import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./report-v9.css";
import "./report-v10.css";
import "./skin-management.css";
import "./commerce-refresh.css";
import "./order-center.css";
import "./field-review.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") ?? incoming.get("host") ?? "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const base = `${protocol}://${host}`;
  return {
    title: "图灵鉴 X · AI 肌肤检测",
    description: "11维AI肌肤状态分析、科技感面部热力图与专属皮肤说明书。",
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title: "图灵鉴 X · AI 肌肤检测",
      description: "看见肌肤此刻的状态",
      images: [{ url: `${base}/og.png`, width: 1734, height: 908, alt: "图灵鉴 X AI 肌肤检测" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "图灵鉴 X · AI 肌肤检测",
      description: "11维分析 · 隐私保护 · 专属皮肤说明书",
      images: [`${base}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
