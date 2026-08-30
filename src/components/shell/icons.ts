import {
  LayoutDashboard, ShieldCheck, Inbox, Building2, ArrowUpRight, Boxes, Landmark, Users2, Settings2,
  ScrollText, KeyRound, Smartphone, AlertTriangle, Archive, FileSearch, Download, Fingerprint, Lock,
  ShieldAlert, GitBranch, PenTool, UserCog, Activity, Trash2, FileWarning, ClipboardList, ShieldQuestion,
  Palmtree
} from 'lucide-react';

// İK Faz 0-5 sayfaları (mevcut, sade UI) ile YENİ Aurora tasarım sistemi
// arasındaki sınır: Server Component'lardan Client Component'lara ikon
// BİLEŞEN REFERANSI (fonksiyon) aktarılamıyor — RSC serileştirme kısıtı
// ("Only plain objects can be passed..."). Bu yüzden sayfalar ikon adını
// (string) geçiyor, gerçek bileşen eşlemesi YALNIZCA bu client-side
// registry'de yapılıyor.
export const ICONS = {
  dashboard: LayoutDashboard, shield: ShieldCheck, inbox: Inbox, building: Building2, arrowUpRight: ArrowUpRight,
  boxes: Boxes, landmark: Landmark, users: Users2, settings: Settings2, palmtree: Palmtree,
  scroll: ScrollText, key: KeyRound, phone: Smartphone, alert: AlertTriangle, archive: Archive,
  fileSearch: FileSearch, download: Download, fingerprint: Fingerprint, lock: Lock, shieldAlert: ShieldAlert,
  gitBranch: GitBranch, pen: PenTool, userCog: UserCog, activity: Activity, trash: Trash2,
  fileWarning: FileWarning, clipboard: ClipboardList, shieldQuestion: ShieldQuestion
} as const;

export type IconName = keyof typeof ICONS;
