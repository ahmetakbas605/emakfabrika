import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { warehouses, stockItems, stockMovements, accountingAccounts } from '@/db/schema';
import { newId } from '@/lib/id';
import { money, toDb } from '@/lib/money';
import { postJournalInTx, AccountingError } from '@/lib/accounting';

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
}

export async function createStockItem(companyId: string, input: CreateStockItemInput): Promise<string> {
  const id = newId();
  await db.insert(stockItems).values({ id, companyId, sku: input.sku, name: input.name, unit: input.unit ?? 'ADET', accountingAccountId: input.accountingAccountId });
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
}

export interface StockMovementResult {
  movementId: string;
  journalId?: string;
}

export async function recordStockMovement(input: RecordStockMovementInput): Promise<StockMovementResult> {
  const qty = money(input.quantity);
  if (qty.lessThanOrEqualTo(0)) throw new AccountingError('Miktar sıfırdan büyük olmalı.');

  return db.transaction(async (tx) => {
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
      createdByUserId: input.createdByUserId
    });

    return { movementId, journalId };
  });
}

export async function listStockMovements(companyId: string, stockItemId?: string) {
  const conditions = stockItemId ? and(eq(stockMovements.companyId, companyId), eq(stockMovements.stockItemId, stockItemId)) : eq(stockMovements.companyId, companyId);
  return db.select().from(stockMovements).where(conditions).orderBy(desc(stockMovements.transactionDate));
}
