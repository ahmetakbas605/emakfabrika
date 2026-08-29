import 'server-only';
import { eq, and, inArray, desc } from 'drizzle-orm';
import { db, type Tx } from '@/db/client';
import { workflowRules, approvalInstances, approvalSteps, approvalStepApprovers, approvalActions, users, positions, approvalDelegations } from '@/db/schema';
import { newId } from '@/lib/id';
import { getManagerChain, resolveActiveApprover } from '@/lib/org';
import { CoreError } from '@/lib/core/errors';
import type { WorkflowConditions, WorkflowChainStep, WorkflowContext } from './types';

// SATINALMA-MİMARİSİ Faz 0 — genel, procurement'a özel OLMAYAN kural
// tabanlı onay motoru (madde 174, 184-190). Kapsam sınırı (bilinçli,
// dokümante edilmiş): `mode`/`quorum` yalnızca TEK bir adımın KENDİ
// çözümlenmiş onaylayan kümesi için geçerli (o adımda kaç kişi gerekli).
// Adımların KENDİSİ hâlâ stepOrder'a göre KATI SIRALI ilerler — aynı anda
// birden fazla adımın aktif olduğu gerçek çapraz-adım paralellik bu
// sürümde YOK (madde 186'nın "Finance + Technical aynı anda" senaryosu,
// aynı adıma İKİ onaylayan koyup mode=SEQUENTIAL/quorum=hepsi ile
// modellenir — pratik sonuç aynı, gerçek eşzamanlı çoklu-adım karmaşıklığı
// olmadan).

// --- Kural yönetimi ---

export interface CreateWorkflowRuleInput {
  documentType: string;
  name: string;
  conditions?: WorkflowConditions;
  approvalChain: WorkflowChainStep[];
  priority?: number;
}

function validateChain(chain: WorkflowChainStep[]): void {
  if (chain.length === 0) throw new CoreError('Onay zinciri en az bir adım içermeli.');
  for (const step of chain) {
    if (!step.approverValue?.trim()) throw new CoreError('Her adımda bir onaylayan (pozisyon/kullanıcı/yönetici seviyesi) belirtilmeli.');
    if (step.approverType === 'MANAGER_CHAIN' && (!Number.isInteger(Number(step.approverValue)) || Number(step.approverValue) < 1)) {
      throw new CoreError('MANAGER_CHAIN adımında approverValue pozitif bir tam sayı (kaçıncı seviye yönetici) olmalı.');
    }
  }
}

export async function createWorkflowRule(companyId: string, input: CreateWorkflowRuleInput): Promise<string> {
  validateChain(input.approvalChain);
  const id = newId();
  await db.insert(workflowRules).values({
    id, companyId,
    documentType: input.documentType,
    name: input.name,
    conditions: input.conditions ?? {},
    approvalChain: input.approvalChain,
    priority: input.priority ?? 0
  });
  return id;
}

export async function listWorkflowRules(companyId: string, documentType?: string) {
  const conditions = documentType ? and(eq(workflowRules.companyId, companyId), eq(workflowRules.documentType, documentType)) : eq(workflowRules.companyId, companyId);
  return db.select().from(workflowRules).where(conditions);
}

function conditionsMatch(conditions: WorkflowConditions | null, context: WorkflowContext): boolean {
  if (!conditions) return true;
  if (conditions.minAmount !== undefined && (context.amount === undefined || context.amount < conditions.minAmount)) return false;
  if (conditions.maxAmount !== undefined && (context.amount === undefined || context.amount > conditions.maxAmount)) return false;
  if (conditions.categoryCode !== undefined && context.categoryCode !== conditions.categoryCode) return false;
  if (conditions.costCenterId !== undefined && context.costCenterId !== conditions.costCenterId) return false;
  if (conditions.capexOpex !== undefined && context.capexOpex !== conditions.capexOpex) return false;
  if (conditions.departmentId !== undefined && context.departmentId !== conditions.departmentId) return false;
  return true;
}

// En yüksek priority'li, eşleşen kural kazanır. Eşitlikte oluşturulma
// sırası (id) belirleyici değil — birden fazla eşit-öncelikli eşleşen
// kural varsa ilk bulunan kullanılır (deterministik olmayan bir durum,
// tenant kendi kurallarını çakışmayacak şekilde tasarlamalı — madde 32-33
// zaten "tenant kendi limitlerini belirler" diyor, çakışma önleme
// motorun değil, kural tanımlayanın sorumluluğu).
export async function matchWorkflowRule(tx: Tx, companyId: string, documentType: string, context: WorkflowContext) {
  const rules = await tx.select().from(workflowRules).where(and(eq(workflowRules.companyId, companyId), eq(workflowRules.documentType, documentType), eq(workflowRules.active, true)));
  const matching = rules.filter((r) => conditionsMatch(r.conditions as WorkflowConditions | null, context));
  if (matching.length === 0) return null;
  matching.sort((a, b) => b.priority - a.priority);
  return matching[0];
}

// --- Onaylayan çözümleme ---

async function resolveStepApprovers(tx: Tx, companyId: string, step: WorkflowChainStep, submittedByUserId: string): Promise<string[]> {
  let resolved: string[];
  if (step.approverType === 'SPECIFIC_USER') {
    const [u] = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, step.approverValue), eq(users.companyId, companyId))).limit(1);
    if (!u) throw new CoreError(`Onay zincirindeki kullanıcı bulunamadı: ${step.approverValue}`);
    resolved = [u.id];
  } else if (step.approverType === 'POSITION') {
    const [p] = await tx.select({ id: positions.id }).from(positions).where(and(eq(positions.id, step.approverValue), eq(positions.companyId, companyId))).limit(1);
    if (!p) throw new CoreError(`Onay zincirindeki pozisyon bulunamadı: ${step.approverValue}`);
    const rows = await tx.select({ id: users.id }).from(users).where(and(eq(users.positionId, step.approverValue), eq(users.companyId, companyId), eq(users.active, true)));
    if (rows.length === 0) throw new CoreError(`"${step.approverValue}" pozisyonunda aktif kullanıcı yok — onay zinciri ilerleyemez.`);
    resolved = rows.map((r) => r.id);
  } else {
    // MANAGER_CHAIN
    const level = Number(step.approverValue);
    const chain = await getManagerChain(companyId, submittedByUserId, level);
    const managerId = chain[level - 1];
    if (!managerId) throw new CoreError(`Talebi başlatanın ${level}. seviye yöneticisi tanımlı değil — organizasyon hiyerarşisi eksik.`);
    resolved = [managerId];
  }
  // Delegasyon şu ANDA çözümlenir (instance oluşturulurken) — izinli bir
  // yöneticinin yerine o anda aktif vekili atanır. Bu, izin bitip yeni bir
  // vekalet başladığında GEÇMİŞ onay örneklerini ETKİLEMEZ (madde 116-117
  // "immutable" ilkesiyle tutarlı — yalnızca YENİ başlayan onaylar güncel
  // vekaleti kullanır).
  const withDelegates = await Promise.all(resolved.map((userId) => resolveActiveApprover(companyId, userId)));
  return [...new Set(withDelegates)];
}

// --- Onay örneği başlatma ---

export interface StartApprovalResult {
  instanceId: string;
}

export async function startApprovalInTx(tx: Tx, companyId: string, documentType: string, documentId: string, submittedByUserId: string, context: WorkflowContext): Promise<StartApprovalResult> {
  const rule = await matchWorkflowRule(tx, companyId, documentType, context);
  if (!rule) throw new CoreError(`"${documentType}" için eşleşen bir onay kuralı yok — önce bir workflow kuralı tanımlanmalı (en azından koşulsuz bir varsayılan kural).`);

  const chain = rule.approvalChain as WorkflowChainStep[];
  const instanceId = newId();
  await tx.insert(approvalInstances).values({ id: instanceId, companyId, documentType, documentId, matchedRuleId: rule.id, submittedByUserId, status: 'IN_PROGRESS' });

  for (let i = 0; i < chain.length; i++) {
    const step = chain[i];
    const approverIds = await resolveStepApprovers(tx, companyId, step, submittedByUserId);
    const stepId = newId();
    await tx.insert(approvalSteps).values({
      id: stepId, instanceId, stepOrder: i, mode: step.mode, quorum: step.quorum,
      status: i === 0 ? 'IN_PROGRESS' : 'PENDING'
    });
    for (const userId of approverIds) {
      await tx.insert(approvalStepApprovers).values({ id: newId(), stepId, userId });
    }
  }

  return { instanceId };
}

// --- Karar verme ---

export type ApprovalDecision = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'DELEGATE';

export interface ActOnStepInput {
  stepId: string;
  actingUserId: string;
  decision: ApprovalDecision;
  comment?: string;
  delegateToUserId?: string; // yalnızca decision='DELEGATE' iken kullanılır
}

export interface ActOnStepResult {
  instanceStatus: 'IN_PROGRESS' | 'APPROVED' | 'REJECTED';
}

export async function actOnStepInTx(tx: Tx, companyId: string, input: ActOnStepInput): Promise<ActOnStepResult> {
  const [step] = await tx.select().from(approvalSteps).where(eq(approvalSteps.id, input.stepId)).limit(1);
  if (!step) throw new CoreError('Onay adımı bulunamadı.');
  const [instance] = await tx.select().from(approvalInstances).where(and(eq(approvalInstances.id, step.instanceId), eq(approvalInstances.companyId, companyId))).limit(1);
  if (!instance) throw new CoreError('Onay örneği bulunamadı.');
  if (step.status !== 'IN_PROGRESS') throw new CoreError('Bu adım şu anda aktif değil.');

  const approverRows = await tx.select().from(approvalStepApprovers).where(eq(approvalStepApprovers.stepId, step.id));
  // Yetki kontrolü: doğrudan atanmış onaylayan MI, yoksa onlardan birinin
  // ŞU ANKİ aktif vekili mi? (Zaman aralığı, instance başladıktan sonra
  // değişmiş olabilir — örn. onaylayan izne SONRADAN çıktıysa.)
  const isAuthorized = await (async () => {
    for (const a of approverRows) {
      if (a.userId === input.actingUserId) return true;
      const activeDelegate = await resolveActiveApprover(companyId, a.userId);
      if (activeDelegate === input.actingUserId) return true;
    }
    return false;
  })();
  if (!isAuthorized) throw new CoreError('Bu onay adımını gerçekleştirme yetkiniz yok.');

  await tx.insert(approvalActions).values({ id: newId(), stepId: step.id, actedByUserId: input.actingUserId, decision: input.decision, comment: input.comment });

  if (input.decision === 'REJECT' || input.decision === 'REQUEST_CHANGES') {
    await tx.update(approvalSteps).set({ status: 'REJECTED' }).where(eq(approvalSteps.id, step.id));
    await tx.update(approvalInstances).set({ status: 'REJECTED', completedAt: new Date() }).where(eq(approvalInstances.id, instance.id));
    return { instanceStatus: 'REJECTED' };
  }

  if (input.decision === 'DELEGATE') {
    if (!input.delegateToUserId) throw new CoreError('Devredilecek kullanıcı belirtilmeli.');
    const [target] = await tx.select({ id: users.id }).from(users).where(and(eq(users.id, input.delegateToUserId), eq(users.companyId, companyId))).limit(1);
    if (!target) throw new CoreError('Devredilecek kullanıcı bulunamadı.');
    await tx.insert(approvalStepApprovers).values({ id: newId(), stepId: step.id, userId: input.delegateToUserId }).onDuplicateKeyUpdate({ set: { userId: input.delegateToUserId } });
    return { instanceStatus: 'IN_PROGRESS' };
  }

  // APPROVE
  const actedRows = await tx.select({ actedByUserId: approvalActions.actedByUserId }).from(approvalActions).where(and(eq(approvalActions.stepId, step.id), eq(approvalActions.decision, 'APPROVE')));
  const distinctApprovers = new Set(actedRows.map((r) => r.actedByUserId));
  const required = step.mode === 'PARALLEL' ? (step.quorum ?? 1) : approverRows.length;

  if (distinctApprovers.size < required) {
    return { instanceStatus: 'IN_PROGRESS' };
  }

  await tx.update(approvalSteps).set({ status: 'APPROVED' }).where(eq(approvalSteps.id, step.id));

  const [nextStep] = await tx.select().from(approvalSteps).where(and(eq(approvalSteps.instanceId, instance.id), eq(approvalSteps.stepOrder, step.stepOrder + 1))).limit(1);
  if (nextStep) {
    await tx.update(approvalSteps).set({ status: 'IN_PROGRESS' }).where(eq(approvalSteps.id, nextStep.id));
    return { instanceStatus: 'IN_PROGRESS' };
  }

  await tx.update(approvalInstances).set({ status: 'APPROVED', completedAt: new Date() }).where(eq(approvalInstances.id, instance.id));
  return { instanceStatus: 'APPROVED' };
}

export async function actOnStep(companyId: string, input: ActOnStepInput): Promise<ActOnStepResult> {
  return db.transaction((tx) => actOnStepInTx(tx, companyId, input));
}

// Onay Kutusu (madde 218-219) TEK bir merkezi ekran — HER domain'in
// (bugün yalnızca procurement, ileride Satış/İK/...) onayları BURADAN
// karara bağlanır. actions/workflow.ts:actOnStepAction bu yüzden hangi
// domain'e ait olduğunu ÖNCE bilmeli — o domain'in KENDİ yan etkilerini
// (procurement için: reddedilince bütçe/rezervasyon serbest bırakma)
// tetikleyebilsin diye. Domain sayısı arttıkça bu if-else bir registry'ye
// dönüşecek (bugün tek domain için gereksiz bir soyutlama olurdu).
export async function getStepDocumentType(stepId: string): Promise<string | null> {
  const [step] = await db.select({ instanceId: approvalSteps.instanceId }).from(approvalSteps).where(eq(approvalSteps.id, stepId)).limit(1);
  if (!step) return null;
  const [instance] = await db.select({ documentType: approvalInstances.documentType }).from(approvalInstances).where(eq(approvalInstances.id, step.instanceId)).limit(1);
  return instance?.documentType ?? null;
}

// --- Sorgular (UI için) ---

// GERÇEK bir hata burada yakalandı (Satınalma Faz 1'in resubmit testiyle):
// bir belge REVISION_REQUIRED'dan sonra yeniden gönderilirse, AYNI
// documentId için İKİNCİ bir approval_instances satırı oluşur (startApproval
// InTx her submit'te YENİ bir instance açar, eskisini SİLMEZ/GÜNCELLEMEZ —
// madde 116-117 immutable ilkesi). ORDER BY olmadan `.limit(1)` MySQL'in
// keyfi (genelde ekleme sırasına yakın ama GARANTİ değil) satır sırasına
// güveniyordu — ESKİ (REJECTED) instance'ı döndürüp YENİ aktif onayı
// gizleyebilirdi. createdAt DESC ile HER ZAMAN en son başlatılan instance
// döner.
export async function getApprovalInstance(companyId: string, documentType: string, documentId: string) {
  const instances = await db.select().from(approvalInstances).where(and(eq(approvalInstances.companyId, companyId), eq(approvalInstances.documentType, documentType), eq(approvalInstances.documentId, documentId))).orderBy(desc(approvalInstances.createdAt));
  if (instances.length === 0) return null;
  // createdAt DESC tek başına YETERSİZ — MySQL TIMESTAMP varsayılan olarak
  // SANİYE hassasiyetinde, aynı saniye içinde oluşan iki instance (hızlı
  // bir resubmit senaryosunda GERÇEKTEN yaşandı) güvenilir sıralanamaz.
  // Bir belgenin aynı anda en fazla BİR aktif (IN_PROGRESS) instance'ı
  // olabilir (submitProcRequest zaten DRAFT/REVISION_REQUIRED dışını
  // reddediyor) — bu yüzden status net, zamana bağlı olmayan bir ayrım.
  const instance = instances.find((i) => i.status === 'IN_PROGRESS') ?? instances[0];

  const steps = await db.select().from(approvalSteps).where(eq(approvalSteps.instanceId, instance.id));
  const stepIds = steps.map((s) => s.id);
  const approvers = stepIds.length > 0 ? await db.select({ stepId: approvalStepApprovers.stepId, userId: approvalStepApprovers.userId, userName: users.fullName }).from(approvalStepApprovers).innerJoin(users, eq(users.id, approvalStepApprovers.userId)).where(inArray(approvalStepApprovers.stepId, stepIds)) : [];
  const actions = stepIds.length > 0 ? await db.select({ stepId: approvalActions.stepId, actedByUserId: approvalActions.actedByUserId, actedByName: users.fullName, decision: approvalActions.decision, comment: approvalActions.comment, createdAt: approvalActions.createdAt }).from(approvalActions).innerJoin(users, eq(users.id, approvalActions.actedByUserId)).where(inArray(approvalActions.stepId, stepIds)) : [];

  return {
    instance,
    steps: steps
      .sort((a, b) => a.stepOrder - b.stepOrder)
      .map((s) => ({
        ...s,
        approvers: approvers.filter((a) => a.stepId === s.id),
        actions: actions.filter((a) => a.stepId === s.id)
      }))
  };
}

// madde 41, 218-219 — "Onay Kutusu" / Approval Inbox. Kullanıcının
// DOĞRUDAN atandığı VEYA şu an aktif vekili olduğu bekleyen adımlar.
export async function listPendingApprovalsForUser(companyId: string, userId: string) {
  const delegatedToMe = await db.select({ delegatorUserId: approvalDelegations.delegatorUserId }).from(approvalDelegations).where(and(eq(approvalDelegations.companyId, companyId), eq(approvalDelegations.delegateUserId, userId), eq(approvalDelegations.active, true)));
  const relevantUserIds = [userId, ...delegatedToMe.map((d) => d.delegatorUserId)];

  const rows = await db
    .select({
      stepId: approvalSteps.id, instanceId: approvalSteps.instanceId, stepOrder: approvalSteps.stepOrder,
      documentType: approvalInstances.documentType, documentId: approvalInstances.documentId,
      submittedByUserId: approvalInstances.submittedByUserId, submittedByName: users.fullName,
      createdAt: approvalInstances.createdAt
    })
    .from(approvalStepApprovers)
    .innerJoin(approvalSteps, eq(approvalSteps.id, approvalStepApprovers.stepId))
    .innerJoin(approvalInstances, eq(approvalInstances.id, approvalSteps.instanceId))
    .innerJoin(users, eq(users.id, approvalInstances.submittedByUserId))
    .where(and(eq(approvalInstances.companyId, companyId), eq(approvalSteps.status, 'IN_PROGRESS'), inArray(approvalStepApprovers.userId, relevantUserIds)));

  // Aynı adım relevantUserIds'teki birden fazla id için eşleşebilir
  // (kullanıcının kendisi + vekalet aldığı kişi aynı adımda İKİSİ de
  // onaylayan olarak atanmışsa) — stepId bazında tekilleştir.
  const seen = new Set<string>();
  return rows.filter((r) => (seen.has(r.stepId) ? false : (seen.add(r.stepId), true)));
}
