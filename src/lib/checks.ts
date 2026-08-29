import 'server-only';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { checks, checkEvents, accountingAccounts } from '@/db/schema';
import { newId } from '@/lib/id';
import { postJournal, AccountingError } from '@/lib/accounting';

// PDF madde 28 — Çek/Senet. Alınan çek: PORTFOLIO → COLLECTED/ENDORSED/
// BOUNCED/RETURNED. Verilen çek: DRAFTED → DELIVERED → PAID/CANCELLED. Her
// GEÇERLİ geçiş burada tanımlı — tanımsız bir geçiş denenirse AccountingError.
const RECEIVED_TRANSITIONS: Record<string, string[]> = {
  PORTFOLIO: ['COLLECTED', 'ENDORSED', 'BOUNCED', 'RETURNED']
};
const ISSUED_TRANSITIONS: Record<string, string[]> = {
  DRAFTED: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['PAID', 'CANCELLED']
};

export interface CreateCheckInput {
  direction: 'RECEIVED' | 'ISSUED';
  checkNo: string;
  bankName?: string;
  partyName: string;
  amount: number | string;
  dueDate: string;
  accountingAccountId: string; // "101 Alınan Çekler" veya "103 Verilen Çekler..."
  // İLK kayıt sırasındaki karşı hesap — alınan çekte genelde "120 Alıcılar"
  // (müşteri borcu çekle kapandı), verilen çekte teslim anına kadar
  // posting YOK (DRAFTED aşaması muhasebeleşmez, yalnızca DELIVERED'de).
  counterAccountCode?: string;
  createdByUserId: string;
}

export async function createCheck(companyId: string, input: CreateCheckInput): Promise<string> {
  const id = newId();
  const initialStatus = input.direction === 'RECEIVED' ? 'PORTFOLIO' : 'DRAFTED';

  await db.insert(checks).values({
    id,
    companyId,
    direction: input.direction,
    checkNo: input.checkNo,
    bankName: input.bankName ?? '',
    partyName: input.partyName,
    amount: String(input.amount),
    dueDate: input.dueDate,
    status: initialStatus,
    accountingAccountId: input.accountingAccountId,
    createdByUserId: input.createdByUserId
  });

  // Alınan çek portföye girer girmez muhasebeleşir (101 borç / karşı hesap
  // alacak — müşteri borcu kapandı). Verilen çek DRAFTED'de muhasebeleşmez
  // (henüz teslim edilmedi, karşı tarafa herhangi bir yükümlülük doğmadı).
  if (input.direction === 'RECEIVED') {
    if (!input.counterAccountCode) throw new AccountingError('Alınan çek için karşı hesap (ör. Alıcılar) gerekli.');
    const [account] = await db.select({ code: accountingAccounts.code }).from(accountingAccounts).where(eq(accountingAccounts.id, input.accountingAccountId)).limit(1);
    if (!account) throw new AccountingError('Çek hesabı bulunamadı.');
    const journal = await postJournal({
      companyId,
      journalDate: todayIso(),
      documentType: 'CHECK',
      description: `Alınan çek — ${input.partyName} (${input.checkNo})`,
      createdByUserId: input.createdByUserId,
      lines: [{ accountCode: account.code, debit: input.amount }, { accountCode: input.counterAccountCode, credit: input.amount }]
    });
    await db.insert(checkEvents).values({
      id: newId(),
      checkId: id,
      fromStatus: 'NEW',
      toStatus: 'PORTFOLIO',
      counterAccountCode: input.counterAccountCode,
      journalId: journal.journalId,
      createdByUserId: input.createdByUserId
    });
  }

  return id;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export interface TransitionCheckInput {
  checkId: string;
  toStatus: string;
  counterAccountCode: string; // tahsilde kasa/banka, cirода ödenecek satıcı, karşılıksızda şüpheli alacak, vb.
  note?: string;
  createdByUserId: string;
}

// Her durum geçişi, çekin O ANKİ hesabı (101/103) ile verilen karşı hesap
// arasında bir muhasebe fişi üretir. Yön (borç/alacak), çekin RECEIVED mi
// ISSUED mu olduğuna göre TERS: alınan çek elden çıkarken (tahsil/ciro/
// karşılıksız/iade) 101 ALACAKLANIR; verilen çek elden çıkarken (ödendi)
// 103 BORÇLANIR (yükümlülük kapandı).
export async function transitionCheck(companyId: string, input: TransitionCheckInput): Promise<void> {
  const [check] = await db.select().from(checks).where(and(eq(checks.id, input.checkId), eq(checks.companyId, companyId))).limit(1);
  if (!check) throw new AccountingError('Çek bulunamadı.');

  const transitions = check.direction === 'RECEIVED' ? RECEIVED_TRANSITIONS : ISSUED_TRANSITIONS;
  const allowed = transitions[check.status] ?? [];
  if (!allowed.includes(input.toStatus)) {
    throw new AccountingError(`"${check.status}" durumundaki bir çek "${input.toStatus}" durumuna geçemez.`);
  }

  const [account] = await db.select({ code: accountingAccounts.code }).from(accountingAccounts).where(eq(accountingAccounts.id, check.accountingAccountId)).limit(1);
  if (!account) throw new AccountingError('Çek hesabı bulunamadı.');

  // CANCELLED (yalnızca DRAFTED'den, henüz hiç muhasebeleşmemiş) — fiş
  // ÜRETİLMEZ, yalnızca durum ve olay kaydı.
  let journalId: string | null = null;
  if (!(check.status === 'DRAFTED' && input.toStatus === 'CANCELLED')) {
    const isReceivedExit = check.direction === 'RECEIVED';
    const journal = await postJournal({
      companyId,
      journalDate: todayIso(),
      documentType: 'CHECK',
      description: `Çek ${input.toStatus} — ${check.partyName} (${check.checkNo})`,
      createdByUserId: input.createdByUserId,
      lines: isReceivedExit
        ? [{ accountCode: input.counterAccountCode, debit: check.amount }, { accountCode: account.code, credit: check.amount }]
        : [{ accountCode: account.code, debit: check.amount }, { accountCode: input.counterAccountCode, credit: check.amount }]
    });
    journalId = journal.journalId;
  }

  await db.update(checks).set({ status: input.toStatus }).where(eq(checks.id, check.id));
  await db.insert(checkEvents).values({
    id: newId(),
    checkId: check.id,
    fromStatus: check.status,
    toStatus: input.toStatus,
    counterAccountCode: input.counterAccountCode,
    journalId,
    note: input.note,
    createdByUserId: input.createdByUserId
  });
}

export async function listChecks(companyId: string, direction?: 'RECEIVED' | 'ISSUED') {
  const conditions = direction ? and(eq(checks.companyId, companyId), eq(checks.direction, direction)) : eq(checks.companyId, companyId);
  return db.select().from(checks).where(conditions).orderBy(desc(checks.dueDate));
}
