// emakerp/scripts/migrate.ts ile AYNI iki-aşamalı disiplin (şema migration'ları
// + rol/yetki daraltma) — RLS yerine burada MySQL'in kendi GRANT/REVOKE
// mekanizması var (bkz. SECURITY-ARCHITECTURE.md §1). Idempotent, tekrar
// tekrar çalıştırılabilir.
import 'dotenv/config';
import path from 'path';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { eq } from 'drizzle-orm';
import { departmentTypes, roles, permissions, rolePermissions } from '../src/db/schema';

async function main() {
  const migrateUrl = process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL;
  if (!migrateUrl) throw new Error('MIGRATE_DATABASE_URL (ya da DATABASE_URL) tanımlı değil.');

  const connection = await mysql.createConnection(migrateUrl);
  const db = drizzle(connection, { mode: 'default' });

  console.log("Şema migration'ları uygulanıyor (drizzle-kit)...");
  await migrate(db, { migrationsFolder: path.join(__dirname, '..', 'drizzle') });

  console.log('Referans (seed) verileri ekleniyor (idempotent)...');
  // PDF madde 40 — yetki matrisi. Platform-geneli roller (SUPER_ADMIN/
  // TENANT_ADMIN) BİLİNÇLİ OLARAK dışarıda bırakıldı — bu tek bir fabrikanın
  // kendi DB'si, platform seviyesi emakerp'te yaşıyor (TENANT-ARCHITECTURE.md §6).
  const ROLE_SEED: { code: string; name: string }[] = [
    { code: 'FACTORY_ADMIN', name: 'Fabrika Yöneticisi' },
    { code: 'COMPANY_ADMIN', name: 'Şirket Yöneticisi' },
    { code: 'ACCOUNTING_MANAGER', name: 'Muhasebe Müdürü' },
    { code: 'ACCOUNTANT', name: 'Muhasebeci' },
    { code: 'FINANCE_MANAGER', name: 'Finans Müdürü' },
    { code: 'SALES_MANAGER', name: 'Satış Müdürü' },
    { code: 'SALES_USER', name: 'Satış Personeli' },
    { code: 'PURCHASING_MANAGER', name: 'Satın Alma Müdürü' },
    { code: 'WAREHOUSE_MANAGER', name: 'Depo Müdürü' },
    { code: 'WAREHOUSE_USER', name: 'Depo Personeli' },
    { code: 'HR_MANAGER', name: 'İK Müdürü' },
    { code: 'AUDITOR', name: 'Denetçi' },
    { code: 'EMPLOYEE', name: 'Çalışan' }
  ];
  const PERMISSION_SEED: { code: string; name: string }[] = [
    { code: 'view', name: 'Görüntüle' },
    { code: 'create', name: 'Oluştur' },
    { code: 'update', name: 'Güncelle' },
    { code: 'delete', name: 'Sil' },
    { code: 'approve', name: 'Onayla' },
    { code: 'cancel', name: 'İptal Et' },
    { code: 'export', name: 'Dışa Aktar' },
    { code: 'print', name: 'Yazdır' },
    { code: 'post', name: 'Muhasebeleştir' },
    { code: 'close_period', name: 'Dönem Kapat' },
    { code: 'reopen_period', name: 'Dönem Aç' }
  ];
  const DEPARTMENT_TYPE_SEED: { code: string; name: string }[] = [
    { code: 'ACCOUNTING', name: 'Muhasebe' }
  ];

  for (const row of DEPARTMENT_TYPE_SEED) {
    await db.insert(departmentTypes).values(row).onDuplicateKeyUpdate({ set: { name: row.name } });
  }
  for (const row of PERMISSION_SEED) {
    await db.insert(permissions).values(row).onDuplicateKeyUpdate({ set: { name: row.name } });
  }
  for (const row of ROLE_SEED) {
    const id = crypto.randomUUID();
    // "id" satırı yalnızca İLK eklemede kullanılır — onDuplicateKeyUpdate
    // yalnızca "name"i günceller, mevcut satırın gerçek id'sini DEĞİŞTİRMEZ.
    // role_permissions bu yüzden aşağıda id'yi TEKRAR SELECT ile okuyor.
    await db.insert(roles).values({ id, code: row.code, name: row.name }).onDuplicateKeyUpdate({ set: { name: row.name } });
  }

  // PDF madde 40-41 — ACCOUNTING modülü için başlangıç yetki matrisi.
  // FACTORY_ADMIN buraya BİLİNÇLİ OLARAK dahil değil — lib/dal.ts:
  // requireDepartmentAccess zaten fabrika yöneticisine her departmanda TAM
  // yetki veren bir fallback içeriyor, ayrı bir satıra gerek yok.
  const ACCOUNTING_ROLE_PERMISSIONS: Record<string, string[]> = {
    ACCOUNTING_MANAGER: ['view', 'create', 'update', 'delete', 'approve', 'cancel', 'export', 'print', 'post', 'close_period', 'reopen_period'],
    ACCOUNTANT: ['view', 'create', 'update', 'export', 'print', 'post'],
    AUDITOR: ['view', 'export', 'print']
  };
  for (const [roleCode, permCodes] of Object.entries(ACCOUNTING_ROLE_PERMISSIONS)) {
    const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, roleCode)).limit(1);
    if (!role) continue;
    for (const permissionCode of permCodes) {
      await db
        .insert(rolePermissions)
        .values({ id: crypto.randomUUID(), roleId: role.id, permissionCode, moduleKey: 'ACCOUNTING' })
        .onDuplicateKeyUpdate({ set: { moduleKey: 'ACCOUNTING' } });
    }
  }

  const appUser = process.env.APP_DB_USER;
  const dbName = process.env.APP_DB_NAME || 'emakfabrika';
  if (appUser) {
    console.log(`"${appUser}" kullanıcısının yetkileri DML-only'e daraltılıyor (DDL yetkisi kaldırılıyor)...`);
    // 2026-08-29 bulgusu: resmi mysql imajı, MYSQL_USER'a veritabanı üzerinde
    // TÜM yetkileri (DDL dahil) veriyor — emakerp'in "app rolü süperkullanıcı
    // OLMAMALI" ilkesiyle aynı gerekçeyle burada daraltılıyor.
    await connection.query(`REVOKE ALL PRIVILEGES ON \`${dbName}\`.* FROM '${appUser}'@'%';`).catch(() => {
      /* kullanıcı henüz farklı bir host paterniyle kayıtlı olabilir, aşağıdaki GRANT yine de dener */
    });
    await connection.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON \`${dbName}\`.* TO '${appUser}'@'%';`);
    await connection.query('FLUSH PRIVILEGES;');
  } else {
    console.log('APP_DB_USER tanımlı değil — yetki daraltma adımı atlandı (yalnızca yerel/tek-kullanıcılı test kurulumunda kabul edilebilir).');
  }

  console.log('Tamamlandı.');
  await connection.end();
}

main().catch((err) => {
  console.error('Migration başarısız:', err);
  process.exit(1);
});
