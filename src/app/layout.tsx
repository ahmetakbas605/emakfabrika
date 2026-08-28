import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "emakfabrika",
  description: "Fabrika/Holding bazlı, departman modüllü ERP — mimari iskelet aşaması."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
