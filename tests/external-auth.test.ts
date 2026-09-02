import 'dotenv/config';
import mysql from 'mysql2/promise';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { companies, users } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { verifyExternalCredentials } from '../src/lib/integration/external-auth';

// emakerp <-> emakfabrika giriş-yönlendirme entegrasyonu (kullanıcının
// açık isteği: "emakerp'e giren kişi aslında fabrika kullanıcısıysa oraya
// yönlendirilsin"). Bu test yalnızca lib katmanını (verifyExternalCredentials)
// kapsar — HTTP ucu (app/api/v1/auth/verify-external) ince bir sarmalayıcı
// (paylaşılan sır kontrolü + JSON), diğer API route'ların bu projede hiç
// ayrı test edilmediği emsaliyle TUTARLI olarak elle (curl) doğrulandı,
// kalıcı test kapsamı bilinçli olarak yalnızca gerçek iş mantığında.
// npm run test:external-auth.

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
  const activeUserId = newId();
  const inactiveUserId = newId();
  const email = `ext-auth-${Date.now()}@test.local`;
  const inactiveEmail = `ext-auth-inactive-${Date.now()}@test.local`;

  await db.insert(companies).values({ id: companyId, name: 'EXTERNAL AUTH TEST A.Ş.', taxId: '9999999991', taxOffice: 'Test V.D.' });
  await db.insert(users).values([
    { id: activeUserId, companyId, fullName: 'Aktif Kullanıcı', email, passwordHash: hashPassword('DogruSifre123!'), active: true, isFactoryAdmin: true },
    { id: inactiveUserId, companyId, fullName: 'Pasif Kullanıcı', email: inactiveEmail, passwordHash: hashPassword('DogruSifre123!'), active: false, isFactoryAdmin: false }
  ]);

  try {
    check('doğru e-posta + doğru şifre → true', (await verifyExternalCredentials(email, 'DogruSifre123!')) === true);
    check('doğru e-posta + yanlış şifre → false', (await verifyExternalCredentials(email, 'YanlisSifre')) === false);
    check('var olmayan e-posta → false (hata FIRLATMADAN)', (await verifyExternalCredentials('yok-boyle-biri@test.local', 'herhangi')) === false);
    check('pasifleştirilmiş kullanıcı, şifre doğru olsa bile → false', (await verifyExternalCredentials(inactiveEmail, 'DogruSifre123!')) === false);

    const [row] = await db.select({ failedLoginAttempts: users.failedLoginAttempts }).from(users).where(eq(users.id, activeUserId)).limit(1);
    check(`yanlış şifre denemeleri failedLoginAttempts sayacını ARTIRMADI (0): ${row?.failedLoginAttempts}`, row?.failedLoginAttempts === 0);

    console.log('\n=== TÜM ZİNCİR BAŞARIYLA TAMAMLANDI ===');
  } finally {
    console.log('\n--- Temizlik ---');
    const cleanupConn = await mysql.createConnection(process.env.MIGRATE_DATABASE_URL!);
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
