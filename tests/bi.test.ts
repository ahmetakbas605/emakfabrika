import 'dotenv/config';
import mysql from 'mysql2/promise';
import { db } from '../src/db/client';
import { companies, users } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { createEmployee } from '../src/lib/hr/employees';
import { createEmployeeQualification } from '../src/lib/hr/qualifications';
import { createParty } from '../src/lib/master-data/parties';
import { createVehicle } from '../src/lib/fleet/vehicles';
import { createContract as createLegalContract, updateContractStatus } from '../src/lib/legal/contracts';
import { createLawsuit } from '../src/lib/legal/lawsuits';
import { createRisk } from '../src/lib/legal/risks';
import { createEnvPermit } from '../src/lib/environment/permits';
import { createIncident } from '../src/lib/safety/incidents';
import { createNcr } from '../src/lib/quality/ncr';
import { createComplaint } from '../src/lib/sales/complaints';
import { createSoftwareProduct, createLicense, createContract as createItContract } from '../src/lib/it/licensing';
import { getExpirationAlerts } from '../src/lib/bi/expiration';
import { getAlertCenterItems } from '../src/lib/bi/alerts';
import { getExecutiveSummary, getFactoryManagerSummary, getCfoSummary } from '../src/lib/bi/dashboard';

// Holding ERP Faz 12 (BI + Holding/CEO Dashboard) — diğer kalıcı test
// paketleriyle AYNI disiplin: gerçek MySQL'e karşı, mock YOK.
// npm run test:bi. Odak: (1) Expiration Engine'in 5 modülün (Fleet/Legal/
// Environment/HR/IT) sona-erme kayıtlarını TEK bir pencerede DOĞRU
// birleştirdiği + withinDays sınırının TÜM kaynaklarda (IT'nin sabit
// EXPIRING_SOON_DAYS'ine RAĞMEN) tutarlı çalıştığı, (2) Alert Center'ın
// severity sınıflandırmasının (severity/priority eşiği + skor eşiği +
// yakın-sona-erme dahil etme) doğru olduğu, (3) üç rol-bazlı özet
// fonksiyonunun (CEO/Fabrika Müdürü/CFO) atmadığı ve Alert Center'la
// TUTARLI sayılar döndürdüğü — bu üçü salt COUNT/GROUP BY toplamaları
// olduğundan (it/dashboard.ts'in getItDashboardSummary'sinin KENDİSİ hiç
// ayrı test edilmedi) kapsam bilinçli olarak hafif tutuldu.

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

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

async function main() {
  const companyId = newId();
  const userId = newId();

  await db.insert(companies).values({ id: companyId, name: 'BI TEST A.Ş.', taxId: '9999999995', taxOffice: 'Test V.D.' });
  await db.insert(users).values([{ id: userId, companyId, fullName: 'Test Kullanıcısı', email: `test-${Date.now()}-bi@bi.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true }]);

  try {
    console.log('--- Fixture kurulumu (5 modülden sona-erme + 5 modülden açık uyarı kaynağı) ---');
    const employeeId = await createEmployee(companyId, { firstName: 'Test', lastName: 'Çalışan', hireDate: '2026-01-01' });
    const partyId = await createParty(companyId, userId, { legalName: 'Test Müşteri A.Ş.', roles: ['CUSTOMER'] });

    // FLEET — biri 10 gün içinde (yakalanmalı), biri 200 gün sonra (30-gün penceresinde YAKALANMAMALI).
    await createVehicle(companyId, { plateNo: 'BI-SOON', registrationExpiryDate: daysFromNow(10) });
    await createVehicle(companyId, { plateNo: 'BI-FAR', registrationExpiryDate: daysFromNow(200) });

    // LEGAL — sözleşme 15 gün içinde. listExpiringContracts YALNIZCA ACTIVE
    // sözleşmeleri sayar (schema.ts varsayılanı DRAFT'tır), bu yüzden elle
    // aktive edilmesi gerekiyor.
    const legalContractId = await createLegalContract(companyId, userId, { title: 'Kira Sözleşmesi', contractType: 'LEASE', startDate: '2026-01-01', endDate: daysFromNow(15) });
    await updateContractStatus(companyId, legalContractId, 'ACTIVE');

    // ENVIRONMENT — izin 20 gün içinde.
    await createEnvPermit(companyId, userId, { permitType: 'EMISSION', issueDate: '2026-01-01', expiryDate: daysFromNow(20) });

    // HR — nitelik 5 gün içinde (AYNI ZAMANDA Alert Center'ın "7 gün içinde
    // sona erme" dahil etme kuralını da test eder — iki fonksiyon TEK
    // fixture ile test edilir, tekrar kurulum YOK).
    await createEmployeeQualification(companyId, employeeId, { qualificationType: 'CERTIFICATE', name: 'İSG Sertifikası', expiryDate: daysFromNow(5) });

    // IT — lisans 25 gün içinde, sözleşme 28 gün içinde (IT'nin KENDİ sabit
    // EXPIRING_SOON_DAYS=30 sabitine göre DEĞİL, BI katmanının withinDays
    // parametresine göre süzüldüğünü kanıtlar).
    const productId = await createSoftwareProduct(companyId, { name: 'Test Yazılım' });
    await createLicense(companyId, { productId, expiresAt: daysFromNow(25) });
    await createItContract(companyId, { title: 'BT Bakım Sözleşmesi', contractType: 'MAINTENANCE', startDate: '2026-01-01', endDate: daysFromNow(28) });

    console.log('--- Expiration Engine ---');
    const within30 = await getExpirationAlerts(companyId, 30);
    check(`30-gün penceresi TAM OLARAK 6 kayıt yakaladı (uzak araç HARİÇ): ${within30.length}`, within30.length === 6);
    check('modüller doğru temsil edildi (FLEET/LEGAL/ENVIRONMENT/HR/IT)', new Set(within30.map((a) => a.module)).size === 5);
    check('sonuç son tarihe göre ARTAN sıralı', within30.every((a, i) => i === 0 || within30[i - 1].expiryDate <= a.expiryDate));
    check('uzak (200 gün) araç belgesi 30-gün penceresine DAHİL EDİLMEDİ', !within30.some((a) => a.label.includes('BI-FAR')));

    const within7 = await getExpirationAlerts(companyId, 7);
    check(`7-gün penceresi YALNIZCA İK sertifikasını yakaladı (1): ${within7.length}`, within7.length === 1 && within7[0].module === 'HR');

    console.log('--- Alert Center (severity sınıflandırması) ---');
    const safetyIncidentId1 = await createIncident(companyId, userId, { incidentType: 'ACCIDENT', severity: 'SEVERE', incidentDate: '2026-02-01', employeeId, description: 'Ağır yaralanma.' });
    const ncrCriticalId = await createNcr(companyId, userId, { title: 'Kritik Uygunsuzluk', description: 'Ölçüm dışı parti.', severity: 'MAJOR' });
    const ncrMinorId = await createNcr(companyId, userId, { title: 'Küçük Uygunsuzluk', description: 'Kozmetik hata.', severity: 'MINOR' });
    await createComplaint(companyId, userId, { partyId, subject: 'Geç Teslimat', description: 'Sipariş 2 hafta geç geldi.', priority: 'HIGH' });
    await createLawsuit(companyId, userId, { title: 'Tedarik Uyuşmazlığı', companyRole: 'DEFENDANT' });
    await createRisk(companyId, userId, { title: 'Tedarik Zinciri Riski', category: 'OPERATIONAL', probability: 5, impact: 3 }); // score=15, eşik TAM sınırda

    const alertItems = await getAlertCenterItems(companyId);
    check(`Alert Center TAM OLARAK 7 öğe döndürdü (6 açık kayıt — MINOR NCR DAHİL, çıkarılmaz sadece düşük önemli sayılır — + 1 yakın-sona-erme): ${alertItems.length}`, alertItems.length === 7);
    check('HIGH sayısı 5 (safety+ncr-major+complaint+risk+yakın-sona-erme)', alertItems.filter((a) => a.severity === 'HIGH').length === 5);
    check('MEDIUM sayısı 2 (ncr-minor+dava)', alertItems.filter((a) => a.severity === 'MEDIUM').length === 2);
    check('MINOR NCR listeye GİRDİ ama MEDIUM olarak (açık her NCR listelenir, yalnızca önem derecesi severity\'e göre ayrışır)', alertItems.some((a) => a.id === ncrMinorId && a.severity === 'MEDIUM'));
    check('MAJOR NCR doğru şekilde HIGH', alertItems.some((a) => a.id === ncrCriticalId && a.severity === 'HIGH'));
    check('yakın-sona-eren İK sertifikası Alert Center\'da HIGH olarak göründü', alertItems.some((a) => a.itemType === 'EXPIRING_CERTIFICATE' && a.severity === 'HIGH'));

    console.log('--- Rol-bazlı özetler (CEO / Fabrika Müdürü / CFO) — atmadan doğru sayım ---');
    const executive = await getExecutiveSummary(companyId);
    check(`CEO özeti: açık İSG olayı sayısı doğru (1): ${executive.openSafetyIncidentsCount}`, executive.openSafetyIncidentsCount === 1);
    check(`CEO özeti: açık NCR sayısı doğru (2 — MAJOR+MINOR, ikisi de açık): ${executive.openNcrCount}`, executive.openNcrCount === 2);
    check(`CEO özeti: 30-gün sona erecek sayısı Expiration Engine ile TUTARLI (6): ${executive.expiringSoonCount}`, executive.expiringSoonCount === 6);
    check(`CEO özeti: yüksek öncelikli uyarı sayısı Alert Center ile TUTARLI (5): ${executive.highAlertCount}`, executive.highAlertCount === 5);
    check('CEO özeti: finansal alanlar sayısal string olarak döndü', typeof executive.totalRevenue === 'string' && !Number.isNaN(Number(executive.totalRevenue)));

    const factory = await getFactoryManagerSummary(companyId);
    check(`Fabrika Müdürü özeti: açık İSG olayı doğru (1): ${factory.openSafetyIncidentsCount}`, factory.openSafetyIncidentsCount === 1);
    check(`Fabrika Müdürü özeti: açık NCR doğru (2): ${factory.openNcrCount}`, factory.openNcrCount === 2);
    check(`Fabrika Müdürü özeti: sona erecek araç belgesi doğru (1 — yalnızca BI-SOON): ${factory.expiringVehicleDocsCount}`, factory.expiringVehicleDocsCount === 1);
    check('Fabrika Müdürü özeti: üretim emri/EAM dağılımları dizi olarak döndü', Array.isArray(factory.productionOrdersByStatus) && Array.isArray(factory.eamAssetsByStatus));

    const cfo = await getCfoSummary(companyId);
    check('CFO özeti: hesap planı boş şirkette bile atmadan 0.00 döndü', cfo.totalAssets === '0.00' && cfo.netIncome === '0.00');
    check('CFO özeti: 30-gün nakit tahmini sayısal alanlarla döndü', typeof cfo.cashFlow30Day.projectedEndingCash === 'number');
    check('CFO özeti: yabancı para hesabı yok, fxExposure boş dizi', Array.isArray(cfo.fxExposure) && cfo.fxExposure.length === 0);

    console.log('\n=== TÜM ZİNCİR BAŞARIYLA TAMAMLANDI ===');
  } finally {
    console.log('\n--- Temizlik ---');
    const cleanupConn = await mysql.createConnection(process.env.MIGRATE_DATABASE_URL!);
    const dependentFirst = [
      'sw_licenses', 'sw_products', 'contracts',
      'risk_register_entries', 'legal_lawsuits', 'legal_contracts',
      'customer_complaints', 'ncr_records', 'safety_incidents',
      'env_permits', 'employee_qualifications', 'employees',
      'vehicles', 'parties'
    ];
    for (const table of dependentFirst) {
      await cleanupConn.query(`DELETE FROM \`${table}\` WHERE company_id = ?`, [companyId]);
    }
    await cleanupConn.query('DELETE FROM users WHERE company_id = ?', [companyId]);
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
