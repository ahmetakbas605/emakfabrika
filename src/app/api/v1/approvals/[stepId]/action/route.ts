import { NextResponse } from 'next/server';
import * as z from 'zod';
import { requireMobileUser } from '@/lib/mobile-auth';
import { actOnStep, getStepDocumentType, type ApprovalDecision } from '@/lib/workflow/engine';
import { actOnRequisitionStep } from '@/lib/procurement/requisition';
import { actOnAwardStep } from '@/lib/procurement/award';
import { actOnLeaveStep } from '@/lib/hr/leave';
import { actOnOvertimeStep } from '@/lib/hr/overtime';
import { actOnBonusStep } from '@/lib/hr/bonus';
import { actOnDsrStep } from '@/lib/security/dsr';
import { CoreError } from '@/lib/core/errors';
import { ProcurementError } from '@/lib/procurement/errors';
import { HrError } from '@/lib/hr/errors';
import { SecurityError } from '@/lib/security/errors';

const BodySchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'DELEGATE']),
  comment: z.string().trim().optional(),
  delegateToUserId: z.string().trim().optional()
});

// actions/workflow.ts:actOnStepAction İLE BİREBİR AYNI dispatch — genel
// motor (documentType'ı TANIMAZ) mı, yoksa procurement'ın kendi yan
// etkili (bütçe/rezervasyon serbest bırakma) sarmalayıcısı mı çağrılacak,
// buradan da AYNI şekilde karar veriliyor. Web/mobil davranış farkı
// OLMASIN diye kopyalanmadı, sadece dispatch AYNI mantıkla tekrarlandı
// (actions/workflow.ts bir Server Action, doğrudan mobil route'tan
// import edilemiyor — Next.js'in "use server" sınırı).
export async function POST(request: Request, { params }: { params: Promise<{ stepId: string }> }) {
  const { stepId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi.' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Geçersiz form.' }, { status: 400 });

  const auth = await requireMobileUser(request);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const actionInput = {
    stepId, actingUserId: auth.user.id, decision: parsed.data.decision as ApprovalDecision,
    comment: parsed.data.comment, delegateToUserId: parsed.data.delegateToUserId
  };

  try {
    const documentType = await getStepDocumentType(stepId);
    if (documentType === 'PROCUREMENT_REQUISITION') {
      await actOnRequisitionStep(auth.user.companyId, actionInput);
    } else if (documentType === 'PROCUREMENT_AWARD') {
      await actOnAwardStep(auth.user.companyId, actionInput);
    } else if (documentType === 'LEAVE') {
      await actOnLeaveStep(auth.user.companyId, actionInput);
    } else if (documentType === 'OVERTIME') {
      await actOnOvertimeStep(auth.user.companyId, actionInput);
    } else if (documentType === 'BONUS') {
      await actOnBonusStep(auth.user.companyId, actionInput);
    } else if (documentType === 'DATA_SUBJECT_REQUEST') {
      await actOnDsrStep(auth.user.companyId, actionInput);
    } else {
      await actOnStep(auth.user.companyId, actionInput);
    }
  } catch (e) {
    if (e instanceof CoreError || e instanceof ProcurementError || e instanceof HrError || e instanceof SecurityError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  return NextResponse.json({ ok: true });
}
