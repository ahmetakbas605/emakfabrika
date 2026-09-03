// Satınalma zinciri: Talep -> RFQ -> Teklif -> Ödül -> Sipariş (PO) ->
// Mal Kabul -> Tedarikçi Faturası. Tek bir uçtan uca örnek zincir (RFQ
// akışı) — proc_requests/proc_rfqs/... hepsi bu şirkette EMPTY'ydi.
import 'dotenv/config';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { eq, and, sql } from 'drizzle-orm';
import {
  parties, products, units, warehouses, stockItems, departments,
  procRequests, procRequestLines,
  procRfqs, procRfqLines, procRfqSuppliers,
  procQuotations, procQuotationLines,
  procAwards, procAwardLines,
  procPos, procPoLines,
  procReceipts, procReceiptLines,
  procVinvoices, procVinvoiceLines,
  docNumberSeqs
} from '../src/db/schema';

const COMPANY_ID = '4cb19554-c8e9-4ea1-a1e0-f2d061af7625';
const ADMIN_USER_ID = '6e73bf6a-3a3d-4916-9213-5742986c040d';
const YEAR = 2026;

function id() { return crypto.randomUUID(); }

async function nextDocNo(db: MySql2Database<Record<string, never>>, sequenceKey: string, prefix: string, padding = 6): Promise<string> {
  await db.insert(docNumberSeqs).values({ companyId: COMPANY_ID, sequenceKey, year: YEAR, lastNumber: 0 }).onDuplicateKeyUpdate({ set: { lastNumber: sql`last_number` } });
  await db.update(docNumberSeqs).set({ lastNumber: sql`${docNumberSeqs.lastNumber} + 1` }).where(and(eq(docNumberSeqs.companyId, COMPANY_ID), eq(docNumberSeqs.sequenceKey, sequenceKey), eq(docNumberSeqs.year, YEAR)));
  const [row] = await db.select({ lastNumber: docNumberSeqs.lastNumber }).from(docNumberSeqs).where(and(eq(docNumberSeqs.companyId, COMPANY_ID), eq(docNumberSeqs.sequenceKey, sequenceKey), eq(docNumberSeqs.year, YEAR))).limit(1);
  return `${prefix}${YEAR}${String(row!.lastNumber).padStart(padding, '0')}`;
}

async function main() {
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  const connection = await mysql.createConnection(url!);
  const db = drizzle(connection, { mode: 'default' });

  try {
    const existing = await db.select({ requestNo: procRequests.requestNo }).from(procRequests).where(eq(procRequests.companyId, COMPANY_ID));
    if (existing.some((r) => r.requestNo === 'PR2026000001')) {
      console.log('Satınalma zinciri zaten var (PR2026000001), atlandı.');
      return;
    }

    const [procDept] = await db.select().from(departments).where(and(eq(departments.companyId, COMPANY_ID), eq(departments.departmentTypeCode, 'PROCUREMENT')));
    const productRows = await db.select().from(products).where(eq(products.companyId, COMPANY_ID));
    const productBySku = Object.fromEntries(productRows.map((p) => [p.sku, p.id]));
    const unitRows = await db.select().from(units).where(eq(units.companyId, COMPANY_ID));
    const unitByCode = Object.fromEntries(unitRows.map((u) => [u.code, u.id]));
    const partyRows = await db.select().from(parties).where(eq(parties.companyId, COMPANY_ID));
    const partyByCode = Object.fromEntries(partyRows.map((p) => [p.code, p.id]));
    const celikTedarik = partyByCode['CARI2026000003'];
    const [warehouse] = await db.select().from(warehouses).where(and(eq(warehouses.companyId, COMPANY_ID), eq(warehouses.name, 'Hammadde Deposu')));
    const [stockItem] = await db.select().from(stockItems).where(and(eq(stockItems.companyId, COMPANY_ID), eq(stockItems.sku, 'URN-004')));

    // ================= 1. TALEP =================
    const requestId = id();
    const requestNo = await nextDocNo(db, 'PR', 'PR', 6);
    await db.insert(procRequests).values({
      id: requestId, companyId: COMPANY_ID, departmentId: procDept.id, requestNo,
      requestType: 'RAW_MATERIAL', priority: 'NORMAL', status: 'APPROVED',
      requestedByUserId: ADMIN_USER_ID, justification: 'Q4 üretim planı için hammadde çelik sac ihtiyacı.', currencyCode: 'TRY',
      estimatedTotal: '285000.000000'
    });
    const requestLineId = id();
    await db.insert(procRequestLines).values({
      id: requestLineId, requestId, lineNo: 1, productId: productBySku['URN-004'], stockItemId: stockItem.id,
      description: 'Sıcak Haddelenmiş Çelik Sac 2mm', quantity: '10000.000000', unitId: unitByCode['KG'],
      estimatedUnitPrice: '28.500000', estimatedTotal: '285000.000000', warehouseId: warehouse.id, stockStatus: 'PENDING'
    });
    console.log(`Talep: ${requestNo} (APPROVED).`);

    // ================= 2. RFQ =================
    const rfqId = id();
    const rfqNo = await nextDocNo(db, 'RFQ', 'RFQ', 6);
    await db.insert(procRfqs).values({
      id: rfqId, companyId: COMPANY_ID, rfqNo, title: 'Q4 Çelik Sac Tedariki',
      description: 'Aylık üretim planı için çelik sac tedariki teklif talebi.', status: 'CLOSED',
      quotationDeadline: new Date('2026-09-10'), deliveryLocation: 'Hammadde Deposu, Gebze', paymentTerms: 'NET30',
      createdByUserId: ADMIN_USER_ID, sentAt: new Date('2026-09-01'), closedAt: new Date('2026-09-10')
    });
    const rfqLineId = id();
    await db.insert(procRfqLines).values({ id: rfqLineId, rfqId, srcRequestLineId: requestLineId, productId: productBySku['URN-004'], description: 'Sıcak Haddelenmiş Çelik Sac 2mm', quantity: '10000.000000', unitId: unitByCode['KG'] });
    await db.insert(procRfqSuppliers).values({ id: id(), rfqId, supplierPartyId: celikTedarik, status: 'RESPONDED' });
    console.log(`RFQ: ${rfqNo} (CLOSED, 1 tedarikçi davetli).`);

    // ================= 3. TEKLİF =================
    const quotationId = id();
    await db.insert(procQuotations).values({
      id: quotationId, rfqId, supplierPartyId: celikTedarik, version: 1, currencyCode: 'TRY',
      validUntil: '2026-10-10', paymentTerms: 'NET30', deliveryDays: 7, submittedByUserId: ADMIN_USER_ID
    });
    const quotationLineId = id();
    await db.insert(procQuotationLines).values({ id: quotationLineId, quotationId, rfqLineId, unitPrice: '27.800000', taxPercent: '20.00', deliveryDays: 7 });
    console.log('Teklif: v1, 27,80 TL/kg.');

    // ================= 4. ÖDÜL =================
    const awardId = id();
    const awardNo = await nextDocNo(db, 'AWD', 'AWD', 6);
    await db.insert(procAwards).values({ id: awardId, companyId: COMPANY_ID, rfqId, awardNo, status: 'APPROVED', createdByUserId: ADMIN_USER_ID, submittedAt: new Date('2026-09-11'), completedAt: new Date('2026-09-12') });
    const awardLineId = id();
    await db.insert(procAwardLines).values({ id: awardLineId, awardId, rfqLineId, supplierPartyId: celikTedarik, quotationLineId, awardedQty: '10000.000000', awardedUnitPrice: '27.800000', awardedTotal: '278000.000000' });
    console.log(`Ödül: ${awardNo} (APPROVED, 278.000 TL).`);

    // ================= 5. SİPARİŞ (PO) =================
    const poId = id();
    const poNo = await nextDocNo(db, 'PO', 'PO', 6);
    await db.insert(procPos).values({
      id: poId, companyId: COMPANY_ID, awardId, supplierPartyId: celikTedarik, poNo, status: 'ACKNOWLEDGED',
      currencyCode: 'TRY', deliveryLocation: 'Hammadde Deposu, Gebze', paymentTerms: 'NET30',
      createdByUserId: ADMIN_USER_ID, issuedAt: new Date('2026-09-12'), acknowledgedAt: new Date('2026-09-13')
    });
    const poLineId = id();
    await db.insert(procPoLines).values({ id: poLineId, poId, awardLineId, description: 'Sıcak Haddelenmiş Çelik Sac 2mm', quantity: '10000.000000', unitId: unitByCode['KG'], unitPrice: '27.800000', lineTotal: '278000.000000' });
    console.log(`Sipariş: ${poNo} (ACKNOWLEDGED, 278.000 TL).`);

    // ================= 6. MAL KABUL (kısmi — 3-way match ekranı için) ====
    const receiptId = id();
    const receiptNo = await nextDocNo(db, 'GR', 'GR', 6);
    await db.insert(procReceipts).values({ id: receiptId, companyId: COMPANY_ID, poId, receiptNo, receiptDate: '2026-09-20', notes: 'İlk parti teslim alındı.', receivedByUserId: ADMIN_USER_ID });
    await db.insert(procReceiptLines).values({ id: id(), receiptId, poLineId, receivedQty: '6000.000000', warehouseId: warehouse.id, stockItemId: stockItem.id });
    console.log(`Mal Kabul: ${receiptNo} (kısmi, 10.000 kg'den 6.000 kg).`);

    // ================= 7. TEDARİKÇİ FATURASI =================
    const vinvoiceId = id();
    await db.insert(procVinvoices).values({ id: vinvoiceId, companyId: COMPANY_ID, poId, supplierInvoiceNo: 'CT-2026-4471', invoiceDate: '2026-09-21', currencyCode: 'TRY', status: 'APPROVED', createdByUserId: ADMIN_USER_ID, approvedAt: new Date('2026-09-22') });
    await db.insert(procVinvoiceLines).values({ id: id(), invoiceId: vinvoiceId, poLineId, invoicedQty: '6000.000000', invoicedUnitPrice: '27.800000', lineTotal: '166800.000000' });
    console.log('Tedarikçi Faturası: CT-2026-4471 (166.800 TL, kısmi mal kabulle uyumlu).');

    console.log('\n=== BATCH 3 (Satınalma) TAMAMLANDI ===');
  } finally {
    await connection.end();
  }
}

main().catch((err) => { console.error('Batch 3 başarısız:', err); process.exit(1); });
