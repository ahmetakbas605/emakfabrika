import type { Metadata } from "next";
import "./globals.css";
import { MotionScope } from "@/components/shell/MotionScope";

export const metadata: Metadata = {
  title: "emakfabrika",
  description: "Fabrika/Holding bazlı, departman modüllü ERP — mimari iskelet aşaması."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        {/* Görsel Yenileme Faz 0 — hareket bütçesi TÜM rotaları kapsar,
            yalnızca /dashboard'u değil: /login de bir "sahne" sayfası
            (bkz. lib/motion.ts). Ayrı bir dashboard/layout.tsx açmak
            yerine kök layout'a konuldu — tek nokta, daha az dosya.
            MotionScope bir istemci bileşeni ama `children` sunucu
            tarafında render edilmeye DEVAM EDER (children prop olarak
            geçer, istemciye serileşmez). */}
        <MotionScope>{children}</MotionScope>
      </body>
    </html>
  );
}
