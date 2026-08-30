import 'server-only';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { roleConflictRules, approvalInstances } from '@/db/schema';
import { newId } from '@/lib/id';
import { SecurityError } from './errors';

// Core Security Faz 9 (rapor §09, madde 58) — Segregation of Duties.
// workflow/engine.ts DEĞİŞMEDİ — bu, actOnXStep fonksiyonlarının
// actOnStepInTx'i ÇAĞIRMADAN ÖNCE isteğe bağlı olarak çalıştırabileceği
// bağımsız bir ön-kontrol. Şu an tek kural türü uygulanıyor:
// CREATOR_CANNOT_APPROVE (bir belgeyi oluşturan kişi aynı belgeyi
// onaylayamaz) — leave/bonus/dsr'ın zaten kendi cancel fonksiyonlarında
// yaptığı NOKTASAL "oluşturan≠iptal eden" kontrolünün GENELLEŞTİRİLMİŞ hâli.

export const SOD_RULES = ['CREATOR_CANNOT_APPROVE'] as const;

export async function createRoleConflictRule(companyId: string, documentType: string, rule: (typeof SOD_RULES)[number], description?: string): Promise<string> {
  const id = newId();
  await db.insert(roleConflictRules).values({ id, companyId, documentType, rule, description: description ?? '' }).onDuplicateKeyUpdate({ set: { active: true, description: description ?? '' } });
  return id;
}

export async function listRoleConflictRules(companyId: string) {
  return db.select().from(roleConflictRules).where(and(eq(roleConflictRules.companyId, companyId), eq(roleConflictRules.active, true)));
}

export async function deactivateRoleConflictRule(companyId: string, ruleId: string): Promise<void> {
  await db.update(roleConflictRules).set({ active: false }).where(and(eq(roleConflictRules.id, ruleId), eq(roleConflictRules.companyId, companyId)));
}

// Bir onay adımına karar vermeden ÖNCE çağrılır — documentType için
// CREATOR_CANNOT_APPROVE aktifse ve karar veren kişi belgeyi
// submittedByUserId olarak oluşturmuşsa reddeder.
export async function assertNoConflict(companyId: string, documentType: string, documentId: string, actingUserId: string): Promise<void> {
  const rules = await db.select({ rule: roleConflictRules.rule }).from(roleConflictRules).where(and(eq(roleConflictRules.companyId, companyId), eq(roleConflictRules.documentType, documentType), eq(roleConflictRules.active, true)));
  if (!rules.some((r) => r.rule === 'CREATOR_CANNOT_APPROVE')) return;

  const [instance] = await db.select({ submittedByUserId: approvalInstances.submittedByUserId }).from(approvalInstances).where(and(eq(approvalInstances.documentType, documentType), eq(approvalInstances.documentId, documentId))).limit(1);
  if (instance && instance.submittedByUserId === actingUserId) {
    throw new SecurityError('Görevler ayrılığı ihlali: bir belgeyi oluşturan kişi aynı belgeyi onaylayamaz.');
  }
}
