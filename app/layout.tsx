import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MadeThis CMO — Autonomous marketing, with judgment",
  description:
    "A self-improving AI chief marketing officer that finds opportunities, protects relationship capital, and learns from outcomes.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
