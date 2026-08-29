import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { warehouses, stockItems, stockMovements, accountingAccounts, whLocations, invBalances, stockTransfers, transferLines, invReservations } from '@/db/schema';
import { newId } from '@/lib/id';
import { money, toDb } from '@/lib/money';
import { postJournalInTx, AccountingError } from '@/lib/accounting';
import { nextDocumentNo } from '@/lib/numbering';

// Yeni Depo departmanı — kullanıcının isteği: IT'nin yedek parça tüketimi
// için minimal ama GERÇEK bir başlangıç, kendi PDF'i geldiğinde
// genişletilecek (bkz. FIELD-SERVICE.md §4, IT-ARCHITECTURE.md §9 Risk 1).
// Ağırlıklı ortalama maliyet yöntemi — Demirbaş'ta kurulan AYNI atomiklik
// deseni: stok miktarı/maliyet güncellemesi + (varsa) muhasebe fişi TEK
// transaction'da (postJournalInTx).

export async function createWarehouse(companyId: string, name: string, branchId?: string): Promise<string> {
  const id = newId();
  await db.insert(warehouses).values({ id, companyId, name, branchId });
  return id;
}

export async function listWarehouses(companyId: string) {
  return db.select().from(warehouses).where(and(eq(warehouses.companyId, companyId), eq(warehouses.active, true)));
}

export interface CreateStockItemInput {
  sku: string;
  name: string;
  unit?: string;
  accountingAccountId?: string;
  // Faz 2A — OPSİYONEL, Master Data'daki (lib/master-data/products.ts) tek
  // Ürün kaynağına bağlantı. Boş bırakılırsa stock_items eskisi gibi
  // bağımsız çalışmaya devam eder (mevcut akış bozulmaz).
  productId?: string;
}

export async function createStockItem(companyId: string, input: CreateStockItemInput): Promise<string> {
  const id = newId();
  await db.insert(stockItems).values({ id, companyId, sku: input.sku, name: input.name, unit: input.unit ?? 'ADET', accountingAccountId: input.accountingAccountId, productId: input.productId });
  return id;
}

export async function listStockItems(companyId: string) {
  return db
    .select({
      id: stockItems.id,
      sku: stockItems.sku,
      name: stockItems.name,
      unit: stockItems.unit,
      currentQty: stockItems.currentQty,
      avgCost: stockItems.avgCost,
      accountingAccountId: stockItems.accountingAccountId,
      accountCode: accountingAccounts.code
    })
    .from(stockItems)
    .leftJoin(accountingAccounts, eq(accountingAccounts.id, stockItems.accountingAccountId))
    .where(and(eq(stockItems.companyId, companyId), eq(stockItems.active, true)));
}

export interface RecordStockMovementInput {
  companyId: string;
  warehouseId: string;
  stockItemId: string;
  movementType: 'IN' | 'OUT';
  quantity: number | string;
  unitCost?: number | string; // yalnızca IN'de kullanılır, OUT'ta yok sayılır (mevcut ort. maliyet kullanılır)
  counterAccountCode?: string; // stockItem.accountingAccountId doluysa ve bu verilmişse fiş üretir
  description?: string;
  transactionDate: string;
  sourceType?: string;
  sourceId?: string;
  createdByUserId: string;
  locationId?: string; // Faz 2A — opsiyonel bin/rack seviyesi konum
}

export interface StockMovementResult {
  movementId: string;
  journalId?: string;
}

export async function recordStockMovement(input: RecordStockMovementInput): Promise<StockMovementResult> {
  return db.transaction((tx) => recordStockMovementInTx(tx, input));
}

// Faz 2A — transitionStockTransfer'ın (aşağıda) TEK bir transfer için BİRDEN
// FAZLA hareket (her satır için OUT+IN) üretmesi gerekiyor; hepsinin TEK
// transaction'da atomik olması için ...InTx varyantı — actions/it/tickets.ts:
// createTicketInTx İLE AYNI desen (Faz 8/9'da bulunan iç-içe-transaction
// hatasının burada TEKRARLANMAMASI için).
export async function recordStockMovementInTx(tx: Tx, input: RecordStockMovementInput): Promise<StockMovementResult> {
  const qty = money(input.quantity);
  if (qty.lessThanOrEqualTo(0)) throw new AccountingError('Miktar sıfırdan büyük olmalı.');

  const [item] = await tx.select().from(stockItems).where(and(eq(stockItems.id, input.stockItemId), eq(stockItems.companyId, input.companyId))).limit(1);
    if (!item) throw new AccountingError('Stok kartı bulunamadı.');

    const currentQty = money(item.currentQty);
    const currentAvgCost = money(item.avgCost);

    let newQty: ReturnType<typeof money>;
    let newAvgCost: ReturnType<typeof money>;
    let movementUnitCost: ReturnType<typeof money>;

    if (input.movementType === 'IN') {
      if (input.unitCost === undefined) throw new AccountingError('Giriş hareketi için birim maliyet gerekli.');
      movementUnitCost = money(input.unitCost);
      newQty = currentQty.plus(qty);
      // Ağırlıklı ortalama: (eski miktar × eski maliyet + yeni miktar × yeni maliyet) / toplam miktar.
      newAvgCost = newQty.isZero() ? money(0) : currentQty.times(currentAvgCost).plus(qty.times(movementUnitCost)).dividedBy(newQty);
    } else {
      if (qty.greaterThan(currentQty)) throw new AccountingError(`Yetersiz stok — mevcut: ${currentQty.toFixed(2)}, istenen: ${qty.toFixed(2)}.`);
      movementUnitCost = currentAvgCost; // OUT'ta maliyet kullanıcıdan alınmaz, o anki ortalamadan hesaplanır.
      newQty = currentQty.minus(qty);
      newAvgCost = currentAvgCost; // OUT ortalama maliyeti değiştirmez.
    }

    await tx.update(stockItems).set({ currentQty: toDb(newQty), avgCost: toDb(newAvgCost) }).where(eq(stockItems.id, item.id));

    // Faz 2A — depo bazlı bakiye (madde 50, 53). stock_items.currentQty
    // (şirket geneli) YUKARIDA zaten güncellendi ve OUT için yeterlilik
    // kontrolü HÂLÂ o şirket-geneli değere göre yapılıyor (mevcut davranış
    // KORUNUYOR — inv_balances yeni bir tablo, geçmiş hareketler için
    // geriye dönük doldurma yok, bu yüzden burada sıfırdan başlayıp negatife
    // düşebilir; bilinçli bir kısıtlama, TODO: INV_BALANCE_BACKFILL). Bu
    // satır yalnızca BİLGİLENDİRİCİ bir kırılım sağlar, henüz yeni bir
    // engelleyici kural eklemez.
    await applyInvBalanceDeltaInTx(tx, {
      warehouseId: input.warehouseId,
      companyId: input.companyId,
      stockItemId: input.stockItemId,
      movementType: input.movementType,
      quantity: qty,
      unitCost: movementUnitCost
    });

    let journalId: string | undefined;
    if (item.accountingAccountId && input.counterAccountCode) {
      const [stockAccount] = await tx.select({ code: accountingAccounts.code }).from(accountingAccounts).where(eq(accountingAccounts.id, item.accountingAccountId)).limit(1);
      if (!stockAccount) throw new AccountingError('Stok değer hesabı bulunamadı.');
      const totalValue = qty.times(movementUnitCost);
      const posted = await postJournalInTx(tx, {
        companyId: input.companyId,
        journalDate: input.transactionDate,
        documentType: 'STOCK',
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        description: input.description ?? `Stok ${input.movementType === 'IN' ? 'girişi' : 'çıkışı'} — ${item.sku}`,
        createdByUserId: input.createdByUserId,
        lines:
          input.movementType === 'IN'
            ? [{ accountCode: stockAccount.code, debit: totalValue }, { accountCode: input.counterAccountCode, credit: totalValue }]
            : [{ accountCode: input.counterAccountCode, debit: totalValue }, { accountCode: stockAccount.code, credit: totalValue }]
      });
      journalId = posted.journalId;
    }

    const movementId = newId();
    await tx.insert(stockMovements).values({
      id: movementId,
      companyId: input.companyId,
      warehouseId: input.warehouseId,
      stockItemId: input.stockItemId,
      movementType: input.movementType,
      quantity: toDb(qty),
      unitCost: toDb(movementUnitCost),
      counterAccountCode: input.counterAccountCode,
      journalId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      description: input.description,
      transactionDate: input.transactionDate,
      locationId: input.locationId,
      createdByUserId: input.createdByUserId
    });

  return { movementId, journalId };
}

export async function listStockMovements(companyId: string, stockItemId?: string) {
  const conditions = stockItemId ? and(eq(stockMovements.companyId, companyId), eq(stockMovements.stockItemId, stockItemId)) : eq(stockMovements.companyId, companyId);
  return db.select().from(stockMovements).where(conditions).orderBy(desc(stockMovements.transactionDate));
}

// stock_items.currentQty İLE AYNI ağırlıklı-ortalama mantığı, yalnızca
// (warehouseId, stockItemId) çiftine göre kırılmış. IN'de gerçek weighted-
// average, OUT'ta yalnızca miktar düşer (avgCost değişmez) — recordStockMovement
// ile TUTARLI.
async function applyInvBalanceDeltaInTx(
  tx: Tx,
  params: { companyId: string; warehouseId: string; stockItemId: string; movementType: 'IN' | 'OUT'; quantity: ReturnType<typeof money>; unitCost: ReturnType<typeof money> }
): Promise<void> {
  const [row] = await tx.select().from(invBalances).where(and(eq(invBalances.warehouseId, params.warehouseId), eq(invBalances.stockItemId, params.stockItemId))).limit(1);
  const currentQty = row ? money(row.qty) : money(0);
  const currentAvgCost = row ? money(row.avgCost) : money(0);

  let newQty: ReturnType<typeof money>;
  let newAvgCost: ReturnType<typeof money>;
  if (params.movementType === 'IN') {
    newQty = currentQty.plus(params.quantity);
    newAvgCost = newQty.isZero() ? money(0) : currentQty.times(currentAvgCost).plus(params.quantity.times(params.unitCost)).dividedBy(newQty);
  } else {
    newQty = currentQty.minus(params.quantity);
    newAvgCost = currentAvgCost;
  }

  if (row) {
    await tx.update(invBalances).set({ qty: toDb(newQty), avgCost: toDb(newAvgCost) }).where(eq(invBalances.id, row.id));
  } else {
    await tx.insert(invBalances).values({ id: newId(), companyId: params.companyId, warehouseId: params.warehouseId, stockItemId: params.stockItemId, qty: toDb(newQty), avgCost: toDb(newAvgCost) });
  }
}

export async function listInvBalances(companyId: string, warehouseId?: string) {
  const conditions = warehouseId ? and(eq(invBalances.companyId, companyId), eq(invBalances.warehouseId, warehouseId)) : eq(invBalances.companyId, companyId);
  return db
    .select({ id: invBalances.id, warehouseId: invBalances.warehouseId, stockItemId: invBalances.stockItemId, sku: stockItems.sku, name: stockItems.name, qty: invBalances.qty, avgCost: invBalances.avgCost })
    .from(invBalances)
    .innerJoin(stockItems, eq(stockItems.id, invBalances.stockItemId))
    .where(conditions);
}

// --- Konum hiyerarşisi (madde 51-52) — it_locations (IT-DATABASE.md §1)
// İLE AYNI desen: bina/rack yerine ZONE→AISLE→RACK→SHELF→BIN, ama AYNI
// kendine-referanslı ağaç tekniği (AnyMySqlColumn lazy-ref, schema.ts). ---

export interface CreateWhLocationInput {
  warehouseId: string;
  parentLocationId?: string;
  locationType: 'ZONE' | 'AISLE' | 'RACK' | 'SHELF' | 'BIN';
  code: string;
  name?: string;
}

export async function createWhLocation(companyId: string, input: CreateWhLocationInput): Promise<string> {
  const [wh] = await db.select({ id: warehouses.id }).from(warehouses).where(and(eq(warehouses.id, input.warehouseId), eq(warehouses.companyId, companyId))).limit(1);
  if (!wh) throw new AccountingError('Depo bulunamadı.');
  if (input.parentLocationId) {
    const [parent] = await db.select({ id: whLocations.id }).from(whLocations).where(and(eq(whLocations.id, input.parentLocationId), eq(whLocations.warehouseId, input.warehouseId))).limit(1);
    if (!parent) throw new AccountingError('Üst konum bulunamadı.');
  }

  const id = newId();
  await db.insert(whLocations).values({ id, warehouseId: input.warehouseId, parentLocationId: input.parentLocationId, locationType: input.locationType, code: input.code, name: input.name ?? '' });
  return id;
}

export async function listWhLocations(warehouseId: string) {
  return db.select().from(whLocations).where(and(eq(whLocations.warehouseId, warehouseId), eq(whLocations.active, true)));
}

// --- Depo Transferi (madde 54-56). ---

export interface CreateStockTransferInput {
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  requestedByUserId: string;
  notes?: string;
  lines: { stockItemId: string; quantity: number | string }[];
}

export async function createStockTransfer(companyId: string, input: CreateStockTransferInput): Promise<string> {
  if (input.sourceWarehouseId === input.destinationWarehouseId) throw new AccountingError('Kaynak ve hedef depo aynı olamaz.');
  if (input.lines.length === 0) throw new AccountingError('En az bir satır gerekli.');

  return db.transaction(async (tx) => {
    const id = newId();
    const transferNo = await nextDocumentNo(tx, companyId, 'TRANSFER', 'TR', new Date().getFullYear(), 6);
    await tx.insert(stockTransfers).values({
      id,
      companyId,
      transferNo,
      sourceWarehouseId: input.sourceWarehouseId,
      destinationWarehouseId: input.destinationWarehouseId,
      status: 'DRAFT',
      requestedByUserId: input.requestedByUserId,
      notes: input.notes
    });
    for (const line of input.lines) {
      await tx.insert(transferLines).values({ id: newId(), transferId: id, stockItemId: line.stockItemId, quantity: toDb(line.quantity) });
    }
    return id;
  });
}

export async function listStockTransfers(companyId: string) {
  return db.select().from(stockTransfers).where(eq(stockTransfers.companyId, companyId)).orderBy(desc(stockTransfers.requestedAt));
}

export async function getStockTransfer(companyId: string, transferId: string) {
  const [transfer] = await db.select().from(stockTransfers).where(and(eq(stockTransfers.id, transferId), eq(stockTransfers.companyId, companyId))).limit(1);
  if (!transfer) throw new AccountingError('Transfer bulunamadı.');
  const lines = await db
    .select({ id: transferLines.id, stockItemId: transferLines.stockItemId, sku: stockItems.sku, name: stockItems.name, quantity: transferLines.quantity, receivedQuantity: transferLines.receivedQuantity })
    .from(transferLines)
    .innerJoin(stockItems, eq(stockItems.id, transferLines.stockItemId))
    .where(eq(transferLines.transferId, transferId));
  return { transfer, lines };
}

export const TRANSFER_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['REQUESTED', 'CANCELLED'],
  REQUESTED: ['APPROVED', 'CANCELLED'],
  APPROVED: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['RECEIVED'],
  RECEIVED: [],
  CANCELLED: []
};

// RECEIVED'e geçiş, transferin GERÇEK stok karşılığını üretir: kaynaktan
// OUT + hedefe IN (madde 54). Her satır için recordStockMovementInTx
// kullanılıyor — TÜM satırlar + durum güncellemesi TEK transaction'da,
// yarım kalan bir transferin (bazı satırlar taşınmış bazıları değil)
// oluşmasını engelliyor (Faz 8/9'daki iç-içe-transaction dersiyle AYNI).
export async function transitionStockTransfer(companyId: string, transferId: string, toStatus: string, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [transfer] = await tx.select().from(stockTransfers).where(and(eq(stockTransfers.id, transferId), eq(stockTransfers.companyId, companyId))).limit(1);
    if (!transfer) throw new AccountingError('Transfer bulunamadı.');
    const allowed = TRANSFER_TRANSITIONS[transfer.status] ?? [];
    if (!allowed.includes(toStatus)) throw new AccountingError(`${transfer.status} durumundan ${toStatus} durumuna geçilemez.`);

    if (toStatus === 'RECEIVED') {
      const lines = await tx.select().from(transferLines).where(eq(transferLines.transferId, transferId));
      const today = new Date().toISOString().slice(0, 10);
      for (const line of lines) {
        const [item] = await tx.select().from(stockItems).where(eq(stockItems.id, line.stockItemId)).limit(1);
        if (!item) continue;
        await recordStockMovementInTx(tx, {
          companyId,
          warehouseId: transfer.sourceWarehouseId,
          stockItemId: line.stockItemId,
          movementType: 'OUT',
          quantity: line.quantity,
          description: `Transfer çıkışı — ${transfer.transferNo}`,
          transactionDate: today,
          sourceType: 'STOCK_TRANSFER',
          sourceId: transferId,
          createdByUserId: userId
        });
        await recordStockMovementInTx(tx, {
          companyId,
          warehouseId: transfer.destinationWarehouseId,
          stockItemId: line.stockItemId,
          movementType: 'IN',
          quantity: line.quantity,
          unitCost: item.avgCost,
          description: `Transfer girişi — ${transfer.transferNo}`,
          transactionDate: today,
          sourceType: 'STOCK_TRANSFER',
          sourceId: transferId,
          createdByUserId: userId
        });
      }
    }

    const now = new Date();
    const patch: Partial<typeof stockTransfers.$inferInsert> = { status: toStatus as (typeof stockTransfers.$inferInsert)['status'] };
    if (toStatus === 'APPROVED') { patch.approvedByUserId = userId; patch.approvedAt = now; }
    if (toStatus === 'IN_TRANSIT') { patch.shippedAt = now; }
    if (toStatus === 'RECEIVED') { patch.receivedByUserId = userId; patch.receivedAt = now; }
    await tx.update(stockTransfers).set(patch).where(eq(stockTransfers.id, transferId));
  });
}

// --- Stok Rezervasyonu (madde 57-59). Satış siparişi (Faz 2C) henüz yok —
// bu, idempotency_keys'in Faz 17 mobil'den ÖNCE şemada hazır beklemesiyle
// AYNI desen: altyapı önce kurulur, gerçek çağıran (Sales Order) Faz 2C'de
// gelir. AVAILABLE = ON_HAND − RESERVED HER ZAMAN hesaplanır, saklanmaz. ---

export interface ReserveStockInput {
  warehouseId: string;
  stockItemId: string;
  quantity: number | string;
  sourceType?: string;
  sourceId?: string;
  createdByUserId: string;
}

export async function reserveStock(companyId: string, input: ReserveStockInput): Promise<string> {
  const [balance] = await db.select({ qty: invBalances.qty }).from(invBalances).where(and(eq(invBalances.warehouseId, input.warehouseId), eq(invBalances.stockItemId, input.stockItemId))).limit(1);
  const onHand = balance ? money(balance.qty) : money(0);

  const reservedRows = await db
    .select({ quantity: invReservations.quantity })
    .from(invReservations)
    .where(and(eq(invReservations.warehouseId, input.warehouseId), eq(invReservations.stockItemId, input.stockItemId), eq(invReservations.status, 'ACTIVE')));
  const alreadyReserved = reservedRows.reduce((acc, r) => acc.plus(money(r.quantity)), money(0));
  const available = onHand.minus(alreadyReserved);

  const qty = money(input.quantity);
  if (qty.lessThanOrEqualTo(0)) throw new AccountingError('Miktar sıfırdan büyük olmalı.');
  if (qty.greaterThan(available)) throw new AccountingError(`Yetersiz kullanılabilir stok — mevcut: ${available.toFixed(2)}, istenen: ${qty.toFixed(2)}.`);

  const id = newId();
  await db.insert(invReservations).values({
    id,
    companyId,
    warehouseId: input.warehouseId,
    stockItemId: input.stockItemId,
    quantity: toDb(qty),
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    createdByUserId: input.createdByUserId
  });
  return id;
}

export async function releaseReservation(companyId: string, reservationId: string): Promise<void> {
  const [row] = await db.select().from(invReservations).where(and(eq(invReservations.id, reservationId), eq(invReservations.companyId, companyId))).limit(1);
  if (!row) throw new AccountingError('Rezervasyon bulunamadı.');
  if (row.status !== 'ACTIVE') throw new AccountingError('Yalnızca aktif bir rezervasyon serbest bırakılabilir.');
  await db.update(invReservations).set({ status: 'RELEASED', releasedAt: new Date() }).where(eq(invReservations.id, reservationId));
}

export async function listReservations(companyId: string, warehouseId?: string) {
  const conditions = warehouseId ? and(eq(invReservations.companyId, companyId), eq(invReservations.warehouseId, warehouseId)) : eq(invReservations.companyId, companyId);
  return db.select().from(invReservations).where(conditions).orderBy(desc(invReservations.createdAt));
}
