import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "ZapDash | NYC land-use application activity",
  description:
    "An independent, searchable view of discretionary land-use application activity reported through NYC Planning's Zoning Application Portal.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
