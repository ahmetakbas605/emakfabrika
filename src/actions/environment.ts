'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod';
import { requireSession } from '@/lib/dal';
import { createEnvPermit } from '@/lib/environment/permits';
import { recordEmission, recordWaste } from '@/lib/environment/records';
import { EnvironmentError } from '@/lib/environment/errors';
import { optionalField } from '@/lib/form';

export type FormState = { error?: string; success?: string } | undefined;

function toErrorMessage(err: unknown, fallback: string): string {
  return err instanceof EnvironmentError ? err.message : fallback;
}

const CreateEnvPermitSchema = z.object({
  permitType: z.enum(['EMISSION', 'WASTE', 'WATER', 'AIR', 'OTHER']),
  issuingAuthority: z.string().trim().optional(),
  issueDate: z.string().trim().optional(),
  expiryDate: z.string().trim().optional()
});

export async function createEnvPermitAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = CreateEnvPermitSchema.safeParse({
    permitType: formData.get('permitType'), issuingAuthority: optionalField(formData, 'issuingAuthority'),
    issueDate: optionalField(formData, 'issueDate'), expiryDate: optionalField(formData, 'expiryDate')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await createEnvPermit(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Çevre izni oluşturulamadı.') };
  }
  revalidatePath('/dashboard/environment');
  return { success: 'Çevre izni oluşturuldu.' };
}

const RecordEmissionSchema = z.object({
  recordDate: z.string().trim().min(1, 'Tarih gerekli.'),
  emissionType: z.enum(['CO2', 'NOX', 'SOX', 'PARTICULATE', 'OTHER']),
  quantity: z.coerce.number().positive('Miktar pozitif olmalı.'),
  unit: z.string().trim().min(1, 'Birim gerekli.'),
  source: z.string().trim().optional()
});

export async function recordEmissionAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = RecordEmissionSchema.safeParse({
    recordDate: formData.get('recordDate'), emissionType: formData.get('emissionType'), quantity: formData.get('quantity'),
    unit: formData.get('unit'), source: optionalField(formData, 'source')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await recordEmission(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Emisyon kaydedilemedi.') };
  }
  revalidatePath('/dashboard/environment');
  return { success: 'Emisyon kaydedildi.' };
}

const RecordWasteSchema = z.object({
  recordDate: z.string().trim().min(1, 'Tarih gerekli.'),
  wasteType: z.enum(['HAZARDOUS', 'NON_HAZARDOUS', 'RECYCLABLE']),
  quantity: z.coerce.number().positive('Miktar pozitif olmalı.'),
  unit: z.string().trim().min(1, 'Birim gerekli.'),
  disposalMethod: z.enum(['LANDFILL', 'INCINERATION', 'RECYCLING', 'OTHER']),
  disposalCompany: z.string().trim().optional()
});

export async function recordWasteAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const session = await requireSession();
  const parsed = RecordWasteSchema.safeParse({
    recordDate: formData.get('recordDate'), wasteType: formData.get('wasteType'), quantity: formData.get('quantity'),
    unit: formData.get('unit'), disposalMethod: formData.get('disposalMethod'), disposalCompany: optionalField(formData, 'disposalCompany')
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || 'Geçersiz form.' };

  try {
    await recordWaste(session.companyId, session.id, parsed.data);
  } catch (err) {
    return { error: toErrorMessage(err, 'Atık kaydedilemedi.') };
  }
  revalidatePath('/dashboard/environment');
  return { success: 'Atık kaydedildi.' };
}
