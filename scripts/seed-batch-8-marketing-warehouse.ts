// Pazarlama (sözleşme+imza, kantar fişi, mağaza+vardiya+satış) — kendi
// modülümüz, doğrulama sırasında eklenip TEMİZLENEN veriler yerine KALICI
// demo veri. + Depo açılış hareketleri (stock_movements/inv_balances) +
// 1 kasa işlemi.
import 'dotenv/config';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq, and } from 'drizzle-orm';
import {
  departments, parties, products, units, stockItems, warehouses, users,
  marketingContracts, marketingContractLines,
  weighbridges, weighbridgeTickets,
  marketingStores, marketingStoreShifts, marketingStoreSales, marketingStoreSaleLines,
  stockMovements, invBalances,
  cashAccounts, cashTransactions, accountingAccounts
} from '../src/db/schema';

const COMPANY_ID = '4cb19554-c8e9-4ea1-a1e0-f2d061af7625';
const ADMIN_USER_ID = '6e73bf6a-3a3d-4916-9213-5742986c040d';

function id() { return crypto.randomUUID(); }

async function main() {
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  const connection = await mysql.createConnection(url!);
  const db = drizzle(connection, { mode: 'default' });

  try {
    const [mktDept] = await db.select().from(departments).where(and(eq(departments.companyId, COMPANY_ID), eq(departments.departmentTypeCode, 'MARKETING')));
    const partyRows = await db.select().from(parties).where(eq(parties.companyId, COMPANY_ID));
    const partyByCode = Object.fromEntries(partyRows.map((p) => [p.code, p.id]));
    const productRows = await db.select().from(products).where(eq(products.companyId, COMPANY_ID));
    const productBySku = Object.fromEntries(productRows.map((p) => [p.sku, p.id]));
    const stockItemRows = await db.select().from(stockItems).where(eq(stockItems.companyId, COMPANY_ID));
    const stockItemBySku = Object.fromEntries(stockItemRows.map((s) => [s.sku, s]));
    const whRows = await db.select().from(warehouses).where(eq(warehouses.companyId, COMPANY_ID));
    const anaDepo = whRows.find((w) => w.name === 'Ana Mamul Deposu')!;
    const hammaddeDepo = whRows.find((w) => w.name === 'Hammadde Deposu')!;

    // ================= PAZARLAMA — ANLAŞMA (imzalı, yürürlükte) =========
    const existingContract = await db.select({ contractNo: marketingContracts.contractNo }).from(marketingContracts).where(eq(marketingContracts.companyId, COMPANY_ID));
    if (!existingContract.some((c) => c.contractNo === 'SZL20260001') && mktDept) {
      const contractId = id();
      await db.insert(marketingContracts).values({
        id: contractId, companyId: COMPANY_ID, departmentId: mktDept.id, contractNo: 'SZL20260001', title: '2026 Yıllık Vana Tedarik Anlaşması',
        partyId: partyByCode['CARI2026000001'], status: 'ACTIVE', currencyCode: 'TRY', startDate: '2026-01-01', endDate: '2026-12-31',
        counterpartyIsContractor: false, signedAt: new Date('2025-12-20'), signedByUserId: ADMIN_USER_ID, counterpartySignatory: 'Serkan Yılmaz', createdByUserId: ADMIN_USER_ID
      });
      await db.insert(marketingContractLines).values({ id: id(), contractId, productId: productBySku['URN-001'], quantity: '300.000000', unitPrice: '1200.000000', deliveryTerm: 'EX_WORKS', deliveryNote: 'Aylık 25 adet teslimat.' });

      // Müteahhit senaryosu — Faz 4 köprüsünün gösterebileceği kalıcı örnek.
      const contractorContractId = id();
      await db.insert(marketingContracts).values({
        id: contractorContractId, companyId: COMPANY_ID, departmentId: mktDept.id, contractNo: 'SZL20260002', title: 'Yapı İnşaat — Şantiye Malzeme Anlaşması',
        partyId: partyByCode['CARI2026000005'], status: 'ACTIVE', currencyCode: 'TRY', startDate: '2026-08-01', endDate: '2027-01-31',
        counterpartyIsContractor: true, signedAt: new Date('2026-07-28'), signedByUserId: ADMIN_USER_ID, counterpartySignatory: 'Proje Müdürü', createdByUserId: ADMIN_USER_ID
      });
      await db.insert(marketingContractLines).values({ id: id(), contractId: contractorContractId, productId: productBySku['URN-005'], quantity: '2000.000000', unitPrice: '65.000000', deliveryTerm: 'DELIVERED', deliveryNote: 'Şantiyeye teslim.' });
      console.log('Pazarlama: 2 sözleşme eklendi (biri müteahhit işaretli).');
    }

    // ================= PAZARLAMA — KANTAR =================
    const existingWb = await db.select({ code: weighbridges.code }).from(weighbridges).where(eq(weighbridges.companyId, COMPANY_ID));
    let mainWeighbridgeId: string;
    if (!existingWb.some((w) => w.code === 'KNT-1') && mktDept) {
      mainWeighbridgeId = id();
      await db.insert(weighbridges).values({ id: mainWeighbridgeId, companyId: COMPANY_ID, departmentId: mktDept.id, code: 'KNT-1', name: 'Ana Kantar', location: 'Fabrika girişi', capacityKg: '60000.000', roadLegalLimitKg: '40000.000', tolerancePercent: '3.000' });
    } else {
      const [existing] = await db.select({ id: weighbridges.id }).from(weighbridges).where(and(eq(weighbridges.companyId, COMPANY_ID), eq(weighbridges.code, 'KNT-1')));
      mainWeighbridgeId = existing.id;
    }
    const existingTicket = await db.select({ ticketNo: weighbridgeTickets.ticketNo }).from(weighbridgeTickets).where(eq(weighbridgeTickets.companyId, COMPANY_ID));
    if (!existingTicket.some((t) => t.ticketNo === 'KNT20260001')) {
      // kg'lı ürün — çelik sac sevkiyatı, net kilo faturaya gidecek miktar.
      await db.insert(weighbridgeTickets).values({
        id: id(), companyId: COMPANY_ID, weighbridgeId: mainWeighbridgeId, ticketNo: 'KNT20260001', purpose: 'SALES_QUANTITY', direction: 'OUTBOUND', status: 'COMPLETED',
        plateNo: '34ABC123', driverName: 'Hakan Yıldız', carrierName: 'Ege Lojistik ve Nakliyat Ltd. Şti.', partyId: partyByCode['CARI2026000002'], productId: productBySku['URN-004'],
        grossKg: '18500.000', tareKg: '8200.000', netKg: '10300.000', firstWeighedAt: new Date('2026-08-30T09:15:00'), secondWeighedAt: new Date('2026-08-30T09:22:00'),
        roadLegalOk: true, createdByUserId: ADMIN_USER_ID, completedAt: new Date('2026-08-30T09:22:00')
      });
      // adetli ürün — yalnızca tonaj kontrolü, miktarı DEĞİŞTİRMEZ.
      await db.insert(weighbridgeTickets).values({
        id: id(), companyId: COMPANY_ID, weighbridgeId: mainWeighbridgeId, ticketNo: 'KNT20260002', purpose: 'ROAD_LEGAL_CHECK', direction: 'OUTBOUND', status: 'COMPLETED',
        plateNo: '41 ABC 123', driverName: 'Kamyonet Sürücüsü', grossKg: '3800.000', tareKg: '2100.000', netKg: '1700.000',
        firstWeighedAt: new Date('2026-08-31T14:00:00'), secondWeighedAt: new Date('2026-08-31T14:05:00'), roadLegalOk: true, createdByUserId: ADMIN_USER_ID, completedAt: new Date('2026-08-31T14:05:00')
      });
      console.log('Pazarlama: 1 kantar, 2 tartım fişi eklendi (biri satış miktarı, biri tonaj kontrolü).');
    }

    // ================= PAZARLAMA — MAĞAZA (POS, vardiya+satış) =========
    const existingStore = await db.select({ code: marketingStores.code }).from(marketingStores).where(eq(marketingStores.companyId, COMPANY_ID));
    if (!existingStore.some((s) => s.code === 'MGZ-1') && mktDept) {
      const [kasaHesap] = await db.select({ id: accountingAccounts.id }).from(accountingAccounts).where(and(eq(accountingAccounts.companyId, COMPANY_ID), eq(accountingAccounts.code, '100.02')));
      const storeWarehouseId = id();
      await db.insert(warehouses).values({ id: storeWarehouseId, companyId: COMPANY_ID, name: 'Mağaza: Showroom Depo' });
      const storeCashId = id();
      await db.insert(cashAccounts).values({ id: storeCashId, companyId: COMPANY_ID, name: 'Mağaza Kasası: Showroom', accountingAccountId: kasaHesap.id, currency: 'TRY' });

      const storeId = id();
      await db.insert(marketingStores).values({ id: storeId, companyId: COMPANY_ID, departmentId: mktDept.id, code: 'MGZ-1', name: 'Merkez Showroom', storeType: 'POS', location: 'Fabrika girişi ofis', warehouseId: storeWarehouseId, cashAccountId: storeCashId, salesRevenueAccountCode: '500' });

      // Mağaza deposuna açılış stoğu (conta seti — küçük parça, showroom'da satılabilir).
      const contaSi = stockItemBySku['URN-006'];
      await db.insert(stockItems).values({ id: id(), companyId: COMPANY_ID, sku: 'URN-006-MGZ', name: 'Vana Conta Seti (Showroom)', unit: 'ADET', currentQty: '95.000000', avgCost: '42.000000', productId: contaSi.productId! });
      const [storeStockItem] = await db.select().from(stockItems).where(and(eq(stockItems.companyId, COMPANY_ID), eq(stockItems.sku, 'URN-006-MGZ')));

      // Kapanmış vardiya + satış (gün sonu muhasebeye aktarılmış).
      const shiftId = id();
      await db.insert(marketingStoreShifts).values({ id: shiftId, companyId: COMPANY_ID, storeId, status: 'CLOSED', openedAt: new Date('2026-09-01T09:00:00'), openedByUserId: ADMIN_USER_ID, closedAt: new Date('2026-09-01T18:00:00'), closedByUserId: ADMIN_USER_ID, totalAmount: '580.000000' });
      const saleId = id();
      await db.insert(marketingStoreSales).values({ id: saleId, companyId: COMPANY_ID, storeId, shiftId, saleNo: 'MGZ20260001', totalAmount: '580.000000', createdByUserId: ADMIN_USER_ID, createdAt: new Date('2026-09-01T11:30:00') });
      await db.insert(marketingStoreSaleLines).values({ id: id(), saleId, productId: contaSi.productId!, quantity: '10.000000', unitPrice: '58.000000' });
      // Kapanışın gün sonu kasa fişi.
      const cashTxnId = id();
      await db.insert(cashTransactions).values({ id: cashTxnId, companyId: COMPANY_ID, cashAccountId: storeCashId, transactionType: 'IN', amount: '580.000000', counterAccountCode: '500', description: 'Merkez Showroom — gün sonu satış toplamı', transactionDate: '2026-09-01', createdByUserId: ADMIN_USER_ID });
      await db.update(marketingStoreShifts).set({ cashTransactionId: cashTxnId }).where(eq(marketingStoreShifts.id, shiftId));
      await db.update(stockItems).set({ currentQty: '85.000000' }).where(eq(stockItems.id, storeStockItem.id));

      console.log('Pazarlama: 1 POS mağaza, kapanmış 1 vardiya, 1 satış, 1 kasa fişi eklendi.');
    }

    // ================= DEPO — AÇILIŞ HAREKETLERİ (inv_balances) =========
    const existingMove = await db.select().from(stockMovements).where(eq(stockMovements.companyId, COMPANY_ID));
    if (existingMove.length === 0) {
      const openings: { sku: string; warehouse: typeof anaDepo }[] = [
        { sku: 'URN-001', warehouse: anaDepo }, { sku: 'URN-002', warehouse: anaDepo }, { sku: 'URN-003', warehouse: anaDepo },
        { sku: 'URN-004', warehouse: hammaddeDepo }, { sku: 'URN-005', warehouse: hammaddeDepo }, { sku: 'URN-006', warehouse: anaDepo }
      ];
      for (const o of openings) {
        const si = stockItemBySku[o.sku];
        await db.insert(stockMovements).values({ id: id(), companyId: COMPANY_ID, warehouseId: o.warehouse.id, stockItemId: si.id, movementType: 'IN', quantity: si.currentQty, unitCost: si.avgCost, description: 'Açılış stoğu (2026 devir).', transactionDate: '2026-01-01', createdByUserId: ADMIN_USER_ID });
        await db.insert(invBalances).values({ id: id(), companyId: COMPANY_ID, warehouseId: o.warehouse.id, stockItemId: si.id, qty: si.currentQty, avgCost: si.avgCost });
      }
      console.log(`Depo: ${openings.length} açılış hareketi + depo-bazlı bakiye eklendi.`);
    }

    console.log('\n=== BATCH 8 (Pazarlama + Depo hareketleri) TAMAMLANDI ===');
  } finally {
    await connection.end();
  }
}

main().catch((err) => { console.error('Batch 8 başarısız:', err); process.exit(1); });
