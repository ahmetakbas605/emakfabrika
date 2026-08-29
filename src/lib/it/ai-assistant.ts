import 'server-only';
import { eq, and, ne, or, like, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { serviceDeskTickets } from '@/db/schema';
import { askAi, isAiConfigured } from '@/lib/ai-provider';
import { ItError } from '@/lib/it/errors';

// Faz 18 (AI) — kullanıcının seçtiği kapsam: ticket özeti, kategori önerisi,
// benzer geçmiş ticket'lar. Halüsinasyon riskini SINIRLAMAK için iki katman
// var: (1) kategori önerisi şirketin GERÇEKTEN kullandığı kategorilerle
// besleniyor (yeni bir kategori icat edebilir ama modele mevcut olanlar
// gösteriliyor), (2) "benzer ticket" listesi, modelin ürettiği ticket
// numaraları DB'den çekilen ADAY kümesiyle KESİŞTİRİLEREK doğrulanıyor —
// model var olmayan bir ticket numarası uydurursa sessizce elenir.
export interface TicketAiAssistance {
  configured: boolean;
  provider: string | null;
  summary: string | null;
  suggestedCategory: string | null;
  similarTickets: { ticketNo: string; title: string }[];
}

async function listRecentCategories(companyId: string): Promise<string[]> {
  // MySQL: DISTINCT ile SELECT listesinde olmayan bir sütuna göre ORDER BY
  // yapılamaz (ER_FIELD_IN_ORDER_NOT_SELECT) — bu mock testle GERÇEKTEN
  // yakalandı. Kategori listesi zaten öneri amaçlı, sıralama gerekmiyor.
  const rows = await db
    .selectDistinct({ category: serviceDeskTickets.category })
    .from(serviceDeskTickets)
    .where(and(eq(serviceDeskTickets.companyId, companyId), ne(serviceDeskTickets.category, '')))
    .limit(30);
  return rows.map((r) => r.category);
}

async function listCandidateSimilarTickets(companyId: string, ticketId: string, title: string) {
  // Basit anahtar-kelime örtüşmesi ile aday kümesi daraltılıyor (vektör DB
  // yok) — başlıktaki 3+ karakterli kelimeler LIKE ile aranıyor, sonuçlar
  // AI'a sıralama/seçim için gönderiliyor.
  const words = title.split(/\s+/).map((w) => w.trim()).filter((w) => w.length >= 3).slice(0, 5);
  if (words.length === 0) return [];
  const conditions = words.map((w) => like(serviceDeskTickets.title, `%${w}%`));
  const rows = await db
    .select({ ticketNo: serviceDeskTickets.ticketNo, title: serviceDeskTickets.title, category: serviceDeskTickets.category })
    .from(serviceDeskTickets)
    .where(and(eq(serviceDeskTickets.companyId, companyId), ne(serviceDeskTickets.id, ticketId), or(...conditions)))
    .orderBy(desc(serviceDeskTickets.createdAt))
    .limit(15);
  return rows;
}

function parseModelJson(reply: string): { summary?: string; suggestedCategory?: string; similarTicketNos?: string[] } {
  const cleaned = reply.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

export async function getTicketAiAssistance(companyId: string, ticketId: string): Promise<TicketAiAssistance> {
  const [ticket] = await db
    .select({ title: serviceDeskTickets.title, description: serviceDeskTickets.description, category: serviceDeskTickets.category })
    .from(serviceDeskTickets)
    .where(and(eq(serviceDeskTickets.id, ticketId), eq(serviceDeskTickets.companyId, companyId)))
    .limit(1);
  if (!ticket) throw new ItError('Ticket bulunamadı.');

  if (!isAiConfigured()) {
    return { configured: false, provider: null, summary: null, suggestedCategory: null, similarTickets: [] };
  }

  const [categories, candidates] = await Promise.all([
    listRecentCategories(companyId),
    listCandidateSimilarTickets(companyId, ticketId, ticket.title)
  ]);

  const system = 'Sen bir BT servis masası asistanısın. Türkçe yanıt ver. Yalnızca istenen JSON formatında, başka hiçbir metin eklemeden yanıt ver.';
  const userMessage = [
    `Ticket başlığı: ${ticket.title}`,
    `Ticket açıklaması: ${ticket.description || '(açıklama girilmemiş)'}`,
    `Mevcut kategori alanı: ${ticket.category || '(boş)'}`,
    `Şirkette daha önce kullanılan kategoriler: ${categories.length > 0 ? categories.join(', ') : '(henüz kategori kullanılmamış)'}`,
    `Aday benzer ticket'lar (yalnızca bu listeden seç, ticketNo ile):`,
    candidates.length > 0 ? candidates.map((c) => `- ${c.ticketNo}: ${c.title} [${c.category || 'kategorisiz'}]`).join('\n') : '(aday bulunamadı)',
    '',
    'Aşağıdaki JSON formatında yanıt ver:',
    '{"summary": "1-2 cümlelik kısa özet", "suggestedCategory": "önerilen kategori (mümkünse yukarıdaki mevcut kategorilerden biri)", "similarTicketNos": ["yukarıdaki aday listesinden gerçekten benzer olanların ticketNo değerleri, en fazla 5 tane"]}'
  ].join('\n');

  const { configured, provider, reply } = await askAi(system, userMessage, 600);
  if (!configured) return { configured: false, provider: null, summary: null, suggestedCategory: null, similarTickets: [] };

  const parsed = parseModelJson(reply);
  const candidateNos = new Set(candidates.map((c) => c.ticketNo));
  const validatedNos = (parsed.similarTicketNos ?? []).filter((no): no is string => typeof no === 'string' && candidateNos.has(no));
  const similarTickets = candidates.filter((c) => validatedNos.includes(c.ticketNo)).map((c) => ({ ticketNo: c.ticketNo, title: c.title }));

  return {
    configured: true,
    provider,
    summary: typeof parsed.summary === 'string' ? parsed.summary : null,
    suggestedCategory: typeof parsed.suggestedCategory === 'string' ? parsed.suggestedCategory : null,
    similarTickets
  };
}
