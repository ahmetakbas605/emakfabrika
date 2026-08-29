'use server';

import { requireDepartmentAccess } from '@/lib/dal';
import { getTicketAiAssistance } from '@/lib/it/ai-assistant';
import { ItError } from '@/lib/it/errors';

export type AiFormState =
  | { error: string; result?: undefined }
  | { error?: undefined; result: Awaited<ReturnType<typeof getTicketAiAssistance>> }
  | undefined;

export async function getTicketAiAssistanceAction(departmentId: string, ticketId: string, _prevState: AiFormState): Promise<AiFormState> {
  const { session } = await requireDepartmentAccess(departmentId);
  try {
    const result = await getTicketAiAssistance(session.companyId, ticketId);
    return { result };
  } catch (err) {
    return { error: err instanceof ItError ? err.message : 'AI asistanı çalıştırılamadı.' };
  }
}
