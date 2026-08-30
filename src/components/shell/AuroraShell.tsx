'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut } from 'lucide-react';
import { ICONS, type IconName } from './icons';

export interface NavGroup {
  label: string;
  items: { href: string; label: string; icon: IconName }[];
}

export function AuroraShell({
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
    <div className="aurora-scope">
      <div className="aurora-field" aria-hidden="true">
        <div className="aurora-blob aurora-blob-1" />
        <div className="aurora-blob aurora-blob-2" />
        <div className="aurora-blob aurora-blob-3" />
      </div>
      <div className="aurora-noise" aria-hidden="true" />

      <div className="flex min-h-screen">
        <motion.aside
          initial={{ x: -24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-64 shrink-0 border-r border-white/[0.07] px-4 py-6 hidden md:flex md:flex-col aurora-scrollbar overflow-y-auto"
        >
          <Link href={brandHref} className="flex items-center gap-2.5 px-2 mb-8 group">
            <span className="h-8 w-8 rounded-lg aurora-gradient-bg flex items-center justify-center font-bold text-[13px] text-black" style={{ background: 'var(--aurora-gradient)' }}>ef</span>
            <span className="font-semibold tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>{brand}</span>
          </Link>

          <nav className="flex-1 space-y-6">
            {navGroups.map((group) => (
              <div key={group.label}>
                <div className="px-2 mb-2 text-[10.5px] font-semibold tracking-widest uppercase" style={{ color: 'var(--aurora-text-faint)', fontFamily: 'var(--font-mono)' }}>{group.label}</div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = pathname === item.href || pathname?.startsWith(item.href + '/');
                    const Icon = ICONS[item.icon];
                    return (
                      <Link key={item.href} href={item.href} className="relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors" style={{ color: active ? 'var(--aurora-text)' : 'var(--aurora-text-dim)' }}>
                        {active ? (
                          <motion.span layoutId="nav-active" className="absolute inset-0 rounded-lg" style={{ background: 'var(--aurora-surface-hover)', border: '1px solid var(--aurora-border-strong)' }} transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
                        ) : null}
                        <Icon size={16} strokeWidth={2} className="relative shrink-0" />
                        <span className="relative">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="mt-auto pt-4 border-t border-white/[0.07]">
            <div className="px-2 mb-2">
              <div className="text-sm font-medium truncate">{userName}</div>
              <div className="text-xs truncate" style={{ color: 'var(--aurora-text-dim)' }}>{companyName}</div>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors hover:bg-white/[0.06]" style={{ color: 'var(--aurora-text-dim)' }}>
                <LogOut size={15} /> Çıkış Yap
              </button>
            </form>
          </div>
        </motion.aside>

        <main className="flex-1 min-w-0 aurora-scrollbar overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="px-6 md:px-10 py-8 max-w-[1400px]"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
