import type { Metadata } from "next";
import "./globals.css";

// This Metadata controls what shows up in Google Search and the Browser Tab!
export const metadata: Metadata = {
  title: "Digital Heroes | Golf Charity Platform",
  description: "A premium subscription platform combining golf performance tracking, charity fundraising, and monthly draw-based rewards.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* We apply the dark background globally here so the page never flashes white while loading */}
      <body className="bg-gray-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}