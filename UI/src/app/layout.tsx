import type { Metadata } from "next";


export const metadata: Metadata = {
  title: "Auto-CV Sender Control Hub",
  description: "Layer 2 profile storage and application tracking dashboard.",
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
