import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  marketingStoreSaleLines,
  marketingStoreSales,
  marketingStoreShifts,
  marketingStores,
  parties,
  stockItems
} from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { createWarehouse, recordStockMovementInTx } from '@/lib/warehouse';
import { recordCashTransaction, createCashAccount } from '@/lib/cash';
import { MarketingError } from './errors';
import {
  canCloseShift,
  canOpenShift,
  canRecordSale,
  requiresOwnLedger,
  saleLinesTotal,
  shiftCloseTotal,
  type MarketingStoreType
} from './store-flow';

// Ofis / Mağaza — Pazarlama Faz 3.
// Kurallar lib/marketing/store-flow.ts'te (saf, test edilebilir);
// burada yalnızca veri erişimi ve MEVCUT depo/kasa altyapısının
// çağrılması. Stok ve kasa için kopya bir muhasebe motoru YAZILMADI.

export interface CreateStoreInput {
  departmentId: string;
  code: string;
  name: string;
  storeType: MarketingStoreType;
  location?: string;
  // POS türünde ZORUNLU — lib katmanında kontrol edilir.
  accountingAccountId?: string;
  salesRevenueAccountCode?: string;
}

export async function createStore(companyId: string, input: CreateStoreInput): Promise<string> {
  if (requiresOwnLedger(input.storeType)) {
    if (!input.accountingAccountId) {
      throw new MarketingError('Tezgâh satışı yapan mağaza için kasa hesabı seçilmelidir.');
    }
    if (!input.salesRevenueAccountCode) {
      throw new MarketingError('Tezgâh satışı yapan mağaza için satış geliri karşı hesabı belirtilmelidir.');
    }
  }

  const id = newId();
  await db.transaction(async (tx) => {
    let warehouseId: string | undefined;
    let cashAccountId: string | undefined;

    if (requiresOwnLedger(input.storeType)) {
      // Mevcut depo/kasa oluşturma yardımcıları KENDİ transaction'ını
      // AÇMIYOR (basit insert), bu yüzden aynı tx içinde güvenle
      // çağrılabilir. Mağaza adını depo/kasa adına da taşıyoruz ki
      // liste ekranlarında "hangi kaydın hangi mağazaya ait olduğu"
      // isimden anlaşılsın.
      warehouseId = await createWarehouse(companyId, `Mağaza: ${input.name}`);
      cashAccountId = await createCashAccount(companyId, {
        name: `Mağaza Kasası: ${input.name}`,
        accountingAccountId: input.accountingAccountId!
      });
    }

    await tx.insert(marketingStores).values({
      id,
      companyId,
      departmentId: input.departmentId,
      code: input.code,
      name: input.name,
      storeType: input.storeType,
      location: input.location ?? '',
      warehouseId,
      cashAccountId,
      salesRevenueAccountCode: input.salesRevenueAccountCode
    });
  });
  return id;
}

export async function listStores(companyId: string, departmentId?: string) {
  const where = departmentId
    ? and(eq(marketingStores.companyId, companyId), eq(marketingStores.departmentId, departmentId))
    : eq(marketingStores.companyId, companyId);
  return db.select().from(marketingStores).where(where);
}

async function loadStore(companyId: string, storeId: string) {
  const [row] = await db.select().from(marketingStores).where(and(eq(marketingStores.id, storeId), eq(marketingStores.companyId, companyId))).limit(1);
  if (!row) throw new MarketingError('Mağaza bulunamadı.');
  return row;
}

async function findOpenShift(companyId: string, storeId: string) {
  const [row] = await db
    .select()
    .from(marketingStoreShifts)
    .where(and(eq(marketingStoreShifts.companyId, companyId), eq(marketingStoreShifts.storeId, storeId), eq(marketingStoreShifts.status, 'OPEN')))
    .limit(1);
  return row ?? null;
}

export async function openShift(companyId: string, userId: string, storeId: string): Promise<string> {
  const store = await loadStore(companyId, storeId);
  if (!requiresOwnLedger(store.storeType)) throw new MarketingError('Bu mağaza türünde vardiya kavramı yok.');

  const existing = await findOpenShift(companyId, storeId);
  if (!canOpenShift(!!existing)) throw new MarketingError('Bu mağazada zaten açık bir vardiya var.');

  const id = newId();
  await db.insert(marketingStoreShifts).values({ id, companyId, storeId, status: 'OPEN', openedByUserId: userId });
  return id;
}

export interface StoreSaleLineInput {
  productId: string;
  quantity: string;
  unitPrice: string;
}

export interface RecordSaleInput {
  storeId: string;
  partyId?: string;
  lines: StoreSaleLineInput[];
}

// Satış + stok düşümü TEK transaction'da: biri başarısız olursa ikisi de
// geri alınır — "kasada satış var ama stokta düşmedi" gibi bir tutarsızlık
// oluşmaz.
export async function recordStoreSale(companyId: string, userId: string, input: RecordSaleInput): Promise<string> {
  const store = await loadStore(companyId, input.storeId);
  const openShiftRow = await findOpenShift(companyId, input.storeId);

  if (!canRecordSale(store.storeType, openShiftRow?.status ?? null)) {
    throw new MarketingError(
      store.storeType !== 'POS'
        ? 'Bu mağaza yalnızca sipariş alır, tezgâh satışı kaydedilemez.'
        : 'Önce vardiya açılmalı.'
    );
  }
  if (!store.warehouseId) throw new MarketingError('Mağazanın bağlı bir deposu yok.');

  const total = saleLinesTotal(input.lines);
  if (total == null) throw new MarketingError('Satış kalemlerinde geçersiz miktar/fiyat var.');
  if (input.lines.length === 0) throw new MarketingError('Satışta en az bir kalem olmalı.');

  const id = newId();
  const today = new Date().toISOString().slice(0, 10);

  await db.transaction(async (tx) => {
    const saleNo = await nextDocumentNo(tx, companyId, 'MARKETING_STORE_SALE', 'MGZ', new Date().getFullYear());
    await tx.insert(marketingStoreSales).values({
      id,
      companyId,
      storeId: input.storeId,
      shiftId: openShiftRow!.id,
      saleNo,
      partyId: input.partyId,
      totalAmount: total.toFixed(6),
      createdByUserId: userId
    });

    for (const line of input.lines) {
      await tx.insert(marketingStoreSaleLines).values({
        id: newId(),
        saleId: id,
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice
      });

      // stockItems ve products AYRI tablolar (stockItems.productId
      // OPSİYONEL bir bağlantı) — lib/sales/shipments.ts'teki AYNI
      // eşleme burada da gerekli, productId'yi doğrudan stockItemId
      // yerine geçirmek YANLIŞ olurdu (recordStockMovementInTx farklı
      // bir tabloya bakar). shipments.ts eşleşme yoksa hareketi
      // SESSİZCE atlıyor — burada BİLİNÇLİ OLARAK farklı davranıyoruz:
      // mağazanın bütün amacı "kendi stoğunu tutması", stok kartı
      // yoksa sessizce atlamak bu vaadi sessizce bozardı.
      const [stockItem] = await tx
        .select({ id: stockItems.id })
        .from(stockItems)
        .where(and(eq(stockItems.productId, line.productId), eq(stockItems.companyId, companyId)))
        .limit(1);
      if (!stockItem) {
        throw new MarketingError('Bu ürün için depo stok kartı tanımlı değil — önce Ana Veri/Depo tarafında stok kartı açılmalı.');
      }

      // Mevcut depo motoru: OUT hareketinde birim maliyeti KULLANICI
      // GİRMEZ, o ANKİ ağırlıklı ortalama maliyetten otomatik hesaplanır
      // (lib/warehouse.ts'in kendi kuralı) — burada tekrar edilmiyor.
      await recordStockMovementInTx(tx, {
        companyId,
        warehouseId: store.warehouseId!,
        stockItemId: stockItem.id,
        movementType: 'OUT',
        quantity: line.quantity,
        description: `Mağaza satışı ${saleNo}`,
        transactionDate: today,
        sourceType: 'MARKETING_STORE_SALE',
        sourceId: id,
        createdByUserId: userId
      });
    }
  });
  return id;
}

// Gün sonu — "muhasebeye aktar" butonu. O vardiyadaki TÜM satışların
// toplamı TEK bir kasa fişi olarak muhasebeleşir (recordCashTransaction
// zaten kendi journal'ını açıyor, burada kopyalanmadı).
export async function closeShift(companyId: string, userId: string, shiftId: string): Promise<void> {
  const [shift] = await db.select().from(marketingStoreShifts).where(and(eq(marketingStoreShifts.id, shiftId), eq(marketingStoreShifts.companyId, companyId))).limit(1);
  if (!shift) throw new MarketingError('Vardiya bulunamadı.');
  if (!canCloseShift(shift.status)) throw new MarketingError('Bu vardiya zaten kapatılmış.');

  const store = await loadStore(companyId, shift.storeId);
  if (!store.cashAccountId || !store.salesRevenueAccountCode) {
    throw new MarketingError('Mağazanın kasa hesabı veya satış geliri karşı hesabı tanımlı değil.');
  }

  const sales = await db
    .select({ totalAmount: marketingStoreSales.totalAmount })
    .from(marketingStoreSales)
    .where(eq(marketingStoreSales.shiftId, shiftId));
  const total = shiftCloseTotal(sales.map((s) => s.totalAmount));

  let cashTransactionId: string | undefined;
  if (total > 0) {
    cashTransactionId = await recordCashTransaction({
      companyId,
      cashAccountId: store.cashAccountId,
      transactionType: 'IN',
      amount: total,
      counterAccountCode: store.salesRevenueAccountCode,
      description: `${store.name} — gün sonu satış toplamı`,
      transactionDate: new Date().toISOString().slice(0, 10),
      createdByUserId: userId
    });
  }

  await db
    .update(marketingStoreShifts)
    .set({
      status: 'CLOSED',
      closedAt: new Date(),
      closedByUserId: userId,
      totalAmount: total.toFixed(6),
      cashTransactionId
    })
    .where(eq(marketingStoreShifts.id, shiftId));
}

export async function listShifts(companyId: string, storeId?: string) {
  const where = storeId
    ? and(eq(marketingStoreShifts.companyId, companyId), eq(marketingStoreShifts.storeId, storeId))
    : eq(marketingStoreShifts.companyId, companyId);
  return db.select().from(marketingStoreShifts).where(where).orderBy(desc(marketingStoreShifts.openedAt));
}

export async function listStoreSales(companyId: string, shiftId: string) {
  return db
    .select({
      id: marketingStoreSales.id,
      saleNo: marketingStoreSales.saleNo,
      totalAmount: marketingStoreSales.totalAmount,
      partyName: parties.legalName,
      createdAt: marketingStoreSales.createdAt
    })
    .from(marketingStoreSales)
    .leftJoin(parties, eq(parties.id, marketingStoreSales.partyId))
    .where(and(eq(marketingStoreSales.companyId, companyId), eq(marketingStoreSales.shiftId, shiftId)))
    .orderBy(desc(marketingStoreSales.createdAt));
}

