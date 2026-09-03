// Satış sözleşmesi imza akışının SAF kuralları — DB'ye de ağa da
// dokunmaz, bu yüzden `server-only` İÇERMEZ (weighing-math.ts ile aynı
// gerekçe: kural test edilebilir olmalı).
//
// Kullanıcının tarifi: "anlaşmasını yapar ve İMZA ALTINA ALIR".
//   DRAFT -> SUBMITTED -> SIGNED -> ACTIVE -> EXPIRED | TERMINATED
//
// SIGNED ile ACTIVE neden ayrı: sözleşme bugün imzalanıp gelecek bir
// tarihte yürürlüğe girebilir. İkisini birleştirmek "imzalandı ama
// henüz başlamadı" durumunu ifade edilemez kılardı.

import type { MARKETING_CONTRACT_STATUSES } from '@/db/schema';

export type ContractStatus = (typeof MARKETING_CONTRACT_STATUSES)[number];

export type ContractAction = 'SUBMIT' | 'SIGN' | 'ACTIVATE' | 'EXPIRE' | 'TERMINATE' | 'BACK_TO_DRAFT';

// Her eylemin hangi durumdan hangisine götürdüğü. Tabloda OLMAYAN bir
// geçiş YAPILAMAZ — "her durumdan her yere" serbestliği, imzalı bir
// sözleşmenin sessizce taslağa dönmesi gibi kazaları davet eder.
const TRANSITIONS: Record<ContractAction, { from: ContractStatus[]; to: ContractStatus }> = {
  SUBMIT: { from: ['DRAFT'], to: 'SUBMITTED' },
  // Onaya sunulmuş sözleşme imzalanır. Taslaktan DOĞRUDAN imzaya
  // geçilemez — imza öncesi bir gözden geçirme adımı olsun diye.
  SIGN: { from: ['SUBMITTED'], to: 'SIGNED' },
  ACTIVATE: { from: ['SIGNED'], to: 'ACTIVE' },
  EXPIRE: { from: ['ACTIVE'], to: 'EXPIRED' },
  // Fesih hem imzalıyken hem yürürlükteyken mümkün.
  TERMINATE: { from: ['SIGNED', 'ACTIVE'], to: 'TERMINATED' },
  // Revizyon: yalnızca HENÜZ İMZALANMAMIŞ sözleşme taslağa döner.
  BACK_TO_DRAFT: { from: ['SUBMITTED'], to: 'DRAFT' }
};

export function canTransition(current: ContractStatus, action: ContractAction): boolean {
  return TRANSITIONS[action].from.includes(current);
}

export function nextStatus(current: ContractStatus, action: ContractAction): ContractStatus | null {
  return canTransition(current, action) ? TRANSITIONS[action].to : null;
}

export function allowedActions(current: ContractStatus): ContractAction[] {
  return (Object.keys(TRANSITIONS) as ContractAction[]).filter((a) => canTransition(current, a));
}

// Satır/tutar değişikliği yalnızca taslakta serbest. İmzalanmış bir
// sözleşmenin fiyatı sonradan değiştirilemez — değişecekse fesih + yeni
// sözleşme. Bu, "imza altına alma"nın anlamı.
export function isEditable(current: ContractStatus): boolean {
  return current === 'DRAFT';
}

// Sipariş yalnızca yürürlükteki sözleşmeden türetilir: imzalanmamış ya
// da süresi dolmuş bir anlaşmaya dayanarak sevkiyat başlatılmamalı.
export function canCreateOrder(current: ContractStatus): boolean {
  return current === 'ACTIVE';
}

export interface ContractDateProblem {
  field: 'endDate';
  message: string;
}

// Bitiş tarihi başlangıçtan önce olamaz. Tarihler opsiyonel (süresiz
// çerçeve anlaşması olabilir), o yüzden yalnızca İKİSİ DE varsa bakılır.
export function validateContractDates(startDate?: string | null, endDate?: string | null): ContractDateProblem | null {
  if (!startDate || !endDate) return null;
  if (endDate < startDate) {
    return { field: 'endDate', message: 'Bitiş tarihi başlangıç tarihinden önce olamaz.' };
  }
  return null;
}

// Sözleşme toplamı — satır adet x birim fiyat. Kantar tarafındaki
// hesaplarla AYNI disiplin: sayıya çevrilemeyen satır sessizce 0
// sayılmaz, null döner ve çağıran uyarır.
export function contractTotal(lines: { quantity: string | number; unitPrice: string | number }[]): number | null {
  let total = 0;
  for (const line of lines) {
    const qty = Number(line.quantity);
    const price = Number(line.unitPrice);
    if (!Number.isFinite(qty) || !Number.isFinite(price)) return null;
    total += qty * price;
  }
  return Number(total.toFixed(6));
}
