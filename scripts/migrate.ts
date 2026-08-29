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
import { departmentTypes, roles, permissions, rolePermissions, itAssetTypes, currencies } from '../src/db/schema';

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
    { code: 'EMPLOYEE', name: 'Çalışan' },
    // IT-ARCHITECTURE.md §6 — IT_ADMIN kasıtlı olarak YOK (isFactoryAdmin
    // bayrağı zaten fabrika-geneli tam yetkiyi karşılıyor, madde 67 "gereksiz
    // abstraction oluşturma" ile tutarlı).
    { code: 'IT_MANAGER', name: 'BT Müdürü' },
    { code: 'SERVICE_DESK_AGENT', name: 'Servis Masası Temsilcisi' },
    { code: 'NETWORK_ENGINEER', name: 'Ağ Mühendisi' },
    { code: 'SYSTEM_ENGINEER', name: 'Sistem Mühendisi' },
    { code: 'SECURITY_ENGINEER', name: 'Güvenlik Mühendisi' },
    { code: 'FIELD_TECHNICIAN', name: 'Saha Teknisyeni' },
    { code: 'HELP_DESK', name: 'Yardım Masası' },
    { code: 'ASSET_MANAGER', name: 'Varlık Yöneticisi' },
    { code: 'END_USER', name: 'Son Kullanıcı' }
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
    { code: 'reopen_period', name: 'Dönem Aç' },
    // IT-DATABASE.md §2 — IT modülü için ek izinler.
    { code: 'assign', name: 'Ata' },
    { code: 'configure', name: 'Yapılandır' },
    { code: 'monitor', name: 'İzle' },
    { code: 'manage_credentials', name: 'Kimlik Bilgisi Yönet' },
    { code: 'manage_assets', name: 'Varlık Yönet' },
    { code: 'manage_network', name: 'Ağ Yönet' }
  ];
  const DEPARTMENT_TYPE_SEED: { code: string; name: string }[] = [
    { code: 'ACCOUNTING', name: 'Muhasebe' },
    { code: 'WAREHOUSE', name: 'Depo' },
    { code: 'IT', name: 'Bilgi Teknolojileri' }
  ];

  // PDF (IT) madde 3 — kod içine sabit gömülmeyen varlık tipi listesi.
  const IT_ASSET_TYPE_SEED: { code: string; name: string }[] = [
    { code: 'DESKTOP', name: 'Masaüstü Bilgisayar' },
    { code: 'LAPTOP', name: 'Laptop' },
    { code: 'SERVER', name: 'Sunucu' },
    { code: 'VM', name: 'Sanal Makine' },
    { code: 'FIREWALL', name: 'Firewall' },
    { code: 'ROUTER', name: 'Router' },
    { code: 'SWITCH', name: 'Switch' },
    { code: 'ACCESS_POINT', name: 'Access Point' },
    { code: 'PRINTER', name: 'Yazıcı' },
    { code: 'SCANNER', name: 'Tarayıcı' },
    { code: 'NAS', name: 'NAS' },
    { code: 'STORAGE', name: 'Depolama' },
    { code: 'UPS', name: 'UPS' },
    { code: 'IP_PHONE', name: 'IP Telefon' },
    { code: 'CCTV_NVR', name: 'CCTV NVR' },
    { code: 'CAMERA', name: 'Kamera' },
    { code: 'IOT', name: 'IoT Cihazı' },
    { code: 'MOBILE_DEVICE', name: 'Mobil Cihaz' },
    { code: 'TABLET', name: 'Tablet' },
    { code: 'NETWORK_APPLIANCE', name: 'Ağ Cihazı' }
  ];

  // ERP Genişletme Faz 1 — currencies company_id TAŞIMAZ (ISO 4217 kodları
  // evrensel, şirkete özgü değil — companies/roles/permissions İLE AYNI
  // gerekçeyle global referans verisi).
  const CURRENCY_SEED: { code: string; name: string; symbol: string }[] = [
    { code: 'TRY', name: 'Türk Lirası', symbol: '₺' },
    { code: 'USD', name: 'Amerikan Doları', symbol: '$' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
    { code: 'GBP', name: 'İngiliz Sterlini', symbol: '£' }
  ];
  for (const row of CURRENCY_SEED) {
    await db.insert(currencies).values(row).onDuplicateKeyUpdate({ set: { name: row.name, symbol: row.symbol } });
  }

  for (const row of DEPARTMENT_TYPE_SEED) {
    await db.insert(departmentTypes).values(row).onDuplicateKeyUpdate({ set: { name: row.name } });
  }
  for (const row of IT_ASSET_TYPE_SEED) {
    await db.insert(itAssetTypes).values(row).onDuplicateKeyUpdate({ set: { name: row.name } });
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
  const WAREHOUSE_ROLE_PERMISSIONS: Record<string, string[]> = {
    WAREHOUSE_MANAGER: ['view', 'create', 'update', 'delete', 'export', 'print', 'post'],
    WAREHOUSE_USER: ['view', 'create', 'post'],
    AUDITOR: ['view', 'export', 'print']
  };
  // IT-ARCHITECTURE.md §6'daki yetki dağılımı — IT_MANAGER tam yetki,
  // SERVICE_DESK_AGENT ticket-odaklı, NETWORK_ENGINEER network+ipam
  // odaklı, FIELD_TECHNICIAN kendi işlerinde update (çoğunlukla mobil
  // üzerinden), ASSET_MANAGER envanter odaklı.
  const IT_ROLE_PERMISSIONS: Record<string, string[]> = {
    IT_MANAGER: ['view', 'create', 'update', 'delete', 'assign', 'approve', 'cancel', 'export', 'print', 'configure', 'monitor', 'manage_credentials', 'manage_assets', 'manage_network'],
    SERVICE_DESK_AGENT: ['view', 'create', 'update', 'assign', 'export', 'print'],
    NETWORK_ENGINEER: ['view', 'create', 'update', 'configure', 'monitor', 'manage_network', 'manage_credentials'],
    SYSTEM_ENGINEER: ['view', 'create', 'update', 'configure', 'monitor', 'manage_assets'],
    SECURITY_ENGINEER: ['view', 'update', 'configure', 'monitor', 'manage_credentials'],
    FIELD_TECHNICIAN: ['view', 'update', 'print'],
    HELP_DESK: ['view', 'create', 'update'],
    ASSET_MANAGER: ['view', 'create', 'update', 'delete', 'assign', 'export', 'print', 'manage_assets'],
    AUDITOR: ['view', 'export', 'print']
  };

  async function seedRolePermissions(moduleKey: string, matrix: Record<string, string[]>) {
    for (const [roleCode, permCodes] of Object.entries(matrix)) {
      const [role] = await db.select({ id: roles.id }).from(roles).where(eq(roles.code, roleCode)).limit(1);
      if (!role) continue;
      for (const permissionCode of permCodes) {
        await db
          .insert(rolePermissions)
          .values({ id: crypto.randomUUID(), roleId: role.id, permissionCode, moduleKey })
          .onDuplicateKeyUpdate({ set: { moduleKey } });
      }
    }
  }
  await seedRolePermissions('ACCOUNTING', ACCOUNTING_ROLE_PERMISSIONS);
  await seedRolePermissions('WAREHOUSE', WAREHOUSE_ROLE_PERMISSIONS);
  await seedRolePermissions('IT', IT_ROLE_PERMISSIONS);

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
