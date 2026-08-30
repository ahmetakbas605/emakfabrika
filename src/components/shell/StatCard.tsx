'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView, animate } from 'framer-motion';
import { ICONS, type IconName } from './icons';

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

  const accentColor = { violet: 'var(--aurora-violet)', cyan: 'var(--aurora-cyan)', emerald: 'var(--aurora-emerald)', warn: 'var(--aurora-warn)', danger: 'var(--aurora-danger)' }[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className="glass-card p-5 relative overflow-hidden"
    >
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-20 blur-2xl" style={{ background: accentColor }} />
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium" style={{ color: 'var(--aurora-text-dim)' }}>{label}</span>
        <Icon size={16} style={{ color: accentColor }} />
      </div>
      <div className="text-3xl font-bold tabular-nums" style={{ fontFamily: 'var(--font-display)' }}>
        <span ref={ref}>{display}</span>{suffix}
      </div>
    </motion.div>
  );
}
