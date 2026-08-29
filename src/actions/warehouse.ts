'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createWarehouse, createStockItem, recordStockMovement } from '@/lib/warehouse';
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
  accountingAccountId: z.string().trim().optional()
});

export async function createStockItemAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = StockItemSchema.safeParse({
    sku: formData.get('sku'),
    name: formData.get('name'),
    unit: optionalField(formData, 'unit'),
    accountingAccountId: optionalField(formData, 'accountingAccountId')
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
