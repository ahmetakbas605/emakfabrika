import 'dotenv/config';
import mysql from 'mysql2/promise';
import { eq } from 'drizzle-orm';
import { db } from '../src/db/client';
import { companies, users } from '../src/db/schema';
import { newId } from '../src/lib/id';
import { hashPassword } from '../src/lib/auth';
import { issueExternalHandoffToken } from '../src/lib/integration/external-auth';
import { verifyExternalHandoffToken } from '../src/lib/session';

// emakerp <-> emakfabrika giriş-yönlendirme entegrasyonu (kullanıcının
// açık isteği: "emakerp'e giren kişi aslında fabrika kullanıcısıysa oraya
// yönlendirilsin, şifreyi tekrar yazmasın"). Bu test yalnızca lib
// katmanını (issueExternalHandoffToken + verifyExternalHandoffToken)
// kapsar — HTTP uçları (app/api/v1/auth/handoff, app/auth/handoff) ince
// birer sarmalayıcı, diğer API route'ların bu projede hiç ayrı test
// edilmediği emsaliyle TUTARLI olarak elle (curl) doğrulandı, kalıcı test
// kapsamı bilinçli olarak yalnızca gerçek iş mantığında. npm run
// test:external-auth.

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
  const mfaUserId = newId();
  const email = `ext-auth-${Date.now()}@test.local`;
  const inactiveEmail = `ext-auth-inactive-${Date.now()}@test.local`;
  const mfaEmail = `ext-auth-mfa-${Date.now()}@test.local`;

  await db.insert(companies).values({ id: companyId, name: 'EXTERNAL AUTH TEST A.Ş.', taxId: '9999999991', taxOffice: 'Test V.D.' });
  await db.insert(users).values([
    { id: activeUserId, companyId, fullName: 'Aktif Kullanıcı', email, passwordHash: hashPassword('DogruSifre123!'), active: true, isFactoryAdmin: true },
    { id: inactiveUserId, companyId, fullName: 'Pasif Kullanıcı', email: inactiveEmail, passwordHash: hashPassword('DogruSifre123!'), active: false, isFactoryAdmin: false },
    { id: mfaUserId, companyId, fullName: 'MFA Kullanıcı', email: mfaEmail, passwordHash: hashPassword('DogruSifre123!'), active: true, isFactoryAdmin: false, mfaEnabled: true }
  ]);

  try {
    const validToken = await issueExternalHandoffToken(email, 'DogruSifre123!');
    check('doğru e-posta + doğru şifre → bir handoff token üretti', typeof validToken === 'string' && validToken.length > 0);

    const redeemed = validToken ? await verifyExternalHandoffToken(validToken) : null;
    check('üretilen token doğru userId/companyId ile ÇÖZÜLEBİLDİ', redeemed?.userId === activeUserId && redeemed?.companyId === companyId);

    // Güvenlik denetimi 2026-09-03, bulgu 2.2 — AYNI token ikinci kez
    // kullanılmaya çalışılırsa (replay) artık reddedilmeli, imza/süre hâlâ
    // geçerli olsa bile (jti tüketildi-kümesi, lib/session.ts).
    const replayed = validToken ? await verifyExternalHandoffToken(validToken) : 'ATLANDI';
    check('AYNI token İKİNCİ kez kullanılınca reddedildi (replay koruması)', replayed === null);

    check('doğru e-posta + yanlış şifre → null', (await issueExternalHandoffToken(email, 'YanlisSifre')) === null);
    check('var olmayan e-posta → null (hata FIRLATMADAN)', (await issueExternalHandoffToken('yok-boyle-biri@test.local', 'herhangi')) === null);
    check('pasifleştirilmiş kullanıcı, şifre doğru olsa bile → null', (await issueExternalHandoffToken(inactiveEmail, 'DogruSifre123!')) === null);
    check('MFA etkin kullanıcı, şifre doğru olsa bile → null (MFA ATLANAMAZ)', (await issueExternalHandoffToken(mfaEmail, 'DogruSifre123!')) === null);

    let invalidTokenRejected = false;
    try {
      const bogus = await verifyExternalHandoffToken('bariz-gecersiz-token');
      invalidTokenRejected = bogus === null;
    } catch {
      invalidTokenRejected = true;
    }
    check('geçersiz/bozuk bir token çözülemedi (hata FIRLATMADAN null döndü)', invalidTokenRejected);

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
