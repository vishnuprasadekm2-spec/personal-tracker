import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Personal Task Dashboard",
  description: "A premium, full-stack personal task tracker and daily report dashboard with built-in rich-text notepad and automated templates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
