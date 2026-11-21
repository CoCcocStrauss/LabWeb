import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ViewportSizing } from "./components/ViewportSizing";

export const metadata: Metadata = {
  title: "行为科学实验",
  description: "行为科学实验页面",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="min-h-[100dvh]"><ViewportSizing />{children}</body>
    </html>
  );
}
