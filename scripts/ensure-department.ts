// Verilen türde bir departmanı, henüz sahip olmayan HER şirkete ekler.
//
// scripts/add-procurement-department.ts'in genelleştirilmiş hâli — aynı
// betiği her yeni departman türü için kopyalamak yerine tür/ad parametre.
//
// Neden ayrı bir betik: scripts/migrate.ts global REFERANS verisini
// (departman TÜRLERİ, roller, izinler) seed eder, şirkete özgü satır
// YAZMAZ. seed-demo-company.ts ise sıfırdan bir demo şirket kurar.
//
// Bağlantıyı migrate.ts gibi KENDİSİ kurar; src/db/client.ts
// `import 'server-only'` içerdiği için Next.js dışında çalışmaz.
//
// Idempotent: aynı şirkette o türde bir departman zaten varsa dokunmaz.
//
// Çalıştır:  npx tsx scripts/ensure-department.ts MARKETING "Pazarlama"
//            (önce npm run db:migrate — departman TÜRÜ oradan gelir)
import 'dotenv/config';
import crypto from 'crypto';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { and, eq } from 'drizzle-orm';
import { companies, departments, departmentTypes } from '../src/db/schema';

async function main() {
  const typeCode = process.argv[2];
  const departmentName = process.argv[3];

  if (!typeCode || !departmentName) {
    throw new Error('Kullanım: tsx scripts/ensure-department.ts <TÜR_KODU> "<Departman Adı>"');
  }

  const url = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error('MIGRATE_DATABASE_URL (ya da DATABASE_URL) tanımlı değil.');

  const connection = await mysql.createConnection(url);
  const db = drizzle(connection, { mode: 'default' });

  try {
    const [type] = await db
      .select({ code: departmentTypes.code })
      .from(departmentTypes)
      .where(eq(departmentTypes.code, typeCode))
      .limit(1);

    if (!type) {
      throw new Error(`departmentTypes tablosunda "${typeCode}" yok — önce "npm run db:migrate" çalıştırın.`);
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
        .where(and(eq(departments.companyId, company.id), eq(departments.departmentTypeCode, typeCode)))
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
        departmentTypeCode: typeCode,
        name: departmentName
      });
      console.log(`  eklendi  ${company.name} — ${departmentName} (${id})`);
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
