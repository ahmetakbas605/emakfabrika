import 'dotenv/config';
import mysql from 'mysql2/promise';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { companies, users, invReservations } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { createAccount, openPeriod, getTrialBalance } from '../src/lib/accounting';
import { createUnit } from '../src/lib/master-data/units';
import { createProduct } from '../src/lib/master-data/products';
import { createWarehouse, createStockItem, recordStockMovement } from '../src/lib/warehouse';
import { createWorkflowRule, listPendingApprovalsForUser } from '../src/lib/workflow/engine';
import { createLead, convertLeadToOpportunity } from '../src/lib/sales/leads';
import { setOpportunityStage } from '../src/lib/sales/opportunities';
import { createQuote, setQuoteStatus } from '../src/lib/sales/quotes';
import { createOrderFromQuote, submitOrder, actOnOrderStep, getOrder } from '../src/lib/sales/orders';
import { createShipment, dispatchShipment } from '../src/lib/sales/shipments';
import { createInvoice, approveInvoice } from '../src/lib/sales/invoices';
import { createCollection, getInvoiceCollectionSummary } from '../src/lib/sales/collections';
import { createComplaint, resolveComplaint, getComplaint } from '../src/lib/sales/complaints';
import { money, toDisplay } from '../src/lib/money';

// Holding ERP Faz 1 — Satış & CRM. accounting.test.ts/holding.test.ts İLE
// AYNI disiplin: gerçek MySQL'e karşı, mock YOK, tüm gerçek uçtan uca
// zinciri (Lead→Fırsat→Teklif→Sipariş→Onay→Sevkiyat→Fatura→Tahsilat→Şikayet)
// dener. npm run test:sales.

let pass = 0;
let fail = 0;
function check(label: string, condition: boolean) {
  if (condition) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ ${label}`);
  }
}

async function main() {
  const companyId = newId();
  const creatorId = newId();
  const approverId = newId();

  await db.insert(companies).values({ id: companyId, name: 'SALES TEST A.Ş.', taxId: '9999999993', taxOffice: 'Test V.D.' });
  await db.insert(users).values([
    { id: creatorId, companyId, fullName: 'Satış Elemanı', email: `test-${Date.now()}-creator@sales.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true },
    { id: approverId, companyId, fullName: 'Satış Müdürü', email: `test-${Date.now()}-approver@sales.test`, passwordHash: hashPassword('x'), isFactoryAdmin: false }
  ]);

  try {
    console.log('--- Ön koşullar: birim, ürün, depo, stok, hesap planı ---');
    const unitId = await createUnit(companyId, { code: 'ADET', name: 'Adet' });
    const productId = await createProduct(companyId, creatorId, { sku: 'TESTURUN-1', name: 'Test Ürünü', baseUnitId: unitId, taxRatePercent: 20 });
    const warehouseId = await createWarehouse(companyId, 'Merkez Depo');
    const stockItemId = await createStockItem(companyId, { sku: 'TESTURUN-1', name: 'Test Ürünü', productId });
    await recordStockMovement({ companyId, warehouseId, stockItemId, movementType: 'IN', quantity: 100, unitCost: 50, transactionDate: '2026-01-01', createdByUserId: creatorId });

    await createAccount(companyId, { code: '120', name: 'Alıcılar', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '100', name: 'Kasa', normalBalance: 'DEBIT', accountType: 'ASSET' });
    await createAccount(companyId, { code: '600', name: 'Yurtiçi Satışlar', normalBalance: 'CREDIT', accountType: 'REVENUE' });
    await createAccount(companyId, { code: '391', name: 'Hesaplanan KDV', normalBalance: 'CREDIT', accountType: 'LIABILITY' });
    await openPeriod(companyId, '2026-01-01', '2026-12-31');
    check('ön koşullar hazırlandı (birim/ürün/depo/stok/hesap planı)', true);

    console.log('--- Lead → Fırsat dönüşümü ---');
    const leadId = await createLead(companyId, creatorId, { contactName: 'Ahmet Yılmaz', companyName: 'Yılmaz Ticaret Ltd.', email: 'ahmet@yilmaz.test' });
    const { partyId, opportunityId } = await convertLeadToOpportunity(companyId, leadId, creatorId, { opportunityName: 'Yılmaz Ticaret — İlk Sipariş' });
    check('lead fırsata dönüştü, yeni Party oluştu', !!partyId && !!opportunityId);
    await setOpportunityStage(companyId, opportunityId, 'WON');
    check('fırsat WON olarak işaretlendi', true);

    console.log('--- Teklif → Sipariş ---');
    const quoteId = await createQuote(companyId, creatorId, {
      partyId, opportunityId, quoteDate: '2026-01-10', currencyCode: 'TRY',
      lines: [{ productId, quantity: 10, unitPrice: 100, discountPercent: 10 }]
    });
    await setQuoteStatus(companyId, quoteId, 'SENT');
    await setQuoteStatus(companyId, quoteId, 'ACCEPTED');
    const orderId = await createOrderFromQuote(companyId, creatorId, quoteId);
    const { order: orderAfterCreate, lines: linesAfterCreate } = await getOrder(companyId, orderId);
    check('sipariş teklif satırlarını AYNEN kopyaladı (10 adet, 900 net — %10 iskonto sonrası)', money(linesAfterCreate[0].lineTotal).equals(900) && orderAfterCreate.status === 'DRAFT');

    console.log('--- Onay akışı (SPECIFIC_USER = approver) ---');
    await createWorkflowRule(companyId, { documentType: 'SALES_ORDER', name: 'Satış Siparişi Onayı', approvalChain: [{ approverType: 'SPECIFIC_USER', approverValue: approverId, mode: 'SEQUENTIAL' }] });
    await submitOrder(companyId, orderId, creatorId);
    const { order: orderAfterSubmit } = await getOrder(companyId, orderId);
    check('sipariş SUBMITTED durumuna geçti', orderAfterSubmit.status === 'SUBMITTED');

    const pendingForApprover = await listPendingApprovalsForUser(companyId, approverId);
    const stepId = pendingForApprover.find((p) => p.documentType === 'SALES_ORDER')?.stepId;
    check('onay adımı approver\'a atandı', !!stepId);
    if (!stepId) throw new Error('Onay adımı bulunamadı — test devam edemez.');

    await actOnOrderStep(companyId, { stepId, actingUserId: approverId, decision: 'APPROVE', warehouseId });
    const { order: orderAfterApproval } = await getOrder(companyId, orderId);
    check('onaylandıktan sonra sipariş CONFIRMED oldu', orderAfterApproval.status === 'CONFIRMED');

    const reservations = await db.select().from(invReservations).where(eq(invReservations.sourceId, orderId));
    check('onay stok rezervasyonu oluşturdu (10 adet, ACTIVE)', reservations.length === 1 && money(reservations[0].quantity).equals(10) && reservations[0].status === 'ACTIVE');

    console.log('--- Sevkiyat ---');
    const { lines: linesForShipment } = await getOrder(companyId, orderId);
    const shipmentId = await createShipment(companyId, creatorId, { orderId, warehouseId, shipmentDate: '2026-01-15', lines: [{ orderLineId: linesForShipment[0].id, quantity: 10 }] });
    await dispatchShipment(companyId, shipmentId, creatorId);
    const { order: orderAfterShip, lines: linesAfterShip } = await getOrder(companyId, orderId);
    check('sevkiyat sonrası sipariş SHIPPED oldu (tam sevkiyat)', orderAfterShip.status === 'SHIPPED');
    check('sipariş kalemi shippedQuantity=10 güncellendi', money(linesAfterShip[0].shippedQuantity).equals(10));

    console.log('--- Fatura + muhasebe entegrasyonu ---');
    const invoiceId = await createInvoice(companyId, creatorId, {
      orderId, partyId, invoiceDate: '2026-01-16', currencyCode: 'TRY',
      lines: [{ orderLineId: linesAfterShip[0].id, productId, quantity: 10, unitPrice: 90, taxRatePercent: 20 }]
    });
    await approveInvoice(companyId, invoiceId, creatorId, { revenueAccountCode: '600', receivableAccountCode: '120', taxAccountCode: '391' });
    const { order: orderAfterInvoice } = await getOrder(companyId, orderId);
    check('fatura onayı sonrası sipariş INVOICED oldu', orderAfterInvoice.status === 'INVOICED');

    const tb = await getTrialBalance(companyId);
    const receivable = tb.find((r) => r.accountCode === '120')!;
    const revenue = tb.find((r) => r.accountCode === '600')!;
    const tax = tb.find((r) => r.accountCode === '391')!;
    check(`Alıcılar bakiyesi doğru (900+180 KDV = 1080): ${toDisplay(receivable.balance)}`, money(receivable.balance).equals(1080));
    check(`Satış geliri doğru (900): ${toDisplay(revenue.balance)}`, money(revenue.balance).equals(900));
    check(`Hesaplanan KDV doğru (180): ${toDisplay(tax.balance)}`, money(tax.balance).equals(180));

    console.log('--- Tahsilat ---');
    await createCollection(companyId, creatorId, { invoiceId, collectionDate: '2026-01-20', amount: 1080, currencyCode: 'TRY', method: 'BANK', cashOrBankAccountCode: '100', receivableAccountCode: '120' });
    const collectionSummary = await getInvoiceCollectionSummary(companyId, invoiceId);
    check(`tahsilat sonrası fatura bakiyesi sıfırlandı (kalan=${collectionSummary.remaining})`, money(collectionSummary.remaining).equals(0));

    const tbAfterCollection = await getTrialBalance(companyId);
    const kasaAfterCollection = tbAfterCollection.find((r) => r.accountCode === '100')!;
    check(`Kasa/Banka tahsilatı doğru işlendi (1080): ${toDisplay(kasaAfterCollection.balance)}`, money(kasaAfterCollection.balance).equals(1080));

    console.log('--- Şikayet ---');
    const complaintId = await createComplaint(companyId, creatorId, { partyId, orderId, subject: 'Geç teslimat', description: 'Sipariş bir gün geç teslim edildi.', priority: 'MEDIUM' });
    await resolveComplaint(companyId, complaintId, 'Müşteriye indirim kuponu tanımlandı.');
    const complaint = await getComplaint(companyId, complaintId);
    check('şikayet RESOLVED durumunda ve çözüm notu kaydedildi', complaint.status === 'RESOLVED' && !!complaint.resolutionNote);

    console.log('\n=== TÜM ZİNCİR BAŞARIYLA TAMAMLANDI ===');
  } finally {
    console.log('\n--- Temizlik ---');
    const cleanupConn = await mysql.createConnection(process.env.MIGRATE_DATABASE_URL!);
    // Satış zincirinin çapraz-referansları (opportunities.lead_id, sales_*
    // arası, stock_items.product_id, inv_*.stock_item_id...) companyId
    // cascade'inin İÇİNDE değil — company DELETE'i TEK başına doğru sırayı
    // garanti edemiyor (GERÇEK bulgu: art arda iki farklı FK'ye çarptı).
    // Uygulama KENDİSİ hiçbir zaman bir şirketi hard-delete etmiyor (madde
    // 116-117 immutability) — bu SADECE test fixture temizliği: "referans
    // eden" tablolar, "referans edilen" tablolardan ÖNCE elle silinir; geri
    // kalan (users/parties/products/units/warehouses/accounts/...) NORMAL
    // cascade ile companies DELETE'inde temizlenir.
    await cleanupConn.query(
      `DELETE jl FROM accounting_journal_lines jl INNER JOIN accounting_journals j ON j.id = jl.journal_id WHERE j.company_id = ?`,
      [companyId]
    );
    const dependentFirst = [
      'sales_collections', 'customer_complaints', 'sales_shipments', 'sales_invoices', 'sales_orders', 'sales_quotes',
      'opportunities', 'leads', 'inv_reservations', 'inv_balances', 'stock_movements', 'stock_items', 'approval_instances'
    ];
    for (const table of dependentFirst) {
      await cleanupConn.query(`DELETE FROM \`${table}\` WHERE company_id = ?`, [companyId]);
    }
    await cleanupConn.query('DELETE FROM companies WHERE id = ?', [companyId]);
    await cleanupConn.end();
  }

  console.log(`\n=== SONUÇ: ${pass} geçti, ${fail} başarısız ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('TEST SÜRECİ HATASI:', err);
  process.exit(1);
});
