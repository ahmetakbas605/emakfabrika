import 'server-only';
import { eq, and, sql } from 'drizzle-orm';
import { type Tx } from '@/db/client';
import { docNumberSeqs } from '@/db/schema';

// ERP-GENİŞLEME-FİZİBİLİTE raporunun önerisi — journal_number_counters/
// ticket_number_counters/ci_key_counters'ta ÜÇ KEZ kopyalanan aynı atomik
// desenin (INSERT...ON DUPLICATE KEY + UPDATE +1) genelleştirilmiş hâli.
// Mevcut üç sayaç KASITLI OLARAK buraya taşınmadı (çalışan koda dokunma) —
// bu, YENİ döküman tipleri (Cari kodu, ileride PO/SO) için tek kaynak.
export async function nextDocumentNo(tx: Tx, companyId: string, sequenceKey: string, prefix: string, year: number, padding = 6): Promise<string> {
  await tx.insert(docNumberSeqs).values({ companyId, sequenceKey, year, lastNumber: 0 }).onDuplicateKeyUpdate({ set: { lastNumber: sql`last_number` } });
  await tx
    .update(docNumberSeqs)
    .set({ lastNumber: sql`${docNumberSeqs.lastNumber} + 1` })
    .where(and(eq(docNumberSeqs.companyId, companyId), eq(docNumberSeqs.sequenceKey, sequenceKey), eq(docNumberSeqs.year, year)));
  const [row] = await tx
    .select({ lastNumber: docNumberSeqs.lastNumber })
    .from(docNumberSeqs)
    .where(and(eq(docNumberSeqs.companyId, companyId), eq(docNumberSeqs.sequenceKey, sequenceKey), eq(docNumberSeqs.year, year)))
    .limit(1);
  return `${prefix}${year}${String(row.lastNumber).padStart(padding, '0')}`;
}
