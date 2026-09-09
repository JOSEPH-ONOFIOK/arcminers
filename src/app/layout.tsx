import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Proving Shaft, Arc Miners",
  description:
    "A pre-mint dig for Arc Miners. Pick a rig, work the seam, and let the log decide what you assay.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
