import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  departments,
  marketingContractLines,
  marketingContracts,
  parties,
  products,
  MARKETING_DELIVERY_TERMS
} from '@/db/schema';
import { newId } from '@/lib/id';
import { nextDocumentNo } from '@/lib/numbering';
import { createOrder } from '@/lib/sales/orders';
import { createProcRequest } from '@/lib/procurement/requisition';
import { MarketingError } from './errors';
import {
  canCreateOrder,
  isEditable,
  nextStatus,
  validateContractDates,
  type ContractAction
} from './contract-flow';

// Satış sözleşmesi — Pazarlama Faz 1.
// Durum geçişi kuralları lib/marketing/contract-flow.ts'te (saf, test
// edilebilir); burada yalnızca veri erişimi ve o kuralların uygulanması.

export interface ContractLineInput {
  productId: string;
  quantity: string;
  unitPrice: string;
  deliveryTerm?: (typeof MARKETING_DELIVERY_TERMS)[number];
  deliveryNote?: string;
}

export interface CreateContractInput {
  departmentId: string;
  title: string;
  partyId: string;
  currencyCode: string;
  startDate?: string;
  endDate?: string;
  counterpartyIsContractor?: boolean;
  counterpartySignatory?: string;
  notes?: string;
  lines: ContractLineInput[];
}

export async function createContract(companyId: string, userId: string, input: CreateContractInput): Promise<string> {
  if (input.lines.length === 0) throw new MarketingError('Sözleşmede en az bir kalem olmalı.');

  const dateProblem = validateContractDates(input.startDate, input.endDate);
  if (dateProblem) throw new MarketingError(dateProblem.message);

  const id = newId();
  await db.transaction(async (tx) => {
    const contractNo = await nextDocumentNo(tx, companyId, 'MARKETING_CONTRACT', 'SZL', new Date().getFullYear());
    await tx.insert(marketingContracts).values({
      id,
      companyId,
      departmentId: input.departmentId,
      contractNo,
      title: input.title,
      partyId: input.partyId,
      currencyCode: input.currencyCode,
      startDate: input.startDate,
      endDate: input.endDate,
      counterpartyIsContractor: input.counterpartyIsContractor ?? false,
      counterpartySignatory: input.counterpartySignatory ?? '',
      notes: input.notes ?? '',
      createdByUserId: userId
    });
    for (const line of input.lines) {
      await tx.insert(marketingContractLines).values({
        id: newId(),
        contractId: id,
        productId: line.productId,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        deliveryTerm: line.deliveryTerm ?? 'EX_WORKS',
        deliveryNote: line.deliveryNote ?? ''
      });
    }
  });
  return id;
}

export async function listContracts(companyId: string, departmentId?: string) {
  const where = departmentId
    ? and(eq(marketingContracts.companyId, companyId), eq(marketingContracts.departmentId, departmentId))
    : eq(marketingContracts.companyId, companyId);

  return db
    .select({
      id: marketingContracts.id,
      contractNo: marketingContracts.contractNo,
      title: marketingContracts.title,
      status: marketingContracts.status,
      currencyCode: marketingContracts.currencyCode,
      startDate: marketingContracts.startDate,
      endDate: marketingContracts.endDate,
      counterpartyIsContractor: marketingContracts.counterpartyIsContractor,
      counterpartySignatory: marketingContracts.counterpartySignatory,
      signedAt: marketingContracts.signedAt,
      partyName: parties.legalName
    })
    .from(marketingContracts)
    .innerJoin(parties, eq(parties.id, marketingContracts.partyId))
    .where(where)
    .orderBy(desc(marketingContracts.createdAt));
}

export async function listContractLines(companyId: string, contractId: string) {
  const [contract] = await db
    .select({ id: marketingContracts.id })
    .from(marketingContracts)
    .where(and(eq(marketingContracts.id, contractId), eq(marketingContracts.companyId, companyId)))
    .limit(1);
  if (!contract) throw new MarketingError('Sözleşme bulunamadı.');

  return db
    .select({
      id: marketingContractLines.id,
      productId: marketingContractLines.productId,
      productName: products.name,
      quantity: marketingContractLines.quantity,
      unitPrice: marketingContractLines.unitPrice,
      deliveryTerm: marketingContractLines.deliveryTerm,
      deliveryNote: marketingContractLines.deliveryNote
    })
    .from(marketingContractLines)
    .innerJoin(products, eq(products.id, marketingContractLines.productId))
    .where(eq(marketingContractLines.contractId, contractId));
}

async function loadContract(companyId: string, contractId: string) {
  const [row] = await db
    .select()
    .from(marketingContracts)
    .where(and(eq(marketingContracts.id, contractId), eq(marketingContracts.companyId, companyId)))
    .limit(1);
  if (!row) throw new MarketingError('Sözleşme bulunamadı.');
  return row;
}

export interface TransitionInput {
  action: ContractAction;
  userId: string;
  counterpartySignatory?: string;
  terminationReason?: string;
}

export async function transitionContract(
  companyId: string,
  contractId: string,
  input: TransitionInput
): Promise<void> {
  const contract = await loadContract(companyId, contractId);
  const target = nextStatus(contract.status, input.action);
  if (!target) {
    throw new MarketingError(`Bu sözleşme "${contract.status}" durumundayken bu işlem yapılamaz.`);
  }

  // İmza atılıyorsa karşı tarafın imzacısı YAZILMALI — kimin imzaladığı
  // bilinmeyen bir "imzalı" sözleşme, imza altına almanın anlamını
  // boşaltır.
  if (input.action === 'SIGN') {
    const signatory = (input.counterpartySignatory ?? contract.counterpartySignatory).trim();
    if (!signatory) throw new MarketingError('İmza için karşı taraf imzacısı yazılmalıdır.');
  }
  if (input.action === 'TERMINATE' && !input.terminationReason?.trim()) {
    throw new MarketingError('Fesih sebebi zorunludur.');
  }

  await db
    .update(marketingContracts)
    .set({
      status: target,
      ...(input.action === 'SIGN'
        ? {
            signedAt: new Date(),
            signedByUserId: input.userId,
            ...(input.counterpartySignatory ? { counterpartySignatory: input.counterpartySignatory } : {})
          }
        : {}),
      ...(input.action === 'TERMINATE' ? { terminationReason: input.terminationReason ?? '' } : {})
    })
    .where(eq(marketingContracts.id, contractId));
}

// Sözleşmeden sipariş türetme — yalnızca YÜRÜRLÜKTEKİ sözleşmeden.
// Satırlar birebir taşınır; sipariş oluşturma mevcut lib/sales/orders.ts
// ile yapılır, kopya bir sipariş mantığı YAZILMAZ.
export async function createOrderFromContract(
  companyId: string,
  userId: string,
  contractId: string
): Promise<string> {
  const contract = await loadContract(companyId, contractId);
  if (!canCreateOrder(contract.status)) {
    throw new MarketingError('Yalnızca yürürlükteki sözleşmeden sipariş oluşturulabilir.');
  }

  const lines = await db
    .select({
      productId: marketingContractLines.productId,
      quantity: marketingContractLines.quantity,
      unitPrice: marketingContractLines.unitPrice
    })
    .from(marketingContractLines)
    .where(eq(marketingContractLines.contractId, contractId));

  if (lines.length === 0) throw new MarketingError('Sözleşmede kalem yok.');

  return createOrder(companyId, userId, {
    partyId: contract.partyId,
    orderDate: new Date().toISOString().slice(0, 10),
    currencyCode: contract.currencyCode,
    lines: lines.map((l) => ({
      productId: l.productId,
      quantity: Number(l.quantity),
      unitPrice: Number(l.unitPrice)
    }))
  });
}

// Satınalma köprüsü — Pazarlama Faz 4.
//
// Kullanıcının tarifi: "müteahhit firma ihtiyacı olursa alt ürünlerde
// onları ayarlar" ve soruldu, cevaplandı: "Satınalma departmanına talep
// açılsın" (Pazarlama doğrudan tedarikçiyle çalışmaz).
//
// counterpartyIsContractor bayrağı olmayan bir sözleşmeden talep
// AÇILAMAZ — bu bayrak tam olarak bunun için var (Faz 1'de eklendi).
// Talep MEVCUT lib/procurement/requisition.ts:createProcRequest ile
// açılır; Satınalma'nın kendi onay/RFQ/mal kabul akışı HİÇ değişmez,
// kopya bir satınalma mantığı YAZILMADI (createOrder'ı çağırmakla AYNI
// disiplin).
export interface RequestSubProductInput {
  description: string;
  quantity: string;
  unitId: string;
  estimatedUnitPrice?: string;
}

export async function requestSubProductFromContract(
  companyId: string,
  userId: string,
  contractId: string,
  input: RequestSubProductInput
): Promise<string> {
  const contract = await loadContract(companyId, contractId);
  if (!contract.counterpartyIsContractor) {
    throw new MarketingError('Bu sözleşmenin karşı tarafı müteahhit olarak işaretlenmemiş — Satınalma talebi yalnızca müteahhit sözleşmelerinden açılabilir.');
  }

  // Satınalma departmanı ŞİRKET BAZINDA tek (createDepartment ile birden
  // fazla PROCUREMENT departmanı teorik olarak açılabilir, ama Faz 0'da
  // her şirkete TEK tane açıldı) — ilk eşleşen kullanılır.
  const [procurementDept] = await db
    .select({ id: departments.id })
    .from(departments)
    .where(and(eq(departments.companyId, companyId), eq(departments.departmentTypeCode, 'PROCUREMENT')))
    .limit(1);
  if (!procurementDept) {
    throw new MarketingError('Şirkette Satınalma departmanı tanımlı değil.');
  }

  return createProcRequest(companyId, userId, {
    departmentId: procurementDept.id,
    currencyCode: contract.currencyCode,
    justification: `${contract.contractNo} nolu Pazarlama sözleşmesi ("${contract.title}") — müteahhit için alt ürün talebi.`,
    lines: [
      {
        description: input.description,
        quantity: input.quantity,
        unitId: input.unitId,
        estimatedUnitPrice: input.estimatedUnitPrice
      }
    ]
  });
}

// Satır ekleme yalnızca taslakta — imzalı sözleşmenin fiyatı değişemez.
export async function addContractLine(companyId: string, contractId: string, line: ContractLineInput): Promise<void> {
  const contract = await loadContract(companyId, contractId);
  if (!isEditable(contract.status)) {
    throw new MarketingError('Yalnızca taslak sözleşmeye kalem eklenebilir.');
  }
  await db.insert(marketingContractLines).values({
    id: newId(),
    contractId,
    productId: line.productId,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    deliveryTerm: line.deliveryTerm ?? 'EX_WORKS',
    deliveryNote: line.deliveryNote ?? ''
  });
}
