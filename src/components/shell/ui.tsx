'use client';

import { motion } from 'framer-motion';

// ==================================================================
// Paylaşılan primitifler — Görsel Yenileme Faz 1'de Stitch'in
// "Dimension" sistemine taşındı.
//
// Sistemin üç kuralı bu dosyada görünür hâlde:
//  1. Hap (9999px) silueti tüm butonlarda ve rozetlerde.
//  2. Yükselti GÖLGEYLE değil, saydamlık + 1px kıl-çizgiyle kurulur.
//  3. Başlık ağırlığı 500'ü GEÇMEZ (dim-h2/dim-h3 sınıfları bunu
//     zaten sabitliyor — burada elle font-bold yazılmaz).
//
// İhraç ADLARI (AuroraButton vb.) bilinçli olarak DEĞİŞTİRİLMEDİ: bu
// primitifleri 11 sayfa kullanıyor ve Faz 1'in kapsamı görsel dil,
// yeniden adlandırma değil. Adlar, o sayfalar modül modül taşınırken
// aynı commit'te düzelecek.
// ==================================================================

export function PageHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="mb-10">
      <div className="dim-metric mb-3" style={{ color: 'var(--dim-sunset)' }}>{eyebrow}</div>
      <h1 className="dim-h2" style={{ color: 'var(--dim-bone)' }}>{title}</h1>
      {description ? <p className="dim-body mt-3 max-w-2xl" style={{ color: 'var(--dim-on-surface-variant)' }}>{description}</p> : null}
    </motion.div>
  );
}

export function GlassPanel({ children, className = '', title, action }: { children: React.ReactNode; className?: string; title?: string; action?: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={`dim-card relative overflow-hidden p-7 ${className}`}
    >
      {title ? (
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="dim-subheading" style={{ color: 'var(--dim-bone)' }}>{title}</h2>
          {action}
        </div>
      ) : null}
      {children}
    </motion.div>
  );
}

// Rozet tonları. Stitch'in aksan bütçesi dışına ÇIKILMAZ — yeni bir
// renk eklemek monokrom disiplini bozar (DESIGN.md "Don't" maddesi).
const TONES: Record<string, { bg: string; fg: string; border: string }> = {
  neutral: { bg: 'var(--dim-frosted-soft)', fg: 'var(--dim-on-surface-variant)', border: 'var(--dim-border-soft)' },
  ok: { bg: 'rgba(52,211,153,0.1)', fg: 'var(--dim-success)', border: 'rgba(52,211,153,0.2)' },
  warn: { bg: 'rgba(245,165,36,0.1)', fg: 'var(--dim-warning)', border: 'rgba(245,165,36,0.2)' },
  danger: { bg: 'rgba(251,90,110,0.1)', fg: 'var(--dim-danger)', border: 'rgba(251,90,110,0.2)' },
  accent: { bg: 'rgba(107,98,242,0.1)', fg: 'var(--dim-violet)', border: 'rgba(107,98,242,0.2)' }
};

const RISK_TONE: Record<string, keyof typeof TONES> = {
  LOW: 'ok',
  MEDIUM: 'warn',
  HIGH: 'danger',
  CRITICAL: 'danger'
};

export function RiskBadge({ level }: { level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' }) {
  const s = TONES[RISK_TONE[level] ?? 'ok'];
  return (
    <span
      className="dim-metric inline-flex items-center gap-1.5 px-2.5 py-1"
      style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}`, borderRadius: 'var(--dim-radius-pill)' }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.fg }} />
      {level}
    </span>
  );
}

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'ok' | 'warn' | 'danger' | 'accent' }) {
  const s = TONES[tone];
  return (
    <span
      className="dim-metric inline-flex px-2.5 py-1"
      style={{ background: s.bg, color: s.fg, border: `1px solid ${s.border}`, borderRadius: 'var(--dim-radius-pill)' }}
    >
      {children}
    </span>
  );
}

// Birincil buton — sistemdeki TEK dolu yüzey: beyaz zemin, koyu metin.
// Degrade dolgu YOK (Stitch: "gradients never on buttons").
export function AuroraButton({ children, variant = 'primary', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const base = 'dim-technical inline-flex items-center gap-2 px-5 py-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';
  const style: React.CSSProperties =
    variant === 'primary'
      ? { background: 'var(--dim-primary)', color: 'var(--dim-on-primary)', borderRadius: 'var(--dim-radius-pill)' }
      : variant === 'danger'
        ? { background: 'rgba(251,90,110,0.12)', color: 'var(--dim-danger)', border: '1px solid rgba(251,90,110,0.3)', borderRadius: 'var(--dim-radius-pill)' }
        : { background: 'var(--dim-frosted-soft)', color: 'var(--dim-bone)', border: '1px solid var(--dim-border)', borderRadius: 'var(--dim-radius-pill)' };
  return <button {...props} className={`${base} ${props.className ?? ''}`} style={{ ...style, ...props.style }}>{children}</button>;
}

// Form alanları hap DEĞİL: Stitch hap silüetini eylem/etiket için
// ayırıyor, giriş alanlarında 10px "ui" yarıçapı kullanılıyor.
const FIELD_BASE = 'dim-body w-full px-4 py-2.5 outline-none transition-colors';
const FIELD_STYLE: React.CSSProperties = {
  background: 'var(--dim-frosted-soft)',
  border: '1px solid var(--dim-border-soft)',
  borderRadius: 'var(--dim-radius-ui)',
  color: 'var(--dim-bone)',
  fontSize: 14
};

export function AuroraInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${FIELD_BASE} ${props.className ?? ''}`} style={{ ...FIELD_STYLE, ...props.style }} />;
}

export function AuroraSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${FIELD_BASE} ${props.className ?? ''}`} style={{ ...FIELD_STYLE, colorScheme: 'dark', ...props.style }} />;
}

export function AuroraTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${FIELD_BASE} ${props.className ?? ''}`} style={{ ...FIELD_STYLE, ...props.style }} />;
}
