'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createBom } from '@/lib/production/bom';
import { ProductionError } from '@/lib/production/errors';

export type FormState = { error?: string; success?: string } | undefined;

const BomLineSchema = z.object({
  componentProductId: z.string().trim().min(1),
  quantity: z.number().positive(),
  unitId: z.string().trim().min(1),
  scrapPercent: z.number().min(0).max(100).optional(),
  alternativeComponentProductId: z.string().trim().optional()
});

const CreateBomSchema = z.object({
  productId: z.string().trim().min(1, 'Ürün gerekli.'),
  code: z.string().trim().min(1, 'Kod gerekli.'),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  baseQuantity: z.string().trim().optional(),
  unitId: z.string().trim().min(1, 'Birim gerekli.'),
  effectiveFrom: z.string().trim().optional(),
  effectiveTo: z.string().trim().optional(),
  lines: z.array(BomLineSchema).min(1, 'En az bir bileşen gerekli.')
});

export async function createBomAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  let linesRaw: unknown;
  try {
    linesRaw = JSON.parse(String(formData.get('linesJson') || '[]'));
  } catch {
    return { error: 'Geçersiz kalem verisi.' };
  }
  const parsed = CreateBomSchema.safeParse({
    productId: formData.get('productId'), code: formData.get('code'), name: formData.get('name'), baseQuantity: formData.get('baseQuantity') || undefined,
    unitId: formData.get('unitId'), effectiveFrom: formData.get('effectiveFrom') || undefined, effectiveTo: formData.get('effectiveTo') || undefined, lines: linesRaw
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createBom(session.companyId, session.id, {
      productId: parsed.data.productId, code: parsed.data.code, name: parsed.data.name,
      baseQuantity: parsed.data.baseQuantity ? Number(parsed.data.baseQuantity) : undefined,
      unitId: parsed.data.unitId, effectiveFrom: parsed.data.effectiveFrom, effectiveTo: parsed.data.effectiveTo, lines: parsed.data.lines
    });
  } catch (err) {
    return { error: err instanceof ProductionError ? err.message : 'BOM oluşturulamadı.' };
  }
  revalidatePath('/dashboard/production/bom');
  return { success: 'BOM oluşturuldu.' };
}
