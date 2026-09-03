// Son parti: İşyeri Hekimi (KENDİ özelliğimiz, henüz boştu), Depo Transfer
// + Rezervasyon, Ürün Barkodu, Garanti, Ağ Arayüzü, Kontrol Listesi
// Şablonu, Muhasebe Fişleme Kuralı (örnek/salt-gösterim, HİÇBİR yerde
// okunmuyor — grep ile doğrulandı), IT Politikası (varsayılan değerle),
// İhale (Satınalma'nın RFQ'dan farklı ikinci akışı — kapalı zarf teklif).
//
// role_conflict_rules, network_credentials, document_attachments,
// approval_delegations/instances, ci_key_counters, ticket_number_counters
// BİLİNÇLİ OLARAK atlandı (gerekçe: önceki batch'lerin yorumlarında).
import 'dotenv/config';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { drizzle, type MySql2Database } from 'drizzle-orm/mysql2';
import { eq, and, sql } from 'drizzle-orm';
import {
  employees, users, products, units, warehouses, stockItems, itAssets, vendors, parties,
  occupationalHealthRecords,
  stockTransfers, transferLines, invReservations,
  productBarcodes, warranties, networkInterfaces,
  checklistTemplates, checklistTemplateItems,
  accountingPostingRules, itPolicies,
  procTenders, procTenderLines, procTenderSuppliers, procTenderBids, procTenderBidLines, procScoringWeights,
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
    const empRows = await db.select({ id: employees.id, firstName: employees.firstName }).from(employees).where(eq(employees.companyId, COMPANY_ID));
    const yusuf = empRows.find((e) => e.firstName === 'Yusuf');
    const productRows = await db.select().from(products).where(eq(products.companyId, COMPANY_ID));
    const productBySku = Object.fromEntries(productRows.map((p) => [p.sku, p.id]));
    const unitRows = await db.select().from(units).where(eq(units.companyId, COMPANY_ID));
    const unitByCode = Object.fromEntries(unitRows.map((u) => [u.code, u.id]));
    const whRows = await db.select().from(warehouses).where(eq(warehouses.companyId, COMPANY_ID));
    const anaDepo = whRows.find((w) => w.name === 'Ana Mamul Deposu')!;
    const hammaddeDepo = whRows.find((w) => w.name === 'Hammadde Deposu')!;
    const stockItemRows = await db.select().from(stockItems).where(eq(stockItems.companyId, COMPANY_ID));
    const stockItemBySku = Object.fromEntries(stockItemRows.map((s) => [s.sku, s]));
    const [server] = await db.select().from(itAssets).where(and(eq(itAssets.companyId, COMPANY_ID), eq(itAssets.assetTag, 'SRV-001')));
    const [techsis] = await db.select().from(vendors).where(and(eq(vendors.companyId, COMPANY_ID), eq(vendors.name, 'TechSis Bilgi Teknolojileri')));
    const partyRows = await db.select().from(parties).where(eq(parties.companyId, COMPANY_ID));
    const partyByCode = Object.fromEntries(partyRows.map((p) => [p.code, p.id]));

    // ================= İŞYERİ HEKİMİ =================
    const existingOh = await db.select().from(occupationalHealthRecords).where(eq(occupationalHealthRecords.companyId, COMPANY_ID));
    if (existingOh.length === 0 && yusuf) {
      await db.insert(occupationalHealthRecords).values([
        { id: id(), companyId: COMPANY_ID, employeeId: yusuf.id, recordType: 'EXAMINATION', examKind: 'PERIODIC', title: '2026 Yıllık Periyodik Muayene', physicianName: 'Dr. Canan Ersoy', institution: 'Kocaeli OSGB', performedAt: '2026-06-15', nextDueDate: '2027-06-15', result: 'FIT' },
        { id: id(), companyId: COMPANY_ID, employeeId: yusuf.id, recordType: 'PERIODIC_FOLLOWUP', examKind: 'OTHER', title: 'İşitme Testi Takibi', institution: 'Kocaeli OSGB', nextDueDate: '2026-12-01', result: 'FIT_WITH_RESTRICTION', restrictionNote: 'Yüksek gürültülü alanlarda kulaklık zorunlu.' }
      ]);
      console.log('İşyeri Hekimi: 2 kayıt eklendi (muayene + periyodik takip).');
    }

    // ================= DEPO — TRANSFER + REZERVASYON =================
    const existingTransfer = await db.select({ transferNo: stockTransfers.transferNo }).from(stockTransfers).where(eq(stockTransfers.companyId, COMPANY_ID));
    if (!existingTransfer.some((t) => t.transferNo === 'TRF20260001')) {
      const transferId = id();
      const contaSi = stockItemBySku['URN-006'];
      await db.insert(stockTransfers).values({ id: transferId, companyId: COMPANY_ID, transferNo: 'TRF20260001', sourceWarehouseId: anaDepo.id, destinationWarehouseId: hammaddeDepo.id, status: 'RECEIVED', requestedByUserId: ADMIN_USER_ID, approvedByUserId: ADMIN_USER_ID, receivedByUserId: ADMIN_USER_ID, requestedAt: new Date('2026-08-20'), approvedAt: new Date('2026-08-20'), shippedAt: new Date('2026-08-21'), receivedAt: new Date('2026-08-21'), notes: 'Kalite kontrol için numune transferi.' });
      await db.insert(transferLines).values({ id: id(), transferId, stockItemId: contaSi.id, quantity: '20.000000', receivedQuantity: '20.000000' });
      console.log('Depo: 1 transfer eklendi (tamamlanmış).');
    }
    const existingRes = await db.select().from(invReservations).where(eq(invReservations.companyId, COMPANY_ID));
    if (existingRes.length === 0) {
      const vanaSi = stockItemBySku['URN-001'];
      await db.insert(invReservations).values({ id: id(), companyId: COMPANY_ID, warehouseId: anaDepo.id, stockItemId: vanaSi.id, quantity: '40.000000', sourceType: 'SALES_ORDER', sourceId: crypto.randomUUID(), status: 'ACTIVE', createdByUserId: ADMIN_USER_ID });
      console.log('Depo: 1 stok rezervasyonu eklendi.');
    }

    // ================= ÜRÜN BARKODU =================
    const existingBarcode = await db.select().from(productBarcodes).where(eq(productBarcodes.companyId, COMPANY_ID));
    if (existingBarcode.length === 0) {
      await db.insert(productBarcodes).values([
        { id: id(), companyId: COMPANY_ID, productId: productBySku['URN-001'], barcode: '8690000000011', barcodeType: 'EAN13' },
        { id: id(), companyId: COMPANY_ID, productId: productBySku['URN-002'], barcode: '8690000000028', barcodeType: 'EAN13' }
      ]);
      console.log('Ana Veri: 2 ürün barkodu eklendi.');
    }

    // ================= GARANTİ (IT) =================
    const existingWarranty = await db.select().from(warranties).where(eq(warranties.assetId, server.id));
    if (existingWarranty.length === 0) {
      await db.insert(warranties).values({ id: id(), companyId: COMPANY_ID, assetId: server.id, vendorId: techsis?.id, startDate: '2024-02-01', endDate: '2027-02-01', terms: '7/24 donanım destek + 4 saat yerinde müdahale garantisi.', cost: '45000.000000' });
      console.log('IT: 1 garanti kaydı eklendi.');
    }

    // ================= AĞ ARAYÜZÜ (IT) =================
    const existingIface = await db.select().from(networkInterfaces).where(eq(networkInterfaces.assetId, server.id));
    if (existingIface.length === 0) {
      await db.insert(networkInterfaces).values({ id: id(), companyId: COMPANY_ID, assetId: server.id, name: 'eth0', macAddress: '00:1A:2B:3C:4D:5E', interfaceType: 'ETHERNET', status: 'UP' });
      console.log('IT: 1 ağ arayüzü eklendi.');
    }

    // ================= KONTROL LİSTESİ ŞABLONU =================
    const existingChecklist = await db.select({ code: checklistTemplates.code }).from(checklistTemplates).where(eq(checklistTemplates.companyId, COMPANY_ID));
    if (!existingChecklist.some((c) => c.code === 'CHK-KOMPRESOR')) {
      const templateId = id();
      await db.insert(checklistTemplates).values({ id: templateId, companyId: COMPANY_ID, code: 'CHK-KOMPRESOR', name: 'Kompresör Aylık Bakım Kontrol Listesi' });
      await db.insert(checklistTemplateItems).values([
        { id: id(), templateId, label: 'Yağ seviyesi kontrolü', orderIndex: 1 },
        { id: id(), templateId, label: 'Hava filtresi temizliği', orderIndex: 2 },
        { id: id(), templateId, label: 'Kayış gerginliği kontrolü', orderIndex: 3 }
      ]);
      console.log('Bakım: 1 kontrol listesi şablonu (3 madde) eklendi.');
    }

    // ================= MUHASEBE FİŞLEME KURALI (örnek, salt gösterim) ===
    const existingRule = await db.select().from(accountingPostingRules).where(eq(accountingPostingRules.companyId, COMPANY_ID));
    if (existingRule.length === 0) {
      await db.insert(accountingPostingRules).values({ id: id(), companyId: COMPANY_ID, documentType: 'SALES_INVOICE', transactionType: 'APPROVE', debitAccountRule: '120 Alıcılar', creditAccountRule: '600 Yurt İçi Satışlar', taxAccountRule: '391 Hesaplanan KDV', active: true });
      console.log('Muhasebe: 1 fişleme kuralı eklendi (örnek/salt gösterim).');
    }

    // ================= IT POLİTİKASI (varsayılan değerle) =================
    const [existingPolicy] = await db.select().from(itPolicies).where(eq(itPolicies.companyId, COMPANY_ID));
    if (!existingPolicy) {
      await db.insert(itPolicies).values({ companyId: COMPANY_ID, continuousLocationTrackingEnabled: false });
      console.log('IT: 1 politika satırı eklendi (varsayılan: sürekli konum takibi KAPALI).');
    }

    // ================= İHALE (Satınalma Faz 8B — kapalı zarf) =================
    const existingTender = await db.select({ title: procTenders.title }).from(procTenders).where(eq(procTenders.companyId, COMPANY_ID));
    if (!existingTender.some((t) => t.title === 'Yıllık Hammadde Çelik Sac İhalesi')) {
      const tenderId = id();
      const tenderNo = await nextDocNo(db, 'TND', 'IHL', 6);
      // OPENED: kapalı zarf teklifleri (bid) açılmış, uygulama artık
      // fiyatları GÖSTERİR — status DRAFT/PUBLISHED bırakılsaydı demo
      // verisi eklenip de EKRANDA GÖRÜNMEYEN bir kayıt olurdu (Faz 8B'nin
      // "ifşa kapısı" bilinçli kısıtı, bkz. schema.ts yorumu).
      await db.insert(procTenders).values({
        id: tenderId, companyId: COMPANY_ID, tenderNo, title: 'Yıllık Hammadde Çelik Sac İhalesi', description: 'Yıllık 120 ton çelik sac ihtiyacı için kapalı zarf ihale.',
        status: 'OPENED', bidSubmissionDeadline: new Date('2026-09-15T17:00:00'), bidOpeningAt: new Date('2026-09-16T10:00:00'), openedAt: new Date('2026-09-16T10:05:00'), openedByUserId: ADMIN_USER_ID, deliveryLocation: 'Hammadde Deposu, Gebze', createdByUserId: ADMIN_USER_ID
      });
      const tenderLineId = id();
      await db.insert(procTenderLines).values({ id: tenderLineId, tenderId, productId: productBySku['URN-004'], description: 'Sıcak Haddelenmiş Çelik Sac 2mm', quantity: '120000.000000', unitId: unitByCode['KG'] });
      await db.insert(procTenderSuppliers).values({ id: id(), tenderId, supplierPartyId: partyByCode['CARI2026000003'], status: 'RESPONDED' });
      const bidId = id();
      await db.insert(procTenderBids).values({ id: bidId, tenderId, supplierPartyId: partyByCode['CARI2026000003'], version: 1, currencyCode: 'TRY', validUntil: '2026-10-16', paymentTerms: 'NET60', deliveryDays: 10, bidBondReference: 'TM-2026-8801', submittedByUserId: ADMIN_USER_ID });
      await db.insert(procTenderBidLines).values({ id: id(), bidId, tenderLineId, unitPrice: '26.900000', taxPercent: '20.00', deliveryDays: 10 });
      await db.insert(procScoringWeights).values({ companyId: COMPANY_ID, priceWeight: '50.00', technicalWeight: '20.00', deliveryWeight: '10.00', commercialWeight: '20.00' }).onDuplicateKeyUpdate({ set: { priceWeight: '50.00' } });
      console.log(`İhale: ${tenderNo} (OPENED — teklif fiyatları görünür), 1 tedarikçi, 1 teklif, skorlama ağırlıkları eklendi.`);
    }

    console.log('\n=== BATCH 11 (Son parti) TAMAMLANDI ===');
  } finally {
    await connection.end();
  }
}

main().catch((err) => { console.error('Batch 11 başarısız:', err); process.exit(1); });
