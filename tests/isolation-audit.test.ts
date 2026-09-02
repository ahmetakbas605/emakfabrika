import 'dotenv/config';
import mysql from 'mysql2/promise';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { companies, users, workOrderChecklistItems } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { createDepartment } from '../src/lib/departments';
import { createUnit } from '../src/lib/master-data/units';
import { createProduct } from '../src/lib/master-data/products';
import { createParty } from '../src/lib/master-data/parties';
import { createOrder, getOrder } from '../src/lib/sales/orders';
import { createInvoice, approveInvoice } from '../src/lib/sales/invoices';
import { SalesError } from '../src/lib/sales/errors';
import { beginMfaSetup, disableMfa } from '../src/lib/security/mfa';
import { SecurityError } from '../src/lib/security/errors';
import { createAsset } from '../src/lib/it/assets';
import { createBackupJob, recordBackupResult } from '../src/lib/it/backup';
import { ItError } from '../src/lib/it/errors';
import { createTicket } from '../src/lib/it/tickets';
import { createWorkOrder, attachChecklistToWorkOrder, addChecklistItem, toggleChecklistItem } from '../src/lib/it/field-service';
import { createDelegation } from '../src/lib/org';
import { CoreError } from '../src/lib/core/errors';

// 2026-09-02 — projenin "tekrar detaylıca incele" isteği üzerine yapılan
// geniş denetim, iki bağımsız modülde EAM/Fleet Faz 2026-08-29'daki (bkz.
// feedback_tenant_isolation_admin_fallback.md) İLE AYNI kalıpta 5 YENİ
// gerçek şirketler-arası izolasyon açığı buldu: bir mutation fonksiyonu
// client-taraflı bir id (userId/backupJobId/checklistItemId/orderLineId/
// delegateUserId) alıp, o id'nin ÇAĞIRANIN KENDİ şirketine ait olduğunu
// DOĞRULAMADAN işlem yapıyordu. Bu test paketi, HER BEŞİ için: (1) başka
// bir şirketin id'siyle çağrıldığında REDDEDİLDİĞİNİ, (2) kendi şirketinin
// id'siyle çağrıldığında NORMAL çalıştığını kanıtlar — gerçek MySQL'e
// karşı, mock YOK. npm run test:isolation-audit.
//
// Bu paket, security/it/org/sales gibi daha önce HİÇ persistent test'i
// olmayan modüllerin genel bir regresyon paketi DEĞİLDİR (o kapsam bu
// denetimin dışında bırakıldı, ayrı bir karar gerektirir) — yalnızca BU
// oturumda bulunup düzeltilen 5 spesifik açığı doğrular.

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
  const companyAId = newId();
  const companyBId = newId();
  const userA1Id = newId();
  const userA2Id = newId();
  const userB1Id = newId();

  await db.insert(companies).values([
    { id: companyAId, name: 'IZOLASYON TEST A A.Ş.', taxId: '9999999997', taxOffice: 'Test V.D.' },
    { id: companyBId, name: 'IZOLASYON TEST B A.Ş.', taxId: '9999999998', taxOffice: 'Test V.D.' }
  ]);
  await db.insert(users).values([
    { id: userA1Id, companyId: companyAId, fullName: 'A Kullanıcı 1', email: `a1-${Date.now()}@iso.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true },
    { id: userA2Id, companyId: companyAId, fullName: 'A Kullanıcı 2', email: `a2-${Date.now()}@iso.test`, passwordHash: hashPassword('x'), isFactoryAdmin: false },
    { id: userB1Id, companyId: companyBId, fullName: 'B Kullanıcı 1', email: `b1-${Date.now()}@iso.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true }
  ]);

  try {
    console.log('--- 1) MFA: beginMfaSetup / disableMfa şirket sınırı ---');
    let crossCompanyBegin = false;
    try {
      await beginMfaSetup(companyAId, userB1Id, 'b1@iso.test');
    } catch (err) {
      crossCompanyBegin = err instanceof SecurityError;
    }
    check('A şirketi B\'nin kullanıcısı için MFA kurulumu BAŞLATAMADI', crossCompanyBegin);

    const setupResult = await beginMfaSetup(companyAId, userA1Id, 'a1@iso.test');
    check('A şirketi KENDİ kullanıcısı için MFA kurulumu başlattı', !!setupResult.secret);

    let crossCompanyDisable = false;
    try {
      await disableMfa(companyAId, userB1Id);
    } catch (err) {
      crossCompanyDisable = err instanceof SecurityError;
    }
    check('A şirketi B\'nin kullanıcısının MFA\'sını SIFIRLAYAMADI (adminDisableMfaAction açığı)', crossCompanyDisable);

    await disableMfa(companyAId, userA1Id);
    check('A şirketi KENDİ kullanıcısının MFA\'sını sıfırlayabildi (regresyon yok)', true);

    console.log('--- 2) IT Yedekleme: recordBackupResult şirket sınırı ---');
    const assetBId = await createAsset(companyBId, { assetTag: 'B-PC-01', assetTypeCode: 'DESKTOP', name: 'B Bilgisayarı' }, userB1Id);
    const backupJobBId = await createBackupJob(companyBId, { assetId: assetBId, source: '/data', destination: 's3://b' });

    let crossCompanyBackup = false;
    try {
      await recordBackupResult(companyAId, userA1Id, { backupJobId: backupJobBId, startedAt: new Date(), finishedAt: new Date(), result: 'SUCCESS' });
    } catch (err) {
      crossCompanyBackup = err instanceof ItError;
    }
    check('A şirketi B\'nin yedekleme işine sonuç YAZAMADI', crossCompanyBackup);

    const assetAId = await createAsset(companyAId, { assetTag: 'A-PC-01', assetTypeCode: 'DESKTOP', name: 'A Bilgisayarı' }, userA1Id);
    const backupJobAId = await createBackupJob(companyAId, { assetId: assetAId, source: '/data', destination: 's3://a' });
    const backupResultId = await recordBackupResult(companyAId, userA1Id, { backupJobId: backupJobAId, startedAt: new Date(), finishedAt: new Date(), result: 'SUCCESS' });
    check('A şirketi KENDİ yedekleme işine sonuç yazabildi (regresyon yok)', !!backupResultId);

    console.log('--- 3) IT Saha Servisi: toggleChecklistItem şirket sınırı ---');
    const itDeptBId = await createDepartment(companyBId, { departmentTypeCode: 'IT', name: 'BT' });
    const ticketBId = await createTicket(companyBId, itDeptBId, { title: 'Saha servisi B', ticketType: 'FIELD_SERVICE', requestedByUserId: userB1Id });
    const workOrderBId = await createWorkOrder(companyBId, ticketBId);
    const checklistBId = await attachChecklistToWorkOrder(workOrderBId, null);
    await addChecklistItem(checklistBId, 'Kontrol 1', 0);
    const [checklistBItem] = await db.select({ id: workOrderChecklistItems.id }).from(workOrderChecklistItems).where(eq(workOrderChecklistItems.checklistId, checklistBId)).limit(1);
    check('B için checklist kalemi oluşturuldu (fixture)', !!checklistBItem);

    let crossCompanyChecklist = false;
    try {
      await toggleChecklistItem(companyAId, checklistBItem.id, true, userA1Id);
    } catch (err) {
      crossCompanyChecklist = err instanceof ItError;
    }
    check('A şirketi B\'nin checklist kalemini İŞARETLEYEMEDİ', crossCompanyChecklist);

    const itDeptAId = await createDepartment(companyAId, { departmentTypeCode: 'IT', name: 'BT' });
    const ticketAId = await createTicket(companyAId, itDeptAId, { title: 'Saha servisi A', ticketType: 'FIELD_SERVICE', requestedByUserId: userA1Id });
    const workOrderAId = await createWorkOrder(companyAId, ticketAId);
    const checklistAId = await attachChecklistToWorkOrder(workOrderAId, null);
    await addChecklistItem(checklistAId, 'Kontrol 1', 0);
    const [checklistAItem] = await db.select({ id: workOrderChecklistItems.id }).from(workOrderChecklistItems).where(eq(workOrderChecklistItems.checklistId, checklistAId)).limit(1);
    await toggleChecklistItem(companyAId, checklistAItem.id, true, userA1Id);
    check('A şirketi KENDİ checklist kalemini işaretleyebildi (regresyon yok)', true);

    console.log('--- 4) Satış Faturası: createInvoice/approveInvoice şirket sınırı ---');
    const unitBId = await createUnit(companyBId, { code: 'ADET', name: 'Adet' });
    const productBId = await createProduct(companyBId, userB1Id, { sku: 'B-001', name: 'B Ürünü', baseUnitId: unitBId });
    const customerBId = await createParty(companyBId, userB1Id, { legalName: 'B Müşteri', roles: ['CUSTOMER'] });
    const orderBId = await createOrder(companyBId, userB1Id, { partyId: customerBId, orderDate: '2026-08-01', currencyCode: 'TRY', lines: [{ productId: productBId, quantity: 10, unitPrice: 100 }] });
    const { lines: orderBLines } = await getOrder(companyBId, orderBId);

    const unitAId = await createUnit(companyAId, { code: 'ADET', name: 'Adet' });
    const productAId = await createProduct(companyAId, userA1Id, { sku: 'A-001', name: 'A Ürünü', baseUnitId: unitAId });
    const customerAId = await createParty(companyAId, userA1Id, { legalName: 'A Müşteri', roles: ['CUSTOMER'] });

    let crossCompanyInvoice = false;
    try {
      await createInvoice(companyAId, userA1Id, { partyId: customerAId, invoiceDate: '2026-08-02', currencyCode: 'TRY', lines: [{ orderLineId: orderBLines[0].id, productId: productAId, quantity: 1, unitPrice: 100 }] });
    } catch (err) {
      crossCompanyInvoice = err instanceof SalesError;
    }
    check('A şirketi B\'nin sipariş kalemine referansla fatura KESEMEDİ', crossCompanyInvoice);

    const orderAId = await createOrder(companyAId, userA1Id, { partyId: customerAId, orderDate: '2026-08-01', currencyCode: 'TRY', lines: [{ productId: productAId, quantity: 10, unitPrice: 100 }] });
    const { lines: orderALines } = await getOrder(companyAId, orderAId);
    const invoiceAId = await createInvoice(companyAId, userA1Id, { orderId: orderAId, partyId: customerAId, invoiceDate: '2026-08-02', currencyCode: 'TRY', lines: [{ orderLineId: orderALines[0].id, productId: productAId, quantity: 5, unitPrice: 100 }] });
    check('A şirketi KENDİ sipariş kalemine referansla fatura kesebildi (regresyon yok)', !!invoiceAId);

    await approveInvoice(companyAId, invoiceAId, userA1Id);
    const { lines: orderALinesAfter } = await getOrder(companyAId, orderAId);
    check(`fatura onaylanınca sipariş kaleminin invoicedQuantity'si doğru arttı (5): ${orderALinesAfter[0].invoicedQuantity}`, Number(orderALinesAfter[0].invoicedQuantity) === 5);

    console.log('--- 5) Vekalet: createDelegation şirket sınırı ---');
    let crossCompanyDelegation = false;
    try {
      await createDelegation(companyAId, { delegatorUserId: userA1Id, delegateUserId: userB1Id, startsAt: new Date('2026-09-01'), endsAt: new Date('2026-09-10') });
    } catch (err) {
      crossCompanyDelegation = err instanceof CoreError;
    }
    check('A şirketi B\'nin kullanıcısına vekalet OLUŞTURAMADI', crossCompanyDelegation);

    const delegationId = await createDelegation(companyAId, { delegatorUserId: userA1Id, delegateUserId: userA2Id, startsAt: new Date('2026-09-01'), endsAt: new Date('2026-09-10') });
    check('A şirketi KENDİ kullanıcısına vekalet oluşturabildi (regresyon yok)', !!delegationId);

    console.log('\n=== TÜM ZİNCİR BAŞARIYLA TAMAMLANDI ===');
  } finally {
    console.log('\n--- Temizlik ---');
    const cleanupConn = await mysql.createConnection(process.env.MIGRATE_DATABASE_URL!);
    // sales_invoice_lines/sales_order_lines/wo_checklist_items/wo_checklists/
    // work_orders/backup_results HİÇBİRİNİN kendi company_id kolonu YOK —
    // hepsi üst tablo (invoice/order/ticket/backup_job) silinince CASCADE
    // ile gider (Faz 5/8'in AYNI cleanup dersi). Sıra ÖNEMLİ: FK'sı cascade
    // OLMAYAN referanslar (sales_invoice_lines.orderLineId → sales_order_
    // lines, backup_jobs.assetId → it_assets) yüzünden çocuk tablolar
    // ebeveynden ÖNCE silinmeli.
    const dependentFirstBoth = [
      'approval_delegations',
      'sales_invoices', 'sales_orders', 'parties', 'products', 'units',
      'service_desk_tickets', 'departments',
      'backup_jobs', 'it_assets'
    ];
    for (const table of dependentFirstBoth) {
      await cleanupConn.query(`DELETE FROM \`${table}\` WHERE company_id IN (?, ?)`, [companyAId, companyBId]);
    }
    await cleanupConn.query('DELETE FROM users WHERE company_id IN (?, ?)', [companyAId, companyBId]);
    await cleanupConn.query('DELETE FROM companies WHERE id IN (?, ?)', [companyAId, companyBId]);
    await cleanupConn.end();
  }

  console.log(`\n=== SONUÇ: ${pass} geçti, ${fail} başarısız ===`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('TEST SÜRECİ HATASI:', err);
  process.exit(1);
});
