'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import {
  createWarehouse, createStockItem, recordStockMovement,
  createWhLocation, createStockTransfer, transitionStockTransfer,
  reserveStock, releaseReservation
} from '@/lib/warehouse';
import { AccountingError } from '@/lib/accounting';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const WarehouseSchema = z.object({ name: z.string().trim().min(1, 'Ad gerekli.') });

export async function createWarehouseAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = WarehouseSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };
  await createWarehouse(session.companyId, parsed.data.name);
  revalidatePath(`/dashboard/departments/${departmentId}/warehouses`);
  return { success: 'Depo oluşturuldu.' };
}

const StockItemSchema = z.object({
  sku: z.string().trim().min(1, 'SKU gerekli.'),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  unit: z.string().trim().optional(),
  accountingAccountId: z.string().trim().optional(),
  productId: z.string().trim().optional()
});

export async function createStockItemAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = StockItemSchema.safeParse({
    sku: formData.get('sku'),
    name: formData.get('name'),
    unit: optionalField(formData, 'unit'),
    accountingAccountId: optionalField(formData, 'accountingAccountId'),
    productId: optionalField(formData, 'productId')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };
  try {
    await createStockItem(session.companyId, parsed.data);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Stok kartı oluşturulamadı — bu SKU zaten kayıtlı olabilir.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/stock-items`);
  return { success: 'Stok kartı oluşturuldu.' };
}

const MovementSchema = z.object({
  warehouseId: z.string().trim().min(1, 'Depo seçilmeli.'),
  stockItemId: z.string().trim().min(1, 'Stok kartı seçilmeli.'),
  movementType: z.enum(['IN', 'OUT']),
  quantity: z.coerce.number().positive('Miktar sıfırdan büyük olmalı.'),
  unitCost: z.string().trim().optional(),
  counterAccountCode: z.string().trim().optional(),
  description: z.string().trim().optional(),
  transactionDate: z.string().trim().min(1, 'Tarih gerekli.')
});

export async function recordStockMovementAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'post');
  const parsed = MovementSchema.safeParse({
    warehouseId: formData.get('warehouseId'),
    stockItemId: formData.get('stockItemId'),
    movementType: formData.get('movementType'),
    quantity: formData.get('quantity'),
    unitCost: optionalField(formData, 'unitCost'),
    counterAccountCode: optionalField(formData, 'counterAccountCode'),
    description: optionalField(formData, 'description'),
    transactionDate: formData.get('transactionDate')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await recordStockMovement({
      companyId: session.companyId,
      warehouseId: parsed.data.warehouseId,
      stockItemId: parsed.data.stockItemId,
      movementType: parsed.data.movementType,
      quantity: parsed.data.quantity,
      unitCost: parsed.data.unitCost,
      counterAccountCode: parsed.data.counterAccountCode,
      description: parsed.data.description,
      transactionDate: parsed.data.transactionDate,
      createdByUserId: session.id
    });
  } catch (err) {
    return { error: err instanceof AccountingError ? err.message : 'Stok hareketi kaydedilemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/stock-items`);
  return { success: 'Stok hareketi kaydedildi.' };
}

// --- Faz 2A (ERP Genişletme) ---

const WhLocationSchema = z.object({
  warehouseId: z.string().trim().min(1),
  parentLocationId: z.string().trim().optional(),
  locationType: z.enum(['ZONE', 'AISLE', 'RACK', 'SHELF', 'BIN']),
  code: z.string().trim().min(1, 'Kod gerekli.'),
  name: z.string().trim().optional()
});

export async function createWhLocationAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = WhLocationSchema.safeParse({
    warehouseId: formData.get('warehouseId'),
    parentLocationId: optionalField(formData, 'parentLocationId'),
    locationType: formData.get('locationType'),
    code: formData.get('code'),
    name: optionalField(formData, 'name')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createWhLocation(session.companyId, parsed.data);
  } catch (err) {
    return { error: err instanceof AccountingError ? err.message : 'Konum oluşturulamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/warehouses/${parsed.data.warehouseId}`);
  return { success: 'Konum oluşturuldu.' };
}

const TransferLineSchema = z.object({ stockItemId: z.string().trim().min(1), quantity: z.string().trim().min(1) });
const CreateTransferSchema = z.object({
  sourceWarehouseId: z.string().trim().min(1, 'Kaynak depo seçilmeli.'),
  destinationWarehouseId: z.string().trim().min(1, 'Hedef depo seçilmeli.'),
  notes: z.string().trim().optional(),
  lines: z.array(TransferLineSchema).min(1, 'En az bir satır gerekli.')
});

// Form'dan gelen "lines" JSON string olarak taşınıyor (birden fazla satırlı
// dinamik bir form — client tarafında bir satır listesi biriktirilip TEK bir
// gizli input'a JSON.stringify edilerek gönderiliyor).
export async function createStockTransferAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get('linesJson') || '[]'));
  } catch {
    return { error: 'Geçersiz satır verisi.' };
  }
  const parsed = CreateTransferSchema.safeParse({
    sourceWarehouseId: formData.get('sourceWarehouseId'),
    destinationWarehouseId: formData.get('destinationWarehouseId'),
    notes: optionalField(formData, 'notes'),
    lines: linesRaw
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createStockTransfer(session.companyId, { ...parsed.data, requestedByUserId: session.id });
  } catch (err) {
    return { error: err instanceof AccountingError ? err.message : 'Transfer oluşturulamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/transfers`);
  return { success: 'Transfer oluşturuldu.' };
}

const TransitionTransferSchema = z.object({ transferId: z.string().trim().min(1), toStatus: z.string().trim().min(1) });

export async function transitionStockTransferAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = TransitionTransferSchema.safeParse({ transferId: formData.get('transferId'), toStatus: formData.get('toStatus') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await transitionStockTransfer(session.companyId, parsed.data.transferId, parsed.data.toStatus, session.id);
  } catch (err) {
    return { error: err instanceof AccountingError ? err.message : 'Transfer durumu güncellenemedi.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/transfers`);
  return { success: 'Transfer durumu güncellendi.' };
}

const ReserveSchema = z.object({ warehouseId: z.string().trim().min(1), stockItemId: z.string().trim().min(1), quantity: z.string().trim().min(1) });

export async function reserveStockAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = ReserveSchema.safeParse({ warehouseId: formData.get('warehouseId'), stockItemId: formData.get('stockItemId'), quantity: formData.get('quantity') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await reserveStock(session.companyId, { ...parsed.data, createdByUserId: session.id });
  } catch (err) {
    return { error: err instanceof AccountingError ? err.message : 'Rezervasyon oluşturulamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/reservations`);
  return { success: 'Rezervasyon oluşturuldu.' };
}

const ReleaseReservationSchema = z.object({ reservationId: z.string().trim().min(1) });

export async function releaseReservationAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');
  const parsed = ReleaseReservationSchema.safeParse({ reservationId: formData.get('reservationId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await releaseReservation(session.companyId, parsed.data.reservationId);
  } catch (err) {
    return { error: err instanceof AccountingError ? err.message : 'Rezervasyon serbest bırakılamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/reservations`);
  return { success: 'Rezervasyon serbest bırakıldı.' };
}
