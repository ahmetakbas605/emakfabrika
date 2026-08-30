'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireHoldingAdmin } from '@/lib/dal';
import { createHolding, moveCompanyToHolding } from '@/lib/holding';
import { CoreError } from '@/lib/core/errors';
import { writeAuditLog } from '@/lib/security/audit';

export type FormState = { error?: string; success?: string } | undefined;

const CreateHoldingSchema = z.object({ name: z.string().trim().min(1, 'Ad gerekli.') });

export async function createHoldingAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireHoldingAdmin();
  const parsed = CreateHoldingSchema.safeParse({ name: formData.get('name') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  let holdingId: string;
  try {
    holdingId = await createHolding(parsed.data);
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Holding oluşturulamadı.' };
  }
  await writeAuditLog({ companyId: session.companyId, userId: session.id, action: 'CREATE', entity: 'HOLDING', entityId: holdingId, module: 'CORE', riskLevel: 'HIGH', newValue: { name: parsed.data.name } });
  revalidatePath('/dashboard/holding');
  return { success: 'Holding oluşturuldu.' };
}

const MoveCompanySchema = z.object({ companyId: z.string().trim().min(1), targetHoldingId: z.string().trim().min(1) });

// KRİTİK işlem — bir şirketi başka bir holding'e taşımak, o şirketin TÜM
// verisinin hangi holding-admin'ler tarafından görülebileceğini değiştirir
// (dal.ts:requireDepartmentAccess'in holding-scope fallback'i). Yalnızca
// mevcut holding'in kendi admin'i tetikleyebilir — session.holdingId ile
// hedef şirketin BUGÜNKÜ holding'i eşleşmiyorsa reddedilir (kendi holding'i
// DIŞINDAKİ bir şirketi "çalamaz").
export async function moveCompanyToHoldingAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireHoldingAdmin();
  const parsed = MoveCompanySchema.safeParse({ companyId: formData.get('companyId'), targetHoldingId: formData.get('targetHoldingId') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await moveCompanyToHolding(parsed.data.companyId, parsed.data.targetHoldingId);
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Şirket taşınamadı.' };
  }
  await writeAuditLog({ companyId: session.companyId, userId: session.id, action: 'UPDATE', entity: 'COMPANY', entityId: parsed.data.companyId, module: 'CORE', riskLevel: 'CRITICAL', changedFields: { holdingId: parsed.data.targetHoldingId } });
  revalidatePath('/dashboard/holding');
  return { success: 'Şirket taşındı.' };
}
