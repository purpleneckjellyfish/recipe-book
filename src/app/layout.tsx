import type { Metadata, Viewport } from "next";
import { Figtree, Syne } from "next/font/google";
import { RegisterSw } from "@/components/RegisterSw";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Recipe Book",
    template: "%s · Recipe Book",
  },
  description:
    "Your household recipe archive, meal planner, and shopping list — self-hosted and shared.",
  applicationName: "Recipe Book",
  appleWebApp: {
    capable: true,
    title: "Recipe Book",
    statusBarStyle: "default",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#e8efeb",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${figtree.variable} ${syne.variable} h-full`}>
      <body className="relative min-h-full antialiased">
        <RegisterSw />
        {children}
      </body>
    </html>
  );
}
