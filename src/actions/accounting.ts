'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireDepartmentAccess } from '@/lib/dal';
import { createAccount, postJournal, openPeriod, closePeriod, reopenPeriod, AccountingError, type JournalLineInput } from '@/lib/accounting';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const AccountSchema = z.object({
  code: z.string().trim().min(1, 'Hesap kodu gerekli.'),
  name: z.string().trim().min(1, 'Hesap adı gerekli.'),
  normalBalance: z.enum(['DEBIT', 'CREDIT']),
  accountType: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])
});

export async function createAccountAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = AccountSchema.safeParse({
    code: formData.get('code'),
    name: formData.get('name'),
    normalBalance: formData.get('normalBalance'),
    accountType: formData.get('accountType')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createAccount(session.companyId, parsed.data);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Hesap oluşturulamadı — bu kod zaten kayıtlı olabilir.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/accounts`);
  return { success: 'Hesap oluşturuldu.' };
}

// QuoteItemsEditor (emakerp) ile AYNI indeksli-satır form deseni — dinamik
// kalem sayısı, tek bir hidden "linesJson" alanına client tarafında
// serileştirilir.
const JournalFormSchema = z.object({
  journalDate: z.string().trim().min(1, 'Tarih gerekli.'),
  documentType: z.string().trim().min(1).default('MANUAL'),
  description: z.string().trim().optional(),
  linesJson: z.string().transform((raw, ctx) => {
    try {
      const parsed = JSON.parse(raw) as JournalLineInput[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'En az bir kalem gerekli.' });
        return z.NEVER;
      }
      return parsed;
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Kalemler okunamadı.' });
      return z.NEVER;
    }
  })
});

export async function postJournalAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'post');
  const parsed = JournalFormSchema.safeParse({
    journalDate: formData.get('journalDate'),
    documentType: formData.get('documentType') || 'MANUAL',
    description: optionalField(formData, 'description'),
    linesJson: formData.get('linesJson')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    const result = await postJournal({
      companyId: session.companyId,
      journalDate: parsed.data.journalDate,
      documentType: parsed.data.documentType,
      description: parsed.data.description,
      createdByUserId: session.id,
      lines: parsed.data.linesJson
    });
    revalidatePath(`/dashboard/departments/${departmentId}/journals`);
    return { success: `Fiş kaydedildi — ${result.journalNo}` };
  } catch (err) {
    return { error: err instanceof AccountingError ? err.message : 'Fiş kaydedilemedi.' };
  }
}

const PeriodSchema = z.object({
  periodStart: z.string().trim().min(1, 'Başlangıç tarihi gerekli.'),
  periodEnd: z.string().trim().min(1, 'Bitiş tarihi gerekli.')
});

export async function openPeriodAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'create');
  const parsed = PeriodSchema.safeParse({ periodStart: formData.get('periodStart'), periodEnd: formData.get('periodEnd') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };
  try {
    await openPeriod(session.companyId, parsed.data.periodStart, parsed.data.periodEnd);
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Dönem açılamadı.' };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/periods`);
  return { success: 'Dönem açıldı.' };
}

export async function closePeriodAction(departmentId: string, periodId: string): Promise<void> {
  const { session } = await requireDepartmentAccess(departmentId, 'close_period');
  await closePeriod(session.companyId, periodId, session.id);
  revalidatePath(`/dashboard/departments/${departmentId}/periods`);
}

export async function reopenPeriodAction(departmentId: string, periodId: string): Promise<void> {
  const { session } = await requireDepartmentAccess(departmentId, 'reopen_period');
  await reopenPeriod(session.companyId, periodId);
  revalidatePath(`/dashboard/departments/${departmentId}/periods`);
}
