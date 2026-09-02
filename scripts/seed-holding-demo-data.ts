import 'dotenv/config';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { parties } from '../src/db/schema';
import { createAccount, openPeriod, postJournal } from '../src/lib/accounting';
import { createBankAccount, recordBankTransaction } from '../src/lib/bank';
import { createUnit } from '../src/lib/master-data/units';
import { createProduct } from '../src/lib/master-data/products';
import { createParty } from '../src/lib/master-data/parties';
import { createOrder } from '../src/lib/sales/orders';
import { createComplaint } from '../src/lib/sales/complaints';
import { createVehicle } from '../src/lib/fleet/vehicles';
import { createContract as createLegalContract, updateContractStatus } from '../src/lib/legal/contracts';
import { createRisk } from '../src/lib/legal/risks';
import { createLawsuit } from '../src/lib/legal/lawsuits';
import { createCollateral } from '../src/lib/legal/collaterals';
import { createEnvPermit } from '../src/lib/environment/permits';
import { createIncident } from '../src/lib/safety/incidents';
import { createEmployeeQualification } from '../src/lib/hr/qualifications';
import { createNcr } from '../src/lib/quality/ncr';
import { createEamAsset } from '../src/lib/eam/assets';
import { createCashFlowItem } from '../src/lib/treasury/cashflow';
import { createSoftwareProduct, createLicense, createContract as createItContract } from '../src/lib/it/licensing';

// Faz 12 (BI) sonrası — kullanıcının "deneme verisi girip link/bilgi ver"
// talebi için tek seferlik bir script. seed-demo-company.ts (Core
// Security fazından) yalnızca şirket/departman/kullanıcı/organizasyon
// kuruyordu — Sales/Fleet/Legal/Environment/Safety/Quality/EAM/Treasury/
// IT/BI'ın GÖRÜNÜR olması için o şirkete GERÇEK iş verisi eksikti (tüm
// sayılar sıfırdı). Bu script AYNI "Deneme Ahmet A.Ş." şirketine, ZATEN
// var olan kullanıcı/çalışan kayıtlarını yeniden kullanarak (§150) az
// sayıda ama ÇEŞİTLİ iş kaydı ekler — BI dashboard'unun (Alert Center +
// Expiration Engine + CEO/Fabrika Müdürü/CFO özetleri) tamamen boş
// görünmemesi için. İdempotent: parties tablosu zaten doluysa (script
// daha önce çalıştırıldıysa) hiçbir şey yapmadan çıkar.
const COMPANY_ID = '4cb19554-c8e9-4ea1-a1e0-f2d061af7625'; // Deneme Ahmet A.Ş.
const ADMIN_USER_ID = '6e73bf6a-3a3d-4916-9213-5742986c040d'; // admin@denemeahmet.local
const EMPLOYEE_ID = '7f843883-8efa-4563-a9a9-4c0ac46821e5'; // Ahmet Korkmaz (zaten var)

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function main() {
  const existing = await db.select({ id: parties.id }).from(parties).where(eq(parties.companyId, COMPANY_ID)).limit(1);
  if (existing.length > 0) {
    console.log('Deneme Ahmet A.Ş. zaten iş verisiyle dolu — script tekrar çalıştırılmadı (idempotent).');
    return;
  }

  console.log('--- Muhasebe: hesap planı + dönem + banka ---');
  const kasaId = await createAccount(COMPANY_ID, { code: '100', name: 'Kasa', normalBalance: 'DEBIT', accountType: 'ASSET' });
  const bankaAccountId = await createAccount(COMPANY_ID, { code: '102', name: 'Banka', normalBalance: 'DEBIT', accountType: 'ASSET' });
  await createAccount(COMPANY_ID, { code: '120', name: 'Alıcılar', normalBalance: 'DEBIT', accountType: 'ASSET' });
  await createAccount(COMPANY_ID, { code: '320', name: 'Satıcılar', normalBalance: 'CREDIT', accountType: 'LIABILITY' });
  await createAccount(COMPANY_ID, { code: '500', name: 'Satış Gelirleri', normalBalance: 'CREDIT', accountType: 'REVENUE' });
  await createAccount(COMPANY_ID, { code: '600', name: 'Genel Yönetim Giderleri', normalBalance: 'DEBIT', accountType: 'EXPENSE' });
  void kasaId;

  await openPeriod(COMPANY_ID, '2026-01-01', '2026-12-31');

  await postJournal({
    companyId: COMPANY_ID, journalDate: '2026-08-15', documentType: 'MANUAL', description: 'Demo: alıcıya vadeli satış',
    createdByUserId: ADMIN_USER_ID, lines: [{ accountCode: '120', debit: 75000 }, { accountCode: '500', credit: 75000 }]
  });
  await postJournal({
    companyId: COMPANY_ID, journalDate: '2026-08-20', documentType: 'MANUAL', description: 'Demo: genel yönetim gideri',
    createdByUserId: ADMIN_USER_ID, lines: [{ accountCode: '600', debit: 18000 }, { accountCode: '320', credit: 18000 }]
  });

  const bankAccountId = await createBankAccount(COMPANY_ID, { name: 'Ana Banka Hesabı (TRY)', accountingAccountId: bankaAccountId, currency: 'TRY' });
  await recordBankTransaction({
    companyId: COMPANY_ID, bankAccountId, transactionType: 'IN', method: 'HAVALE', amount: 250000,
    counterAccountCode: '120', description: 'Demo: sermaye + tahsilat girişi', transactionDate: '2026-08-05', createdByUserId: ADMIN_USER_ID
  });

  console.log('--- Master Data + Satış: cari/ürün/sipariş/şikayet ---');
  const unitId = await createUnit(COMPANY_ID, { code: 'ADET', name: 'Adet' });
  const productId = await createProduct(COMPANY_ID, ADMIN_USER_ID, { sku: 'URN-001', name: 'Endüstriyel Vana', baseUnitId: unitId, productType: 'STOCK_ITEM' });
  const customerId = await createParty(COMPANY_ID, ADMIN_USER_ID, { legalName: 'Anadolu Sanayi A.Ş.', roles: ['CUSTOMER'] });
  const supplierId = await createParty(COMPANY_ID, ADMIN_USER_ID, { legalName: 'Marmara Metal Ltd. Şti.', roles: ['SUPPLIER'] });
  void supplierId;
  await createOrder(COMPANY_ID, ADMIN_USER_ID, { partyId: customerId, orderDate: '2026-08-25', currencyCode: 'TRY', lines: [{ productId, quantity: 50, unitPrice: 1500 }] });
  await createComplaint(COMPANY_ID, ADMIN_USER_ID, { partyId: customerId, subject: 'Geç Teslimat', description: 'Sipariş 2 hafta geç teslim edildi.', priority: 'HIGH' });

  console.log('--- Filo + BT: sona erecek belgeler ---');
  await createVehicle(COMPANY_ID, { plateNo: '34 DMO 01', brand: 'Ford', model: 'Transit', registrationExpiryDate: daysFromNow(12) });
  const softwareProductId = await createSoftwareProduct(COMPANY_ID, { name: 'ERP Lisansı' });
  await createLicense(COMPANY_ID, { productId: softwareProductId, seats: 25, expiresAt: daysFromNow(20) });
  await createItContract(COMPANY_ID, { title: 'Sunucu Bakım Sözleşmesi', contractType: 'MAINTENANCE', startDate: '2026-01-01', endDate: daysFromNow(18) });

  console.log('--- Hukuk: sözleşme/dava/risk/teminat ---');
  const contractId = await createLegalContract(COMPANY_ID, ADMIN_USER_ID, { title: 'Depo Kira Sözleşmesi', contractType: 'LEASE', counterpartyPartyId: supplierId, startDate: '2026-01-01', endDate: daysFromNow(25) });
  await updateContractStatus(COMPANY_ID, contractId, 'ACTIVE');
  await createLawsuit(COMPANY_ID, ADMIN_USER_ID, { title: 'Tedarikçi Sözleşme Uyuşmazlığı', companyRole: 'DEFENDANT', counterpartyPartyId: supplierId, claimAmount: 45000, currencyCode: 'TRY' });
  await createRisk(COMPANY_ID, ADMIN_USER_ID, { title: 'Tek Tedarikçiye Bağımlılık', category: 'OPERATIONAL', probability: 4, impact: 4 });
  await createCollateral(COMPANY_ID, ADMIN_USER_ID, { contractId, collateralType: 'LETTER_OF_GUARANTEE', amount: 30000, provider: 'Ziraat Bankası', expiryDate: daysFromNow(300) });

  console.log('--- Çevre + İSG + Kalite + EAM ---');
  await createEnvPermit(COMPANY_ID, ADMIN_USER_ID, { permitType: 'EMISSION', issuingAuthority: 'Çevre ve Şehircilik Bakanlığı', issueDate: '2026-01-01', expiryDate: daysFromNow(28) });
  await createIncident(COMPANY_ID, ADMIN_USER_ID, { incidentType: 'NEAR_MISS', severity: 'MODERATE', incidentDate: '2026-08-22', employeeId: EMPLOYEE_ID, location: 'Depo', description: 'Forklift ramp yakınında ramak kala olay.' });
  await createEmployeeQualification(COMPANY_ID, EMPLOYEE_ID, { qualificationType: 'CERTIFICATE', name: 'İş Güvenliği Uzmanlığı Sertifikası', expiryDate: daysFromNow(6) });
  await createNcr(COMPANY_ID, ADMIN_USER_ID, { title: 'Vana Ölçü Sapması', description: 'Gelen partide 3 adet vana tolerans dışı ölçüldü.', severity: 'MAJOR' });
  await createEamAsset(COMPANY_ID, { assetTypeCode: 'COMPRESSOR', code: 'EAM-001', name: 'Ana Hat Kompresörü', manufacturer: 'Atlas Copco' });

  console.log('--- Hazine ---');
  await createCashFlowItem(COMPANY_ID, ADMIN_USER_ID, { direction: 'INFLOW', description: 'Beklenen müşteri tahsilatı', amount: 75000, currencyCode: 'TRY', expectedDate: daysFromNow(20) });
  await createCashFlowItem(COMPANY_ID, ADMIN_USER_ID, { direction: 'OUTFLOW', description: 'Beklenen tedarikçi ödemesi', amount: 18000, currencyCode: 'TRY', expectedDate: daysFromNow(15) });

  console.log('\n=== Deneme verisi başarıyla eklendi (Deneme Ahmet A.Ş.) ===');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('SEED HATASI:', err);
    process.exit(1);
  });
