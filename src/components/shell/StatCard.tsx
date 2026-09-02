'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, animate } from 'framer-motion';
import { ICONS, type IconName } from './icons';

// Görsel Yenileme Faz 1 — Stitch'in "Summary Cards Bento" kartı.
// Yapı oradan birebir: üstte mono-metric etiket, altında headline-xl
// sayı, sağ üstte soluk ikon, kartın tamamında %3 opaklıkta 20px ızgara
// dokusu. Kart yüzeyi buzlu cam + 24px yarıçap + kıl-çizgi; GÖLGE YOK.
//
// accent adları (violet/cyan/emerald...) çağrı yerlerini bozmamak için
// KORUNDU, ama artık Dimension'ın aksan bütçesine bakıyorlar: cyan
// kobalta, violet dusk-violet'e düşüyor. Yeni renk EKLENMEDİ.
const ACCENTS: Record<string, string> = {
  violet: 'var(--dim-violet)',
  cyan: 'var(--dim-cobalt)',
  emerald: 'var(--dim-success)',
  warn: 'var(--dim-warning)',
  danger: 'var(--dim-danger)'
};

export function StatCard({ label, value, icon, accent = 'violet', suffix = '', delay = 0 }: {
  label: string; value: number; icon: IconName; accent?: 'violet' | 'cyan' | 'emerald' | 'warn' | 'danger'; suffix?: string; delay?: number;
}) {
  const Icon = ICONS[icon];
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, { duration: 1.1, delay, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => setDisplay(Math.round(v)) });
    return () => controls.stop();
  }, [inView, value, delay]);

  const accentColor = ACCENTS[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="dim-card group relative flex flex-col justify-between overflow-hidden p-7"
      style={{ minHeight: 168 }}
    >
      <div className="dim-grid-overlay" aria-hidden="true" />

      <div className="absolute right-6 top-6 opacity-50 transition-opacity group-hover:opacity-100">
        <Icon size={18} strokeWidth={1.5} style={{ color: accentColor }} />
      </div>

      <span className="dim-metric relative z-10" style={{ color: 'var(--dim-on-surface-variant)' }}>{label}</span>

      <div className="dim-h1 relative z-10 mt-6 tabular-nums" style={{ color: 'var(--dim-primary)' }}>
        <span ref={ref}>{display}</span>
        {suffix ? <span className="dim-technical ml-2" style={{ color: 'var(--dim-on-surface-variant)' }}>{suffix}</span> : null}
      </div>
    </motion.div>
  );
}
