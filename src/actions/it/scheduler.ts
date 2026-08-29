'use server';

import { revalidatePath } from 'next/cache';
import { requireDepartmentAccess } from '@/lib/dal';
import { runSchedulerTasksOnce } from '@/lib/scheduler';

export type FormState = { error?: string; success?: string } | undefined;

// Gerçek periyodik döngüyle (lib/scheduler.ts:startScheduler) AYNI
// fonksiyonu çağırır — "elle tetikle" ile "otomatik" arasında davranış
// farkı yok, yalnızca ne zaman çalıştığı farklı.
export async function triggerSchedulerAction(departmentId: string, _prevState: FormState): Promise<FormState> {
  await requireDepartmentAccess(departmentId, 'configure');
  const result = await runSchedulerTasksOnce();
  revalidatePath(`/dashboard/departments/${departmentId}/it/tickets`);
  if (!result) return { success: 'Zaten çalışıyordu, bu istek atlandı.' };
  if (result.errors.length > 0) return { error: `${result.companiesProcessed} şirket işlendi, ${result.errors.length} hata: ${result.errors.join('; ')}` };
  return { success: `${result.companiesProcessed} şirket işlendi — ${result.maintenanceGenerated} bakım işi üretildi, ${result.escalated} ticket eskalasyona uğradı.` };
}
