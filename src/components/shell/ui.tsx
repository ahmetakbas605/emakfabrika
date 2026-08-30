'use client';

import { motion } from 'framer-motion';

export function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mb-8">
      <div className="text-[11px] font-semibold tracking-widest uppercase mb-2" style={{ color: 'var(--aurora-cyan)', fontFamily: 'var(--font-mono)' }}>{eyebrow}</div>
      <h1 className="text-2xl md:text-[28px] font-bold tracking-tight mb-2" style={{ fontFamily: 'var(--font-display)' }}>{title}</h1>
      {description ? <p className="text-sm max-w-2xl" style={{ color: 'var(--aurora-text-dim)' }}>{description}</p> : null}
    </motion.div>
  );
}

export function GlassPanel({ children, className = '', title, action }: { children: React.ReactNode; className?: string; title?: string; action?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className={`glass-card p-5 ${className}`}>
      {title ? (
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </motion.div>
  );
}

const RISK_STYLES: Record<string, { bg: string; fg: string }> = {
  LOW: { bg: 'rgba(52,211,153,0.14)', fg: '#34d399' },
  MEDIUM: { bg: 'rgba(245,165,36,0.14)', fg: '#f5a524' },
  HIGH: { bg: 'rgba(251,90,110,0.14)', fg: '#fb5a6e' },
  CRITICAL: { bg: 'rgba(255,61,113,0.18)', fg: '#ff3d71' }
};

export function RiskBadge({ level }: { level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }) {
  const s = RISK_STYLES[level] ?? RISK_STYLES.LOW;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: s.bg, color: s.fg }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.fg }} />
      {level}
    </span>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent' }) {
  const tones: Record<string, { bg: string; fg: string }> = {
    neutral: { bg: 'rgba(255,255,255,0.08)', fg: 'var(--aurora-text-dim)' },
    ok: { bg: 'rgba(52,211,153,0.14)', fg: '#34d399' },
    warn: { bg: 'rgba(245,165,36,0.14)', fg: '#f5a524' },
    danger: { bg: 'rgba(251,90,110,0.14)', fg: '#fb5a6e' },
    accent: { bg: 'rgba(139,92,246,0.16)', fg: '#a78bfa' }
  };
  const s = tones[tone];
  return <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: s.bg, color: s.fg }}>{children}</span>;
}

export function AuroraButton({ children, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const base = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    primary: 'text-black hover:brightness-110 active:scale-[0.98]',
    ghost: 'border hover:bg-white/[0.06]',
    danger: 'hover:brightness-110 active:scale-[0.98] text-white'
  };
  const style: React.CSSProperties = variant === 'primary' ? { background: 'var(--aurora-gradient)' } : variant === 'danger' ? { background: 'var(--aurora-danger)' } : { borderColor: 'var(--aurora-border-strong)', color: 'var(--aurora-text)' };
  return <button {...props} className={`${base} ${variants[variant]} ${props.className ?? ''}`} style={{ ...style, ...props.style }}>{children}</button>;
}

export function AuroraInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-white/[0.09] focus:border-[var(--aurora-cyan)] outline-none transition-colors placeholder:text-[var(--aurora-text-faint)] ${props.className ?? ''}`} />;
}

export function AuroraSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-white/[0.09] focus:border-[var(--aurora-cyan)] outline-none transition-colors ${props.className ?? ''}`} style={{ colorScheme: 'dark' }} />;
}

export function AuroraTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`px-3 py-2 rounded-lg text-sm bg-white/[0.04] border border-white/[0.09] focus:border-[var(--aurora-cyan)] outline-none transition-colors placeholder:text-[var(--aurora-text-faint)] ${props.className ?? ''}`} />;
}
