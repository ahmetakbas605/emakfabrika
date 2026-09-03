// Satış hattı: Aday Müşteri -> Fırsat -> Teklif -> Sipariş -> Sevkiyat ->
// Fatura -> Tahsilat + Şikayet. Tüm ID'ler DOĞAL ANAHTARLA okunur (Batch 1
// bir önceki adımda ekledi), betik idempotent (natural-key varlık kontrolü).
import 'dotenv/config';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { eq, and, sql } from 'drizzle-orm';
import {
  parties, products, warehouses, users,
  leads, opportunities,
  salesQuotes, salesQuoteLines, salesOrders, salesOrderLines,
  salesShipments, salesShipmentLines, salesInvoices, salesInvoiceLines,
  salesCollections, customerComplaints, docNumberSeqs
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
    const partyRows = await db.select().from(parties).where(eq(parties.companyId, COMPANY_ID));
    const partyByCode = Object.fromEntries(partyRows.map((p) => [p.code, p.id]));
    const anadolu = partyByCode['CARI2026000001'];
    const marmara = partyByCode['CARI2026000002'];
    const yapiInsaat = partyByCode['CARI2026000005'];

    const productRows = await db.select().from(products).where(eq(products.companyId, COMPANY_ID));
    const productBySku = Object.fromEntries(productRows.map((p) => [p.sku, p.id]));

    const [warehouse] = await db.select().from(warehouses).where(and(eq(warehouses.companyId, COMPANY_ID), eq(warehouses.name, 'Ana Mamul Deposu')));

    // ================= LEADS =================
    const existingLeads = await db.select({ contactName: leads.contactName }).from(leads).where(eq(leads.companyId, COMPANY_ID));
    const existingLeadNames = new Set(existingLeads.map((l) => l.contactName));
    const leadRows = [
      { contactName: 'Mehmet Aydın', companyName: 'Aydın İnşaat Malzemeleri', email: 'mehmet@aydinmalzeme.com.tr', phone: '05052223344', source: 'Web Sitesi', status: 'QUALIFIED' as const },
      { contactName: 'Selin Kaya', companyName: 'Kaya Endüstriyel Ürünler', email: 'selin@kayaendustriyel.com.tr', phone: '05063334455', source: 'Referans', status: 'NEW' as const },
      { contactName: 'Orhan Çelik', companyName: 'Çelik Yapı Market', email: 'orhan@celikyapi.com.tr', phone: '05074445566', source: 'Fuar', status: 'CONTACTED' as const }
    ].filter((l) => !existingLeadNames.has(l.contactName));
    if (leadRows.length > 0) {
      await db.insert(leads).values(leadRows.map((l) => ({ id: id(), companyId: COMPANY_ID, ...l, createdByUserId: ADMIN_USER_ID })));
    }
    console.log(`Leads: ${leadRows.length} yeni.`);

    // ================= OPPORTUNITIES =================
    const existingOpps = await db.select({ name: opportunities.name }).from(opportunities).where(eq(opportunities.companyId, COMPANY_ID));
    const existingOppNames = new Set(existingOpps.map((o) => o.name));
    const oppData = [
      { name: 'Anadolu Sanayi — Yıllık Vana Anlaşması', partyId: anadolu, stage: 'PROPOSAL' as const, estimatedValue: '450000.000000', expectedCloseDate: '2026-10-15' },
      { name: 'Marmara Metal — Pompa Tedariki', partyId: marmara, stage: 'NEGOTIATION' as const, estimatedValue: '180000.000000', expectedCloseDate: '2026-09-30' },
      { name: 'Yapı İnşaat — Proje Malzeme Paketi', partyId: yapiInsaat, stage: 'QUALIFICATION' as const, estimatedValue: '620000.000000', expectedCloseDate: '2026-11-20' }
    ].filter((o) => !existingOppNames.has(o.name));
    if (oppData.length > 0) {
      await db.insert(opportunities).values(oppData.map((o) => ({ id: id(), companyId: COMPANY_ID, ...o, currencyCode: 'TRY', createdByUserId: ADMIN_USER_ID })));
    }
    console.log(`Opportunities: ${oppData.length} yeni.`);

    // ================= SALES QUOTES =================
    const existingQuotes = await db.select({ quoteNo: salesQuotes.quoteNo }).from(salesQuotes).where(eq(salesQuotes.companyId, COMPANY_ID));
    const existingQuoteNos = new Set(existingQuotes.map((q) => q.quoteNo));
    if (!existingQuoteNos.has('TKF20260001')) {
      const quoteId = id();
      const quoteNo = await nextDocNo(db, 'SQ', 'TKF');
      await db.insert(salesQuotes).values({ id: quoteId, companyId: COMPANY_ID, quoteNo, partyId: marmara, quoteDate: '2026-08-20', validUntil: '2026-09-20', currencyCode: 'TRY', status: 'SENT', createdByUserId: ADMIN_USER_ID });
      await db.insert(salesQuoteLines).values([
        { id: id(), quoteId, productId: productBySku['URN-002'], quantity: '20.000000', unitPrice: '8400.000000', taxRatePercent: '20.00', lineTotal: '168000.000000' },
        { id: id(), quoteId, productId: productBySku['URN-006'], quantity: '40.000000', unitPrice: '145.000000', taxRatePercent: '20.00', lineTotal: '5800.000000' }
      ]);
      console.log('Teklif eklendi: TKF20260001 (2 kalem).');
    }

    // ================= SALES ORDERS (mevcut 1'e ek 2 tane) =================
    const existingOrders = await db.select({ orderNo: salesOrders.orderNo }).from(salesOrders).where(eq(salesOrders.companyId, COMPANY_ID));
    const existingOrderNos = new Set(existingOrders.map((o) => o.orderNo));
    const orderIds: Record<string, string> = {};

    if (!existingOrderNos.has('SIP20260101')) {
      const orderId = id();
      const orderNo = 'SIP20260101';
      await db.insert(salesOrders).values({ id: orderId, companyId: COMPANY_ID, orderNo, partyId: anadolu, orderDate: '2026-08-25', currencyCode: 'TRY', status: 'CONFIRMED', createdByUserId: ADMIN_USER_ID, submittedAt: new Date('2026-08-25'), confirmedAt: new Date('2026-08-26') });
      const line1 = id();
      await db.insert(salesOrderLines).values({ id: line1, orderId, productId: productBySku['URN-001'], quantity: '60.000000', unitPrice: '1250.000000', taxRatePercent: '20.00', lineTotal: '75000.000000' });
      orderIds['SIP20260101'] = orderId;
      (orderIds as any)['SIP20260101_line1'] = line1;
    }
    if (!existingOrderNos.has('SIP20260102')) {
      const orderId = id();
      const orderNo = 'SIP20260102';
      await db.insert(salesOrders).values({ id: orderId, companyId: COMPANY_ID, orderNo, partyId: yapiInsaat, orderDate: '2026-08-28', currencyCode: 'TRY', status: 'SUBMITTED', createdByUserId: ADMIN_USER_ID, submittedAt: new Date('2026-08-28') });
      await db.insert(salesOrderLines).values({ id: id(), orderId, productId: productBySku['URN-005'], quantity: '500.000000', unitPrice: '65.000000', taxRatePercent: '20.00', lineTotal: '32500.000000' });
      orderIds['SIP20260102'] = orderId;
    }
    console.log(`Sipariş: ${Object.keys(orderIds).filter((k) => !k.includes('_line')).length} yeni.`);

    // Mevcut TEK sipariş (audit'te "sales_orders -> 1" görülen) + yeni
    // SIP20260101 üzerinden sevkiyat/fatura/tahsilat zincirini kur.
    let baseOrderId: string;
    let baseOrderLineId: string;
    if (orderIds['SIP20260101']) {
      baseOrderId = orderIds['SIP20260101'];
      baseOrderLineId = (orderIds as any)['SIP20260101_line1'];
    } else {
      const [existing] = await db.select({ id: salesOrders.id }).from(salesOrders).where(and(eq(salesOrders.companyId, COMPANY_ID), eq(salesOrders.orderNo, 'SIP20260101')));
      baseOrderId = existing.id;
      const [existingLine] = await db.select({ id: salesOrderLines.id }).from(salesOrderLines).where(eq(salesOrderLines.orderId, baseOrderId));
      baseOrderLineId = existingLine.id;
    }

    // ================= SHIPMENT =================
    const existingShip = await db.select({ shipmentNo: salesShipments.shipmentNo }).from(salesShipments).where(eq(salesShipments.companyId, COMPANY_ID));
    if (!existingShip.some((s) => s.shipmentNo === 'SVK20260001')) {
      const shipmentId = id();
      await db.insert(salesShipments).values({ id: shipmentId, companyId: COMPANY_ID, shipmentNo: 'SVK20260001', orderId: baseOrderId, warehouseId: warehouse.id, shipmentDate: '2026-08-29', status: 'DELIVERED', createdByUserId: ADMIN_USER_ID });
      await db.insert(salesShipmentLines).values({ id: id(), shipmentId, orderLineId: baseOrderLineId, quantity: '60.000000' });
      await db.update(salesOrderLines).set({ shippedQuantity: '60.000000' }).where(eq(salesOrderLines.id, baseOrderLineId));
      console.log('Sevkiyat eklendi: SVK20260001.');
    }

    // ================= INVOICE =================
    const existingInv = await db.select({ invoiceNo: salesInvoices.invoiceNo, id: salesInvoices.id }).from(salesInvoices).where(eq(salesInvoices.companyId, COMPANY_ID));
    let invoiceId: string;
    if (!existingInv.some((i) => i.invoiceNo === 'FAT20260101')) {
      invoiceId = id();
      await db.insert(salesInvoices).values({ id: invoiceId, companyId: COMPANY_ID, invoiceNo: 'FAT20260101', orderId: baseOrderId, partyId: anadolu, invoiceDate: '2026-08-30', currencyCode: 'TRY', status: 'APPROVED', createdByUserId: ADMIN_USER_ID, approvedAt: new Date('2026-08-30') });
      await db.insert(salesInvoiceLines).values({ id: id(), invoiceId, orderLineId: baseOrderLineId, productId: productBySku['URN-001'], quantity: '60.000000', unitPrice: '1250.000000', taxRatePercent: '20.00', lineTotal: '75000.000000' });
      await db.update(salesOrderLines).set({ invoicedQuantity: '60.000000' }).where(eq(salesOrderLines.id, baseOrderLineId));
      console.log('Fatura eklendi: FAT20260101.');
    } else {
      invoiceId = existingInv.find((i) => i.invoiceNo === 'FAT20260101')!.id;
    }

    // ================= COLLECTION (kısmi tahsilat — tam ekran senaryosu) ===
    const existingColl = await db.select().from(salesCollections).where(eq(salesCollections.invoiceId, invoiceId));
    if (existingColl.length === 0) {
      await db.insert(salesCollections).values({ id: id(), companyId: COMPANY_ID, invoiceId, collectionDate: '2026-09-02', amount: '50000.000000', currencyCode: 'TRY', method: 'BANK', createdByUserId: ADMIN_USER_ID });
      console.log('Tahsilat eklendi: 50.000 TL (kısmi, 75.000 TL faturaya karşı).');
    }

    // ================= COMPLAINT (mevcut 1'e ek 1 tane) =================
    const existingComplaints = await db.select({ complaintNo: customerComplaints.complaintNo }).from(customerComplaints).where(eq(customerComplaints.companyId, COMPANY_ID));
    if (!existingComplaints.some((c) => c.complaintNo === 'SKY20260002')) {
      await db.insert(customerComplaints).values({ id: id(), companyId: COMPANY_ID, complaintNo: 'SKY20260002', partyId: anadolu, orderId: baseOrderId, subject: 'Geç teslimat', description: 'Sipariş edilen 60 adet vananın teslimatı 3 gün gecikti.', status: 'IN_PROGRESS', priority: 'MEDIUM', assignedToUserId: ADMIN_USER_ID, createdByUserId: ADMIN_USER_ID });
      console.log('Şikayet eklendi: SKY20260002.');
    }

    console.log('\n=== BATCH 2 (Satış) TAMAMLANDI ===');
  } finally {
    await connection.end();
  }
}

main().catch((err) => { console.error('Batch 2 başarısız:', err); process.exit(1); });
