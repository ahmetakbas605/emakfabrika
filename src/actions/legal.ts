'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createContract, updateContractStatus } from '@/lib/legal/contracts';
import { createLawsuit, updateLawsuitStatus } from '@/lib/legal/lawsuits';
import { createCollateral, releaseCollateral } from '@/lib/legal/collaterals';
import { createRisk, updateRiskAssessment, startRiskMitigation, closeRisk } from '@/lib/legal/risks';
import { uploadAttachment } from '@/lib/documents/attachments';
import { LegalError } from '@/lib/legal/errors';
import { CoreError } from '@/lib/core/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof LegalError || err instanceof CoreError ? err.message : fallback;
}

const CreateContractSchema = z.object({
  title: z.string().trim().min(1, 'Başlık gerekli.'),
  contractType: z.enum(['SUPPLIER', 'CUSTOMER', 'LEASE', 'NDA', 'SERVICE', 'OTHER']),
  counterpartyPartyId: z.string().trim().optional(),
  counterpartyName: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  value: z.string().trim().optional(),
  currencyCode: z.string().trim().optional(),
  ownerUserId: z.string().trim().optional()
});

export async function createContractAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateContractSchema.safeParse({
    title: formData.get('title'), contractType: formData.get('contractType'), counterpartyPartyId: optionalField(formData, 'counterpartyPartyId'),
    counterpartyName: optionalField(formData, 'counterpartyName'), startDate: optionalField(formData, 'startDate'), endDate: optionalField(formData, 'endDate'),
    value: optionalField(formData, 'value'), currencyCode: optionalField(formData, 'currencyCode'), ownerUserId: optionalField(formData, 'ownerUserId')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    const contractId = await createContract(session.companyId, session.id, { ...parsed.data, value: parsed.data.value ? Number(parsed.data.value) : undefined });

    const file = formData.get('file');
    if (file instanceof File && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      await uploadAttachment(session.companyId, {
        entityType: 'LEGAL_CONTRACT', entityId: contractId, fileName: file.name, mimeType: file.type || 'application/octet-stream',
        buffer, uploadedByUserId: session.id, documentCategory: 'SÖZLEŞME'
      });
    }
  } catch (err) {
    return { error: toErrorMessage(err, 'Sözleşme oluşturulamadı.') };
  }
  revalidatePath('/dashboard/legal');
  return { success: 'Sözleşme oluşturuldu.' };
}

const ContractStatusSchema = z.object({ contractId: z.string().trim().min(1), status: z.enum(['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED']) });

export async function updateContractStatusAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = ContractStatusSchema.safeParse({ contractId: formData.get('contractId'), status: formData.get('status') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await updateContractStatus(session.companyId, parsed.data.contractId, parsed.data.status);
  } catch (err) {
    return { error: toErrorMessage(err, 'Sözleşme durumu güncellenemedi.') };
  }
  revalidatePath('/dashboard/legal');
  return { success: 'Sözleşme durumu güncellendi.' };
}

const CreateLawsuitSchema = z.object({
  title: z.string().trim().min(1, 'Başlık gerekli.'),
  companyRole: z.enum(['PLAINTIFF', 'DEFENDANT']),
  counterpartyPartyId: z.string().trim().optional(),
  counterpartyName: z.string().trim().optional(),
  contractId: z.string().trim().optional(),
  claimAmount: z.string().trim().optional(),
  currencyCode: z.string().trim().optional(),
  courtName: z.string().trim().optional(),
  filedDate: z.string().trim().optional(),
  ownerUserId: z.string().trim().optional()
});

export async function createLawsuitAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateLawsuitSchema.safeParse({
    title: formData.get('title'), companyRole: formData.get('companyRole'), counterpartyPartyId: optionalField(formData, 'counterpartyPartyId'),
    counterpartyName: optionalField(formData, 'counterpartyName'), contractId: optionalField(formData, 'contractId'), claimAmount: optionalField(formData, 'claimAmount'),
    currencyCode: optionalField(formData, 'currencyCode'), courtName: optionalField(formData, 'courtName'), filedDate: optionalField(formData, 'filedDate'),
    ownerUserId: optionalField(formData, 'ownerUserId')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    const lawsuitId = await createLawsuit(session.companyId, session.id, { ...parsed.data, claimAmount: parsed.data.claimAmount ? Number(parsed.data.claimAmount) : undefined });

    const file = formData.get('file');
    if (file instanceof File && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      await uploadAttachment(session.companyId, {
        entityType: 'LEGAL_LAWSUIT', entityId: lawsuitId, fileName: file.name, mimeType: file.type || 'application/octet-stream',
        buffer, uploadedByUserId: session.id, documentCategory: 'DAVA'
      });
    }
  } catch (err) {
    return { error: toErrorMessage(err, 'Dava kaydı oluşturulamadı.') };
  }
  revalidatePath('/dashboard/legal');
  return { success: 'Dava kaydı oluşturuldu.' };
}

const LawsuitStatusSchema = z.object({ lawsuitId: z.string().trim().min(1), status: z.enum(['OPEN', 'IN_PROGRESS', 'SETTLED', 'WON', 'LOST', 'CLOSED']) });

export async function updateLawsuitStatusAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = LawsuitStatusSchema.safeParse({ lawsuitId: formData.get('lawsuitId'), status: formData.get('status') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await updateLawsuitStatus(session.companyId, parsed.data.lawsuitId, parsed.data.status);
  } catch (err) {
    return { error: toErrorMessage(err, 'Dava durumu güncellenemedi.') };
  }
  revalidatePath('/dashboard/legal');
  return { success: 'Dava durumu güncellendi.' };
}

const CreateCollateralSchema = z.object({
  contractId: z.string().trim().optional(),
  collateralType: z.enum(['LETTER_OF_GUARANTEE', 'CASH_DEPOSIT', 'CHECK', 'PROMISSORY_NOTE', 'OTHER']),
  amount: z.coerce.number().positive('Tutar pozitif olmalı.'),
  currencyCode: z.string().trim().optional(),
  provider: z.string().trim().optional(),
  issueDate: z.string().trim().optional(),
  expiryDate: z.string().trim().optional()
});

export async function createCollateralAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateCollateralSchema.safeParse({
    contractId: optionalField(formData, 'contractId'), collateralType: formData.get('collateralType'), amount: formData.get('amount'),
    currencyCode: optionalField(formData, 'currencyCode'), provider: optionalField(formData, 'provider'), issueDate: optionalField(formData, 'issueDate'),
    expiryDate: optionalField(formData, 'expiryDate')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createCollateral(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Teminat kaydedilemedi.') };
  }
  revalidatePath('/dashboard/legal');
  return { success: 'Teminat kaydedildi.' };
}

const CollateralIdSchema = z.object({ collateralId: z.string().trim().min(1) });

export async function releaseCollateralAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CollateralIdSchema.safeParse({ collateralId: formData.get('collateralId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await releaseCollateral(session.companyId, parsed.data.collateralId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Teminat serbest bırakılamadı.') };
  }
  revalidatePath('/dashboard/legal');
  return { success: 'Teminat serbest bırakıldı.' };
}

const CreateRiskSchema = z.object({
  title: z.string().trim().min(1, 'Başlık gerekli.'),
  category: z.enum(['LEGAL', 'FINANCIAL', 'OPERATIONAL', 'STRATEGIC', 'COMPLIANCE', 'OTHER']),
  description: z.string().trim().optional(),
  probability: z.coerce.number().int().min(1).max(5),
  impact: z.coerce.number().int().min(1).max(5),
  ownerUserId: z.string().trim().optional(),
  mitigation: z.string().trim().optional()
});

export async function createRiskAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateRiskSchema.safeParse({
    title: formData.get('title'), category: formData.get('category'), description: optionalField(formData, 'description'),
    probability: formData.get('probability'), impact: formData.get('impact'), ownerUserId: optionalField(formData, 'ownerUserId'), mitigation: optionalField(formData, 'mitigation')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createRisk(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Risk kaydı oluşturulamadı.') };
  }
  revalidatePath('/dashboard/legal/risks');
  return { success: 'Risk kaydı oluşturuldu.' };
}

const UpdateRiskAssessmentSchema = z.object({
  riskId: z.string().trim().min(1), probability: z.coerce.number().int().min(1).max(5), impact: z.coerce.number().int().min(1).max(5), mitigation: z.string().trim().optional()
});

export async function updateRiskAssessmentAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = UpdateRiskAssessmentSchema.safeParse({
    riskId: formData.get('riskId'), probability: formData.get('probability'), impact: formData.get('impact'), mitigation: optionalField(formData, 'mitigation')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await updateRiskAssessment(session.companyId, parsed.data.riskId, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Risk değerlendirmesi güncellenemedi.') };
  }
  revalidatePath('/dashboard/legal/risks');
  return { success: 'Risk değerlendirmesi güncellendi.' };
}

const RiskIdSchema = z.object({ riskId: z.string().trim().min(1) });

export async function startRiskMitigationAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = RiskIdSchema.safeParse({ riskId: formData.get('riskId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await startRiskMitigation(session.companyId, parsed.data.riskId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Azaltma süreci başlatılamadı.') };
  }
  revalidatePath('/dashboard/legal/risks');
  return { success: 'Azaltma süreci başlatıldı.' };
}

export async function closeRiskAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = RiskIdSchema.safeParse({ riskId: formData.get('riskId') });
  if (!parsed.success) return { error: 'Geçersiz form.' };

  try {
    await closeRisk(session.companyId, parsed.data.riskId);
  } catch (err) {
    return { error: toErrorMessage(err, 'Risk kaydı kapatılamadı.') };
  }
  revalidatePath('/dashboard/legal/risks');
  return { success: 'Risk kaydı kapatıldı.' };
}
