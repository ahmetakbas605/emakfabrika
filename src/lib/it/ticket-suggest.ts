// SERVICE-DESK.md §3 — AI-hazır ama AI OLMADAN da çalışan kural tabanlı
// öneri. Yalnızca formda ÖN-DOLDURULMUŞ bir değer olarak gösterilir, ASLA
// otomatik uygulanmaz (madde 35) — kullanıcı her zaman değiştirebilir.
// Gerçek AI entegrasyonu Faz 18'e ertelendi.
const KEYWORD_RULES: { keywords: string[]; category: string; priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL' }[] = [
  { keywords: ['yazıcı', 'printer', 'toner'], category: 'Yazıcı', priority: 'LOW' },
  { keywords: ['internet', 'ağ', 'network', 'wifi', 'kablosuz'], category: 'Ağ', priority: 'NORMAL' },
  { keywords: ['sunucu', 'server', 'çöktü', 'erişilemiyor'], category: 'Sunucu', priority: 'CRITICAL' },
  { keywords: ['virüs', 'malware', 'saldırı', 'sızma', 'hack'], category: 'Güvenlik', priority: 'CRITICAL' },
  { keywords: ['şifre', 'parola', 'giriş yapamıyorum', 'hesap kilitli'], category: 'Hesap/Erişim', priority: 'HIGH' },
  { keywords: ['bilgisayar açılmıyor', 'mavi ekran', 'donuyor'], category: 'Bilgisayar', priority: 'HIGH' },
  { keywords: ['yavaş', 'performans'], category: 'Performans', priority: 'NORMAL' },
  { keywords: ['e-posta', 'email', 'mail'], category: 'E-posta', priority: 'NORMAL' }
];

export interface TicketSuggestion {
  category: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
}

export function suggestCategoryAndPriority(title: string, description?: string): TicketSuggestion | null {
  const text = `${title} ${description ?? ''}`.toLocaleLowerCase('tr-TR');
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      return { category: rule.category, priority: rule.priority };
    }
  }
  return null;
}
