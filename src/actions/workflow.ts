'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireFactoryAdmin, requireSession } from '@/lib/dal';
import { createWorkflowRule, actOnStep, getStepDocumentType, type ApprovalDecision } from '@/lib/workflow/engine';
import type { WorkflowChainStep } from '@/lib/workflow/types';
import { actOnRequisitionStep } from '@/lib/procurement/requisition';
import { actOnAwardStep } from '@/lib/procurement/award';
import { CoreError } from '@/lib/core/errors';
import { ProcurementError } from '@/lib/procurement/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

const ChainStepSchema = z.object({
  approverType: z.enum(['POSITION', 'SPECIFIC_USER', 'MANAGER_CHAIN']),
  approverValue: z.string().trim().min(1),
  mode: z.enum(['SEQUENTIAL', 'PARALLEL']),
  quorum: z.number().int().positive().optional()
});

const WorkflowRuleSchema = z.object({
  documentType: z.string().trim().min(1, 'Belge türü gerekli.'),
  name: z.string().trim().min(1, 'Ad gerekli.'),
  minAmount: z.string().trim().optional(),
  maxAmount: z.string().trim().optional(),
  categoryCode: z.string().trim().optional(),
  capexOpex: z.enum(['CAPEX', 'OPEX']).optional(),
  priority: z.string().trim().optional(),
  chain: z.array(ChainStepSchema).min(1, 'En az bir onay adımı gerekli.')
});

// TicketWorkLogForm/StockTransferForm İLE AYNI desen — dinamik satır
// listesi client'ta biriktirilir, tek bir gizli input'a JSON.stringify
// edilerek gönderilir.
export async function createWorkflowRuleAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireFactoryAdmin();
  let chainRaw: unknown;
  try {
    chainRaw = JSON.parse(String(formData.get('chainJson') || '[]'));
  } catch {
    return { error: 'Geçersiz onay zinciri verisi.' };
  }
  const parsed = WorkflowRuleSchema.safeParse({
    documentType: formData.get('documentType'),
    name: formData.get('name'),
    minAmount: optionalField(formData, 'minAmount'),
    maxAmount: optionalField(formData, 'maxAmount'),
    categoryCode: optionalField(formData, 'categoryCode'),
    capexOpex: optionalField(formData, 'capexOpex'),
    priority: optionalField(formData, 'priority'),
    chain: chainRaw
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createWorkflowRule(session.companyId, {
      documentType: parsed.data.documentType,
      name: parsed.data.name,
      conditions: {
        minAmount: parsed.data.minAmount ? Number(parsed.data.minAmount) : undefined,
        maxAmount: parsed.data.maxAmount ? Number(parsed.data.maxAmount) : undefined,
        categoryCode: parsed.data.categoryCode || undefined,
        capexOpex: parsed.data.capexOpex
      },
      approvalChain: parsed.data.chain as WorkflowChainStep[],
      priority: parsed.data.priority ? Number(parsed.data.priority) : undefined
    });
  } catch (err) {
    return { error: err instanceof CoreError ? err.message : 'Kural oluşturulamadı.' };
  }
  revalidatePath('/dashboard/workflow/rules');
  return { success: 'Onay kuralı oluşturuldu.' };
}

const ActOnStepSchema = z.object({
  stepId: z.string().trim().min(1),
  decision: z.enum(['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'DELEGATE']),
  comment: z.string().trim().optional(),
  delegateToUserId: z.string().trim().optional()
});

export async function actOnStepAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = ActOnStepSchema.safeParse({
    stepId: formData.get('stepId'),
    decision: formData.get('decision'),
    comment: optionalField(formData, 'comment'),
    delegateToUserId: optionalField(formData, 'delegateToUserId')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  const actionInput = {
    stepId: parsed.data.stepId,
    actingUserId: session.id,
    decision: parsed.data.decision as ApprovalDecision,
    comment: parsed.data.comment,
    delegateToUserId: parsed.data.delegateToUserId
  };

  try {
    const documentType = await getStepDocumentType(parsed.data.stepId);
    if (documentType === 'PROCUREMENT_REQUISITION') {
      await actOnRequisitionStep(session.companyId, actionInput);
    } else if (documentType === 'PROCUREMENT_AWARD') {
      await actOnAwardStep(session.companyId, actionInput);
    } else {
      await actOnStep(session.companyId, actionInput);
    }
  } catch (err) {
    return { error: err instanceof CoreError || err instanceof ProcurementError ? err.message : 'İşlem gerçekleştirilemedi.' };
  }
  revalidatePath('/dashboard/approvals');
  revalidatePath('/dashboard/procurement');
  return { success: 'Karar kaydedildi.' };
}
