'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession, requireDepartmentAccess } from '@/lib/dal';
import { createLeaveRequest, submitLeaveRequest, cancelLeaveRequest, setLeaveEntitlement } from '@/lib/hr/leave';
import { HrError } from '@/lib/hr/errors';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof HrError ? err.message : fallback;
}

const CreateLeaveSchema = z.object({
  leaveType: z.enum(['ANNUAL', 'SICK', 'UNPAID', 'ABSENCE', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'OTHER']),
  startDate: z.string().trim().min(1, 'Başlangıç tarihi gerekli.'),
  endDate: z.string().trim().min(1, 'Bitiş tarihi gerekli.'),
  reason: z.string().trim().optional()
});

// Kendi kendine hizmet: yalnızca oturumun BAĞLI OLDUĞU özlük kaydı için
// (session.employeeId) — İK Faz 0'ın users.employeeId köprüsü. Bağlı
// değilse (örn. dış danışman/salt-admin hesap) bu akış kullanılamaz.
// Award/PO İLE AYNI desen: önce taslak oluşturulur, AYRI bir adımda
// gönderilir — ikisini TEK adımda birleştirmek, gönderim başarısız olursa
// (örn. eşleşen workflow kuralı yok) kullanıcının yeniden deneyemeyeceği
// sahipsiz bir taslak bırakırdı.
export async function createLeaveRequestAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  if (!session.employeeId) return { error: 'ERP hesabınız bir özlük kaydına bağlı değil — İK ile iletişime geçin.' };

  const parsed = CreateLeaveSchema.safeParse({
    leaveType: formData.get('leaveType'), startDate: formData.get('startDate'), endDate: formData.get('endDate'), reason: formData.get('reason') || undefined
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createLeaveRequest(session.companyId, session.employeeId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'İzin talebi oluşturulamadı.') };
  }
  revalidatePath('/dashboard/hr/leave');
  return { success: 'İzin talebi taslak olarak kaydedildi — göndermek için aşağıdaki listeden "Gönder"e tıklayın.' };
}

const SubmitLeaveSchema = z.object({ leaveRequestId: z.string().trim().min(1) });

export async function submitLeaveRequestAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = SubmitLeaveSchema.safeParse({ leaveRequestId: formData.get('leaveRequestId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await submitLeaveRequest(session.companyId, parsed.data.leaveRequestId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'Gönderilemedi.') };
  }
  revalidatePath('/dashboard/hr/leave');
  return { success: 'İzin talebi onaya gönderildi.' };
}

const CancelLeaveSchema = z.object({ leaveRequestId: z.string().trim().min(1) });

export async function cancelLeaveRequestAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CancelLeaveSchema.safeParse({ leaveRequestId: formData.get('leaveRequestId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await cancelLeaveRequest(session.companyId, parsed.data.leaveRequestId, session.id);
  } catch (err) {
    return { error: toErrorMessage(err, 'İptal edilemedi.') };
  }
  revalidatePath('/dashboard/hr/leave');
  return { success: 'İzin talebi iptal edildi.' };
}

const SetEntitlementSchema = z.object({
  employeeId: z.string().trim().min(1, 'Çalışan seçilmeli.'),
  year: z.string().trim().min(1, 'Yıl gerekli.'),
  leaveType: z.enum(['ANNUAL', 'SICK', 'UNPAID', 'ABSENCE', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'OTHER']),
  entitlementDays: z.string().trim().min(1, 'Hak ediş günü gerekli.')
});

export async function setLeaveEntitlementAction(departmentId: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const { session } = await requireDepartmentAccess(departmentId, 'update');

  const parsed = SetEntitlementSchema.safeParse({
    employeeId: formData.get('employeeId'), year: formData.get('year'), leaveType: formData.get('leaveType'), entitlementDays: formData.get('entitlementDays')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await setLeaveEntitlement(session.companyId, parsed.data.employeeId, Number(parsed.data.year), parsed.data.leaveType, Number(parsed.data.entitlementDays));
  } catch (err) {
    return { error: toErrorMessage(err, 'Hak ediş kaydedilemedi.') };
  }
  revalidatePath(`/dashboard/departments/${departmentId}/hr/leave`);
  return { success: 'Hak ediş kaydedildi.' };
}
