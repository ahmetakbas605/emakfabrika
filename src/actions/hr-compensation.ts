'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createCompensation } from '@/lib/hr/compensation';
import { HrError } from '@/lib/hr/errors';

export type FormState = { error?: string; success?: string } | undefined;

const CreateCompensationSchema = z.object({
  effectiveDate: z.string().trim().min(1, 'Yürürlük tarihi gerekli.'),
  baseSalary: z.string().trim().min(1, 'Maaş gerekli.'),
  currencyCode: z.string().trim().min(1, 'Para birimi gerekli.'),
  changeReason: z.string().trim().optional()
});

// Terfi/Transfer/Maaş Değişikliği'nin kendi onay akışı henüz yok (Faz 0'ın
// organizasyon değişikliği kararıyla AYNI) — bu yüzden yalnızca İK
// (requireDepartmentAccess 'update') doğrudan düzenleyebilir, çalışan
// kendi maaşını göremez/değiştiremez (§142'nin alan-seviyesi izin
// ihtiyacı henüz yok — İK dışı hiçbir rol bu action'a erişemiyor zaten).
export async function createCompensationAction(departmentId: string, employeeId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');

  const parsed = CreateCompensationSchema.safeParse({
    effectiveDate: formData.get('effectiveDate'), baseSalary: formData.get('baseSalary'), currencyCode: formData.get('currencyCode'), changeReason: formData.get('changeReason') || undefined
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createCompensation(session.companyId, employeeId, session.id, { ...parsed.data, baseSalary: Number(parsed.data.baseSalary) });
  } catch (err) {
    return { error: err instanceof HrError ? err.message : 'Maaş kaydı oluşturulamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/employees/${employeeId}`);
  return { success: 'Yeni maaş kaydı oluşturuldu.' };
}
