// Satınalma departmanını, henüz sahip olmayan HER şirkete ekler.
//
// Neden ayrı bir betik: scripts/migrate.ts global REFERANS verisini
// (departman TÜRLERİ, roller, izinler) seed eder — şirkete özgü satır
// yazmaz. seed-demo-company.ts ise sıfırdan bir demo şirket kurar,
// mevcut bir şirkete tek bir departman eklemek için kullanılamaz.
//
// Bağlantıyı scripts/migrate.ts gibi KENDİSİ kurar; src/db/client.ts
// `import 'server-only'` içerdiği için Next.js dışında çalışmaz.
//
// Idempotent: aynı şirkette PROCUREMENT türünde bir departman zaten
// varsa dokunmaz. Tekrar tekrar çalıştırılabilir.
//
// Çalıştır:  npm run db:add-procurement-dept
//            (önce npm run db:migrate — departman TÜRÜ oradan gelir)
import 'dotenv/config';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { and, eq } from 'drizzle-orm';
import { companies, departments, departmentTypes } from '../src/db/schema';

const TYPE_CODE = 'PROCUREMENT';
const DEPARTMENT_NAME = 'Satınalma';

async function main() {
  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('MIGRATE_DATABASE_URL (ya da DATABASE_URL) tanımlı değil.');

  const connection = await mysql.createConnection(url);
  const db = drizzle(connection, { mode: 'default' });

  try {
    const [type] = await db
      .select({ code: departmentTypes.code })
      .from(departmentTypes)
      .where(eq(departmentTypes.code, TYPE_CODE))
      .limit(1);

    if (!type) {
      throw new Error(`departmentTypes tablosunda "${TYPE_CODE}" yok — önce "npm run db:migrate" çalıştırın.`);
    }

    const rows = await db.select({ id: companies.id, name: companies.name }).from(companies);
    if (rows.length === 0) {
      console.log('Hiç şirket yok — yapılacak bir şey yok.');
      return;
    }

    let created = 0;
    let skipped = 0;

    for (const company of rows) {
      const [existing] = await db
        .select({ id: departments.id, name: departments.name })
        .from(departments)
        .where(and(eq(departments.companyId, company.id), eq(departments.departmentTypeCode, TYPE_CODE)))
        .limit(1);

      if (existing) {
        console.log(`  atlandı  ${company.name} — zaten var ("${existing.name}")`);
        skipped += 1;
        continue;
      }

      const id = crypto.randomUUID();
      await db.insert(departments).values({
        id,
        companyId: company.id,
        departmentTypeCode: TYPE_CODE,
        name: DEPARTMENT_NAME
      });
      console.log(`  eklendi  ${company.name} — ${DEPARTMENT_NAME} (${id})`);
      created += 1;
    }

    console.log(`\n${created} eklendi, ${skipped} zaten vardı.`);
  } finally {
    await connection.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Başarısız:', err);
    process.exit(1);
  });
