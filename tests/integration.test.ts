import 'dotenv/config';
import mysql from 'mysql2/promise';
import { db } from '../src/db/client';
import { companies, users } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { subscribe, publishEvent, listEvents } from '../src/lib/integration/events';
import { resolveEmailProvider, resolveSmsProvider } from '../src/lib/integration/notifications';
import { resolveDirectoryProvider, resolveRfidProvider, resolvePlcProvider, resolveBankFeedProvider } from '../src/lib/integration/external-systems';
import { IntegrationError } from '../src/lib/integration/errors';
import { createIncident } from '../src/lib/safety/incidents';
import { createNcr } from '../src/lib/quality/ncr';

// Holding ERP Faz 13 (Integration Hub + Event Bus) — diğer kalıcı test
// paketleriyle AYNI disiplin: gerçek MySQL'e karşı, mock YOK. npm run
// test:integration. Odak: (1) publishEvent'in olayı KALICI olarak
// yazdığı, (2) abonelerin (subscribe) gerçekten çağrıldığı, (3) EN
// KRİTİK özellik — bir abone hata fırlatırsa bu ASLA çağıranın (ör.
// createIncident'in) kendi iş akışını bozmadığı/geciktirmediği, (4) Null
// sağlayıcıların (Email/SMS/LDAP/RFID/PLC-SCADA/Banka) hepsinin dürüstçe
// "yapılandırılmadı" hatası fırlattığı, (5) GERÇEK bağlanmış olayların
// (SAFETY_INCIDENT_CREATED/QUALITY_NCR_CREATED) doğru payload ile
// kaydedildiği.

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
  const adminUserId = newId();

  await db.insert(companies).values({ id: companyId, name: 'INTEGRATION TEST A.Ş.', taxId: '9999999999', taxOffice: 'Test V.D.' });
  await db.insert(users).values([{ id: adminUserId, companyId, fullName: 'Fabrika Yöneticisi', email: `admin-${Date.now()}@int.test`, passwordHash: hashPassword('x'), isFactoryAdmin: true }]);

  try {
    console.log('--- Event Bus çekirdeği: publish + list ---');
    await publishEvent(companyId, { eventType: 'TEST_EVENT_A', sourceModule: 'TEST', entityId: 'e1', payload: { foo: 'bar' } });
    await publishEvent(companyId, { eventType: 'TEST_EVENT_B', sourceModule: 'TEST', entityId: 'e2' });

    const allEvents = await listEvents(companyId);
    check(`2 olay kaydedildi: ${allEvents.length}`, allEvents.length === 2);
    const filtered = await listEvents(companyId, 'TEST_EVENT_A');
    check('eventType filtresi doğru çalıştı (1)', filtered.length === 1 && filtered[0].entityId === 'e1');
    check('payload JSON olarak doğru saklandı', JSON.stringify(filtered[0].payload) === JSON.stringify({ foo: 'bar' }));

    console.log('--- Abonelik (subscribe) gerçekten çağrılıyor mu ---');
    let received: { companyId: string; entityId: string | null; payload: Record<string, unknown> | undefined } | null = null;
    subscribe('TEST_EVENT_SUBSCRIBED', async (cid, eid, payload) => {
      received = { companyId: cid, entityId: eid, payload };
    });
    await publishEvent(companyId, { eventType: 'TEST_EVENT_SUBSCRIBED', sourceModule: 'TEST', entityId: 'e3', payload: { x: 1 } });
    check('abone gerçekten çağrıldı ve doğru veriyi aldı', received !== null && (received as any).companyId === companyId && (received as any).entityId === 'e3' && (received as any).payload.x === 1);

    console.log('--- KRİTİK: hata fırlatan bir abone yayınlayanı ETKİLEMEMELİ ---');
    subscribe('TEST_EVENT_FAILING_SUBSCRIBER', async () => {
      throw new Error('Kasıtlı test hatası — abone başarısız oluyor.');
    });
    let publishThrew = false;
    try {
      await publishEvent(companyId, { eventType: 'TEST_EVENT_FAILING_SUBSCRIBER', sourceModule: 'TEST' });
    } catch {
      publishThrew = true;
    }
    check('hata fırlatan abone, publishEvent\'in KENDİSİNİN başarısız olmasına neden OLMADI', !publishThrew);
    const failingEventLogged = await listEvents(companyId, 'TEST_EVENT_FAILING_SUBSCRIBER');
    check('olay yine de KALICI olarak günlüğe yazıldı (abone hatasına RAĞMEN)', failingEventLogged.length === 1);

    console.log('--- Null sağlayıcılar: hepsi dürüstçe "yapılandırılmadı" hatası fırlatıyor ---');
    let emailRejected = false;
    try { await resolveEmailProvider(companyId).send({ to: 'x@x.com', subject: 's', body: 'b' }); } catch (err) { emailRejected = err instanceof IntegrationError; }
    check('Email sağlayıcısı (Null) dürüstçe reddetti', emailRejected);

    let smsRejected = false;
    try { await resolveSmsProvider(companyId).send({ to: '+90', message: 'm' }); } catch (err) { smsRejected = err instanceof IntegrationError; }
    check('SMS sağlayıcısı (Null) dürüstçe reddetti', smsRejected);

    let ldapRejected = false;
    try { await resolveDirectoryProvider(companyId).findUser('x@x.com'); } catch (err) { ldapRejected = err instanceof IntegrationError; }
    check('LDAP/Dizin sağlayıcısı (Null) dürüstçe reddetti', ldapRejected);

    let rfidRejected = false;
    try { await resolveRfidProvider(companyId).readLatest('READER-1'); } catch (err) { rfidRejected = err instanceof IntegrationError; }
    check('RFID sağlayıcısı (Null) dürüstçe reddetti', rfidRejected);

    let plcRejected = false;
    try { await resolvePlcProvider(companyId).readTags(['TAG1']); } catch (err) { plcRejected = err instanceof IntegrationError; }
    check('PLC/SCADA sağlayıcısı (Null) dürüstçe reddetti', plcRejected);

    let bankFeedRejected = false;
    try { await resolveBankFeedProvider(companyId).fetchStatement('acc1', '2026-01-01', '2026-01-31'); } catch (err) { bankFeedRejected = err instanceof IntegrationError; }
    check('Banka ekstre sağlayıcısı (Null) dürüstçe reddetti', bankFeedRejected);

    console.log('--- Gerçek bağlantı: İSG olayı + Kalite NCR, Null e-posta sağlayıcısına RAĞMEN başarıyla oluşuyor ---');
    const severeIncidentId = await createIncident(companyId, adminUserId, { incidentType: 'ACCIDENT', severity: 'SEVERE', incidentDate: '2026-08-01', description: 'Ciddi kaza — bildirim tetiklemeli.' });
    check('SEVERE İSG olayı, e-posta sağlayıcısı yapılandırılmamış OLMASINA RAĞMEN başarıyla oluşturuldu', !!severeIncidentId);
    const safetyEvents = await listEvents(companyId, 'SAFETY_INCIDENT_CREATED');
    check(`SAFETY_INCIDENT_CREATED olayı doğru payload ile kaydedildi (severity=SEVERE): ${JSON.stringify(safetyEvents[0]?.payload)}`, safetyEvents.length === 1 && (safetyEvents[0].payload as any)?.severity === 'SEVERE' && safetyEvents[0].entityId === severeIncidentId);

    const minorIncidentId = await createIncident(companyId, adminUserId, { incidentType: 'NEAR_MISS', severity: 'MINOR', incidentDate: '2026-08-02', description: 'Küçük olay — bildirim tetiklememeli.' });
    check('MINOR İSG olayı da (bildirim eşiği altında olsa bile) başarıyla oluşturuldu', !!minorIncidentId);
    const allSafetyEvents = await listEvents(companyId, 'SAFETY_INCIDENT_CREATED');
    check(`her iki olay da (SEVERE+MINOR) günlüğe yazıldı, yalnızca bildirim eşiği farklı davranır: ${allSafetyEvents.length}`, allSafetyEvents.length === 2);

    const criticalNcrId = await createNcr(companyId, adminUserId, { title: 'Kritik Hata', description: 'Test.', severity: 'CRITICAL' });
    check('CRITICAL NCR, e-posta sağlayıcısı yapılandırılmamış OLMASINA RAĞMEN başarıyla oluşturuldu', !!criticalNcrId);
    const qualityEvents = await listEvents(companyId, 'QUALITY_NCR_CREATED');
    check(`QUALITY_NCR_CREATED olayı doğru payload ile kaydedildi (severity=CRITICAL): ${JSON.stringify(qualityEvents[0]?.payload)}`, qualityEvents.length === 1 && (qualityEvents[0].payload as any)?.severity === 'CRITICAL' && qualityEvents[0].entityId === criticalNcrId);

    console.log('\n=== TÜM ZİNCİR BAŞARIYLA TAMAMLANDI ===');
  } finally {
    console.log('\n--- Temizlik ---');
    const cleanupConn = await mysql.createConnection(process.env.MIGRATE_DATABASE_URL!);
    const dependentFirst = ['integration_events', 'safety_incidents', 'ncr_records'];
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
