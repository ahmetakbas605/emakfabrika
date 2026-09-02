'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { ICONS, type IconName } from './icons';

// ==================================================================
// DIMENSION KABUĞU — Görsel Yenileme Faz 1.
//
// AuroraShell'in yerini alır. Görsel dil BENİM icadım DEĞİL: Google
// Stitch'teki "Emak Living 3D ERP" projesinin Dashboard ekranından
// birebir alındı — yüzen/yuvarlatılmış kenar çubuğu, hap biçimli nav
// öğeleri, dolu-beyaz aktif durum, buzlu kapsüllü yapışkan başlık.
//
// Prop API'si AuroraShell ile AYNI bırakıldı (navGroups/brand/
// brandHref/companyName/userName/logoutAction) — iki çağrı yerinin de
// tek yapması gereken import satırını değiştirmek.
//
// KASITLI OLARAK KALDIRILDI: AuroraShell'in içindeki AnimatePresence
// sayfa geçişi. Sabit 0.35s süre ve y:10 kaydırma, Faz 0'da kurulan
// hareket bütçesini (lib/motion.ts) EZİYORDU — bir WORKBENCH sayfası
// bu sarmalayıcı yüzünden yine de kayıyordu, ki Faz 0'ın tek yasağı
// tam olarak buydu (imleç input'tayken sayfanın kayması). Sayfa geçişi
// artık YALNIZCA globals.css'teki kademe kurallarından gelir.
// ==================================================================

export interface NavGroup {
  label: string;
  items: { href: string; label: string; icon: IconName }[];
}

// Stitch'te kenar çubuğu ekrandan 24px "gutter" kadar ayrı DURUYOR ve
// içerik onun genişliği + iki gutter kadar içeriden başlıyor. Sayıyı
// iki yerde elle tekrar yazmamak için burada tek kaynak.
const SIDEBAR_WIDTH = 272;
const GUTTER = 24;

export function DimensionShell({
  children, navGroups, brand, brandHref, companyName, userName, logoutAction
}: {
  children: React.ReactNode;
  navGroups: NavGroup[];
  brand: string;
  brandHref: string;
  companyName: string;
  userName: string;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();

  return (
    <div className="dim-scope">
      {/* Zemin ışıması — sunset sağ üstte, dusk violet sol altta.
          Stitch'in hero bölümündeki iki bulanık küre, %10 opaklık. */}
      <div className="dim-field" aria-hidden="true">
        <div className="dim-glow dim-glow-sunset" />
        <div className="dim-glow dim-glow-violet" />
      </div>

      <motion.aside
        initial={{ x: -16, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="dim-panel dim-scrollbar fixed z-50 hidden flex-col overflow-y-auto p-4 md:flex"
        style={{ left: GUTTER, top: GUTTER, bottom: GUTTER, width: SIDEBAR_WIDTH }}
      >
        {/* Marka. Kare değil hap-kenarlı (radius-icon 4px) küçük bir
            işaret + 20px başlık — Stitch'in headline-sm rolü. */}
        <Link href={brandHref} className="mb-8 flex shrink-0 items-center gap-3 px-2">
          <span
            className="flex h-8 w-8 items-center justify-center text-[13px] font-semibold"
            style={{ background: 'var(--dim-primary)', color: 'var(--dim-on-primary)', borderRadius: 'var(--dim-radius-icon)' }}
          >
            ef
          </span>
          <span className="dim-h3" style={{ color: 'var(--dim-primary)' }}>{brand}</span>
        </Link>

        <nav className="flex-1 space-y-6">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="dim-metric mb-2 px-3" style={{ color: 'var(--dim-slate)' }}>{group.label}</div>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname?.startsWith(item.href + '/');
                  const Icon = ICONS[item.icon];
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className="relative flex items-center gap-3 px-4 py-2 transition-colors duration-300"
                      style={{
                        borderRadius: 'var(--dim-radius-pill)',
                        color: active ? 'var(--dim-on-primary)' : 'var(--dim-on-surface-variant)'
                      }}
                    >
                      {/* Aktif öğe DOLU BEYAZ — sistemdeki tek dolu
                          yüzey. layoutId ile öğeler arasında kayar. */}
                      {active ? (
                        <motion.span
                          layoutId="dim-nav-active"
                          className="absolute inset-0"
                          style={{ background: 'var(--dim-primary)', borderRadius: 'var(--dim-radius-pill)' }}
                          transition={{ type: 'spring', stiffness: 400, damping: 34 }}
                        />
                      ) : null}
                      <Icon size={16} strokeWidth={1.5} className="relative shrink-0" />
                      <span className="dim-technical relative truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Kullanıcı kapsülü — Stitch'te alt kenarda hap biçimli,
            surface-container-low zeminli, çok soluk kenarlıklı. */}
        <div className="mt-auto shrink-0 pt-6">
          <div
            className="flex items-center gap-3 p-2"
            style={{
              background: 'var(--dim-container-low)',
              border: '1px solid var(--dim-border-faint)',
              borderRadius: 'var(--dim-radius-pill)'
            }}
          >
            <span
              className="dim-technical flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{ background: 'var(--dim-container-high)', color: 'var(--dim-bone)' }}
              aria-hidden="true"
            >
              {userName.trim().charAt(0).toUpperCase()}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="dim-technical truncate" style={{ color: 'var(--dim-bone)' }}>{userName}</span>
              <span className="dim-metric truncate" style={{ color: 'var(--dim-slate)' }}>{companyName}</span>
            </div>
            <form action={logoutAction} className="shrink-0">
              <button
                type="submit"
                aria-label="Çıkış yap"
                title="Çıkış yap"
                className="flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                style={{ color: 'var(--dim-on-surface-variant)' }}
              >
                <LogOut size={15} strokeWidth={1.5} />
              </button>
            </form>
          </div>
        </div>
      </motion.aside>

      {/* İçerik sütunu. Masaüstünde kenar çubuğu + iki gutter kadar
          içeriden başlar; mobilde kenar çubuğu gizli olduğu için tam
          genişlik. Ofset globals.css'teki .dim-content'te — sayı orada
          SIDEBAR_WIDTH/GUTTER ile aynı olmak zorunda. */}
      <div className="dim-content">
        {/* Yapışkan başlık — yarı saydam zemin + blur, böylece içerik
            altından geçerken okunur kalır. */}
        <header className="dim-header sticky top-0 z-40 mb-4 flex h-20 items-center justify-between">
          <div className="flex min-w-0 flex-col">
            <span className="dim-metric truncate" style={{ color: 'var(--dim-cobalt)' }}>{companyName}</span>
            {/* Kobalt kıl-çizgi — Stitch'te başlığın altındaki kısa
                degrade şerit. */}
            <span className="mt-1 h-px w-12" style={{ background: 'linear-gradient(90deg, var(--dim-cobalt), transparent)' }} />
          </div>
          <div className="dim-capsule flex shrink-0 items-center gap-2 px-4 py-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--dim-success)' }} />
            <span className="dim-metric" style={{ color: 'var(--dim-on-surface-variant)' }}>Sistem Aktif</span>
          </div>
        </header>

        <main className="max-w-[1400px] pb-16">{children}</main>
      </div>
    </div>
  );
}
