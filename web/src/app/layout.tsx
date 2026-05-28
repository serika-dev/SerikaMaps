import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Serika Maps — Navigate Your World",
  description:
    "A premium, open-source maps platform with real-time navigation, beautiful dark UI, and Android Auto support.",
  keywords: ["maps", "navigation", "open source", "serika", "directions"],
  openGraph: {
    title: "Serika Maps",
    description: "Navigate Your World — Premium open-source maps.",
    url: "https://maps.serika.dev",
    siteName: "Serika Maps",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
