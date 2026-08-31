import 'dotenv/config';
import mysql from 'mysql2/promise';
import { db } from '../src/db/client';
import { companies, users } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { createEmployee } from '../src/lib/hr/employees';
import { createEnvPermit, listEnvPermits, listExpiringEnvPermits } from '../src/lib/environment/permits';
import { recordEmission, recordWaste, getEnvironmentalSummary } from '../src/lib/environment/records';
import { EnvironmentError } from '../src/lib/environment/errors';
import { createIncident, listIncidents, startIncidentInvestigation, closeIncident } from '../src/lib/safety/incidents';
import { SafetyError } from '../src/lib/safety/errors';
import { createProject } from '../src/lib/projects/projects';
import { createPrototype, listPrototypes, updatePrototypeStatus } from '../src/lib/rnd/prototypes';
import { createLabTest, listLabTests, updateLabTestStatus } from '../src/lib/rnd/labtests';
import { RndError } from '../src/lib/rnd/errors';

// Holding ERP Faz 10 (Çevre/İSG HR-dışı + Ar-Ge) — Diğer kalıcı test
// paketleriyle AYNI disiplin: gerçek MySQL'e karşı, mock YOK. npm run
// test:environment. Üç alt-alanı TEK dosyada test ediyor (Faz 6'nın EAM+
// Enerji'yi, Faz 9'un sözleşme+dava+teminat+risk'i TEK dosyada test etmesi
// İLE AYNI desen) — odak: (1) dönem özetinin yalnızca aralık-içi kayıtları
// topladığı, (2) Ar-Ge prototipinin Faz 8'in ZATEN var olan projects
// tablosuna doğru bağlandığı, (3) sonuçlanmış kayıtların değişmezliği.

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
  const userId = newId();

  await db.insert(companies).values({ id: companyId, name: 'ENV SAFETY RND TEST A.Ş.', taxId: '9999999994', taxOffice: 'Test V.D.' });
  await db.insert(users).values([{ id: userId, companyId, fullName: 'Test Kullanıcısı', email: `test-${Date.now()}-esr@esr.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true }]);

  try {
    console.log('--- Çevre: İzin (geçersiz tarih reddi + sona-erme raporu) ---');
    let invalidPermitDateRejected = false;
    try {
      await createEnvPermit(companyId, userId, { permitType: 'EMISSION', issueDate: '2026-06-01', expiryDate: '2026-01-01' });
    } catch (err) {
      invalidPermitDateRejected = err instanceof EnvironmentError;
    }
    check('son geçerlilik düzenlemeden önce olan izin reddedildi', invalidPermitDateRejected);

    const soonExpiry = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await createEnvPermit(companyId, userId, { permitType: 'EMISSION', issuingAuthority: 'Çevre Bakanlığı', issueDate: '2026-01-01', expiryDate: soonExpiry });
    const farExpiry = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    await createEnvPermit(companyId, userId, { permitType: 'WASTE', issueDate: '2026-01-01', expiryDate: farExpiry });

    const permits = await listEnvPermits(companyId);
    check('2 izin listelendi', permits.length === 2);
    const expiring = await listExpiringEnvPermits(companyId, 30);
    check(`sona-erme raporu YALNIZCA 30-gün-içindeki izni yakaladı (1, uzak tarihli HARİÇ): ${expiring.length}`, expiring.length === 1);

    console.log('--- Çevre: Emisyon/Atık kayıtları + dönem özeti (aralık-dışı kayıt hariç tutulur) ---');
    await recordEmission(companyId, userId, { recordDate: '2026-02-05', emissionType: 'CO2', quantity: 100, unit: 'ton' });
    await recordEmission(companyId, userId, { recordDate: '2026-02-20', emissionType: 'CO2', quantity: 50, unit: 'ton' });
    await recordEmission(companyId, userId, { recordDate: '2026-02-10', emissionType: 'NOX', quantity: 20, unit: 'kg' });
    await recordEmission(companyId, userId, { recordDate: '2026-04-01', emissionType: 'CO2', quantity: 999, unit: 'ton' }); // aralık DIŞI

    await recordWaste(companyId, userId, { recordDate: '2026-02-05', wasteType: 'HAZARDOUS', quantity: 30, unit: 'kg', disposalMethod: 'INCINERATION' });
    await recordWaste(companyId, userId, { recordDate: '2026-02-15', wasteType: 'RECYCLABLE', quantity: 10, unit: 'kg', disposalMethod: 'RECYCLING' });
    await recordWaste(companyId, userId, { recordDate: '2026-04-01', wasteType: 'HAZARDOUS', quantity: 999, unit: 'kg', disposalMethod: 'LANDFILL' }); // aralık DIŞI

    const summary = await getEnvironmentalSummary(companyId, '2026-02-01', '2026-02-28');
    check(`emisyon TİPE göre doğru toplandı (CO2=100+50=150, Nisan HARİÇ): ${summary.emissionByType.CO2}`, summary.emissionByType.CO2 === 150);
    check(`NOX doğru (20): ${summary.emissionByType.NOX}`, summary.emissionByType.NOX === 20);
    check('Nisan\'daki CO2 kaydı özete DAHİL EDİLMEDİ (yalnızca 2 tip var)', Object.keys(summary.emissionByType).length === 2);
    check(`atık TİPE göre doğru toplandı (HAZARDOUS=30, Nisan HARİÇ): ${summary.wasteByType.HAZARDOUS}`, summary.wasteByType.HAZARDOUS === 30);
    check(`RECYCLABLE doğru (10): ${summary.wasteByType.RECYCLABLE}`, summary.wasteByType.RECYCLABLE === 10);

    console.log('--- İSG: Olay/Kaza kaydı (çalışana opsiyonel bağlantı + sırasız geçiş reddi) ---');
    const employeeId = await createEmployee(companyId, { firstName: 'Test', lastName: 'Çalışan', hireDate: '2026-01-01' });

    let missingEmployeeRejected = false;
    try {
      await createIncident(companyId, userId, { incidentType: 'ACCIDENT', incidentDate: '2026-02-01', employeeId: newId(), description: 'Olmayan çalışan' });
    } catch (err) {
      missingEmployeeRejected = err instanceof SafetyError;
    }
    check('olmayan bir çalışanla olay kaydı oluşturulamadı', missingEmployeeRejected);

    const incidentId = await createIncident(companyId, userId, { incidentType: 'ACCIDENT', severity: 'MODERATE', incidentDate: '2026-02-15', location: 'Üretim Hattı 1', employeeId, description: 'Elle taşıma sırasında hafif yaralanma.' });

    let closeBeforeInvestigateRejected = false;
    try {
      await closeIncident(companyId, incidentId, { rootCause: 'x', correctiveAction: 'y' });
    } catch (err) {
      closeBeforeInvestigateRejected = err instanceof SafetyError;
    }
    check('OPEN aşamasında (soruşturma başlamadan) kapatma reddedildi', closeBeforeInvestigateRejected);

    await startIncidentInvestigation(companyId, incidentId);
    let doubleStartRejected = false;
    try {
      await startIncidentInvestigation(companyId, incidentId);
    } catch (err) {
      doubleStartRejected = err instanceof SafetyError;
    }
    check('zaten soruşturulan bir olay tekrar başlatılamadı', doubleStartRejected);

    await closeIncident(companyId, incidentId, { rootCause: 'Uygun olmayan kaldırma tekniği.', correctiveAction: 'Ergonomi eğitimi planlandı.' });
    const incidents = await listIncidents(companyId);
    check('olay listelendi, çalışan adı doğru geldi ve durum CLOSED', incidents.length === 1 && incidents[0].employeeName === 'Test' && incidents[0].status === 'CLOSED');

    console.log('--- Ar-Ge: Prototip (Faz 8\'in projects\'ine bağlanır) + Laboratuvar Testi ---');
    const projectId = await createProject(companyId, userId, { code: 'RND-001', name: 'Yeni Nesil Ürün Ar-Ge Projesi' });

    let missingProjectRejected = false;
    try {
      await createPrototype(companyId, userId, { projectId: newId(), name: 'Olmayan Proje Prototipi' });
    } catch (err) {
      missingProjectRejected = err instanceof RndError;
    }
    check('olmayan bir projeyle prototip oluşturulamadı', missingProjectRejected);

    const prototypeId = await createPrototype(companyId, userId, { projectId, name: 'Prototip A', description: 'İlk tasarım denemesi' });
    const prototypes = await listPrototypes(companyId);
    check('prototip Faz 8\'in projesine DOĞRU bağlandı', prototypes.length === 1 && prototypes[0].projectName === 'Yeni Nesil Ürün Ar-Ge Projesi');

    await updatePrototypeStatus(companyId, prototypeId, 'BUILDING');
    await updatePrototypeStatus(companyId, prototypeId, 'APPROVED');
    let terminalPrototypeChangeRejected = false;
    try {
      await updatePrototypeStatus(companyId, prototypeId, 'TESTING');
    } catch (err) {
      terminalPrototypeChangeRejected = err instanceof RndError;
    }
    check('onaylanmış (APPROVED) bir prototipin durumu tekrar DEĞİŞTİRİLEMEDİ', terminalPrototypeChangeRejected);

    let missingPrototypeRejected = false;
    try {
      await createLabTest(companyId, { prototypeId: newId(), testName: 'Olmayan Prototip Testi' });
    } catch (err) {
      missingPrototypeRejected = err instanceof RndError;
    }
    check('olmayan bir prototiple laboratuvar testi oluşturulamadı', missingPrototypeRejected);

    const testId = await createLabTest(companyId, { prototypeId, testName: 'Dayanıklılık Testi', testDate: '2026-03-01' });
    await updateLabTestStatus(companyId, testId, { status: 'IN_PROGRESS' });
    await updateLabTestStatus(companyId, testId, { status: 'COMPLETED', resultSummary: 'Tüm kriterler karşılandı.' });
    let terminalTestChangeRejected = false;
    try {
      await updateLabTestStatus(companyId, testId, { status: 'FAILED' });
    } catch (err) {
      terminalTestChangeRejected = err instanceof RndError;
    }
    check('tamamlanmış (COMPLETED) bir testin durumu tekrar DEĞİŞTİRİLEMEDİ', terminalTestChangeRejected);

    const labTests = await listLabTests(companyId);
    check('laboratuvar testi listelendi, prototipe doğru bağlandı ve COMPLETED', labTests.length === 1 && labTests[0].prototypeName === 'Prototip A' && labTests[0].status === 'COMPLETED');

    console.log('\n=== TÜM ZİNCİR BAŞARIYLA TAMAMLANDI ===');
  } finally {
    console.log('\n--- Temizlik ---');
    const cleanupConn = await mysql.createConnection(process.env.MIGRATE_DATABASE_URL!);
    // rnd_lab_tests.prototypeId -> rnd_prototypes (cascade YOK), önce silinmeli.
    // rnd_prototypes.projectId -> projects (cascade YOK), projects'ten önce silinmeli.
    const dependentFirst = [
      'rnd_lab_tests', 'rnd_prototypes', 'projects',
      'safety_incidents', 'env_emission_records', 'env_waste_records', 'env_permits',
      'employees'
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
