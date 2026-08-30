'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireFactoryAdmin } from '@/lib/dal';
import { createDepartment } from '@/lib/departments';
import { CoreError } from '@/lib/core/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const CreateDepartmentSchema = z.object({
  departmentTypeCode: z.string().trim().min(1, 'Departman türü gerekli.'),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  parentDepartmentId: z.string().trim().optional()
});

// Yalnızca fabrika yöneticisi — yeni bir departman oluşturmak, kim hangi
// departmana erişebileceğini belirleyen üst düzey bir organizasyon kararı
// (positions/workflow-rules İLE AYNI yetki seviyesi).
export async function createDepartmentAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  const parsed = CreateDepartmentSchema.safeParse({
    departmentTypeCode: formData.get('departmentTypeCode'),
    name: formData.get('name'),
    parentDepartmentId: optionalField(formData, 'parentDepartmentId')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createDepartment(session.companyId, parsed.data);
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Departman oluşturulamadı.' };
  }
  revalidatePath('/dashboard/org');
  revalidatePath('/dashboard');
  return { success: 'Departman oluşturuldu.' };
}
