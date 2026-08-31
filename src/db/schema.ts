import { mysqlTable, char, varchar, int, decimal, json, timestamp, date, time, boolean, mysqlEnum, text, index, uniqueIndex, type AnyMySqlColumn } from 'drizzle-orm/mysql-core';

// Faz 2 (Database) + Faz 3 (Tenant/Auth) + Faz 4 (Accounting Core) — bkz.
// DATABASE-ARCHITECTURE.md §5. CHAR(36) UUID stratejisi: §2. Bu fabrikanın
// KENDİ MySQL veritabanı (DIŞ kiracı sınırı = fiziksel DB sınırı, bkz.
// TENANT-ARCHITECTURE.md §1) — hiçbir tabloda `tenant_id` YOK ve OLMAYACAK
// (bkz. ASSUMPTIONS.md §1 — database-per-tenant kararı KORUNUYOR).
// Holding ERP genişletmesi (Faz 0, MASTER-ERP-ROADMAP.md) — İÇ seviyede,
// AYNI fiziksel DB içinde birden fazla şirketi gruplayan `holdings` tablosu
// eklendi: bu bir tenant sınırı DEĞİL (tenant sınırı hâlâ = fiziksel DB),
// yalnızca "bu holding'in TÜM şirketleri" sorgusunu/konsolide raporlamayı
// mümkün kılan organizasyonel bir üst-seviye.

// --- Holding / Şirket / Şube / Departman (TENANT-ARCHITECTURE.md §1-3) ---

export const holdings = mysqlTable('holdings', {
  id: char('id', { length: 36 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const ACCOUNTING_MODES = ['PRE_ACCOUNTING', 'FULL_ACCOUNTING'] as const;

export const companies = mysqlTable('companies', {
  id: char('id', { length: 36 }).primaryKey(),
  // Faz 0 — additive, NULLABLE: mevcut satırlar migrate.ts'in idempotent
  // backfill adımıyla bir "Varsayılan Holding"e bağlanır (bkz. ASSUMPTIONS.md
  // §3), ama şema seviyesinde NOT NULL'a çevirmek AYRI, sonraki bir migration
  // (bugünkü tek geçişte veri+şema sırasını riske atmamak için — bu session'ın
  // audit hash-zinciri fix'inde de aynı temkinli disiplin uygulanmıştı).
  holdingId: char('holding_id', { length: 36 }).references(() => holdings.id),
  name: varchar('name', { length: 255 }).notNull(),
  // VKN (10 hane) veya TCKN (11 hane, şahıs işletmesi) — PDF madde 9.
  taxId: varchar('tax_id', { length: 11 }).notNull().default(''),
  taxOffice: varchar('tax_office', { length: 255 }).notNull().default(''),
  mersisNo: varchar('mersis_no', { length: 32 }).notNull().default(''),
  tradeRegistryNo: varchar('trade_registry_no', { length: 32 }).notNull().default(''),
  address: text('address'),
  city: varchar('city', { length: 100 }).notNull().default(''),
  district: varchar('district', { length: 100 }).notNull().default(''),
  // PDF madde 57 — TENANT-ARCHITECTURE.md §4: company seviyesinde tanımlı.
  accountingMode: mysqlEnum('accounting_mode', ACCOUNTING_MODES).notNull().default('FULL_ACCOUNTING'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
});

export const branches = mysqlTable('branches', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  address: text('address'),
  city: varchar('city', { length: 100 }).notNull().default(''),
  district: varchar('district', { length: 100 }).notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Kod içine sabit gömülmeyen departman türü referansı — PDF madde 3'ün genel
// ilkesi departman türleri için de uygulanıyor. İlk satır (seed): ACCOUNTING.
export const departmentTypes = mysqlTable('department_types', {
  code: varchar('code', { length: 32 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull()
});

export const departments = mysqlTable('departments', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  departmentTypeCode: varchar('department_type_code', { length: 32 }).notNull().references(() => departmentTypes.code),
  name: varchar('name', { length: 255 }).notNull(),
  // İK Faz 0 — madde 7'nin "Sub Department" katmanı. Opsiyonel self-ref
  // (AnyMySqlColumn lazy-ref — users.managerUserId İLE AYNI teknik, bu
  // dosyada zaten defalarca kullanıldı). NULL = üst-seviye departman.
  parentDepartmentId: char('parent_department_id', { length: 36 }).references((): AnyMySqlColumn => departments.id),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const roles = mysqlTable('roles', {
  id: char('id', { length: 36 }).primaryKey(),
  code: varchar('code', { length: 64 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description')
});

export const permissions = mysqlTable('permissions', {
  code: varchar('code', { length: 32 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull()
});

// PDF madde 40-41: bir rolün, bir MODÜL içinde hangi işlemleri yapabileceği.
export const rolePermissions = mysqlTable('role_permissions', {
  id: char('id', { length: 36 }).primaryKey(),
  roleId: char('role_id', { length: 36 }).notNull().references(() => roles.id, { onDelete: 'cascade' }),
  permissionCode: varchar('permission_code', { length: 32 }).notNull().references(() => permissions.code),
  moduleKey: varchar('module_key', { length: 32 }).notNull()
}, (table) => [uniqueIndex('udx_role_perm_module').on(table.roleId, table.permissionCode, table.moduleKey)]);

export const users = mysqlTable('users', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  active: boolean('active').notNull().default(true),
  // 5 hatalı denemede otomatik pasifleştirme — emakerp'in aynı kuralı
  // (lib/security-log.ts), burada IP kara listesi olmadan sadeleştirilmiş hâli.
  failedLoginAttempts: int('failed_login_attempts').notNull().default(0),
  // Bu fabrikadaki en yüksek yetki — emakerp'in tek-kiracı içindeki ADMIN
  // rolüyle aynı fikir, platform-geneli bir SUPER_ADMIN kavramı YOK (bkz.
  // TENANT-ARCHITECTURE.md — platform seviyesi emakerp'te yaşıyor).
  isFactoryAdmin: boolean('is_factory_admin').notNull().default(false),
  // Holding ERP Faz 0 — isFactoryAdmin'in TEK ŞİRKET sınırını aşan, aynı
  // holding'deki TÜM şirketlere erişim veren üst yetki (master prompt §87
  // HOLDING_ADMIN). Company-scope'lu isFactoryAdmin'den AYRI bir bayrak —
  // bir kullanıcı ikisine de, yalnızca birine, ya da hiçbirine sahip olabilir.
  isHoldingAdmin: boolean('is_holding_admin').notNull().default(false),
  // Core Security Faz 4 — web oturumu artık user_sessions tablosunda
  // (çoklu eşzamanlı oturum + tek tek iptal desteği, madde 15). Eski tekil
  // sessionToken/sessionExpiresAt kolonları KALDIRILDI (kullanılmayan kod
  // bırakılmadı) — lib/dal.ts:getSession artık user_sessions'a bakıyor.
  // Core Security Faz 5 — MFA (TOTP, RFC 6238). totpSecretEncrypted
  // lib/crypto.ts'in AYNI AES-256-GCM yardımcı fonksiyonuyla şifrelenir
  // (ayrı env-var anahtarı: MFA_ENC_KEY).
  totpSecretEncrypted: text('totp_secret_encrypted'),
  mfaEnabled: boolean('mfa_enabled').notNull().default(false),
  mfaRecoveryCodesHash: json('mfa_recovery_codes_hash'),
  mfaEnabledAt: timestamp('mfa_enabled_at'),
  // Mobil oturum — emakerp'in requireMobileUser deseniyle AYNI (opak Bearer
  // <userId>.<token>), ayrı bir "sessions" tablosu YOK (SECURITY-ARCHITECTURE.md §1).
  mobileSessionToken: varchar('mobile_session_token', { length: 128 }),
  mobileSessionExpiresAt: timestamp('mobile_session_expires_at'),
  // Satınalma Genişletme Faz 0 — dinamik organizasyon hiyerarşisi (madde
  // 4-6). Her ikisi de OPSİYONEL — dolu değilse mevcut kullanıcı davranışı
  // değişmez, yalnızca workflow motorunun MANAGER_CHAIN/POSITION onay
  // adımları bu alanları kullanır. positions tablosu dosyanın sonunda
  // tanımlı (AnyMySqlColumn lazy-ref — network_diagrams'taki AYNI teknik).
  positionId: char('position_id', { length: 36 }).references((): AnyMySqlColumn => positions.id),
  managerUserId: char('manager_user_id', { length: 36 }).references((): AnyMySqlColumn => users.id),
  // İK Faz 0 — bir ERP giriş hesabını KENDİ özlük kaydına bağlar (madde 195'in
  // employees vs. users ayrımı, İK Mimarisi raporu §03). OPSİYONEL ve TEK
  // YÖNLÜ: it_asset_assignments.userId, approval_actions.actedByUserId gibi
  // "ERP'de KİM yaptı" alanları users.id'ye bağlı KALIYOR, bu FK yalnızca
  // "bu ERP hesabının özlük karşılığı hangi employee" sorusuna cevap veriyor
  // — dış danışman gibi employees kaydı OLMAYAN bir users satırı da geçerli.
  employeeId: char('employee_id', { length: 36 }).references((): AnyMySqlColumn => employees.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
});

// SECURITY-ARCHITECTURE.md §3 — üçüncü yetkilendirme katmanı: kullanıcının
// HANGİ departmanda HANGİ rolle çalıştığı. Bir kullanıcı birden fazla
// departmana/role sahip olabilir.
export const userDepartmentAccess = mysqlTable('user_department_access', {
  id: char('id', { length: 36 }).primaryKey(),
  userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  departmentId: char('department_id', { length: 36 }).notNull().references(() => departments.id, { onDelete: 'cascade' }),
  roleId: char('role_id', { length: 36 }).notNull().references(() => roles.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_user_dept_role').on(table.userId, table.departmentId, table.roleId)]);

// PDF madde 38 — SECURITY-ARCHITECTURE.md §7: kritik-yol (best-effort DEĞİL).
export const AUDIT_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const AUDIT_RESULTS = ['SUCCESS', 'FAILURE'] as const;

// Core Security Faz 1-2 (KVKK+Güvenlik+Audit raporu §06) — bu tablo
// tanımlandığı günden bu yana yalnızca lib/accounting.ts'te kullanılmıştı
// (grep-doğrulanmış, 2 INSERT). Bu genişletme + lib/security/audit.ts'in
// merkezi writeAuditLog yardımcı fonksiyonu, raporun "en kritik bulgusu"
// olan bu boşluğu kapatıyor. Yeni alanların TAMAMI opsiyonel/varsayılanlı
// — accounting.ts'in mevcut 2 INSERT'i DOKUNULMADI, davranışları değişmedi.
export const auditLogs = mysqlTable('audit_logs', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }),
  userId: char('user_id', { length: 36 }).references(() => users.id),
  action: varchar('action', { length: 64 }).notNull(),
  entity: varchar('entity', { length: 64 }).notNull(),
  entityId: char('entity_id', { length: 36 }),
  oldValue: json('old_value'),
  newValue: json('new_value'),
  ip: varchar('ip', { length: 64 }),
  device: varchar('device', { length: 255 }),
  correlationId: char('correlation_id', { length: 36 }),
  module: varchar('module', { length: 64 }),
  sessionId: char('session_id', { length: 36 }),
  changedFields: json('changed_fields'),
  riskLevel: mysqlEnum('risk_level', AUDIT_RISK_LEVELS).notNull().default('LOW'),
  result: mysqlEnum('result', AUDIT_RESULTS).notNull().default('SUCCESS'),
  // madde 13 — hash zinciri. SHA-256(previousHash + bu satırın kanonik
  // JSON'u), previousHash şirketin bir önceki audit satırına işaret eder.
  // Blockchain DEĞİL (madde 13'ün kendi notu) — amaç yalnızca sonradan
  // müdahalenin matematiksel tespiti (bkz. lib/security/audit.ts).
  previousHash: varchar('previous_hash', { length: 64 }),
  currentHash: varchar('current_hash', { length: 64 }),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [index('idx_audit_company_entity').on(table.companyId, table.entity, table.entityId)]);

// --- Muhasebe Çekirdeği (ACCOUNTING-ENGINE.md) ---

export const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'] as const;
export const NORMAL_BALANCES = ['DEBIT', 'CREDIT'] as const;

// PDF madde 15 — Tek Düzen Hesap Planı, kullanıcı tanımlı (hard-code DEĞİL).
export const accountingAccounts = mysqlTable('accounting_accounts', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  parentAccountId: char('parent_account_id', { length: 36 }),
  normalBalance: mysqlEnum('normal_balance', NORMAL_BALANCES).notNull(),
  accountType: mysqlEnum('account_type', ACCOUNT_TYPES).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
}, (table) => [uniqueIndex('udx_account_company_code').on(table.companyId, table.code)]);

export const PERIOD_STATUSES = ['OPEN', 'CLOSED'] as const;

// PDF madde 17 — dönem kilitleme. Kapalı dönemde yazma UYGULAMA katmanında
// engellenir (ACCOUNTING-ENGINE.md §5) — DB seviyesinde bunu garanti eden bir
// mekanizma YOK, bu bilinçli bir risk kabulüdür.
export const accountingPeriods = mysqlTable('accounting_periods', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  periodStart: date('period_start', { mode: 'string' }).notNull(),
  periodEnd: date('period_end', { mode: 'string' }).notNull(),
  status: mysqlEnum('status', PERIOD_STATUSES).notNull().default('OPEN'),
  closedAt: timestamp('closed_at'),
  closedByUserId: char('closed_by_user_id', { length: 36 }).references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [index('idx_periods_company_dates').on(table.companyId, table.periodStart, table.periodEnd)]);

export const JOURNAL_STATUSES = ['POSTED', 'REVERSED'] as const;

// PDF madde 14, 16, 44, 77, 86 — muhasebe fişi. status='REVERSED' asla
// silinmez (financial immutability, ACCOUNTING-ENGINE.md §5).
export const accountingJournals = mysqlTable('accounting_journals', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  // PDF madde 55 — parametrik numaralandırma (ör. "MF202600000001").
  journalNo: varchar('journal_no', { length: 64 }).notNull(),
  journalDate: date('journal_date', { mode: 'string' }).notNull(),
  // 'MANUAL' | 'SALES_INVOICE' | 'PURCHASE_INVOICE' | 'PAYMENT' | ... —
  // kod içine sabit ENUM olarak gömülmedi, serbest metin + accounting_posting_
  // rules.document_type ile eşleşir (yeni belge türü eklemek migration istemesin diye).
  documentType: varchar('document_type', { length: 64 }).notNull(),
  // Bu fişin hangi kaynaktan (fatura/ödeme/elle) geldiğini işaret eden
  // polimorfik referans — Faz 5-6'da invoices/payments tabloları eklenince kullanılacak.
  sourceType: varchar('source_type', { length: 64 }),
  sourceId: char('source_id', { length: 36 }),
  description: text('description'),
  status: mysqlEnum('status', JOURNAL_STATUSES).notNull().default('POSTED'),
  reversalOfJournalId: char('reversal_of_journal_id', { length: 36 }),
  correctionGroupId: char('correction_group_id', { length: 36 }),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
}, (table) => [uniqueIndex('udx_journal_company_no').on(table.companyId, table.journalNo)]);

// PDF madde 43, 86 — DECIMAL(20,6), asla JS float. debit/credit birlikte
// TOTAL_DEBIT==TOTAL_CREDIT doğrulamasının kaynağı (ACCOUNTING-ENGINE.md §4).
export const accountingJournalLines = mysqlTable('accounting_journal_lines', {
  id: char('id', { length: 36 }).primaryKey(),
  journalId: char('journal_id', { length: 36 }).notNull().references(() => accountingJournals.id, { onDelete: 'cascade' }),
  accountId: char('account_id', { length: 36 }).notNull().references(() => accountingAccounts.id),
  debit: decimal('debit', { precision: 20, scale: 6 }).notNull().default('0'),
  credit: decimal('credit', { precision: 20, scale: 6 }).notNull().default('0'),
  // PDF madde 30 — işlem para birimi ayrı, muhasebe her zaman TRY (ACCOUNTING-
  // ENGINE.md §7) — base* alanları her zaman TRY karşılığı.
  currency: varchar('currency', { length: 3 }).notNull().default('TRY'),
  exchangeRate: decimal('exchange_rate', { precision: 20, scale: 6 }).notNull().default('1'),
  baseCurrencyDebit: decimal('base_currency_debit', { precision: 20, scale: 6 }).notNull().default('0'),
  baseCurrencyCredit: decimal('base_currency_credit', { precision: 20, scale: 6 }).notNull().default('0'),
  description: text('description'),
  costCenterId: char('cost_center_id', { length: 36 }),
  lineOrder: int('line_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [
  index('idx_journal_lines_journal').on(table.journalId),
  index('idx_journal_lines_account').on(table.accountId)
]);

// PDF madde 16 — ACCOUNTING-ENGINE.md §3: *_account_rule bir "çözümleyici
// anahtarı" taşır (ör. "CARI_SUBACCOUNT:120"), sabit hesap kodu DEĞİL.
// companyId NULL = tüm şirketler için varsayılan kural.
export const accountingPostingRules = mysqlTable('accounting_posting_rules', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).references(() => companies.id, { onDelete: 'cascade' }),
  documentType: varchar('document_type', { length: 64 }).notNull(),
  transactionType: varchar('transaction_type', { length: 64 }).notNull(),
  debitAccountRule: varchar('debit_account_rule', { length: 128 }).notNull(),
  creditAccountRule: varchar('credit_account_rule', { length: 128 }).notNull(),
  taxAccountRule: varchar('tax_account_rule', { length: 128 }),
  costAccountRule: varchar('cost_account_rule', { length: 128 }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- Mevzuat motoru (MEVZUAT-MAP.md §1-2) ---

export const RULE_STATUSES = ['ACTIVE', 'DRAFT', 'RETIRED'] as const;

export const taxRules = mysqlTable('tax_rules', {
  id: char('id', { length: 36 }).primaryKey(),
  ruleCode: varchar('rule_code', { length: 64 }).notNull(),
  ruleName: varchar('rule_name', { length: 255 }).notNull(),
  description: text('description'),
  effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
  effectiveTo: date('effective_to', { mode: 'string' }),
  country: varchar('country', { length: 2 }).notNull().default('TR'),
  companyType: varchar('company_type', { length: 64 }),
  taxpayerType: varchar('taxpayer_type', { length: 64 }),
  sector: varchar('sector', { length: 64 }),
  // TODO: RULE_CONDITION_FORMAT (MEVZUAT-MAP.md §1) — biçimi henüz kesinleşmedi,
  // şimdilik serbest JSON.
  condition: json('condition'),
  calculationMethod: varchar('calculation_method', { length: 32 }).notNull().default('PERCENTAGE'),
  rate: decimal('rate', { precision: 10, scale: 6 }),
  threshold: decimal('threshold', { precision: 20, scale: 6 }),
  status: mysqlEnum('status', RULE_STATUSES).notNull().default('ACTIVE'),
  sourceReference: text('source_reference'),
  version: int('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [index('idx_tax_rules_code_effective').on(table.ruleCode, table.effectiveFrom)]);

// KDV tevkifatı genelde kesirli (5/10, 7/10, 9/10) — rate ondalık karşılığı
// (0.5, 0.7, 0.9), fractionLabel okunabilirlik için ("5/10").
export const withholdingRules = mysqlTable('withholding_rules', {
  id: char('id', { length: 36 }).primaryKey(),
  ruleCode: varchar('rule_code', { length: 64 }).notNull(),
  ruleName: varchar('rule_name', { length: 255 }).notNull(),
  description: text('description'),
  effectiveFrom: date('effective_from', { mode: 'string' }).notNull(),
  effectiveTo: date('effective_to', { mode: 'string' }),
  sector: varchar('sector', { length: 64 }),
  rate: decimal('rate', { precision: 10, scale: 6 }).notNull(),
  fractionLabel: varchar('fraction_label', { length: 16 }),
  status: mysqlEnum('status', RULE_STATUSES).notNull().default('ACTIVE'),
  sourceReference: text('source_reference'),
  version: int('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [index('idx_withholding_rules_code_effective').on(table.ruleCode, table.effectiveFrom)]);

// PDF madde 55 — parametrik, eşzamanlılık-güvenli fiş numarası sayacı.
// MySQL'in bilinen "atomik sayaç" deseni: INSERT...ON DUPLICATE KEY UPDATE
// last_number=LAST_INSERT_ID(last_number+1), ardından SELECT LAST_INSERT_ID()
// — iki eşzamanlı istek asla aynı numarayı almaz (Postgres'teki
// pg_advisory_xact_lock'un MySQL karşılığı, bkz. lib/accounting.ts).
export const journalNumberCounters = mysqlTable('journal_number_counters', {
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  year: int('year').notNull(),
  lastNumber: int('last_number').notNull().default(0)
}, (table) => [uniqueIndex('udx_journal_counter_company_year').on(table.companyId, table.year)]);

// --- Kasa (PDF madde 26) ---

export const CASH_TRANSACTION_TYPES = ['IN', 'OUT'] as const;

// Her kasa kartı, hesap planındaki BİR "100 Kasa" tipi hesaba eşlenir —
// nakit hareketi kaydedilince otomatik muhasebe fişi bu hesabı kullanır
// (ACCOUNTING-ENGINE.md'nin "her ERP olayı muhasebeye event üretir"
// ilkesinin basit, tek-yönlü hâli — henüz gerçek bir event bus YOK,
// doğrudan çağrı; ikinci bir dinleyici gerektiğinde eklenecek).
export const cashAccounts = mysqlTable('cash_accounts', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  accountingAccountId: char('accounting_account_id', { length: 36 }).notNull().references(() => accountingAccounts.id),
  currency: varchar('currency', { length: 3 }).notNull().default('TRY'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const cashTransactions = mysqlTable('cash_transactions', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  cashAccountId: char('cash_account_id', { length: 36 }).notNull().references(() => cashAccounts.id),
  transactionType: mysqlEnum('transaction_type', CASH_TRANSACTION_TYPES).notNull(),
  amount: decimal('amount', { precision: 20, scale: 6 }).notNull(),
  // Karşı hesap kodu — ör. tahsilatta "120 Alıcılar", giderde "770 Genel
  // Yönetim Giderleri". Serbest hesap kodu (dropdown UI'de hesap planından
  // seçilir) — PDF'in "kasa, banka, tahsilat, ödeme, virman" ayrımını tek
  // bir esnek alanla karşılıyor, her tür için ayrı tablo AÇILMADI.
  counterAccountCode: varchar('counter_account_code', { length: 32 }).notNull(),
  description: text('description'),
  transactionDate: date('transaction_date', { mode: 'string' }).notNull(),
  journalId: char('journal_id', { length: 36 }).references(() => accountingJournals.id),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- Banka (PDF madde 27) ---

export const BANK_TRANSACTION_METHODS = ['HAVALE', 'EFT', 'FAST', 'KREDI_KARTI', 'POS', 'KOMISYON', 'DIGER'] as const;

export const bankAccounts = mysqlTable('bank_accounts', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  iban: varchar('iban', { length: 34 }).notNull().default(''),
  accountingAccountId: char('accounting_account_id', { length: 36 }).notNull().references(() => accountingAccounts.id),
  currency: varchar('currency', { length: 3 }).notNull().default('TRY'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const bankTransactions = mysqlTable('bank_transactions', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  bankAccountId: char('bank_account_id', { length: 36 }).notNull().references(() => bankAccounts.id),
  transactionType: mysqlEnum('transaction_type', CASH_TRANSACTION_TYPES).notNull(),
  method: mysqlEnum('method', BANK_TRANSACTION_METHODS).notNull().default('HAVALE'),
  amount: decimal('amount', { precision: 20, scale: 6 }).notNull(),
  counterAccountCode: varchar('counter_account_code', { length: 32 }).notNull(),
  description: text('description'),
  transactionDate: date('transaction_date', { mode: 'string' }).notNull(),
  journalId: char('journal_id', { length: 36 }).references(() => accountingJournals.id),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- Çek/Senet (PDF madde 28) ---

export const CHECK_DIRECTIONS = ['RECEIVED', 'ISSUED'] as const;
// Alınan çek: PORTFOLIO(portföyde) → COLLECTED(tahsil)/ENDORSED(ciro edildi)/
// BOUNCED(karşılıksız)/RETURNED(iade). Verilen çek: DRAFTED(düzenlendi) →
// DELIVERED(teslim edildi) → PAID(ödendi)/CANCELLED(iptal). Tek "status"
// varchar sütunu — yönlere göre farklı geçerli değer kümesi UYGULAMA
// katmanında doğrulanır (lib/checks.ts), iki ayrı ENUM/tablo AÇILMADI
// (PDF madde 67: gereksiz abstraction oluşturma).
export const checks = mysqlTable('checks', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  direction: mysqlEnum('direction', CHECK_DIRECTIONS).notNull(),
  checkNo: varchar('check_no', { length: 64 }).notNull().default(''),
  bankName: varchar('bank_name', { length: 255 }).notNull().default(''),
  // Alınan çekte keşideci (çeki veren), verilen çekte lehtar (çeki alacak taraf).
  partyName: varchar('party_name', { length: 255 }).notNull().default(''),
  amount: decimal('amount', { precision: 20, scale: 6 }).notNull(),
  dueDate: date('due_date', { mode: 'string' }).notNull(),
  status: varchar('status', { length: 32 }).notNull(),
  // Bu çek grubunun muhasebede karşılığı — ör. "101 Alınan Çekler" (received)
  // veya "103 Verilen Çekler ve Ödeme Emirleri" (issued).
  accountingAccountId: char('accounting_account_id', { length: 36 }).notNull().references(() => accountingAccounts.id),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
});

// Her durum geçişi (portföy→tahsil, teslim→ödeme, vb.) bir satır — hangi
// muhasebe fişinin bu geçişten üretildiği izlenebilir (financial audit trail,
// PDF madde 38'in çek/senet'e uygulanmış hâli).
export const checkEvents = mysqlTable('check_events', {
  id: char('id', { length: 36 }).primaryKey(),
  checkId: char('check_id', { length: 36 }).notNull().references(() => checks.id, { onDelete: 'cascade' }),
  fromStatus: varchar('from_status', { length: 32 }).notNull(),
  toStatus: varchar('to_status', { length: 32 }).notNull(),
  counterAccountCode: varchar('counter_account_code', { length: 32 }),
  journalId: char('journal_id', { length: 36 }).references(() => accountingJournals.id),
  note: text('note'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- Masraf Merkezi (PDF madde 34) ---

// accountingJournalLines.costCenterId zaten Faz 4'te vardı (JournalLineInput
// üzerinden doldurulur) — bu tablo o ID'nin neye referans verdiğini tanımlar.
export const costCenters = mysqlTable('cost_centers', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_cost_center_company_code').on(table.companyId, table.code)]);

// --- Bütçe (PDF madde 35) ---

export const BUDGET_STATUSES = ['DRAFT', 'ACTIVE', 'CLOSED'] as const;

export const budgets = mysqlTable('budgets', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  periodStart: date('period_start', { mode: 'string' }).notNull(),
  periodEnd: date('period_end', { mode: 'string' }).notNull(),
  status: mysqlEnum('status', BUDGET_STATUSES).notNull().default('DRAFT'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// month NULL = dönemin TAMAMI için tek toplam (yıllık bütçe); 1-12 = aylık
// kırılım (PDF madde 35: "yıllık bütçe, aylık bütçe" ikisi de destekleniyor,
// aynı tabloda granülerlik farkı olarak).
export const budgetItems = mysqlTable('budget_items', {
  id: char('id', { length: 36 }).primaryKey(),
  budgetId: char('budget_id', { length: 36 }).notNull().references(() => budgets.id, { onDelete: 'cascade' }),
  accountId: char('account_id', { length: 36 }).notNull().references(() => accountingAccounts.id),
  costCenterId: char('cost_center_id', { length: 36 }).references(() => costCenters.id),
  month: int('month'),
  plannedAmount: decimal('planned_amount', { precision: 20, scale: 6 }).notNull()
});

// --- Demirbaş (PDF madde 32) ---

export const DEPRECIATION_METHODS = ['STRAIGHT_LINE'] as const;
export const FIXED_ASSET_STATUSES = ['ACTIVE', 'DISPOSED'] as const;

// Parametrik amortisman yöntemi (PDF: "amortisman yöntemleri parametrik
// olmalı") — bugün yalnızca STRAIGHT_LINE (doğrusal) uygulanıyor, enum
// gelecekte AZALAN_BAKİYELER vb. ile genişleyebilir; hesaplama fonksiyonu
// (lib/fixed-assets.ts) yöntem bazında dallanacak şekilde yazıldı.
export const fixedAssets = mysqlTable('fixed_assets', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  // 253 Tesis Makine Cihaz / 255 Demirbaşlar gibi bir aktif hesap.
  accountingAccountId: char('accounting_account_id', { length: 36 }).notNull().references(() => accountingAccounts.id),
  // 257 Birikmiş Amortismanlar (kontra-aktif). Kolon adı kısaltıldı — gerçek
  // bulgu: drizzle'ın otomatik FK kısıt adı MySQL'in 64 karakter sınırını
  // aşıyordu ("fixed_assets_accumulated_depreciation_account_id_..._fk").
  accumDeprAccountId: char('accum_depr_account_id', { length: 36 }).notNull().references(() => accountingAccounts.id),
  // 740/770 Amortisman Gideri.
  deprExpAccountId: char('depr_exp_account_id', { length: 36 }).notNull().references(() => accountingAccounts.id),
  purchaseDate: date('purchase_date', { mode: 'string' }).notNull(),
  purchaseCost: decimal('purchase_cost', { precision: 20, scale: 6 }).notNull(),
  usefulLifeYears: int('useful_life_years').notNull(),
  depreciationMethod: mysqlEnum('depreciation_method', DEPRECIATION_METHODS).notNull().default('STRAIGHT_LINE'),
  status: mysqlEnum('status', FIXED_ASSET_STATUSES).notNull().default('ACTIVE'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Aynı ay için aynı demirbaşa iki kez amortisman işlenmesin diye benzersiz.
export const depreciationRuns = mysqlTable('depreciation_runs', {
  id: char('id', { length: 36 }).primaryKey(),
  fixedAssetId: char('fixed_asset_id', { length: 36 }).notNull().references(() => fixedAssets.id, { onDelete: 'cascade' }),
  periodDate: date('period_date', { mode: 'string' }).notNull(),
  amount: decimal('amount', { precision: 20, scale: 6 }).notNull(),
  journalId: char('journal_id', { length: 36 }).notNull().references(() => accountingJournals.id),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_depreciation_asset_period').on(table.fixedAssetId, table.periodDate)]);

// --- Depo (yeni departman — kullanıcının isteği: IT'nin yedek parça
// tüketimi için minimal ama GERÇEK bir Depo departmanı, ileride kendi PDF'i
// geldiğinde genişletilecek; bkz. FIELD-SERVICE.md §4'teki TODO'nun burada
// çözülmesi) ---

export const STOCK_MOVEMENT_TYPES = ['IN', 'OUT'] as const;

export const warehouses = mysqlTable('warehouses', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  branchId: char('branch_id', { length: 36 }).references(() => branches.id),
  name: varchar('name', { length: 255 }).notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// currentQty/avgCost burada TUTULUR (denormalize) — her sorguda tüm
// hareketleri toplamak yerine (Muhasebe'nin mizan deseninin TERSİ: burada
// stok kartı sayısı az, hareket sayısı çok olabilir, güncel bakiyeyi HER
// hareketle birlikte güncellemek daha ucuz). Ağırlıklı ortalama maliyet
// yöntemi (PDF'in orijinal ERP promptunun "FIFO/ağırlıklı ortalama/hareketli
// ortalama" seçeneklerinden EN BASİTİ — ileride genişletilebilir, bugün tek
// yöntem, TODO: COSTING_METHOD_CHOICE kalıcı karar değil).
export const stockItems = mysqlTable('stock_items', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  sku: varchar('sku', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  unit: varchar('unit', { length: 16 }).notNull().default('ADET'),
  currentQty: decimal('current_qty', { precision: 20, scale: 6 }).notNull().default('0'),
  avgCost: decimal('avg_cost', { precision: 20, scale: 6 }).notNull().default('0'),
  // Dolu ise, her hareket otomatik muhasebe fişi üretir (Kasa/Banka ile AYNI
  // opsiyonel-entegrasyon deseni) — boşsa Depo yalnızca miktar takibi yapar.
  accountingAccountId: char('accounting_account_id', { length: 36 }).references(() => accountingAccounts.id),
  // Faz 2A (ERP Genişletme) — OPSİYONEL bağlantı, aşağıdaki `products` master
  // tablosuna (dosyanın sonunda tanımlı, bu yüzden AnyMySqlColumn lazy-ref —
  // network_diagrams/diagram_versions'taki AYNI ileri-referans tekniği).
  // Doldurulmazsa stock_items eskisi gibi kendi başına çalışmaya devam eder
  // — mevcut Depo akışı BOZULMAZ.
  productId: char('product_id', { length: 36 }).references((): AnyMySqlColumn => products.id),
  // Holding ERP Faz 3 (MRP) — OPSİYONEL minimum stok/sipariş noktası
  // (madde 20: "Minimum stok"). Şirket-geneli (depo-bazlı DEĞİL) — daha
  // ayrıntılı depo-bazlı politika ihtiyacı doğarsa ayrı bir tabloya
  // taşınabilir, bugünkü ölçek için bu basitleştirme yeterli.
  minQty: decimal('min_qty', { precision: 20, scale: 6 }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_stock_item_company_sku').on(table.companyId, table.sku)]);

export const stockMovements = mysqlTable('stock_movements', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  warehouseId: char('warehouse_id', { length: 36 }).notNull().references(() => warehouses.id),
  stockItemId: char('stock_item_id', { length: 36 }).notNull().references(() => stockItems.id),
  movementType: mysqlEnum('movement_type', STOCK_MOVEMENT_TYPES).notNull(),
  quantity: decimal('quantity', { precision: 20, scale: 6 }).notNull(),
  // IN'de kullanıcı girer (alış maliyeti); OUT'ta o ANKİ ağırlıklı ortalama
  // maliyetten OTOMATİK hesaplanır (kullanıcı girmez) — lib/warehouse.ts.
  unitCost: decimal('unit_cost', { precision: 20, scale: 6 }),
  counterAccountCode: varchar('counter_account_code', { length: 32 }),
  journalId: char('journal_id', { length: 36 }).references(() => accountingJournals.id),
  // Bu hareketin nereden geldiğini işaret eden polimorfik referans — ör.
  // IT'nin work_order_parts'ı (Faz 8) bu alanı dolduracak.
  sourceType: varchar('source_type', { length: 64 }),
  sourceId: char('source_id', { length: 36 }),
  description: text('description'),
  transactionDate: date('transaction_date', { mode: 'string' }).notNull(),
  // Faz 2A — OPSİYONEL bin/rack seviyesi konum (aşağıdaki `wh_locations`,
  // dosyanın sonunda — AnyMySqlColumn lazy-ref). Boşsa hareket yalnızca
  // depo seviyesinde kalır, eski davranış korunur.
  locationId: char('location_id', { length: 36 }).references((): AnyMySqlColumn => whLocations.id),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- IT departmanı — Faz 4 (Asset Management) + Faz 5 (CMDB).
// Şema: IT-DATABASE.md §1-4, CMDB.md. ---

export const IT_LOCATION_TYPES = ['BUILDING', 'FLOOR', 'ROOM', 'RACK', 'DESK', 'DATA_CENTER'] as const;

// IT-DATABASE.md §1 — building→floor→room→rack→desk zinciri, branches'in
// ALTINA eklenen bir hiyerarşi (branches DEĞİŞTİRİLMEDİ).
export const itLocations = mysqlTable('it_locations', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  branchId: char('branch_id', { length: 36 }).references(() => branches.id),
  parentLocationId: char('parent_location_id', { length: 36 }),
  locationType: mysqlEnum('location_type', IT_LOCATION_TYPES).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  rackUnits: int('rack_units'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// PDF madde 3 — kod içine sabit gömülmeyen, seed edilen varlık tipi listesi
// (department_types ile AYNI desen).
export const itAssetTypes = mysqlTable('it_asset_types', {
  code: varchar('code', { length: 32 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull()
});

export const IT_ASSET_STATUSES = [
  'IN_STOCK', 'ASSIGNED', 'INSTALLED', 'IN_SERVICE', 'UNDER_MAINTENANCE',
  'REPAIR', 'LOST', 'STOLEN', 'RETIRED', 'DISPOSED', 'UNKNOWN'
] as const;

export const itAssets = mysqlTable('it_assets', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  branchId: char('branch_id', { length: 36 }).references(() => branches.id),
  locationId: char('location_id', { length: 36 }).references(() => itLocations.id),
  // Hangi departmana zimmetli (Muhasebe/Depo/İK/vb. — IT'nin KENDİSİ değil,
  // bu varlığı KULLANAN departman).
  departmentId: char('department_id', { length: 36 }).references(() => departments.id),
  assetTypeCode: varchar('asset_type_code', { length: 32 }).notNull().references(() => itAssetTypes.code),
  assetTag: varchar('asset_tag', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  manufacturer: varchar('manufacturer', { length: 255 }).notNull().default(''),
  model: varchar('model', { length: 255 }).notNull().default(''),
  serialNumber: varchar('serial_number', { length: 255 }).notNull().default(''),
  status: mysqlEnum('status', IT_ASSET_STATUSES).notNull().default('IN_STOCK'),
  // Faz 14 (Server/VM) — bir VM'in barındığı fiziksel sunucu, AYNI
  // it_assets tablosuna self-referans (VM de bir asset, host da bir
  // asset — PDF'in bu fazına ait ayrı bir doküman/madde metni bu projede
  // hiç yakalanmadı, dürüst bir boşluk; bu alan CMDB'nin RUNS_ON ilişki
  // tipiyle TUTARLI, asset-katmanında hafif bir karşılığı — network_
  // diagrams'taki AnyMySqlColumn self-ref tekniğiyle AYNI).
  hostAssetId: char('host_asset_id', { length: 36 }).references((): AnyMySqlColumn => itAssets.id),
  ownerUserId: char('owner_user_id', { length: 36 }).references(() => users.id),
  responsibleTechnicianId: char('responsible_technician_id', { length: 36 }).references(() => users.id),
  purchaseDate: date('purchase_date', { mode: 'string' }),
  purchaseCost: decimal('purchase_cost', { precision: 20, scale: 6 }),
  warrantyStart: date('warranty_start', { mode: 'string' }),
  warrantyEnd: date('warranty_end', { mode: 'string' }),
  lastInventoryScanAt: timestamp('last_inventory_scan_at'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
}, (table) => [uniqueIndex('udx_it_asset_company_tag').on(table.companyId, table.assetTag)]);

// IT-DATABASE.md §3 — bilgisayara/sunucuya özgü alanlar AYRI (Firewall'da
// CPU alanı anlamsız). 1:1, assetId FK.
export const computerDetails = mysqlTable('computer_details', {
  assetId: char('asset_id', { length: 36 }).primaryKey().references(() => itAssets.id, { onDelete: 'cascade' }),
  hostname: varchar('hostname', { length: 255 }).notNull().default(''),
  os: varchar('os', { length: 255 }).notNull().default(''),
  osVersion: varchar('os_version', { length: 100 }).notNull().default(''),
  cpu: varchar('cpu', { length: 255 }).notNull().default(''),
  ramGb: int('ram_gb'),
  storageGb: int('storage_gb'),
  lastUser: varchar('last_user', { length: 255 }).notNull().default(''),
  antivirusStatus: varchar('antivirus_status', { length: 64 }).notNull().default(''),
  encryptionEnabled: boolean('encryption_enabled').notNull().default(false)
});

// PDF madde 8 — kullanıcı-cihaz N:N geçmişi.
export const ASSIGNMENT_TYPES = ['PERMANENT', 'TEMPORARY', 'SHARED'] as const;

export const itAssetAssignments = mysqlTable('it_asset_assignments', {
  id: char('id', { length: 36 }).primaryKey(),
  assetId: char('asset_id', { length: 36 }).notNull().references(() => itAssets.id, { onDelete: 'cascade' }),
  userId: char('user_id', { length: 36 }).notNull().references(() => users.id),
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  returnedAt: timestamp('returned_at'),
  assignmentType: mysqlEnum('assignment_type', ASSIGNMENT_TYPES).notNull().default('PERMANENT'),
  assignedBy: char('assigned_by', { length: 36 }).notNull().references(() => users.id),
  reason: text('reason')
});

export const itAssetStatusHistory = mysqlTable('it_asset_status_history', {
  id: char('id', { length: 36 }).primaryKey(),
  assetId: char('asset_id', { length: 36 }).notNull().references(() => itAssets.id, { onDelete: 'cascade' }),
  fromStatus: varchar('from_status', { length: 32 }).notNull(),
  toStatus: varchar('to_status', { length: 32 }).notNull(),
  changedBy: char('changed_by', { length: 36 }).notNull().references(() => users.id),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Asset lifecycle geçiş tablosunun (checks.ts/tickets ile AYNI desen)
// numaralandırması İÇİN atomik sayaç — CMDB.md §1'deki "CI_KEY" üretimi
// (ör. SERVER-001), asset_type_code bazında ayrı sayaç.
export const ciKeyCounters = mysqlTable('ci_key_counters', {
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  assetTypeCode: varchar('asset_type_code', { length: 32 }).notNull(),
  lastNumber: int('last_number').notNull().default(0)
}, (table) => [uniqueIndex('udx_ci_key_counter').on(table.companyId, table.assetTypeCode)]);

// --- CMDB (Faz 5) ---

export const CI_TYPES = ['ASSET', 'SERVICE', 'APPLICATION', 'DATABASE'] as const;

export const configurationItems = mysqlTable('configuration_items', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  ciType: mysqlEnum('ci_type', CI_TYPES).notNull().default('ASSET'),
  linkedAssetId: char('linked_asset_id', { length: 36 }).references(() => itAssets.id),
  name: varchar('name', { length: 255 }).notNull(),
  ciKey: varchar('ci_key', { length: 64 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
}, (table) => [uniqueIndex('udx_ci_company_key').on(table.companyId, table.ciKey)]);

// CMDB.md §2 — İLİŞKİ HER ZAMAN TEK YÖNDE saklanır, çift kayıt YAPILMAZ.
export const CI_RELATIONSHIP_TYPES = [
  'DEPENDS_ON', 'RUNS_ON', 'CONNECTED_TO', 'HOSTED_ON', 'LOCATED_IN',
  'OWNED_BY', 'USED_BY', 'BACKED_UP_BY', 'MONITORED_BY', 'PROTECTED_BY',
  'LICENSED_BY', 'SUPPORTED_BY', 'CONTRACTED_BY', 'PARENT_OF', 'CHILD_OF'
] as const;

export const ciRelationships = mysqlTable('ci_relationships', {
  id: char('id', { length: 36 }).primaryKey(),
  sourceCiId: char('source_ci_id', { length: 36 }).notNull().references(() => configurationItems.id, { onDelete: 'cascade' }),
  targetCiId: char('target_ci_id', { length: 36 }).notNull().references(() => configurationItems.id, { onDelete: 'cascade' }),
  relationshipType: mysqlEnum('relationship_type', CI_RELATIONSHIP_TYPES).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- Service Desk (Faz 6-7, SERVICE-DESK.md) ---

// journalNumberCounters ile AYNI desen — şirket+yıl bazlı atomik ticket no.
export const ticketNumberCounters = mysqlTable('ticket_number_counters', {
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  year: int('year').notNull(),
  lastNumber: int('last_number').notNull().default(0)
}, (table) => [uniqueIndex('udx_ticket_counter_company_year').on(table.companyId, table.year)]);

export const TICKET_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;

// SERVICE-DESK.md §2 — business_hours/holiday_calendars İLE ayarlama şimdilik
// YOK (TODO: SLA_AFTER_HOURS_POLICY, BUSINESS_REVIEW gerektiriyor, LEGAL değil).
// resolveSlaDeadline bugün yalnızca createdAt + dakika/saat ekliyor.
export const slaPolicies = mysqlTable('sla_policies', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  priority: mysqlEnum('priority', TICKET_PRIORITIES).notNull(),
  responseMinutes: int('response_minutes').notNull(),
  resolutionHours: int('resolution_hours').notNull(),
  // SERVICE-DESK.md §8 — role code dizisi (ör. ["SERVICE_DESK_AGENT","IT_MANAGER"]),
  // sırayla eskalasyon seviyelerini temsil eder. NULL/boş = bu politika için
  // eskalasyon yapılandırılmamış.
  escalationChain: json('escalation_chain').$type<string[]>(),
  active: boolean('active').notNull().default(true)
}, (table) => [uniqueIndex('udx_sla_policy_company_priority').on(table.companyId, table.priority)]);

// SERVICE-DESK.md §1 — durum makinesi TICKET_TRANSITIONS lib/it/tickets.ts'te.
export const TICKET_STATUSES = [
  'NEW', 'TRIAGED', 'ASSIGNED', 'ACCEPTED', 'ON_THE_WAY', 'ARRIVED', 'INSPECTION',
  'WORKING', 'WAITING', 'TESTING', 'RESOLVED', 'USER_APPROVAL_PENDING', 'CLOSED'
] as const;

// FIELD-SERVICE.md §1 — bir ticket FIELD_SERVICE olduğunda 1:1 bir work_orders
// satırı açılır; durum makinesinin KENDİSİ (TICKET_TRANSITIONS) tekrarlanmaz,
// work_orders yalnızca saha-özel YAN veriyi (konum, checklist, parça) taşır.
export const TICKET_TYPES = ['STANDARD', 'FIELD_SERVICE'] as const;

export const serviceDeskTickets = mysqlTable('service_desk_tickets', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  departmentId: char('department_id', { length: 36 }).notNull().references(() => departments.id),
  ticketNo: varchar('ticket_no', { length: 32 }).notNull(),
  ticketType: mysqlEnum('ticket_type', TICKET_TYPES).notNull().default('STANDARD'),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  category: varchar('category', { length: 64 }).notNull().default(''),
  priority: mysqlEnum('priority', TICKET_PRIORITIES).notNull().default('NORMAL'),
  status: mysqlEnum('status', TICKET_STATUSES).notNull().default('NEW'),
  requestedByUserId: char('requested_by_user_id', { length: 36 }).notNull().references(() => users.id),
  relatedAssetId: char('related_asset_id', { length: 36 }).references(() => itAssets.id),
  relatedCiId: char('related_ci_id', { length: 36 }).references(() => configurationItems.id),
  slaPolicyId: char('sla_policy_id', { length: 36 }).references(() => slaPolicies.id),
  slaDueAt: timestamp('sla_due_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow(),
  closedAt: timestamp('closed_at')
}, (table) => [
  uniqueIndex('udx_ticket_company_no').on(table.companyId, table.ticketNo),
  index('idx_ticket_status').on(table.status),
  index('idx_ticket_priority').on(table.priority)
]);

export const ticketStatusHistory = mysqlTable('ticket_status_history', {
  id: char('id', { length: 36 }).primaryKey(),
  ticketId: char('ticket_id', { length: 36 }).notNull().references(() => serviceDeskTickets.id, { onDelete: 'cascade' }),
  fromStatus: varchar('from_status', { length: 32 }).notNull(),
  toStatus: varchar('to_status', { length: 32 }).notNull(),
  changedBy: char('changed_by', { length: 36 }).notNull().references(() => users.id),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// SERVICE-DESK.md §4 — TAM BİR LEADER zorunlu (uygulama katmanı, transaction
// içinde). it_asset_assignments İLE AYNI desen: unassignedAt IS NULL = aktif.
export const TICKET_ASSIGNMENT_ROLES = ['LEADER', 'MEMBER'] as const;

export const ticketAssignments = mysqlTable('ticket_assignments', {
  id: char('id', { length: 36 }).primaryKey(),
  ticketId: char('ticket_id', { length: 36 }).notNull().references(() => serviceDeskTickets.id, { onDelete: 'cascade' }),
  userId: char('user_id', { length: 36 }).notNull().references(() => users.id),
  role: mysqlEnum('role', TICKET_ASSIGNMENT_ROLES).notNull(),
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  unassignedAt: timestamp('unassigned_at'),
  assignedBy: char('assigned_by', { length: 36 }).notNull().references(() => users.id)
});

// SERVICE-DESK.md §7 — ayrı bir timeline tablosu YOK, comments/work_logs/
// status_history uygulama katmanında UNION edilip sıralanıyor.
export const ticketComments = mysqlTable('ticket_comments', {
  id: char('id', { length: 36 }).primaryKey(),
  ticketId: char('ticket_id', { length: 36 }).notNull().references(() => serviceDeskTickets.id, { onDelete: 'cascade' }),
  authorUserId: char('author_user_id', { length: 36 }).notNull().references(() => users.id),
  body: text('body').notNull(),
  isInternal: boolean('is_internal').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// FIELD-SERVICE.md §5 — billable/non_billable ayrımı için AYRI bir tablo
// AÇILMADI, mevcut ticket_work_logs'a tek sütun eklendi (aynı bilgiyi iki
// yerde tutmama ilkesi, SERVICE-DESK.md §7'nin timeline kararıyla aynı ruh).
// Faturalama zincirinin kendisi Satış departmanı gelene kadar YOK
// (TODO: SALES_DEPARTMENT_INTEGRATION) — bu yalnızca bir bayrak.
export const ticketWorkLogs = mysqlTable('ticket_work_logs', {
  id: char('id', { length: 36 }).primaryKey(),
  ticketId: char('ticket_id', { length: 36 }).notNull().references(() => serviceDeskTickets.id, { onDelete: 'cascade' }),
  userId: char('user_id', { length: 36 }).notNull().references(() => users.id),
  minutesSpent: int('minutes_spent').notNull(),
  billable: boolean('billable').notNull().default(false),
  note: text('note'),
  loggedAt: timestamp('logged_at').notNull().defaultNow()
});

// SERVICE-DESK.md §8 — kalıcı eskalasyon denetim kaydı. Gerçek bildirim
// altyapısı (it_notifications) henüz kurulmadı (IT-ARCHITECTURE.md §3'ün
// kendi TODO: AUDIT_TABLE_REUSE_VS_NEW notu) — bu yüzden "eskalasyon"un
// bugünkü gerçek karşılığı: kalıcı bir kayıt + arayüzde görünürlük, e-posta/
// push bildirimi DEĞİL. lib/scheduler.ts'in periyodik görevi tarafından
// üretilir.
export const ticketEscalations = mysqlTable('ticket_escalations', {
  id: char('id', { length: 36 }).primaryKey(),
  ticketId: char('ticket_id', { length: 36 }).notNull().references(() => serviceDeskTickets.id, { onDelete: 'cascade' }),
  level: int('level').notNull(),
  escalatedToRoleCode: varchar('escalated_to_role_code', { length: 64 }).notNull(),
  escalatedAt: timestamp('escalated_at').notNull().defaultNow()
});

// --- Incident / Problem (SERVICE-DESK.md §5) ---

export const INCIDENT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const INCIDENT_STATUSES = ['OPEN', 'INVESTIGATING', 'RESOLVED', 'CLOSED'] as const;

export const incidents = mysqlTable('incidents', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  severity: mysqlEnum('severity', INCIDENT_SEVERITIES).notNull().default('MEDIUM'),
  status: mysqlEnum('status', INCIDENT_STATUSES).notNull().default('OPEN'),
  openedByUserId: char('opened_by_user_id', { length: 36 }).notNull().references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Bir ticket birden fazla incident'a, bir incident birden fazla ticket'a
// bağlanabilir (N:N) — madde 55-57'nin "20 ticket → 1 incident" örneği.
export const ticketIncidents = mysqlTable('ticket_incidents', {
  ticketId: char('ticket_id', { length: 36 }).notNull().references(() => serviceDeskTickets.id, { onDelete: 'cascade' }),
  incidentId: char('incident_id', { length: 36 }).notNull().references(() => incidents.id, { onDelete: 'cascade' })
}, (table) => [uniqueIndex('udx_ticket_incident').on(table.ticketId, table.incidentId)]);

export const PROBLEM_STATUSES = ['OPEN', 'ROOT_CAUSE_IDENTIFIED', 'RESOLVED', 'CLOSED'] as const;

export const problems = mysqlTable('problems', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  rootCause: text('root_cause'),
  status: mysqlEnum('status', PROBLEM_STATUSES).notNull().default('OPEN'),
  openedByUserId: char('opened_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// SERVICE-DESK.md §5 — problem kapandığında bağlı incident'lar OTOMATİK
// kapanmaz, yalnızca problems.status değişir.
export const problemIncidents = mysqlTable('problem_incidents', {
  problemId: char('problem_id', { length: 36 }).notNull().references(() => problems.id, { onDelete: 'cascade' }),
  incidentId: char('incident_id', { length: 36 }).notNull().references(() => incidents.id, { onDelete: 'cascade' })
}, (table) => [uniqueIndex('udx_problem_incident').on(table.problemId, table.incidentId)]);

// --- Change Management (SERVICE-DESK.md §6) ---

export const CHANGE_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export const CHANGE_STATUSES = ['DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED'] as const;

export const changes = mysqlTable('changes', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  riskLevel: mysqlEnum('risk_level', CHANGE_LEVELS).notNull(),
  impactLevel: mysqlEnum('impact_level', CHANGE_LEVELS).notNull(),
  status: mysqlEnum('status', CHANGE_STATUSES).notNull().default('DRAFT'),
  requestedByUserId: char('requested_by_user_id', { length: 36 }).notNull().references(() => users.id),
  scheduledAt: timestamp('scheduled_at'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const CHANGE_APPROVAL_DECISIONS = ['APPROVED', 'REJECTED'] as const;

export const changeApprovals = mysqlTable('change_approvals', {
  id: char('id', { length: 36 }).primaryKey(),
  changeId: char('change_id', { length: 36 }).notNull().references(() => changes.id, { onDelete: 'cascade' }),
  approvedByUserId: char('approved_by_user_id', { length: 36 }).notNull().references(() => users.id),
  decision: mysqlEnum('decision', CHANGE_APPROVAL_DECISIONS).notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- Field Service (Faz 8, FIELD-SERVICE.md) ---

// §2 — "konum takibini varsayılan sürekli yapma" (PDF madde 88, 132, KVKK).
// Her şirket için TEK satır, KAPALI varsayılan.
export const itPolicies = mysqlTable('it_policies', {
  companyId: char('company_id', { length: 36 }).primaryKey().references(() => companies.id, { onDelete: 'cascade' }),
  continuousLocationTrackingEnabled: boolean('continuous_location_tracking_enabled').notNull().default(false)
});

export const workOrders = mysqlTable('work_orders', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  ticketId: char('ticket_id', { length: 36 }).notNull().unique().references(() => serviceDeskTickets.id, { onDelete: 'cascade' }),
  arrivedAt: timestamp('arrived_at'),
  arrivalLatitude: decimal('arrival_latitude', { precision: 10, scale: 7 }),
  arrivalLongitude: decimal('arrival_longitude', { precision: 10, scale: 7 }),
  customerName: varchar('customer_name', { length: 255 }),
  signatureNote: text('signature_note'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// §2 — source ayrımı: ARRIVAL_BUTTON her zaman izinli (tek nokta), CONTINUOUS
// yalnızca it_policies.continuousLocationTrackingEnabled AÇIKSA kaydedilir.
export const LOCATION_SOURCES = ['ARRIVAL_BUTTON', 'CONTINUOUS'] as const;

export const technicianLocations = mysqlTable('technician_locations', {
  id: char('id', { length: 36 }).primaryKey(),
  userId: char('user_id', { length: 36 }).notNull().references(() => users.id),
  workOrderId: char('work_order_id', { length: 36 }).references(() => workOrders.id, { onDelete: 'cascade' }),
  latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
  source: mysqlEnum('source', LOCATION_SOURCES).notNull(),
  recordedAt: timestamp('recorded_at').notNull().defaultNow()
});

// §3 — şablon SONRADAN değişse bile geçmiş work order'ların checklist'i
// DEĞİŞMEZ: work_order_checklist_items, template_item'lardan bir KEZ
// kopyalanır (Muhasebe'nin mevzuat-effective-dating ilkesiyle AYNI mantık).
export const checklistTemplates = mysqlTable('checklist_templates', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }).notNull()
}, (table) => [uniqueIndex('udx_checklist_template_company_code').on(table.companyId, table.code)]);

export const checklistTemplateItems = mysqlTable('checklist_template_items', {
  id: char('id', { length: 36 }).primaryKey(),
  templateId: char('template_id', { length: 36 }).notNull().references(() => checklistTemplates.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 255 }).notNull(),
  orderIndex: int('order_index').notNull().default(0)
});

// MySQL'in 64-karakter identifier sınırı (fixed_assets'te daha önce yaşanan
// GERÇEK aynı hata — bkz. proje notları): "work_order_checklists" tablo adı
// "work_order_checklist_items"in FK adıyla birleşince sınırı aşıyordu, "wo_"
// kısaltmasıyla tablo adları kısaltıldı.
export const workOrderChecklists = mysqlTable('wo_checklists', {
  id: char('id', { length: 36 }).primaryKey(),
  workOrderId: char('work_order_id', { length: 36 }).notNull().unique().references(() => workOrders.id, { onDelete: 'cascade' }),
  templateId: char('template_id', { length: 36 }).references(() => checklistTemplates.id)
});

export const workOrderChecklistItems = mysqlTable('wo_checklist_items', {
  id: char('id', { length: 36 }).primaryKey(),
  checklistId: char('checklist_id', { length: 36 }).notNull().references(() => workOrderChecklists.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 255 }).notNull(),
  orderIndex: int('order_index').notNull().default(0),
  checked: boolean('checked').notNull().default(false),
  note: text('note'),
  checkedAt: timestamp('checked_at'),
  checkedBy: char('checked_by', { length: 36 }).references(() => users.id)
});

// §4 — IT-ARCHITECTURE.md §9 Risk 1'in çözümü: ayrı bir "spare_parts" basit
// sayacı YOK, Depo departmanının GERÇEK stock_items/stock_movements'ı
// kullanılıyor (lib/warehouse.ts:recordStockMovement, OUT hareketi,
// sourceType='WORK_ORDER_PART'). unitCost, tüketim ANINDAKİ ortalama
// maliyetin SNAPSHOT'ı — sonradan stok maliyeti değişse bile bu satır
// değişmez (fixed_assets/muhasebe'deki "geçmiş kayıt sabit kalır" ilkesiyle
// AYNI).
export const workOrderParts = mysqlTable('work_order_parts', {
  id: char('id', { length: 36 }).primaryKey(),
  workOrderId: char('work_order_id', { length: 36 }).notNull().references(() => workOrders.id, { onDelete: 'cascade' }),
  stockItemId: char('stock_item_id', { length: 36 }).notNull().references(() => stockItems.id),
  stockMovementId: char('stock_movement_id', { length: 36 }).notNull().references(() => stockMovements.id),
  quantity: decimal('quantity', { precision: 20, scale: 6 }).notNull(),
  unitCost: decimal('unit_cost', { precision: 20, scale: 6 }).notNull(),
  billable: boolean('billable').notNull().default(false),
  consumedAt: timestamp('consumed_at').notNull().defaultNow(),
  consumedByUserId: char('consumed_by_user_id', { length: 36 }).notNull().references(() => users.id)
});

// --- Maintenance (Faz 9, MAINTENANCE.md — madde 61-67) ---

export const MAINTENANCE_TYPES = ['PREVENTIVE', 'CORRECTIVE', 'PREDICTIVE', 'INSPECTION', 'CALIBRATION'] as const;
export const MAINTENANCE_FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'] as const;

// §1 — assigned_team_id ve sla_policy_id PDF'de var ama bugün "takım"
// (team) diye bir varlık şemada YOK (icat edilmedi, PDF'in "gereksiz
// abstraction yapma" ilkesiyle tutarlı) — yalnızca tek bir teknisyene
// atanabiliyor. SLA zaten ticket'ın kendi priority'sinden otomatik
// (lib/it/tickets.ts:createTicket), ayrıca burada tekrarlanmıyor.
// MySQL'in 64-karakter identifier sınırı — bu proje boyunca üçüncü kez
// karşılaşılan aynı gerçek hata (fixed_assets, work_order_checklists,
// şimdi burada) — baştan "maint_" kısaltmasıyla tablo adları kısaltıldı,
// migration denemeden önce FK adı uzunluğu hesaplanarak doğrulandı.
export const maintenancePlans = mysqlTable('maint_plans', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  assetId: char('asset_id', { length: 36 }).references(() => itAssets.id),
  title: varchar('title', { length: 255 }).notNull(),
  maintenanceType: mysqlEnum('maintenance_type', MAINTENANCE_TYPES).notNull(),
  frequency: mysqlEnum('frequency', MAINTENANCE_FREQUENCIES).notNull(),
  intervalValue: int('interval_value').notNull().default(1),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  nextDueDate: date('next_due_date', { mode: 'string' }).notNull(),
  assignedTechnicianId: char('assigned_technician_id', { length: 36 }).references(() => users.id),
  checklistTemplateId: char('checklist_template_id', { length: 36 }).references(() => checklistTemplates.id),
  estimatedDurationMinutes: int('estimated_duration_minutes'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// §2 — UNIQUE(plan, tarih) bilinçli: üretim görevi İKİ KEZ çalıştırılsa bile
// aynı gün için ikinci bir work order AÇILMAZ (fixed_assets'teki "ay başına
// bir amortisman" korumasıyla AYNI desen).
export const maintenanceWorkOrders = mysqlTable('maint_work_orders', {
  id: char('id', { length: 36 }).primaryKey(),
  maintenancePlanId: char('maintenance_plan_id', { length: 36 }).notNull().references(() => maintenancePlans.id, { onDelete: 'cascade' }),
  workOrderId: char('work_order_id', { length: 36 }).notNull().unique().references(() => workOrders.id, { onDelete: 'cascade' }),
  scheduledDate: date('scheduled_date', { mode: 'string' }).notNull(),
  generatedAt: timestamp('generated_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_maint_wo_plan_date').on(table.maintenancePlanId, table.scheduledDate)]);

// --- License / Warranty / Contract (Faz 10) ---

// IT-ARCHITECTURE.md §4 — Vendor, Muhasebe'ye OPSİYONEL bağlanır (madde 125):
// bir tedarikçinin hesap planındaki karşılığı varsa işaretlenebilir, ama bu
// GERÇEK bir cari/fatura zinciri DEĞİL (o, Satış departmanı geldiğinde
// kurulacak — TODO: SALES_DEPARTMENT_INTEGRATION, FIELD-SERVICE.md §5'teki
// AYNI sınır).
export const vendors = mysqlTable('vendors', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  contactName: varchar('contact_name', { length: 255 }).notNull().default(''),
  contactEmail: varchar('contact_email', { length: 255 }).notNull().default(''),
  contactPhone: varchar('contact_phone', { length: 32 }).notNull().default(''),
  accountingAccountId: char('accounting_account_id', { length: 36 }).references(() => accountingAccounts.id),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// "sw_" kısaltması bilinçli — MySQL'in 64-karakter FK sınırı bu projede üç
// kez yaşandı (fixed_assets, work_order_checklists, maintenance_*), bu kez
// migration denemeden önce hesaplanıp baştan kısaltıldı.
export const softwareProducts = mysqlTable('sw_products', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  publisher: varchar('publisher', { length: 255 }).notNull().default(''),
  vendorId: char('vendor_id', { length: 36 }).references(() => vendors.id)
});

// "Hangi varlıkta hangi yazılım kurulu" — Software Asset Management'ın
// temeli, lisans tüketiminden (license_assignments) AYRI bir kavram: bir
// kurulum lisanssız da olabilir (henüz atanmamış/free tier).
export const softwareInstallations = mysqlTable('sw_installations', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  productId: char('product_id', { length: 36 }).notNull().references(() => softwareProducts.id),
  assetId: char('asset_id', { length: 36 }).notNull().references(() => itAssets.id),
  installedVersion: varchar('installed_version', { length: 64 }).notNull().default(''),
  installedAt: timestamp('installed_at').notNull().defaultNow()
});

export const softwareLicenses = mysqlTable('sw_licenses', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  productId: char('product_id', { length: 36 }).notNull().references(() => softwareProducts.id),
  vendorId: char('vendor_id', { length: 36 }).references(() => vendors.id),
  licenseKey: varchar('license_key', { length: 255 }).notNull().default(''),
  seats: int('seats').notNull().default(1),
  purchaseDate: date('purchase_date', { mode: 'string' }),
  expiresAt: date('expires_at', { mode: 'string' }),
  cost: decimal('cost', { precision: 20, scale: 6 }),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Bir kurulum EN FAZLA bir lisansa bağlanabilir (unique installationId) —
// koltuk (seat) sayısı aşılırsa lib katmanı reddeder (uygulama-katmanı
// kontrol, MySQL'de "COUNT(*) <= seats" ifade eden bir constraint pratik
// değil — aynı gerekçe ticket_assignments'taki tek-LEADER kontrolüyle).
export const licenseAssignments = mysqlTable('license_assignments', {
  id: char('id', { length: 36 }).primaryKey(),
  licenseId: char('license_id', { length: 36 }).notNull().references(() => softwareLicenses.id, { onDelete: 'cascade' }),
  installationId: char('installation_id', { length: 36 }).notNull().unique().references(() => softwareInstallations.id, { onDelete: 'cascade' }),
  assignedAt: timestamp('assigned_at').notNull().defaultNow()
});

// it_assets.warrantyStart/warrantyEnd (Faz 4) İLE KARIŞTIRILMASIN: o alanlar
// "şu an geçerli garanti" özet görünümü (asset listesinde tek satır), BU
// tablo garantinin TAM geçmişi/detayı (bir varlığın zaman içinde birden
// fazla garanti kaydı olabilir — orijinal + uzatılmış gibi) — asset
// durumu/durum geçmişi ayrımıyla AYNI desen (özet alan + ayrı geçmiş tablosu).
export const warranties = mysqlTable('warranties', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  assetId: char('asset_id', { length: 36 }).notNull().references(() => itAssets.id),
  vendorId: char('vendor_id', { length: 36 }).references(() => vendors.id),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }).notNull(),
  terms: text('terms'),
  cost: decimal('cost', { precision: 20, scale: 6 }),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const CONTRACT_TYPES = ['SUPPORT', 'MAINTENANCE', 'SERVICE', 'LEASE', 'OTHER'] as const;

export const contracts = mysqlTable('contracts', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  vendorId: char('vendor_id', { length: 36 }).references(() => vendors.id),
  title: varchar('title', { length: 255 }).notNull(),
  contractType: mysqlEnum('contract_type', CONTRACT_TYPES).notNull().default('OTHER'),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }).notNull(),
  cost: decimal('cost', { precision: 20, scale: 6 }),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const contractAssets = mysqlTable('contract_assets', {
  contractId: char('contract_id', { length: 36 }).notNull().references(() => contracts.id, { onDelete: 'cascade' }),
  assetId: char('asset_id', { length: 36 }).notNull().references(() => itAssets.id, { onDelete: 'cascade' })
}, (table) => [uniqueIndex('udx_contract_asset').on(table.contractId, table.assetId)]);

// --- IPAM / Network (Faz 11, IPAM.md + NETWORK.md §1-2) ---

// NETWORK.md §2 — network_vlans, network_subnets'e (aşağıda) İKİ YÖNLÜ
// referans veriyor (subnet_id burada, vlan_id orada) — PDF'in kendi
// tasarımı böyle; ikisi de NULL olabildiği için MySQL'de sorun değil
// (drizzle-kit tüm FK'ları CREATE TABLE'lardan SONRA, ayrı ALTER TABLE
// ifadeleriyle ekliyor — bu projedeki her migration dosyasında zaten
// gözlemlenen davranış).
export const networkVlans = mysqlTable('network_vlans', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  branchId: char('branch_id', { length: 36 }).references(() => branches.id),
  vlanNumber: int('vlan_number').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  subnetId: char('subnet_id', { length: 36 }).references((): AnyMySqlColumn => networkSubnets.id),
  gateway: varchar('gateway', { length: 64 }).notNull().default(''),
  dhcpEnabled: boolean('dhcp_enabled').notNull().default(false),
  purpose: varchar('purpose', { length: 255 }).notNull().default(''),
  networkZone: varchar('network_zone', { length: 64 }).notNull().default(''),
  securityLevel: varchar('security_level', { length: 32 }).notNull().default('')
}, (table) => [uniqueIndex('udx_vlan_company_branch_number').on(table.companyId, table.branchId, table.vlanNumber)]);

export const networkSubnets = mysqlTable('network_subnets', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  branchId: char('branch_id', { length: 36 }).references(() => branches.id),
  cidr: varchar('cidr', { length: 64 }).notNull(),
  gateway: varchar('gateway', { length: 64 }).notNull().default(''),
  dnsPrimary: varchar('dns_primary', { length: 64 }).notNull().default(''),
  dnsSecondary: varchar('dns_secondary', { length: 64 }).notNull().default(''),
  vlanId: char('vlan_id', { length: 36 }).references(() => networkVlans.id),
  dhcpEnabled: boolean('dhcp_enabled').notNull().default(false),
  description: text('description'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// IPAM.md §1 — bilinçli karar (TODO: IP_RANGE_DISPLAY_STRATEGY çözüldü):
// bir subnet'in TÜM adresleri ÖNCEDEN satır olarak oluşturulmaz (bir /16
// 65k+ satır demek, gereksiz depolama) — yalnızca GERÇEKTEN atanmış/
// rezerve/çakışan adresler burada satır tutar, "boş" adresler CIDR
// aralığından UI'de HESAPLANARAK gösterilir (lib/it/ipam.ts:
// listAvailableIps).
export const IP_VERSIONS = ['IPV4', 'IPV6'] as const;
export const IP_STATUSES = ['AVAILABLE', 'ASSIGNED', 'RESERVED', 'CONFLICT', 'BLOCKED', 'UNKNOWN'] as const;

export const ipAddresses = mysqlTable('ip_addresses', {
  id: char('id', { length: 36 }).primaryKey(),
  subnetId: char('subnet_id', { length: 36 }).notNull().references(() => networkSubnets.id, { onDelete: 'cascade' }),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  ipVersion: mysqlEnum('ip_version', IP_VERSIONS).notNull().default('IPV4'),
  status: mysqlEnum('status', IP_STATUSES).notNull().default('AVAILABLE')
}, (table) => [uniqueIndex('udx_ip_subnet_address').on(table.subnetId, table.ipAddress)]);

export const networkInterfaces = mysqlTable('network_interfaces', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  assetId: char('asset_id', { length: 36 }).notNull().references(() => itAssets.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 64 }).notNull(),
  macAddress: varchar('mac_address', { length: 17 }).notNull().default(''),
  interfaceType: mysqlEnum('interface_type', ['ETHERNET', 'FIBER', 'WIFI']).notNull().default('ETHERNET'),
  switchPortId: char('switch_port_id', { length: 36 }).references((): AnyMySqlColumn => networkInterfaces.id),
  vlanId: char('vlan_id', { length: 36 }).references(() => networkVlans.id),
  status: varchar('status', { length: 32 }).notNull().default('UP')
});

// IPAM.md §2 — ip_addresses.status='ASSIGNED' olması İÇİN aktif (releasedAt
// IS NULL) bir satır ZORUNLU; status ELLE güncellenmez, yalnızca
// lib/it/ipam.ts:assignIp/releaseIp üzerinden (tutarsızlık riskine karşı,
// it_asset_assignments'taki AYNI ilke).
export const IP_ASSIGNMENT_TYPES = ['STATIC', 'DHCP', 'RESERVED'] as const;

export const ipAssignments = mysqlTable('ip_assignments', {
  id: char('id', { length: 36 }).primaryKey(),
  ipAddressId: char('ip_address_id', { length: 36 }).notNull().references(() => ipAddresses.id, { onDelete: 'cascade' }),
  assetId: char('asset_id', { length: 36 }).references(() => itAssets.id),
  networkInterfaceId: char('network_interface_id', { length: 36 }).references(() => networkInterfaces.id),
  assignmentType: mysqlEnum('assignment_type', IP_ASSIGNMENT_TYPES).notNull().default('STATIC'),
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
  releasedAt: timestamp('released_at')
});

// --- Network Diagram (Faz 12, NETWORK.md §3) ---

// DATABASE-ARCHITECTURE.md'nin genel ilkesiyle AYNI: topoloji SADECE
// frontend canvas state olarak SAKLANMAZ — gerçek, yapılandırılmış
// düğüm/bağlantı verisi (aşağıda) kalıcı tutulur. Her düzenleme YENİ bir
// diagram_versions satırı açar, ESKİ versiyon SİLİNMEZ (Muhasebe'nin
// financial immutability ilkesiyle AYNI disiplin — burada "ağ konfigürasyon
// geçmişi" için). "diagram_versions" (network_ önekisiz) — network_diagrams
// ile İKİ YÖNLÜ referansı MySQL'in 64-karakter FK sınırına sığdırmak için
// bilinçli kısaltma (bu projede beşinci kez karşılaşılan aynı sınır).
export const networkDiagrams = mysqlTable('network_diagrams', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  currentVersionId: char('current_version_id', { length: 36 }).references((): AnyMySqlColumn => diagramVersions.id)
});

export const diagramVersions = mysqlTable('diagram_versions', {
  id: char('id', { length: 36 }).primaryKey(),
  diagramId: char('diagram_id', { length: 36 }).notNull().references(() => networkDiagrams.id, { onDelete: 'cascade' }),
  versionNo: int('version_no').notNull(),
  createdBy: char('created_by', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_diagram_version_no').on(table.diagramId, table.versionNo)]);

export const NETWORK_NODE_TYPES = [
  'FIREWALL', 'ROUTER', 'SWITCH', 'SERVER', 'ACCESS_POINT', 'PRINTER',
  'COMPUTER', 'CAMERA', 'NVR', 'INTERNET', 'CLOUD'
] as const;

// linkedAssetId NULL olabilir — INTERNET/CLOUD gibi soyut düğümlerin bir
// it_assets karşılığı yok, bu durumda "label" görüntülenen ad olur.
export const networkNodes = mysqlTable('network_nodes', {
  id: char('id', { length: 36 }).primaryKey(),
  diagramVersionId: char('diagram_version_id', { length: 36 }).notNull().references(() => diagramVersions.id, { onDelete: 'cascade' }),
  nodeType: mysqlEnum('node_type', NETWORK_NODE_TYPES).notNull(),
  linkedAssetId: char('linked_asset_id', { length: 36 }).references(() => itAssets.id),
  label: varchar('label', { length: 255 }).notNull().default(''),
  positionX: int('position_x').notNull().default(0),
  positionY: int('position_y').notNull().default(0)
});

export const networkLinks = mysqlTable('network_links', {
  id: char('id', { length: 36 }).primaryKey(),
  diagramVersionId: char('diagram_version_id', { length: 36 }).notNull().references(() => diagramVersions.id, { onDelete: 'cascade' }),
  sourceNodeId: char('source_node_id', { length: 36 }).notNull().references(() => networkNodes.id, { onDelete: 'cascade' }),
  targetNodeId: char('target_node_id', { length: 36 }).notNull().references(() => networkNodes.id, { onDelete: 'cascade' }),
  port: varchar('port', { length: 64 }).notNull().default(''),
  vlanId: char('vlan_id', { length: 36 }).references(() => networkVlans.id),
  bandwidth: varchar('bandwidth', { length: 64 }).notNull().default(''),
  interfaceName: varchar('interface_name', { length: 64 }).notNull().default('')
});

// --- Network Credentials / Secret Vault (Faz 3 gap, IT-SECURITY.md §1) ---

export const NETWORK_CREDENTIAL_TYPES = ['SSH', 'SNMP_COMMUNITY', 'API_KEY', 'VPN'] as const;

// encryptedSecret ("enc:" önekli, lib/crypto.ts) FRONTEND'E ASLA
// gönderilmez — bu tabloyu okuyan HER sorgu bu alanı AÇIKÇA hariç tutmalı,
// SELECT * kullanılmamalı (lib/it/network-credentials.ts'in kendi disiplini).
export const networkCredentials = mysqlTable('network_credentials', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  assetId: char('asset_id', { length: 36 }).references(() => itAssets.id),
  credentialType: mysqlEnum('credential_type', NETWORK_CREDENTIAL_TYPES).notNull(),
  label: varchar('label', { length: 255 }).notNull().default(''),
  encryptedSecret: text('encrypted_secret').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- Monitoring (Faz 13, MONITORING.md) ---

export const MONITOR_TARGET_TYPES = ['PING', 'SNMP', 'SERVICE', 'PORT'] as const;

// "monitor_targets" (monitoring_ değil) — MySQL 64-karakter FK sınırına
// sığdırmak için bilinçli kısaltma (bu projede altıncı kez proaktif önlenen
// aynı sınır). config JSON'da düz metin sır TUTULMAZ — gerçek SNMP
// community/agent anahtarı gerekiyorsa network_credentials'a referans
// verilir (credentialId), config yalnızca OID/port gibi hassas OLMAYAN
// ayarları taşır.
export const monitorTargets = mysqlTable('monitor_targets', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  assetId: char('asset_id', { length: 36 }).notNull().references(() => itAssets.id, { onDelete: 'cascade' }),
  targetType: mysqlEnum('target_type', MONITOR_TARGET_TYPES).notNull(),
  credentialId: char('credential_id', { length: 36 }).references(() => networkCredentials.id),
  config: json('config').$type<Record<string, string | number>>(),
  intervalSeconds: int('interval_seconds').notNull().default(300),
  active: boolean('active').notNull().default(true)
});

// MONITORING.md §4 — üretim ölçeğinde MySQL PARTITION BY RANGE (aylık)
// gerekiyor; drizzle-kit'in tablo DSL'i bunu doğrudan ifade edemiyor (ham
// SQL migration + partition bakım görevi gerektirir) — TODO:
// METRICS_PARTITIONING, gerçek veri hacmi bu ihtiyacı doğurduğunda ele
// alınacak. Bugün normal (partition'sız) bir tablo — retention/aggregation
// mantığı (lib/it/monitoring.ts:pruneOldMetrics) ZATEN gerçek ve
// çalışıyor, yalnızca DELETE ile (partition DROP değil).
export const monitoringMetrics = mysqlTable('monitoring_metrics', {
  id: char('id', { length: 36 }).primaryKey(),
  targetId: char('target_id', { length: 36 }).notNull().references(() => monitorTargets.id, { onDelete: 'cascade' }),
  metricName: varchar('metric_name', { length: 64 }).notNull(),
  value: decimal('value', { precision: 20, scale: 6 }).notNull(),
  recordedAt: timestamp('recorded_at').notNull().defaultNow()
}, (table) => [index('idx_metric_target_recorded').on(table.targetId, table.recordedAt)]);

export const ALERT_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO'] as const;
export const ALERT_STATUSES = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'] as const;

// MONITORING.md §3 — correlationGroupId: aynı target'tan kısa sürede
// (CORRELATION_WINDOW_SECONDS) birden fazla alert gelirse SONRAKİ alert'ler
// AYNI grubu paylaşır (ham veri kaybolmaz, her biri yine satır olur) ama
// Incident zinciri yalnızca grubun İLK alert'i için tetiklenir.
export const monitoringAlerts = mysqlTable('monitoring_alerts', {
  id: char('id', { length: 36 }).primaryKey(),
  targetId: char('target_id', { length: 36 }).notNull().references(() => monitorTargets.id, { onDelete: 'cascade' }),
  severity: mysqlEnum('severity', ALERT_SEVERITIES).notNull(),
  message: text('message').notNull(),
  status: mysqlEnum('status', ALERT_STATUSES).notNull().default('OPEN'),
  correlationGroupId: char('correlation_group_id', { length: 36 }),
  incidentId: char('incident_id', { length: 36 }).references(() => incidents.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// MONITORING.md §4 — ham metrik 30 gün sonra silinir (bugün DELETE ile,
// TODO: METRICS_PARTITIONING gerçek hacimde partition DROP'a geçecek), bu
// tablo o silmeden ÖNCE günlük özet (avg/min/max) olarak kalıcı tutar —
// lib/it/monitoring.ts:pruneOldMetrics'in aynı transaction'ında yazılır.
export const monitoringMetricsDailyAgg = mysqlTable('monitoring_metrics_daily_agg', {
  id: char('id', { length: 36 }).primaryKey(),
  targetId: char('target_id', { length: 36 }).notNull().references(() => monitorTargets.id, { onDelete: 'cascade' }),
  metricName: varchar('metric_name', { length: 64 }).notNull(),
  date: date('date', { mode: 'string' }).notNull(),
  avgValue: decimal('avg_value', { precision: 20, scale: 6 }).notNull(),
  minValue: decimal('min_value', { precision: 20, scale: 6 }).notNull(),
  maxValue: decimal('max_value', { precision: 20, scale: 6 }).notNull(),
  sampleCount: int('sample_count').notNull()
}, (table) => [uniqueIndex('udx_metric_agg_target_name_date').on(table.targetId, table.metricName, table.date)]);

// MONITORING.md §5 — her gün sonunda (scheduler) o günün metriklerinden
// hesaplanıp buraya YAZILIR, Muhasebe'nin "ham tabloyu her seferinde
// tarama" karşıtı ilkesiyle AYNI mantık (madde 87), zaman-serisi versiyonu.
export const monitoringAvailability = mysqlTable('monitoring_availability', {
  id: char('id', { length: 36 }).primaryKey(),
  targetId: char('target_id', { length: 36 }).notNull().references(() => monitorTargets.id, { onDelete: 'cascade' }),
  date: date('date', { mode: 'string' }).notNull(),
  uptimeSeconds: int('uptime_seconds').notNull().default(0),
  downtimeSeconds: int('downtime_seconds').notNull().default(0),
  availabilityPercent: decimal('availability_percent', { precision: 5, scale: 2 }).notNull().default('0')
}, (table) => [uniqueIndex('udx_availability_target_date').on(table.targetId, table.date)]);

// --- Backup Management (MONITORING.md §6) ---

export const backupJobs = mysqlTable('backup_jobs', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  assetId: char('asset_id', { length: 36 }).notNull().references(() => itAssets.id),
  source: varchar('source', { length: 255 }).notNull(),
  destination: varchar('destination', { length: 255 }).notNull(),
  schedule: varchar('schedule', { length: 64 }).notNull().default(''),
  retentionDays: int('retention_days').notNull().default(30),
  encryption: boolean('encryption').notNull().default(false),
  active: boolean('active').notNull().default(true)
});

export const BACKUP_RESULTS = ['SUCCESS', 'FAILED', 'PARTIAL'] as const;

// result='FAILED' -> lib/it/backup.ts:recordBackupResult OTOMATİK bir
// monitoring_alerts satırı (severity='HIGH') üretir (madde 75'in kendi isteği).
export const backupResults = mysqlTable('backup_results', {
  id: char('id', { length: 36 }).primaryKey(),
  backupJobId: char('backup_job_id', { length: 36 }).notNull().references(() => backupJobs.id, { onDelete: 'cascade' }),
  startedAt: timestamp('started_at').notNull(),
  finishedAt: timestamp('finished_at'),
  result: mysqlEnum('result', BACKUP_RESULTS).notNull(),
  sizeBytes: decimal('size_bytes', { precision: 20, scale: 0 }),
  verificationStatus: varchar('verification_status', { length: 32 }).notNull().default(''),
  errorMessage: text('error_message')
});

// --- Endpoint Compliance (IT-SECURITY.md §4) ---

export const COMPLIANCE_STATUSES = ['COMPLIANT', 'NON_COMPLIANT', 'UNKNOWN'] as const;

// "overall" uygulama katmanında HESAPLANIR (lib/it/compliance.ts) — DB
// trigger DEĞİL, madde 87'nin "hesaplama uygulama katmanında" ilkesi.
export const endpointCompliance = mysqlTable('endpoint_compliance', {
  id: char('id', { length: 36 }).primaryKey(),
  assetId: char('asset_id', { length: 36 }).notNull().references(() => itAssets.id, { onDelete: 'cascade' }),
  antivirusStatus: varchar('antivirus_status', { length: 32 }).notNull().default('UNKNOWN'),
  firewallStatus: varchar('firewall_status', { length: 32 }).notNull().default('UNKNOWN'),
  encryptionStatus: varchar('encryption_status', { length: 32 }).notNull().default('UNKNOWN'),
  patchStatus: varchar('patch_status', { length: 32 }).notNull().default('UNKNOWN'),
  osSupportStatus: varchar('os_support_status', { length: 32 }).notNull().default('UNKNOWN'),
  overall: mysqlEnum('overall', COMPLIANCE_STATUSES).notNull().default('UNKNOWN'),
  checkedAt: timestamp('checked_at').notNull().defaultNow()
});

// --- Knowledge Base (Faz 15) ---
// IT-ARCHITECTURE.md'nin Faz listesinde yalnızca başlığı var — Faz 14
// (Server/VM) ile AYNI dürüst boşluk, bu fazın kendi PDF metni bu proje
// boyunca hiç yakalanmadı. Standart bir ITSM bilgi bankası olarak
// yorumlandı: kategori ağacı + makale, ticket kategorileriyle GEVŞEK
// ilişkili (madde referansı yok, bu yüzden zorunlu bir FK yerine serbest
// metin "category" alanı — SERVICE-DESK.md'nin kendi ticket.category'siyle
// AYNI serbest-metin yaklaşımı).
export const kbCategories = mysqlTable('kb_categories', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  parentCategoryId: char('parent_category_id', { length: 36 }).references((): AnyMySqlColumn => kbCategories.id)
});

export const kbArticles = mysqlTable('kb_articles', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  categoryId: char('category_id', { length: 36 }).references(() => kbCategories.id),
  title: varchar('title', { length: 255 }).notNull(),
  content: text('content').notNull(),
  authorUserId: char('author_user_id', { length: 36 }).notNull().references(() => users.id),
  viewCount: int('view_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
});

// PDF madde 79 — idempotency (API-ARCHITECTURE.md §4).
export const idempotencyKeys = mysqlTable('idempotency_keys', {
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  requestHash: varchar('request_hash', { length: 64 }).notNull(),
  responseSnapshot: json('response_snapshot'),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_idempotency_key_endpoint').on(table.idempotencyKey, table.endpoint)]);

// --- ERP Genişletme Faz 1 — Master Data: Party/Product/Currency/Unit/Fiyat
// Listesi. ERP-GENİŞLEME-FİZİBİLİTE raporunun kararı: TÜM yeni master data
// company_id ile scope edilir (accounting_accounts/warehouses/stock_items
// İLE AYNI disiplin — holding-geneli paylaşım TODO: HOLDING_ACCOUNT_PLAN_
// SCOPE çözülene kadar ertelendi, mevcut tutarsızlık büyütülmedi, aynı
// desene uyuldu). Hiçbir mevcut Muhasebe/Depo/IT tablosu DEĞİŞTİRİLMEDİ —
// yalnızca opsiyonel bağlantılar eklendi (yukarıda stock_items.productId,
// stock_movements.locationId). ---

export const currencies = mysqlTable('currencies', {
  code: char('code', { length: 3 }).primaryKey(), // ISO 4217 — TRY/USD/EUR/...
  name: varchar('name', { length: 100 }).notNull(),
  symbol: varchar('symbol', { length: 8 }).notNull().default(''),
  decimalPlaces: int('decimal_places').notNull().default(2),
  active: boolean('active').notNull().default(true)
});

export const EXCHANGE_RATE_TYPES = ['BUY', 'SELL', 'EFFECTIVE', 'CENTRAL_BANK', 'CUSTOM'] as const;

export const exchangeRates = mysqlTable('exchange_rates', {
  id: char('id', { length: 36 }).primaryKey(),
  currencyCode: char('currency_code', { length: 3 }).notNull().references(() => currencies.code),
  rateDate: date('rate_date', { mode: 'string' }).notNull(),
  rate: decimal('rate', { precision: 20, scale: 6 }).notNull(),
  rateType: mysqlEnum('rate_type', EXCHANGE_RATE_TYPES).notNull().default('EFFECTIVE'),
  source: varchar('source', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_exchange_rate_currency_date_type').on(table.currencyCode, table.rateDate, table.rateType)]);

// Doluysa bu birim türetilmiştir: 1 bu birim = conversionFactor × baseUnit
// (madde 21 — "base unit ve conversion factor mantığı"). Boşsa bu birimin
// KENDİSİ bir taban birimdir (ör. ADET, KG).
export const units = mysqlTable('units', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 16 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  baseUnitId: char('base_unit_id', { length: 36 }).references((): AnyMySqlColumn => units.id),
  conversionFactor: decimal('conversion_factor', { precision: 20, scale: 6 }),
  active: boolean('active').notNull().default(true)
}, (table) => [uniqueIndex('udx_unit_company_code').on(table.companyId, table.code)]);

// MySQL 64 karakter FK isim sınırı — kendine-referanslı bir kategori ağacı
// için "product_categories" adı kb_categories'te olduğu gibi kısaltıldı.
export const productCats = mysqlTable('product_cats', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  parentCategoryId: char('parent_category_id', { length: 36 }).references((): AnyMySqlColumn => productCats.id),
  code: varchar('code', { length: 32 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  active: boolean('active').notNull().default(true)
}, (table) => [uniqueIndex('udx_product_cat_company_code').on(table.companyId, table.code)]);

export const brands = mysqlTable('brands', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  active: boolean('active').notNull().default(true)
});

export const PRODUCT_TYPES = ['STOCK_ITEM', 'SERVICE', 'ASSET', 'KIT', 'NON_STOCK', 'CONSUMABLE', 'SPARE_PART'] as const;
export const PRODUCT_TRACKING_TYPES = ['NONE', 'SERIAL', 'LOT'] as const;

// PDF madde 189-190 — tek Ürün Master'ı: it_assets/stock_items/sw_products
// KENDİ alanlarını korur (donanım/lisans-özel alanlar), bu tablo onları
// DEĞİŞTİRMEZ — yalnızca Satınalma/Satış'ın ihtiyaç duyacağı GENEL ürün
// kavramını sağlar.
export const products = mysqlTable('products', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  sku: varchar('sku', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  shortName: varchar('short_name', { length: 100 }).notNull().default(''),
  description: text('description'),
  brandId: char('brand_id', { length: 36 }).references(() => brands.id),
  categoryId: char('category_id', { length: 36 }).references(() => productCats.id),
  productType: mysqlEnum('product_type', PRODUCT_TYPES).notNull().default('STOCK_ITEM'),
  baseUnitId: char('base_unit_id', { length: 36 }).notNull().references(() => units.id),
  purchaseUnitId: char('purchase_unit_id', { length: 36 }).references(() => units.id),
  salesUnitId: char('sales_unit_id', { length: 36 }).references(() => units.id),
  trackingType: mysqlEnum('tracking_type', PRODUCT_TRACKING_TYPES).notNull().default('NONE'),
  // Basit varyant desteği (madde 26) — tam bir öznitelik/matris sistemi
  // BİLİNÇLİ OLARAK kapsam dışı, yalnızca "bu ürün şu ürünün varyantı"
  // ilişkisi (ör. "Dell Latitude" (parent) → "16GB/512GB/i5" (variant)).
  parentProductId: char('parent_product_id', { length: 36 }).references((): AnyMySqlColumn => products.id),
  taxRatePercent: decimal('tax_rate_percent', { precision: 5, scale: 2 }),
  active: boolean('active').notNull().default(true),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
}, (table) => [uniqueIndex('udx_product_company_sku').on(table.companyId, table.sku)]);

export const BARCODE_TYPES = ['EAN13', 'EAN8', 'UPC', 'CODE128', 'CUSTOM'] as const;

export const productBarcodes = mysqlTable('product_barcodes', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  productId: char('product_id', { length: 36 }).notNull().references(() => products.id, { onDelete: 'cascade' }),
  barcode: varchar('barcode', { length: 64 }).notNull(),
  barcodeType: mysqlEnum('barcode_type', BARCODE_TYPES).notNull().default('EAN13')
}, (table) => [uniqueIndex('udx_product_barcode_company').on(table.companyId, table.barcode)]);

export const paymentTerms = mysqlTable('payment_terms', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  netDays: int('net_days').notNull().default(0),
  active: boolean('active').notNull().default(true)
}, (table) => [uniqueIndex('udx_payment_term_company_code').on(table.companyId, table.code)]);

export const PARTY_TYPES = ['PERSON', 'COMPANY'] as const;

// PDF madde 34 — tekrar eden customer/supplier tabloları yerine tek PARTY
// modeli, rol PARTY_ROLES ile ayrılıyor (bir party hem müşteri hem
// tedarikçi olabilir — madde 33 "BOTH" ihtiyacı ayrı bir enum değeri yerine
// iki rol satırıyla karşılanıyor, daha esnek).
export const parties = mysqlTable('parties', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  partyType: mysqlEnum('party_type', PARTY_TYPES).notNull().default('COMPANY'),
  code: varchar('code', { length: 32 }).notNull(),
  legalName: varchar('legal_name', { length: 255 }).notNull(),
  tradeName: varchar('trade_name', { length: 255 }).notNull().default(''),
  taxNumber: varchar('tax_number', { length: 11 }).notNull().default(''),
  taxOffice: varchar('tax_office', { length: 255 }).notNull().default(''),
  email: varchar('email', { length: 255 }).notNull().default(''),
  phone: varchar('phone', { length: 32 }).notNull().default(''),
  website: varchar('website', { length: 255 }).notNull().default(''),
  currencyCode: char('currency_code', { length: 3 }).references(() => currencies.code),
  paymentTermId: char('payment_term_id', { length: 36 }).references(() => paymentTerms.id),
  creditLimit: decimal('credit_limit', { precision: 20, scale: 6 }),
  active: boolean('active').notNull().default(true),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
}, (table) => [uniqueIndex('udx_party_company_code').on(table.companyId, table.code)]);

export const PARTY_ROLE_VALUES = ['CUSTOMER', 'SUPPLIER'] as const;

export const partyRoles = mysqlTable('party_roles', {
  id: char('id', { length: 36 }).primaryKey(),
  partyId: char('party_id', { length: 36 }).notNull().references(() => parties.id, { onDelete: 'cascade' }),
  role: mysqlEnum('role', PARTY_ROLE_VALUES).notNull(),
  active: boolean('active').notNull().default(true)
}, (table) => [uniqueIndex('udx_party_role').on(table.partyId, table.role)]);

export const PARTY_ADDRESS_TYPES = ['BILLING', 'SHIPPING', 'OTHER'] as const;

export const partyAddresses = mysqlTable('party_addresses', {
  id: char('id', { length: 36 }).primaryKey(),
  partyId: char('party_id', { length: 36 }).notNull().references(() => parties.id, { onDelete: 'cascade' }),
  addressType: mysqlEnum('address_type', PARTY_ADDRESS_TYPES).notNull().default('OTHER'),
  label: varchar('label', { length: 100 }).notNull().default(''),
  addressLine: text('address_line'),
  city: varchar('city', { length: 100 }).notNull().default(''),
  district: varchar('district', { length: 100 }).notNull().default(''),
  country: varchar('country', { length: 100 }).notNull().default('Türkiye'),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const partyContacts = mysqlTable('party_contacts', {
  id: char('id', { length: 36 }).primaryKey(),
  partyId: char('party_id', { length: 36 }).notNull().references(() => parties.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  title: varchar('title', { length: 100 }).notNull().default(''),
  email: varchar('email', { length: 255 }).notNull().default(''),
  phone: varchar('phone', { length: 32 }).notNull().default(''),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const productSuppliers = mysqlTable('product_suppliers', {
  id: char('id', { length: 36 }).primaryKey(),
  productId: char('product_id', { length: 36 }).notNull().references(() => products.id, { onDelete: 'cascade' }),
  supplierPartyId: char('supplier_party_id', { length: 36 }).notNull().references(() => parties.id),
  supplierSku: varchar('supplier_sku', { length: 64 }).notNull().default(''),
  purchasePrice: decimal('purchase_price', { precision: 20, scale: 6 }),
  currencyCode: char('currency_code', { length: 3 }).references(() => currencies.code),
  leadTimeDays: int('lead_time_days'),
  minOrderQty: decimal('min_order_qty', { precision: 20, scale: 6 }),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_product_supplier').on(table.productId, table.supplierPartyId)]);

export const priceLists = mysqlTable('price_lists', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  currencyCode: char('currency_code', { length: 3 }).notNull().references(() => currencies.code),
  validFrom: date('valid_from', { mode: 'string' }),
  validTo: date('valid_to', { mode: 'string' }),
  // Doluysa bu fiyat listesi YALNIZCA bu cariye özeldir (madde 30 "müşteri
  // bazlı fiyat"); boşsa genel liste.
  partyId: char('party_id', { length: 36 }).references(() => parties.id),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const priceListItems = mysqlTable('price_list_items', {
  id: char('id', { length: 36 }).primaryKey(),
  priceListId: char('price_list_id', { length: 36 }).notNull().references(() => priceLists.id, { onDelete: 'cascade' }),
  productId: char('product_id', { length: 36 }).notNull().references(() => products.id),
  price: decimal('price', { precision: 20, scale: 6 }).notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }),
  taxInclusive: boolean('tax_inclusive').notNull().default(false)
}, (table) => [uniqueIndex('udx_price_list_item').on(table.priceListId, table.productId)]);

// PDF madde 97-98 — genelleştirilmiş numaralama servisi. journal_number_
// counters/ticket_number_counters/ci_key_counters İLE AYNI atomik desen
// (INSERT...ON DUPLICATE KEY + UPDATE +1), ama TEK tabloda, sequenceKey ile
// ayrıştırılmış — üç kopyanın dördüncüsünü açmak yerine buradan büyütülür
// (ERP-GENİŞLEME-FİZİBİLİTE raporunun önerisi). Mevcut üç sayaç KASITLI
// OLARAK buraya taşınmadı — çalışan, test edilmiş koda dokunmamak için.
export const docNumberSeqs = mysqlTable('doc_number_seqs', {
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  sequenceKey: varchar('sequence_key', { length: 32 }).notNull(), // 'PARTY' | 'PO' | 'SO' | ...
  year: int('year').notNull(),
  lastNumber: int('last_number').notNull().default(0)
}, (table) => [uniqueIndex('udx_doc_number_seq').on(table.companyId, table.sequenceKey, table.year)]);

// --- ERP Genişletme Faz 2A — Depo'yu gerçek bir stok omurgasına genişletme:
// bina/rack tipi konum hiyerarşisi (it_locations İLE AYNI desen), depo
// bazlı bakiye, transfer, rezervasyon. Mevcut stock_items/stock_movements/
// recordStockMovement DAVRANIŞI BOZULMADI — yalnızca eklendi. ---

export const WH_LOCATION_TYPES = ['ZONE', 'AISLE', 'RACK', 'SHELF', 'BIN'] as const;

export const whLocations = mysqlTable('wh_locations', {
  id: char('id', { length: 36 }).primaryKey(),
  warehouseId: char('warehouse_id', { length: 36 }).notNull().references(() => warehouses.id, { onDelete: 'cascade' }),
  parentLocationId: char('parent_location_id', { length: 36 }).references((): AnyMySqlColumn => whLocations.id),
  locationType: mysqlEnum('location_type', WH_LOCATION_TYPES).notNull(),
  code: varchar('code', { length: 32 }).notNull(),
  name: varchar('name', { length: 255 }).notNull().default(''),
  active: boolean('active').notNull().default(true)
});

// Depo bazlı bakiye — stock_items.currentQty (şirket geneli) DEĞİŞTİRİLMEDİ,
// hâlâ AYNI şekilde güncelleniyor (mevcut ekranlar/entegrasyonlar bozulmaz);
// bu tablo EK bir kırılım (madde 50, 53 — depo bazlı görünürlük).
export const invBalances = mysqlTable('inv_balances', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  warehouseId: char('warehouse_id', { length: 36 }).notNull().references(() => warehouses.id),
  stockItemId: char('stock_item_id', { length: 36 }).notNull().references(() => stockItems.id),
  qty: decimal('qty', { precision: 20, scale: 6 }).notNull().default('0'),
  avgCost: decimal('avg_cost', { precision: 20, scale: 6 }).notNull().default('0'),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
}, (table) => [uniqueIndex('udx_inv_balance_warehouse_item').on(table.warehouseId, table.stockItemId)]);

export const STOCK_TRANSFER_STATUSES = ['DRAFT', 'REQUESTED', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED'] as const;

export const stockTransfers = mysqlTable('stock_transfers', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  transferNo: varchar('transfer_no', { length: 32 }).notNull(),
  sourceWarehouseId: char('source_warehouse_id', { length: 36 }).notNull().references(() => warehouses.id),
  destinationWarehouseId: char('destination_warehouse_id', { length: 36 }).notNull().references(() => warehouses.id),
  status: mysqlEnum('status', STOCK_TRANSFER_STATUSES).notNull().default('DRAFT'),
  requestedByUserId: char('requested_by_user_id', { length: 36 }).notNull().references(() => users.id),
  approvedByUserId: char('approved_by_user_id', { length: 36 }).references(() => users.id),
  receivedByUserId: char('received_by_user_id', { length: 36 }).references(() => users.id),
  requestedAt: timestamp('requested_at').notNull().defaultNow(),
  approvedAt: timestamp('approved_at'),
  shippedAt: timestamp('shipped_at'),
  receivedAt: timestamp('received_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_stock_transfer_company_no').on(table.companyId, table.transferNo)]);

export const transferLines = mysqlTable('transfer_lines', {
  id: char('id', { length: 36 }).primaryKey(),
  transferId: char('transfer_id', { length: 36 }).notNull().references(() => stockTransfers.id, { onDelete: 'cascade' }),
  stockItemId: char('stock_item_id', { length: 36 }).notNull().references(() => stockItems.id),
  quantity: decimal('quantity', { precision: 20, scale: 6 }).notNull(),
  receivedQuantity: decimal('received_quantity', { precision: 20, scale: 6 })
});

export const INV_RESERVATION_STATUSES = ['ACTIVE', 'RELEASED', 'CONSUMED'] as const;

// Satış siparişi (Faz 2C) henüz yok — bu tablo şimdiden kuruluyor (madde
// 57-59), tıpkı idempotency_keys'in Faz 17 mobil'den önce şemada hazır
// beklemesi gibi. AVAILABLE = ON_HAND − RESERVED hesaplaması lib
// katmanında yapılır, burada saklanmaz (madde 58).
export const invReservations = mysqlTable('inv_reservations', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  warehouseId: char('warehouse_id', { length: 36 }).notNull().references(() => warehouses.id),
  stockItemId: char('stock_item_id', { length: 36 }).notNull().references(() => stockItems.id),
  quantity: decimal('quantity', { precision: 20, scale: 6 }).notNull(),
  sourceType: varchar('source_type', { length: 64 }),
  sourceId: char('source_id', { length: 36 }),
  status: mysqlEnum('status', INV_RESERVATION_STATUSES).notNull().default('ACTIVE'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  releasedAt: timestamp('released_at')
});

// --- Satınalma Genişletme Faz 0 — Platform Temeli. SATINALMA-MİMARİSİ
// raporunun kararı: bu tablolar procurement'a ÖZEL değil (madde 174'ün
// "mevcut yoksa TEK bir genel motor kur" ilkesi) — pozisyon/hiyerarşi ve
// workflow/approval motoru, ileride Satış/İK/Sözleşme onayı gibi HER
// akışın kullanacağı genel platform parçaları. documentType/entityType
// alanları bu yüzden serbest metin (örn. 'PROCUREMENT_REQUISITION') —
// procurement domain'i Faz 1'de bu tabloları TÜKETECEK, burada
// TANIMLAMAYACAK. ---

// madde 4-6 — dinamik organizasyon. Sabit bir seviye listesi (Ustabaşı/
// Şef/Müdür gibi) YOK, her şirket kendi unvanlarını approvalLevel ile
// birlikte tanımlar.
export const positions = mysqlTable('positions', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  title: varchar('title', { length: 100 }).notNull(),
  approvalLevel: int('approval_level').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_position_company_code').on(table.companyId, table.code)]);

export const WORKFLOW_APPROVER_TYPES = ['POSITION', 'SPECIFIC_USER', 'MANAGER_CHAIN'] as const;
export const WORKFLOW_STEP_MODES = ['SEQUENTIAL', 'PARALLEL'] as const;

// madde 31-33, 184, 188 — kural motoru. conditions/approvalChain JSON:
// hard-code onay eşiği YOK, her şirket kendi kurallarını tanımlar.
// lib/workflow/types.ts'teki WorkflowConditions/WorkflowChainStep
// arayüzleriyle eşleşir (yalnızca uygulama katmanında tip güvenliği —
// DB seviyesinde serbest JSON).
export const workflowRules = mysqlTable('workflow_rules', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  documentType: varchar('document_type', { length: 64 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  conditions: json('conditions'),
  approvalChain: json('approval_chain').notNull(),
  priority: int('priority').notNull().default(0),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [index('idx_workflow_rule_company_doctype').on(table.companyId, table.documentType)]);

export const APPROVAL_INSTANCE_STATUSES = ['IN_PROGRESS', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;

// documentType+documentId polimorfik referans — approval_instances
// HERHANGİ bir belgeye (talep, sözleşme, gider raporu, ...) bağlanabilir.
export const approvalInstances = mysqlTable('approval_instances', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  documentType: varchar('document_type', { length: 64 }).notNull(),
  documentId: char('document_id', { length: 36 }).notNull(),
  matchedRuleId: char('matched_rule_id', { length: 36 }).references(() => workflowRules.id),
  status: mysqlEnum('status', APPROVAL_INSTANCE_STATUSES).notNull().default('IN_PROGRESS'),
  submittedByUserId: char('submitted_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  // Core Security Faz 9 (madde 35, "Approval Tampering Protection") —
  // status enum'unu DEĞİŞTİRMEK (yeni bir 'INVALIDATED' üyesi eklemek) bu
  // oturumda 10+ documentType'ın ZATEN kanıtlanmış status-tabanlı
  // mantığını riske atardı; bunun yerine SAF EKLEME bir bayrak. "Bu onay
  // hâlâ geçerli mi" sorusu artık status==='APPROVED' && !invalidated
  // olmalı (bkz. lib/security/tamper.ts:isApprovalValid) — mevcut
  // kontroller GERİYE DÖNÜK güncellenmedi (kapsam dışı, bu oturumun
  // riskini artırırdı), yalnızca YENİ tüketiciler bu bayrağı kontrol eder.
  invalidated: boolean('invalidated').notNull().default(false),
  invalidatedAt: timestamp('invalidated_at'),
  invalidatedReason: varchar('invalidated_reason', { length: 255 })
}, (table) => [index('idx_approval_instance_document').on(table.documentType, table.documentId)]);

export const APPROVAL_STEP_STATUSES = ['PENDING', 'IN_PROGRESS', 'APPROVED', 'REJECTED'] as const;

// Adımlar kuraldan ANLIK türetilir (instance oluşturulduğunda kopyalanır)
// — kural sonradan değişse/silinse bile bu talebin onay geçmişi sabit kalır.
export const approvalSteps = mysqlTable('approval_steps', {
  id: char('id', { length: 36 }).primaryKey(),
  instanceId: char('instance_id', { length: 36 }).notNull().references(() => approvalInstances.id, { onDelete: 'cascade' }),
  stepOrder: int('step_order').notNull(),
  mode: mysqlEnum('mode', WORKFLOW_STEP_MODES).notNull().default('SEQUENTIAL'),
  // Doluysa: bu kadar APPROVE yeterli (madde 189 quorum). Boşsa: atanan
  // TÜM onaylayanların onayı gerekir.
  quorum: int('quorum'),
  status: mysqlEnum('status', APPROVAL_STEP_STATUSES).notNull().default('PENDING'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Bir adıma atanan (kuraldan ÇÖZÜMLENMİŞ, somut) onaylayan kullanıcı(lar).
export const approvalStepApprovers = mysqlTable('approval_step_approvers', {
  id: char('id', { length: 36 }).primaryKey(),
  stepId: char('step_id', { length: 36 }).notNull().references(() => approvalSteps.id, { onDelete: 'cascade' }),
  userId: char('user_id', { length: 36 }).notNull().references(() => users.id)
}, (table) => [uniqueIndex('udx_approval_step_approver').on(table.stepId, table.userId)]);

export const APPROVAL_DECISIONS = ['APPROVE', 'REJECT', 'REQUEST_CHANGES', 'DELEGATE'] as const;

// madde 46 — tam onay geçmişi. Immutable (madde 116-117 ilkesiyle AYNI —
// kayıt asla güncellenmez/silinmez).
// Core Security §09 (madde 31-32) — bugünkü "Onayla" butonu ile 5070
// sayılı Kanun anlamında NİTELİKLİ elektronik imza AYNI ŞEY DEĞİL. Bu
// alan yalnızca AYRIMI kod seviyesinde netleştirir — QUALIFIED_ESIGNATURE
// akışının kendisi (gerçek bir e-imza sağlayıcı entegrasyonu) bu oturumun
// kapsamı DIŞINDA, varsayılan her zaman ACKNOWLEDGEMENT.
export const SIGNATURE_TYPES = ['ACKNOWLEDGEMENT', 'QUALIFIED_ESIGNATURE'] as const;

export const approvalActions = mysqlTable('approval_actions', {
  id: char('id', { length: 36 }).primaryKey(),
  stepId: char('step_id', { length: 36 }).notNull().references(() => approvalSteps.id, { onDelete: 'cascade' }),
  actedByUserId: char('acted_by_user_id', { length: 36 }).notNull().references(() => users.id),
  decision: mysqlEnum('decision', APPROVAL_DECISIONS).notNull(),
  comment: text('comment'),
  signatureType: mysqlEnum('signature_type', SIGNATURE_TYPES).notNull().default('ACKNOWLEDGEMENT'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// madde 8-9 — vekalet. Zaman aralığı bazlı (izin süresi), approval_actions'daki
// tekil-adım DELEGATE aksiyonundan FARKLI (o, tek bir bekleyen onayı elle
// devretmek için; bu, bir kullanıcının TÜM gelecek onaylarını bir tarih
// aralığında otomatik devretmek için).
export const approvalDelegations = mysqlTable('approval_delegations', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  delegatorUserId: char('delegator_user_id', { length: 36 }).notNull().references(() => users.id),
  delegateUserId: char('delegate_user_id', { length: 36 }).notNull().references(() => users.id),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// madde 25-28 — polimorfik ek dosya. entityType serbest ('PROCUREMENT_
// REQUEST_LINE' gibi) — herhangi bir modül kullanabilir. Fiziksel dosya
// yerel diskte (bu fabrikanın kendi sunucusu — tek-sunucu on-prem model,
// S3/cloud abstraction'ı bilinçli olarak YOK), bkz. lib/documents/storage.ts.
// İK Faz 1 — documentCategory/issueDate/expiryDate/version/supersedesId
// hepsi OPSİYONEL: Satınalma'nın (IT dahil) mevcut hiçbir kullanıcısı bu
// alanları set etmez, davranışları değişmez (İK Mimarisi raporu §05,
// Satınalma Faz 8B'nin proc_tech_evals'a tenderBidLineId eklediği AYNI
// additive desen). version/supersedesId proc_quotations'ın "eski
// silinmez, yeni satır + artan versiyon" ilkesiyle aynı (madde 14).
export const documentAttachments = mysqlTable('document_attachments', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  entityType: varchar('entity_type', { length: 64 }).notNull(),
  entityId: char('entity_id', { length: 36 }).notNull(),
  fileName: varchar('file_name', { length: 255 }).notNull(),
  mimeType: varchar('mime_type', { length: 127 }).notNull(),
  sizeBytes: int('size_bytes').notNull(),
  storageKey: varchar('storage_key', { length: 512 }).notNull(),
  uploadedByUserId: char('uploaded_by_user_id', { length: 36 }).notNull().references(() => users.id),
  documentCategory: varchar('document_category', { length: 64 }),
  issueDate: date('issue_date', { mode: 'string' }),
  expiryDate: date('expiry_date', { mode: 'string' }),
  version: int('version').notNull().default(1),
  supersedesId: char('supersedes_id', { length: 36 }).references((): AnyMySqlColumn => documentAttachments.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [index('idx_attachment_entity').on(table.entityType, table.entityId)]);

export const BUDGET_COMMITMENT_STATUSES = ['RESERVED', 'CONSUMED', 'RELEASED'] as const;

// madde 34-36 — gerçek zamanlı bütçe taahhüdü. budget_items.plannedAmount
// (lib/budgets.ts) DEĞİŞMEDİ — bu, PLAN'ın üstüne AYRI bir tüketim
// katmanı: RESERVED (talep onaylandı) → CONSUMED (fatura kesildi, Faz
// 2B/2C'de) veya RELEASED (talep iptal). AVAILABLE = plannedAmount −
// SUM(RESERVED+CONSUMED), lib katmanında hesaplanır.
export const budgetCommitments = mysqlTable('budget_commitments', {
  id: char('id', { length: 36 }).primaryKey(),
  budgetItemId: char('budget_item_id', { length: 36 }).notNull().references(() => budgetItems.id),
  sourceType: varchar('source_type', { length: 64 }).notNull(),
  sourceId: char('source_id', { length: 36 }).notNull(),
  amount: decimal('amount', { precision: 20, scale: 6 }).notNull(),
  status: mysqlEnum('status', BUDGET_COMMITMENT_STATUSES).notNull().default('RESERVED'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  releasedAt: timestamp('released_at')
});

// --- Satınalma (Procurement) Faz 1 — Purchase Requisition (madde 12-28).
// Faz 0'ın platform temelini TÜKETİR, hiçbiri için YENİ tablo AÇILMADI:
// numaralama (doc_number_seqs, sequenceKey='PR'), workflow (approval_
// instances, documentType='PROCUREMENT_REQUISITION'), ek dosya (document_
// attachments, entityType='PROCUREMENT_REQUEST_LINE'), bütçe taahhüdü
// (budget_commitments), stok rezervasyonu (inv_reservations — Faz 2A'da
// "henüz gerçek tüketicisi yok" notuyla kurulmuştu, İLK GERÇEK TÜKETİCİSİ
// burası). Tablo adları MySQL 64 karakter FK sınırı için kısaltıldı
// ("procurement_request_lines" self-FK'siz bile sınıra çok yakındı).

export const PROCUREMENT_REQUEST_TYPES = ['NORMAL', 'URGENT', 'EMERGENCY', 'PROJECT', 'PRODUCTION', 'MAINTENANCE', 'IT', 'OFFICE', 'RAW_MATERIAL', 'SERVICE', 'CAPEX', 'OPEX', 'STOCK_REPLENISHMENT'] as const;
export const PROCUREMENT_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;
// madde 133 kanban'ının SADELEŞTİRİLMİŞ hâli — STOCK_CHECK ayrı bir durum
// DEĞİL, submit anında otomatik hesaplanıyor (bkz. lib/procurement/
// requisition.ts:submitRequisition yorumu).
export const PROCUREMENT_REQUEST_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'CANCELLED'] as const;
export const PROCUREMENT_CAPEX_OPEX = ['CAPEX', 'OPEX'] as const;

export const procRequests = mysqlTable('proc_requests', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  departmentId: char('department_id', { length: 36 }).references(() => departments.id),
  requestNo: varchar('request_no', { length: 32 }).notNull(),
  requestType: mysqlEnum('request_type', PROCUREMENT_REQUEST_TYPES).notNull().default('NORMAL'),
  priority: mysqlEnum('priority', PROCUREMENT_PRIORITIES).notNull().default('NORMAL'),
  status: mysqlEnum('status', PROCUREMENT_REQUEST_STATUSES).notNull().default('DRAFT'),
  requestedByUserId: char('requested_by_user_id', { length: 36 }).notNull().references(() => users.id),
  costCenterId: char('cost_center_id', { length: 36 }).references(() => costCenters.id),
  // İkisi de OPSİYONEL — bütçe takibi madde 34'te "kontrol edilebilir"
  // (zorunlu değil), stock_items.accountingAccountId İLE AYNI opsiyonel-
  // entegrasyon deseni.
  budgetItemId: char('budget_item_id', { length: 36 }).references(() => budgetItems.id),
  budgetCommitmentId: char('budget_commitment_id', { length: 36 }).references(() => budgetCommitments.id),
  capexOpex: mysqlEnum('capex_opex', PROCUREMENT_CAPEX_OPEX),
  requestedDeliveryDate: date('requested_delivery_date', { mode: 'string' }),
  justification: text('justification'),
  estimatedTotal: decimal('estimated_total', { precision: 20, scale: 6 }),
  currencyCode: char('currency_code', { length: 3 }).references(() => currencies.code),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  submittedAt: timestamp('submitted_at'),
  completedAt: timestamp('completed_at')
}, (table) => [uniqueIndex('udx_proc_request_company_no').on(table.companyId, table.requestNo)]);

// madde 20 — PENDING: henüz kontrol edilmedi (submit'ten önce). Diğerleri
// submit ANINDA otomatik hesaplanır (bkz. requisition.ts), depo sorumlusu
// gerekirse elle düzeltebilir (updateLineStockStatus).
export const PROC_LINE_STOCK_STATUSES = ['PENDING', 'STOCK_AVAILABLE', 'STOCK_PARTIAL', 'STOCK_UNAVAILABLE', 'NEW_PURCHASE_REQUIRED'] as const;

export const procRequestLines = mysqlTable('proc_request_lines', {
  id: char('id', { length: 36 }).primaryKey(),
  requestId: char('request_id', { length: 36 }).notNull().references(() => procRequests.id, { onDelete: 'cascade' }),
  lineNo: int('line_no').notNull(),
  // madde 18 — mümkünse Master Data'daki tek Ürün'e bağlan; productId/
  // stockItemId İKİSİ de opsiyonel (Depo'da henüz kartı olmayan, ilk kez
  // alınacak bir ürün için description serbest metinle yeterli).
  productId: char('product_id', { length: 36 }).references(() => products.id),
  stockItemId: char('stock_item_id', { length: 36 }).references(() => stockItems.id),
  description: varchar('description', { length: 255 }).notNull(),
  quantity: decimal('quantity', { precision: 20, scale: 6 }).notNull(),
  unitId: char('unit_id', { length: 36 }).notNull().references(() => units.id),
  preferredBrand: varchar('preferred_brand', { length: 255 }).notNull().default(''),
  alternativeBrand: varchar('alternative_brand', { length: 255 }).notNull().default(''),
  model: varchar('model', { length: 255 }).notNull().default(''),
  // madde 23-24 — description/mandatory_features/minimum_specifications/
  // preferred_specifications/standards/compatibility/warranty_requirement/
  // delivery_requirement/certification_requirement. JSON — workflow_rules.
  // conditions İLE AYNI desen (serbest, sorgu alanı değil, salt gösterim).
  technicalSpec: json('technical_spec'),
  estimatedUnitPrice: decimal('estimated_unit_price', { precision: 20, scale: 6 }),
  estimatedTotal: decimal('estimated_total', { precision: 20, scale: 6 }),
  warehouseId: char('warehouse_id', { length: 36 }).references(() => warehouses.id),
  deliveryLocation: varchar('delivery_location', { length: 255 }).notNull().default(''),
  stockStatus: mysqlEnum('stock_status', PROC_LINE_STOCK_STATUSES).notNull().default('PENDING'),
  reservedQty: decimal('reserved_qty', { precision: 20, scale: 6 }),
  purchaseQty: decimal('purchase_qty', { precision: 20, scale: 6 }),
  reservationId: char('reservation_id', { length: 36 }).references(() => invReservations.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- Satınalma Faz 2 — Procurement Queue + RFQ (madde 47-65). Queue AYRI
// bir tablo DEĞİL — APPROVED proc_requests'in, henüz hiçbir RFQ satırından
// referans almayan satırlarının SORGUSU (lib/procurement/rfq.ts). Bir RFQ,
// BİRDEN FAZLA farklı talepten satır toplayabilir (madde 49-50) — ayrı bir
// "Batch" varlığı yok, bu konsolidasyonun kendisi zaten proc_rfq_lines.
// srcRequestLineId ilişkisiyle kayıpsız ifade ediliyor.

// AWARDED (Faz 4 eklendi) — bir Award onaylandığında RFQ'nun ulaştığı
// nihai durum, CLOSED'dan sonraki adım.
export const PROC_RFQ_STATUSES = ['DRAFT', 'SENT', 'CLOSED', 'AWARDED', 'CANCELLED'] as const;

export const procRfqs = mysqlTable('proc_rfqs', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  rfqNo: varchar('rfq_no', { length: 32 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: mysqlEnum('status', PROC_RFQ_STATUSES).notNull().default('DRAFT'),
  quotationDeadline: timestamp('quotation_deadline'),
  deliveryLocation: varchar('delivery_location', { length: 255 }).notNull().default(''),
  paymentTerms: varchar('payment_terms', { length: 255 }).notNull().default(''),
  warrantyRequirement: varchar('warranty_requirement', { length: 255 }).notNull().default(''),
  notes: text('notes'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  sentAt: timestamp('sent_at'),
  closedAt: timestamp('closed_at')
}, (table) => [uniqueIndex('udx_proc_rfq_company_no').on(table.companyId, table.rfqNo)]);

export const procRfqLines = mysqlTable('proc_rfq_lines', {
  id: char('id', { length: 36 }).primaryKey(),
  rfqId: char('rfq_id', { length: 36 }).notNull().references(() => procRfqs.id, { onDelete: 'cascade' }),
  // OPSİYONEL — dolu ise bu RFQ satırı hangi onaylanmış talep satırından
  // geldiğini izler (Procurement Queue bu FK'nin BOŞ olduğu APPROVED
  // talep satırlarını listeler). Boş bırakılabilir: bir RFQ, hiçbir
  // talebe bağlı olmayan doğrudan bir ihtiyaç için de açılabilir.
  srcRequestLineId: char('src_request_line_id', { length: 36 }).references(() => procRequestLines.id),
  productId: char('product_id', { length: 36 }).references(() => products.id),
  description: varchar('description', { length: 255 }).notNull(),
  quantity: decimal('quantity', { precision: 20, scale: 6 }).notNull(),
  unitId: char('unit_id', { length: 36 }).notNull().references(() => units.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const PROC_RFQ_SUPPLIER_STATUSES = ['INVITED', 'RESPONDED', 'DECLINED'] as const;

export const procRfqSuppliers = mysqlTable('proc_rfq_suppliers', {
  id: char('id', { length: 36 }).primaryKey(),
  rfqId: char('rfq_id', { length: 36 }).notNull().references(() => procRfqs.id, { onDelete: 'cascade' }),
  supplierPartyId: char('supplier_party_id', { length: 36 }).notNull().references(() => parties.id),
  status: mysqlEnum('status', PROC_RFQ_SUPPLIER_STATUSES).notNull().default('INVITED'),
  invitedAt: timestamp('invited_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_proc_rfq_supplier').on(table.rfqId, table.supplierPartyId)]);

// madde 117 — Quotation Revision (V1/V2/V3). Var olan bir teklifi
// GÜNCELLEMEK yerine her gönderim YENİ bir satır + artan version — teklif
// alındıktan sonra orijinal fiyatın SİLİNMEMESİ ilkesi (madde 116-117,
// approval_instances'ta zaten uygulanan AYNI immutable desen).
export const procQuotations = mysqlTable('proc_quotations', {
  id: char('id', { length: 36 }).primaryKey(),
  rfqId: char('rfq_id', { length: 36 }).notNull().references(() => procRfqs.id, { onDelete: 'cascade' }),
  supplierPartyId: char('supplier_party_id', { length: 36 }).notNull().references(() => parties.id),
  version: int('version').notNull(),
  currencyCode: char('currency_code', { length: 3 }).notNull().references(() => currencies.code),
  validUntil: date('valid_until', { mode: 'string' }),
  paymentTerms: varchar('payment_terms', { length: 255 }).notNull().default(''),
  deliveryDays: int('delivery_days'),
  notes: text('notes'),
  // Tedarikçi portalı YOK (madde 59, ileride) — bugün teklif, e-posta/telefon
  // ile alınıp BİR satınalma kullanıcısı tarafından girilir.
  submittedByUserId: char('submitted_by_user_id', { length: 36 }).notNull().references(() => users.id),
  submittedAt: timestamp('submitted_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_proc_quotation_version').on(table.rfqId, table.supplierPartyId, table.version)]);

export const procQuotationLines = mysqlTable('proc_quotation_lines', {
  id: char('id', { length: 36 }).primaryKey(),
  quotationId: char('quotation_id', { length: 36 }).notNull().references(() => procQuotations.id, { onDelete: 'cascade' }),
  rfqLineId: char('rfq_line_id', { length: 36 }).notNull().references(() => procRfqLines.id),
  unitPrice: decimal('unit_price', { precision: 20, scale: 6 }).notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }),
  taxPercent: decimal('tax_percent', { precision: 5, scale: 2 }),
  deliveryDays: int('delivery_days'),
  // madde 61 — "istenen ürün yok, alternatif ürün sunuyorum".
  isAlternative: boolean('is_alternative').notNull().default(false),
  alternativeDescription: varchar('alternative_description', { length: 255 }).notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- Satınalma Faz 3 — Teknik/Ticari Değerlendirme + Ağırlıklı Skorlama
// (madde 69-74). Faz 2'nin karşılaştırma verisini (fiyat) TÜKETİR — fiyat
// skoru için ayrı bir alan YOK, lib/procurement/evaluation.ts fiyatı
// proc_quotation_lines'tan ANLIK hesaplar. Tablo adları MySQL 64 karakter
// FK sınırı için kısaltıldı ("procurement_technical_evaluations" self-ref
// olmadan bile sınırın çok üzerindeydi).

// madde 70 — örnek ağırlıklar (Price 50/Technical 20/Delivery 10/
// Warranty 10/Supplier 10) BİLİNÇLİ OLARAK 4 bileşene sadeleştirildi:
// Warranty ve Supplier Performance için sistemde GERÇEK, yapılandırılmış
// bir veri kaynağı yok (madde 139-140'ın supplier scorecard'ı bu projede
// henüz kurulmadı) — var olmayan verilere dayanan ayrı sayısal alanlar
// icat etmek yerine, ikisi de tek bir "Ticari Değerlendirme" (madde 74)
// puanına, satınalma uzmanının kendi değerlendirmesiyle giriyor. Şirket
// kendi ağırlıklarını belirler (madde 70'in kendi ilkesi) — TEK satır,
// company_id primary key (it_policies İLE AYNI desen).
export const procScoringWeights = mysqlTable('proc_scoring_weights', {
  companyId: char('company_id', { length: 36 }).primaryKey().references(() => companies.id, { onDelete: 'cascade' }),
  priceWeight: decimal('price_weight', { precision: 5, scale: 2 }).notNull().default('50'),
  technicalWeight: decimal('technical_weight', { precision: 5, scale: 2 }).notNull().default('20'),
  deliveryWeight: decimal('delivery_weight', { precision: 5, scale: 2 }).notNull().default('10'),
  commercialWeight: decimal('commercial_weight', { precision: 5, scale: 2 }).notNull().default('20'),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
});

export const PROC_TECH_COMPLIANCE_STATUSES = ['COMPLIANT', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT', 'ALTERNATIVE_ACCEPTED', 'REJECTED'] as const;

// madde 71-73 — talebi oluşturan BİRİM yapar (bugün: herhangi bir oturum
// açmış kullanıcı, ayrı bir "teknik değerlendirici" rolü henüz yok).
// quotationLineId ÜZERİNDE benzersiz — bir teklif SATIRI tek bir
// değerlendirmeye sahip (yeniden değerlendirme = ÜZERİNE yazar, ayrı bir
// versiyon geçmişi YOK — teklifin kendisi zaten versiyonlanıyor, madde
// 117; bir değerlendirme her zaman BELİRLİ bir teklif VERSİYONUNA aittir,
// tedarikçi yeni versiyon gönderirse o versiyonun satırları YENİDEN
// değerlendirilmeyi bekler, boş kalır).
// Faz 8C — quotationLineId/tenderBidLineId İKİSİ de opsiyonel, procAwards'ın
// Faz 8B'de aldığı AYNI opsiyonel-ikili genelleme (schema.ts'teki o yorum).
// MySQL'in tekil (unique) index'i NULL değerleri BİRBİRİNDEN FARKLI sayar
// (NULL != NULL), bu yüzden İKİ ayrı tekil index (biri quotationLineId,
// biri tenderBidLineId üzerinde) doğru davranışı verir — bir satırın ikisi
// de dolu olmadığı için çakışma riski YOK.
export const procTechEvals = mysqlTable('proc_tech_evals', {
  id: char('id', { length: 36 }).primaryKey(),
  quotationLineId: char('quotation_line_id', { length: 36 }).references(() => procQuotationLines.id, { onDelete: 'cascade' }),
  tenderBidLineId: char('tender_bid_line_id', { length: 36 }).references(() => procTenderBidLines.id, { onDelete: 'cascade' }),
  complianceStatus: mysqlEnum('compliance_status', PROC_TECH_COMPLIANCE_STATUSES).notNull(),
  // madde 73 — NON_COMPLIANT/REJECTED ise zorunlu (uygulama katmanında
  // doğrulanır, DB seviyesinde CHECK yok — projenin genel disiplini).
  reason: text('reason'),
  evaluatedByUserId: char('evaluated_by_user_id', { length: 36 }).notNull().references(() => users.id),
  evaluatedAt: timestamp('evaluated_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_proc_tech_eval_line').on(table.quotationLineId), uniqueIndex('udx_proc_tech_eval_tbid_line').on(table.tenderBidLineId)]);

// madde 74 — fiyat/indirim/ödeme/teslimat/tedarikçi geçmişi hepsi TEK bir
// niteliksel puana (0-100) giriyor, teklifin TAMAMI için (satır başına
// değil — ödeme koşulu/tedarikçi geçmişi zaten satıra özgü değil).
export const procCommEvals = mysqlTable('proc_comm_evals', {
  id: char('id', { length: 36 }).primaryKey(),
  quotationId: char('quotation_id', { length: 36 }).references(() => procQuotations.id),
  tenderBidId: char('tender_bid_id', { length: 36 }).references(() => procTenderBids.id),
  score: decimal('score', { precision: 5, scale: 2 }).notNull(),
  notes: text('notes'),
  evaluatedByUserId: char('evaluated_by_user_id', { length: 36 }).notNull().references(() => users.id),
  evaluatedAt: timestamp('evaluated_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_proc_comm_eval_quotation').on(table.quotationId), uniqueIndex('udx_proc_comm_eval_tbid').on(table.tenderBidId)]);

// --- Satınalma Faz 4 — Award (madde 75-82). Faz 3'ün değerlendirmesini
// TÜKETİR — hangi satır hangi tedarikçiye/hangi teklif satırına gidiyor,
// burada bir KARAR olarak kayda geçer. Bölünmüş/kısmi ödül (madde 75-77 —
// "bir kalem birden fazla tedarikçiye bölünebilir") ayrı bir "Split" kavramı
// GEREKTİRMİYOR: proc_award_lines zaten aynı rfqLineId için BİRDEN FAZLA
// satır içerebilir, her biri kendi tedarikçisi+miktarıyla — tıpkı
// proc_rfq_lines.srcRequestLineId'nin "bir RFQ birden fazla talepten satır
// toplayabilir" ilkesini ayrı bir Batch varlığı olmadan ifade etmesi gibi.
// Ödül KARARININ KENDİSİ bir harcama taahhüdü olduğu için (Requisition'ın
// onay gerektirdiği AYNI gerekçeyle) genel workflow motorundan geçer —
// documentType='PROCUREMENT_AWARD'.
export const PROC_AWARD_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'CANCELLED'] as const;

// Faz 8B — kaynak RFQ VEYA Tender olabilir (İhale Kapsamı raporu §4,
// seçenek A). rfqId/tenderId İKİSİ de OPSİYONEL, uygulama katmanında TAM
// BİRİ dolu olmalı (DB constraint değil, bu projenin genel disiplini —
// örn. workflow_rules.conditions'ın da DB seviyesinde doğrulanmaması gibi).
// Faz 0-7'nin RFQ akışı (lib/procurement/award.ts:createAward) BU
// GENELLEMEDEN SONRA DA hiç değişmeden çalışır — yalnızca tenderId/
// tenderLineId/tenderBidLineId alanlarını hiç doldurmaz (NULL kalır).
export const procAwards = mysqlTable('proc_awards', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  rfqId: char('rfq_id', { length: 36 }).references(() => procRfqs.id),
  tenderId: char('tender_id', { length: 36 }).references(() => procTenders.id),
  awardNo: varchar('award_no', { length: 32 }).notNull(),
  status: mysqlEnum('status', PROC_AWARD_STATUSES).notNull().default('DRAFT'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  submittedAt: timestamp('submitted_at'),
  completedAt: timestamp('completed_at')
}, (table) => [uniqueIndex('udx_proc_award_company_no').on(table.companyId, table.awardNo)]);

// unitPrice/discountPercent/taxPercent BİLİNÇLİ OLARAK teklif satırından
// KOPYALANIR, canlı referans değil (madde 116-117 immutable ilkesi — bir
// tedarikçi ödülden SONRA yeni bir teklif versiyonu gönderirse, zaten
// karara bağlanmış ödül fiyatı GEÇMİŞTE kalan bir kayıt olarak sabit kalmalı).
// rfqLineId/tenderLineId VE quotationLineId/tenderBidLineId çiftleri de
// procAwards İLE AYNI opsiyonel-ikili desende (yukarıdaki yorum).
export const procAwardLines = mysqlTable('proc_award_lines', {
  id: char('id', { length: 36 }).primaryKey(),
  awardId: char('award_id', { length: 36 }).notNull().references(() => procAwards.id, { onDelete: 'cascade' }),
  rfqLineId: char('rfq_line_id', { length: 36 }).references(() => procRfqLines.id),
  tenderLineId: char('tender_line_id', { length: 36 }).references(() => procTenderLines.id),
  supplierPartyId: char('supplier_party_id', { length: 36 }).notNull().references(() => parties.id),
  quotationLineId: char('quotation_line_id', { length: 36 }).references(() => procQuotationLines.id),
  tenderBidLineId: char('tender_bid_line_id', { length: 36 }).references(() => procTenderBidLines.id),
  awardedQty: decimal('awarded_qty', { precision: 20, scale: 6 }).notNull(),
  awardedUnitPrice: decimal('awarded_unit_price', { precision: 20, scale: 6 }).notNull(),
  awardedTotal: decimal('awarded_total', { precision: 20, scale: 6 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- Satınalma Faz 5 — Purchase Order / Sözleşme (madde 83-95 civarı).
// Award KARARI zaten onaylandı (Faz 4) — PO bu kararın tedarikçiye
// gönderilen RESMİ kağıdı, o yüzden AYRI bir onay akışından GEÇMEZ (ikinci
// bir onay, zaten onaylanmış bir kararı tekrar onaya sokmak olurdu — gerçek
// bir kontrol değil, gereksiz bir sürtünme). Bir Award BİRDEN FAZLA
// tedarikçiye bölünmüşse (Faz 4), her tedarikçi kendi PO'sunu alır —
// tedarikçi başına GRUPLANMIŞ proc_award_lines, tek bir "karma" PO değil
// (bir tedarikçiye gönderilecek kağıt başka bir tedarikçinin fiyatını
// GÖRMEMELİ). "Sözleşme" ayrı bir şema DEĞİL — imzalı sözleşme dosyası
// document_attachments'a (Faz 0) entityType='PROC_PO' ile eklenir, tıpkı
// Requisition kalemlerinin ek dosyalarının aynı altyapıyı kullanması gibi
// (madde 25-28'in genel amacı zaten buydu — procurement'a özel bir dosya
// deposu icat etmemek).
export const PROC_PO_STATUSES = ['DRAFT', 'ISSUED', 'ACKNOWLEDGED', 'CANCELLED'] as const;

export const procPos = mysqlTable('proc_pos', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  awardId: char('award_id', { length: 36 }).notNull().references(() => procAwards.id),
  supplierPartyId: char('supplier_party_id', { length: 36 }).notNull().references(() => parties.id),
  poNo: varchar('po_no', { length: 32 }).notNull(),
  status: mysqlEnum('status', PROC_PO_STATUSES).notNull().default('DRAFT'),
  currencyCode: char('currency_code', { length: 3 }).notNull().references(() => currencies.code),
  deliveryLocation: varchar('delivery_location', { length: 255 }).notNull().default(''),
  paymentTerms: varchar('payment_terms', { length: 255 }).notNull().default(''),
  warrantyRequirement: varchar('warranty_requirement', { length: 255 }).notNull().default(''),
  notes: text('notes'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  issuedAt: timestamp('issued_at'),
  acknowledgedAt: timestamp('acknowledged_at'),
  cancelledAt: timestamp('cancelled_at')
}, (table) => [uniqueIndex('udx_proc_pos_company_no').on(table.companyId, table.poNo)]);

// awardLineId ÜZERİNDE benzersiz — bir Award satırı en fazla BİR PO
// satırına dönüşebilir (proc_rfq_lines.srcRequestLineId'nin "bir talep
// satırı yalnızca bir RFQ'ya eklenebilir" kısıtıyla AYNI desen, burada
// bir geri-işaretçi yerine bu tablonun kendi UNIQUE'i üzerinden uygulanıyor
// — Award satırı hangi PO'ya "gittiğini" bilmek ZORUNDA değil, sorgu
// PO satırlarından yeter). Fiyat/miktar YİNE snapshot — award satırından
// kopyalanır, canlı referans değil.
export const procPoLines = mysqlTable('proc_po_lines', {
  id: char('id', { length: 36 }).primaryKey(),
  poId: char('po_id', { length: 36 }).notNull().references(() => procPos.id, { onDelete: 'cascade' }),
  awardLineId: char('award_line_id', { length: 36 }).notNull().references(() => procAwardLines.id),
  description: varchar('description', { length: 255 }).notNull(),
  quantity: decimal('quantity', { precision: 20, scale: 6 }).notNull(),
  unitId: char('unit_id', { length: 36 }).notNull().references(() => units.id),
  unitPrice: decimal('unit_price', { precision: 20, scale: 6 }).notNull(),
  lineTotal: decimal('line_total', { precision: 20, scale: 6 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_proc_po_lines_award_line').on(table.awardLineId)]);

// --- Satınalma Faz 6 — Mal Kabul (Goods Receipt) + 3-Way Match. PO'nun
// KENDİ durumuna "RECEIVED" gibi bir alan EKLENMEDİ — kısmi/tam teslim
// alındı bilgisi proc_receipt_lines'ın proc_po_lines.quantity'ye göre
// TOPLAMINDAN her seferinde HESAPLANIR (budget/reservation availability'nin
// zaten bu projede hiç STOK bir kalıcı alan olarak tutulmaması, hep canlı
// SUM ile hesaplanması İLE AYNI tercih — durumun kendisiyle senkron
// tutulması gereken YENİ bir alan, senkron KAÇIRILDIĞINDA yanlış bilgi
// gösterme riski taşır).
export const procReceipts = mysqlTable('proc_receipts', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  poId: char('po_id', { length: 36 }).notNull().references(() => procPos.id),
  receiptNo: varchar('receipt_no', { length: 32 }).notNull(),
  receiptDate: date('receipt_date', { mode: 'string' }).notNull(),
  notes: text('notes'),
  receivedByUserId: char('received_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_proc_receipts_company_no').on(table.companyId, table.receiptNo)]);

// warehouseId/stockItemId İKİSİ de OPSİYONEL — Requisition'ın kendi
// stockItemId/warehouseId opsiyonelliğiyle AYNI gerekçe (madde 18): fiziksel
// stok kartı olmayan bir kalem (hizmet, doğrudan tüketilen sarf) yalnızca
// 3-way match için kaydedilir, gerçek bir stok hareketi ÜRETMEZ. İkisi de
// doluysa recordStockMovementInTx (Depo, Faz 2A) ÇAĞRILIR — procurement
// kendi stok mantığını TEKRAR YAZMAZ, var olanı SARAR (stockMovementId bu
// çağrının sonucuna işaret eder, izlenebilirlik için).
export const procReceiptLines = mysqlTable('proc_receipt_lines', {
  id: char('id', { length: 36 }).primaryKey(),
  receiptId: char('receipt_id', { length: 36 }).notNull().references(() => procReceipts.id, { onDelete: 'cascade' }),
  poLineId: char('po_line_id', { length: 36 }).notNull().references(() => procPoLines.id),
  receivedQty: decimal('received_qty', { precision: 20, scale: 6 }).notNull(),
  warehouseId: char('warehouse_id', { length: 36 }).references(() => warehouses.id),
  stockItemId: char('stock_item_id', { length: 36 }).references(() => stockItems.id),
  stockMovementId: char('stock_movement_id', { length: 36 }).references(() => stockMovements.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Tedarikçi faturası — genel bir "Muhasebe Alacaklı Fatura" modülü BİLİNÇLİ
// OLARAK inşa EDİLMEDİ (accounting_journals zaten genel amaçlı fiş
// altyapısı; ayrı bir tam AP modülü bu fazın kapsamı DEĞİL, kendi başına
// ayrı bir girişim olurdu). Burada YALNIZCA 3-way match'in ihtiyaç duyduğu
// minimum: PO'ya karşı gelen tedarikçi faturasının miktar/fiyatını
// kaydetmek. Onaylanınca (madde ~90 civarı) GR/IR clearing muhasebesi
// postJournalInTx (lib/accounting.ts) ile OPSİYONEL olarak fişlenir — Depo
// stok hareketlerinin counterAccountCode İLE AYNI opsiyonel-entegrasyon
// deseni, yeni bir doğrudan tablo yazımı DEĞİL.
export const PROC_VENDOR_INVOICE_STATUSES = ['DRAFT', 'APPROVED', 'CANCELLED'] as const;

export const procVinvoices = mysqlTable('proc_vinvoices', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  poId: char('po_id', { length: 36 }).notNull().references(() => procPos.id),
  supplierInvoiceNo: varchar('supplier_invoice_no', { length: 64 }).notNull(),
  invoiceDate: date('invoice_date', { mode: 'string' }).notNull(),
  currencyCode: char('currency_code', { length: 3 }).notNull().references(() => currencies.code),
  status: mysqlEnum('status', PROC_VENDOR_INVOICE_STATUSES).notNull().default('DRAFT'),
  notes: text('notes'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  approvedAt: timestamp('approved_at')
}, (table) => [uniqueIndex('udx_proc_vinvoices_company_no').on(table.companyId, table.supplierInvoiceNo)]);

export const procVinvoiceLines = mysqlTable('proc_vinvoice_lines', {
  id: char('id', { length: 36 }).primaryKey(),
  invoiceId: char('invoice_id', { length: 36 }).notNull().references(() => procVinvoices.id, { onDelete: 'cascade' }),
  poLineId: char('po_line_id', { length: 36 }).notNull().references(() => procPoLines.id),
  invoicedQty: decimal('invoiced_qty', { precision: 20, scale: 6 }).notNull(),
  invoicedUnitPrice: decimal('invoiced_unit_price', { precision: 20, scale: 6 }).notNull(),
  lineTotal: decimal('line_total', { precision: 20, scale: 6 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- Satınalma Faz 8A — İhale (Tender), platform temeli. RFQ'dan (Faz 2)
// TEK gerçek farkı: teklif İÇERİĞİ, planlı bir açılış anına kadar hiçbir
// ekran/sorgudan görünmez (proc_tender_bids/proc_tender_bid_lines, Faz 8B
// — henüz YOK). Bu faz yalnızca ihale BAŞLIĞI/kalemleri/davetli tedarikçi
// yaşam döngüsünü kurar — proc_rfqs/proc_rfq_lines/proc_rfq_suppliers'ın
// (Faz 2) neredeyse BİREBİR aynı şekli, kasıtlı olarak (İhale Kapsamı
// raporu §2 — "yeniden kullanılan/yeni olan" tablosu).
//
// proc_awards'ın kaynağını (rfqId) hem RFQ hem Tender'a genellemek Faz 8B'ye
// BIRAKILDI — o genelleme, ancak İhale'den gerçek bir Award üretilebildiği
// ANDA (yani teklifler var olduğunda) bir tüketiciye kavuşuyor; şimdiden
// eklemek, kullanılmayan bir yarı-durum (procAwards.tenderId dolu ama
// procAwardLines'ın işaret edeceği tender-bid-line kavramı henüz yok)
// yaratırdı — "infrastructure before consumer" ilkesinin kendisi bile bu
// projede hep GERÇEKTEN yakın bir tüketici için uygulandı (idempotency_keys,
// inv_reservations), bir fazın YARISI için değil.
// OPENED/AWARDED Faz 8B'de EKLENDİ (additive — proc_rfqs.status'a AWARDED'ın
// Faz 4'te eklendiği AYNI desen): OPENED, açılış aksiyonu GERÇEKTEN var
// olduğu için; AWARDED, actOnAwardStep'in tender kaynaklı bir ödülü
// onayladığında GERÇEKTEN bu duruma taşıdığı için. EVALUATION Faz 8C'ye
// bırakıldı — o fazın kendi ağırlıklı skorlama akışı henüz yok.
export const PROC_TENDER_STATUSES = ['DRAFT', 'PUBLISHED', 'OPENED', 'AWARDED', 'CANCELLED'] as const;

export const procTenders = mysqlTable('proc_tenders', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  tenderNo: varchar('tender_no', { length: 32 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  status: mysqlEnum('status', PROC_TENDER_STATUSES).notNull().default('DRAFT'),
  bidSubmissionDeadline: timestamp('bid_submission_deadline'),
  // Faz 8B'nin "ifşa kapısı" bu ANA göre karar verecek — teklif içeriği
  // ancak status='PUBLISHED'İ AŞIP açılış GERÇEKLEŞTİKTEN sonra görünür
  // (açılışın kendisi Faz 8B'de bir aksiyon, bu alan yalnızca PLANLANAN anı
  // tutar, gerçek açılışı işaretleyen bir openedAt Faz 8B'de eklenecek).
  bidOpeningAt: timestamp('bid_opening_at'),
  // Faz 8B — GERÇEK açılış anı (openTenderBidding çağrıldığında set edilir).
  // bidOpeningAt yalnızca PLANLANAN anı tutar (açılış o andan ÖNCE
  // yapılamaz, ama daha SONRA da yapılabilir — gerçek dünyada toplantı
  // gecikebilir); openedAt GERÇEKTE ne zaman olduğunu kaydeder.
  openedAt: timestamp('opened_at'),
  openedByUserId: char('opened_by_user_id', { length: 36 }).references(() => users.id),
  deliveryLocation: varchar('delivery_location', { length: 255 }).notNull().default(''),
  paymentTerms: varchar('payment_terms', { length: 255 }).notNull().default(''),
  warrantyRequirement: varchar('warranty_requirement', { length: 255 }).notNull().default(''),
  // madde (İhale Kapsamı raporu §5) — banka entegrasyonu YOK, yalnızca
  // beklenen teminatın kaydı; tedarikçinin GERÇEKTEN sağladığı teminat
  // mektubu bir ek dosya (document_attachments, entityType='PROC_TENDER')
  // olarak yüklenir.
  bidBondRequired: boolean('bid_bond_required').notNull().default(false),
  bidBondPercent: decimal('bid_bond_percent', { precision: 5, scale: 2 }),
  bidBondAmount: decimal('bid_bond_amount', { precision: 20, scale: 6 }),
  // false: yalnızca proc_tender_suppliers'a eklenmiş (davet edilmiş)
  // tedarikçiler teklif verebilir (Faz 8B). true: herhangi bir SUPPLIER
  // rollü party kendi teklifini vererek KATILABİLİR (Faz 8B'nin kapsamı,
  // burada yalnızca niyet alanı olarak tutuluyor).
  openParticipation: boolean('open_participation').notNull().default(false),
  notes: text('notes'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  publishedAt: timestamp('published_at'),
  cancelledAt: timestamp('cancelled_at')
}, (table) => [uniqueIndex('udx_proc_tenders_company_no').on(table.companyId, table.tenderNo)]);

// proc_rfq_lines İLE BİREBİR AYNI ŞEKİL — srcRequestLineId OPSİYONEL (Faz
// 2'nin Procurement Queue mantığıyla aynı, bir talep satırı ya RFQ'ya ya
// İhale'ye gidebilir, ikisine BİRDEN değil — bu kısıt Faz 8B'de, ilk
// tüketici ortaya çıktığında uygulanacak).
export const procTenderLines = mysqlTable('proc_tender_lines', {
  id: char('id', { length: 36 }).primaryKey(),
  tenderId: char('tender_id', { length: 36 }).notNull().references(() => procTenders.id, { onDelete: 'cascade' }),
  srcRequestLineId: char('src_request_line_id', { length: 36 }).references(() => procRequestLines.id),
  productId: char('product_id', { length: 36 }).references(() => products.id),
  description: varchar('description', { length: 255 }).notNull(),
  quantity: decimal('quantity', { precision: 20, scale: 6 }).notNull(),
  unitId: char('unit_id', { length: 36 }).notNull().references(() => units.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const PROC_TENDER_SUPPLIER_STATUSES = ['INVITED', 'RESPONDED', 'DECLINED'] as const;

// proc_rfq_suppliers İLE BİREBİR AYNI ŞEKİL. openParticipation=true bir
// ihalede, ilk teklifini veren tedarikçi kendini bu tabloya EKLER (Faz 8B) —
// bu fazda yalnızca DAVET akışı var.
export const procTenderSuppliers = mysqlTable('proc_tender_suppliers', {
  id: char('id', { length: 36 }).primaryKey(),
  tenderId: char('tender_id', { length: 36 }).notNull().references(() => procTenders.id, { onDelete: 'cascade' }),
  supplierPartyId: char('supplier_party_id', { length: 36 }).notNull().references(() => parties.id),
  status: mysqlEnum('status', PROC_TENDER_SUPPLIER_STATUSES).notNull().default('INVITED'),
  invitedAt: timestamp('invited_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_proc_tender_supplier').on(table.tenderId, table.supplierPartyId)]);

// --- Satınalma Faz 8B — Kapalı Zarf Teklif + Açılış. proc_quotations/
// proc_quotation_lines (Faz 2) İLE BİREBİR AYNI ŞEKİL (versiyonlu, madde
// 116-117 immutable ilkesi) — TEK fark, İÇERİĞİN İfşa Kapısı: teklif
// SATIRLARI (fiyat/miktar) tender.status='OPENED' olmadan hiçbir okuma
// fonksiyonundan (lib/procurement/tender.ts:getTenderBidComparison)
// DÖNMEZ. Bu GERÇEK bir kriptografik mühürleme DEĞİL — uygulama katmanında
// bir kapı (İhale Kapsamı raporu §3'te AÇIKÇA belirtilen, gizlenmeyen bir
// sınırlama): bir DB yöneticisi tabloyu doğrudan sorgulayabilir, ama
// uygulamanın KENDİSİ açılıştan önce hiçbir ekranda/API'de fiyatı göstermez.
export const procTenderBids = mysqlTable('proc_tender_bids', {
  id: char('id', { length: 36 }).primaryKey(),
  tenderId: char('tender_id', { length: 36 }).notNull().references(() => procTenders.id, { onDelete: 'cascade' }),
  supplierPartyId: char('supplier_party_id', { length: 36 }).notNull().references(() => parties.id),
  version: int('version').notNull(),
  currencyCode: char('currency_code', { length: 3 }).notNull().references(() => currencies.code),
  validUntil: date('valid_until', { mode: 'string' }),
  paymentTerms: varchar('payment_terms', { length: 255 }).notNull().default(''),
  deliveryDays: int('delivery_days'),
  // Serbest metin — teminat mektubu/dekont referansı. Banka doğrulaması
  // YOK (İhale Kapsamı raporu §5); gerçek belge document_attachments'a
  // (entityType='PROC_TENDER') ayrıca yüklenir.
  bidBondReference: varchar('bid_bond_reference', { length: 255 }).notNull().default(''),
  notes: text('notes'),
  submittedByUserId: char('submitted_by_user_id', { length: 36 }).notNull().references(() => users.id),
  submittedAt: timestamp('submitted_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_proc_tender_bid_version').on(table.tenderId, table.supplierPartyId, table.version)]);

export const procTenderBidLines = mysqlTable('proc_tender_bid_lines', {
  id: char('id', { length: 36 }).primaryKey(),
  bidId: char('bid_id', { length: 36 }).notNull().references(() => procTenderBids.id, { onDelete: 'cascade' }),
  tenderLineId: char('tender_line_id', { length: 36 }).notNull().references(() => procTenderLines.id),
  unitPrice: decimal('unit_price', { precision: 20, scale: 6 }).notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }),
  taxPercent: decimal('tax_percent', { precision: 5, scale: 2 }),
  deliveryDays: int('delivery_days'),
  isAlternative: boolean('is_alternative').notNull().default(false),
  alternativeDescription: varchar('alternative_description', { length: 255 }).notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- İnsan Kaynakları Faz 0 — Employee Core + Organizasyon (İK Mimarisi
// raporu §03-04). employees, users'TAN AYRI: bordrodaki HERKESİN kaydı
// (ERP'ye hiç giriş yapmayan üretim işçisi DAHİL) — users yalnızca bir ERP
// GİRİŞ hesabı. Mevcut hiçbir modülün users.id referansı DEĞİŞMEDİ (IT
// zimmet ataması, onay aksiyonları vb. hâlâ users.id'ye bağlı) — bu, o
// modüllerin "ERP'de kim yaptı" sorusunu yanıtlamaya devam etmesi gerektiği
// için bilinçli bir tercih (rapor §03), employees'e taşınmadı.
export const EMPLOYMENT_STATUSES = ['ACTIVE', 'ON_LEAVE', 'SUSPENDED', 'TERMINATED'] as const;

// TC/pasaport gibi hassas alanlar (identityReference) bu fazda YALNIZCA
// düz metin olarak tutuluyor — maskeleme/şifreleme İK Mimarisi raporunun
// §11 (KVKK/Güvenlik Sertleştirme) fazına BİLİNÇLİ OLARAK bırakıldı, o
// faza kadar bu alana erişim normal RBAC (requireDepartmentAccess) ile
// sınırlı. TODO: HR_SENSITIVE_FIELD_MASKING.
export const employees = mysqlTable('employees', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  employeeNumber: varchar('employee_number', { length: 32 }).notNull(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  preferredName: varchar('preferred_name', { length: 100 }),
  gender: varchar('gender', { length: 32 }),
  birthDate: date('birth_date', { mode: 'string' }),
  nationality: varchar('nationality', { length: 100 }),
  identityReference: varchar('identity_reference', { length: 32 }),
  maritalStatus: varchar('marital_status', { length: 32 }),
  employmentStatus: mysqlEnum('employment_status', EMPLOYMENT_STATUSES).notNull().default('ACTIVE'),
  hireDate: date('hire_date', { mode: 'string' }).notNull(),
  terminationDate: date('termination_date', { mode: 'string' }),
  departmentId: char('department_id', { length: 36 }).references(() => departments.id),
  positionId: char('position_id', { length: 36 }).references(() => positions.id),
  // madde 8 — raporlama zinciri hard-code DEĞİL. users.managerUserId İLE
  // AYNI self-ref teknik, ama KASITLI OLARAK AYRI bir alan: workflow
  // motorunun MANAGER_CHAIN çözümlemesi hâlâ users.managerUserId'yi
  // kullanıyor (değişmedi) — bu alan yalnızca İK'nın kendi org şeması için.
  managerEmployeeId: char('manager_employee_id', { length: 36 }).references((): AnyMySqlColumn => employees.id),
  costCenterId: char('cost_center_id', { length: 36 }).references(() => costCenters.id),
  // madde 04'ün Facility kararı — branches Facility yerine kullanılıyor,
  // ayrı bir facilities tablosu AÇILMADI.
  branchId: char('branch_id', { length: 36 }).references(() => branches.id),
  workLocation: varchar('work_location', { length: 255 }).notNull().default(''),
  // İK Faz 2 (PDKS) — ileri-referans (shifts bu dosyada daha aşağıda
  // tanımlı, managerEmployeeId'nin kendi kendine yaptığı AnyMySqlColumn
  // lazy-ref tekniğiyle aynı). Versiyon geçmişi YOK — "şu an hangi
  // vardiyada" sorusuna cevap, PDKS çekirdeğinin ihtiyacı bu kadarı.
  shiftId: char('shift_id', { length: 36 }).references((): AnyMySqlColumn => shifts.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
}, (table) => [uniqueIndex('udx_employees_company_number').on(table.companyId, table.employeeNumber)]);

export const EMPLOYEE_CONTACT_TYPES = ['PHONE_MOBILE', 'PHONE_HOME', 'PHONE_WORK', 'EMAIL_PERSONAL', 'EMAIL_WORK', 'OTHER'] as const;

export const employeeContacts = mysqlTable('employee_contacts', {
  id: char('id', { length: 36 }).primaryKey(),
  employeeId: char('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  contactType: mysqlEnum('contact_type', EMPLOYEE_CONTACT_TYPES).notNull(),
  value: varchar('value', { length: 255 }).notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const EMPLOYEE_ADDRESS_TYPES = ['HOME', 'WORK', 'OTHER'] as const;

export const employeeAddresses = mysqlTable('employee_addresses', {
  id: char('id', { length: 36 }).primaryKey(),
  employeeId: char('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  addressType: mysqlEnum('address_type', EMPLOYEE_ADDRESS_TYPES).notNull().default('HOME'),
  line: text('line').notNull(),
  city: varchar('city', { length: 100 }).notNull().default(''),
  district: varchar('district', { length: 100 }).notNull().default(''),
  postalCode: varchar('postal_code', { length: 16 }).notNull().default(''),
  country: varchar('country', { length: 100 }).notNull().default('Türkiye'),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const employeeEmergencyContacts = mysqlTable('employee_emergency_contacts', {
  id: char('id', { length: 36 }).primaryKey(),
  employeeId: char('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  relationship: varchar('relationship', { length: 100 }).notNull().default(''),
  phone: varchar('phone', { length: 32 }).notNull(),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// İK Faz 1 — İK Mimarisi raporu §05/Faz 1: sözleşme versiyon zinciri.
// Yalnızca EN SON versiyon status='ACTIVE' olur — bir öncekini yeni
// versiyon oluşturulurken 'SUPERSEDED'e çeviriyoruz (proc_quotations'ın
// aksine, burada "güncel olan" tekil ve sık sorgulandığı için MAX(version)
// yerine açık bir status kolonu tercih edildi). supersedesId zincirin
// kendisini (hangi versiyon hangisinin yerine geçti) izlenebilir kılar.
// Sözleşmenin imzalı belgesi document_attachments'a (entityType=
// 'EMPLOYEE_CONTRACT', entityId=bu satırın id'si) AYRICA yüklenir.
export const EMPLOYEE_CONTRACT_TYPES = ['INDEFINITE', 'DEFINITE', 'PART_TIME', 'INTERNSHIP', 'CONSULTANT'] as const;
export const EMPLOYEE_CONTRACT_STATUSES = ['ACTIVE', 'SUPERSEDED', 'EXPIRED', 'TERMINATED'] as const;

export const employeeContracts = mysqlTable('employee_contracts', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  employeeId: char('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  contractType: mysqlEnum('contract_type', EMPLOYEE_CONTRACT_TYPES).notNull(),
  status: mysqlEnum('status', EMPLOYEE_CONTRACT_STATUSES).notNull().default('ACTIVE'),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }),
  probationEndDate: date('probation_end_date', { mode: 'string' }),
  weeklyWorkingHours: decimal('weekly_working_hours', { precision: 5, scale: 2 }),
  terms: text('terms'),
  version: int('version').notNull().default(1),
  supersedesId: char('supersedes_id', { length: 36 }).references((): AnyMySqlColumn => employeeContracts.id),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// İK Faz 1 — madde 16-22: diploma/sertifika/eğitim tek bir tabloda
// (qualificationType ile ayrışır) — üçü de aynı şekli paylaşıyor (ad,
// veren kurum, tarih aralığı), ayrı tablolara bölmek gereksiz tekrar
// olurdu. expiryDate, süre-dolma uyarısının VERİ modeli — gönderim
// (Bildirim altyapısı henüz yok) Faz 8'e kadar bekler, bu faz yalnızca
// sorgulanabilir veriyi kurar (bkz. lib/hr/qualifications.ts
// listExpiringQualifications). Belge dosyası document_attachments'a
// (entityType='EMPLOYEE_QUALIFICATION') ayrıca yüklenir.
export const EMPLOYEE_QUALIFICATION_TYPES = ['DIPLOMA', 'CERTIFICATE', 'TRAINING', 'LICENSE', 'OTHER'] as const;
export const EMPLOYEE_QUALIFICATION_STATUSES = ['ACTIVE', 'EXPIRED', 'REVOKED'] as const;

export const employeeQualifications = mysqlTable('employee_qualifications', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  employeeId: char('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  qualificationType: mysqlEnum('qualification_type', EMPLOYEE_QUALIFICATION_TYPES).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  institution: varchar('institution', { length: 255 }).notNull().default(''),
  fieldOfStudy: varchar('field_of_study', { length: 255 }).notNull().default(''),
  credentialNumber: varchar('credential_number', { length: 100 }).notNull().default(''),
  issueDate: date('issue_date', { mode: 'string' }),
  expiryDate: date('expiry_date', { mode: 'string' }),
  status: mysqlEnum('status', EMPLOYEE_QUALIFICATION_STATUSES).notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- İK Faz 2 — PDKS Çekirdeği (İK Mimarisi raporu §06) ---
// Akış: PDKS Cihazı → Integration Gateway (Adapter) → Raw Punch (silinmez)
// → Employee/Shift Eşleştirme → Attendance Kaydı → Payroll. Bu faz cihaz
// ENTEGRASYONU içermiyor — yalnızca MANUAL adaptörü gerçek: PDKS personeli
// bir giriş/çıkış kaydını elle girer (test/backfill amaçlı), akışın geri
// kalanı (raw_punch → attendance işleme) GERÇEK kod, hardware'e bağlı
// değil. GENERIC_RFID/ZKTECO/HIKVISION yalnızca adapterType seçenekleri
// olarak duruyor — madde 170-172'nin "vendor-neutral adapter" ilkesi,
// gerçek cihaz entegrasyonu geldiğinde İK modülü hiçbir markaya DOĞRUDAN
// bağlanmayacak, yalnızca yeni bir adapter implementasyonu eklenecek.

export const shifts = mysqlTable('shifts', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  breakMinutes: int('break_minutes').notNull().default(0),
  graceMinutes: int('grace_minutes').notNull().default(0),
  // true ise endTime, startTime'dan KÜÇÜK/EŞİT okunur (gece vardiyası,
  // örn. 22:00-06:00) — attendance processor'ın gün sınırını nasıl
  // yorumlayacağını belirler.
  crossesMidnight: boolean('crosses_midnight').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_shifts_company_code').on(table.companyId, table.code)]);

export const PDKS_ADAPTER_TYPES = ['MANUAL', 'GENERIC_RFID', 'ZKTECO', 'HIKVISION'] as const;

export const pdksDevices = mysqlTable('pdks_devices', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  name: varchar('name', { length: 150 }).notNull(),
  adapterType: mysqlEnum('adapter_type', PDKS_ADAPTER_TYPES).notNull().default('MANUAL'),
  branchId: char('branch_id', { length: 36 }).references(() => branches.id),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_pdks_devices_company_code').on(table.companyId, table.code)]);

export const PDKS_PUNCH_DIRECTIONS = ['IN', 'OUT', 'UNKNOWN'] as const;

// madde 53/164 — "silinmez": normal akışta SİLİNMEZ/GÜNCELLENMEZ, tek
// istisna processed bayrağı (attendance processor bu punch'ı işlediğinde
// true'ya çevrilir, kendisi asla değişmez).
export const pdksRawPunches = mysqlTable('pdks_raw_punches', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  deviceId: char('device_id', { length: 36 }).notNull().references(() => pdksDevices.id),
  employeeId: char('employee_id', { length: 36 }).references(() => employees.id),
  // Gerçek RFID/kart cihazları önce kart UID'sini bildirir, employee
  // eşleştirmesi SONRADAN yapılabilir — MANUAL adaptörde employeeId zaten
  // giriş anında bilindiği için bu alan o durumda kullanılmaz.
  cardReference: varchar('card_reference', { length: 100 }),
  punchAt: timestamp('punch_at').notNull(),
  direction: mysqlEnum('direction', PDKS_PUNCH_DIRECTIONS).notNull().default('UNKNOWN'),
  rawPayload: json('raw_payload'),
  processed: boolean('processed').notNull().default(false),
  recordedByUserId: char('recorded_by_user_id', { length: 36 }).references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [index('idx_pdks_raw_punches_employee_date').on(table.employeeId, table.punchAt)]);

export const PDKS_ATTENDANCE_STATUSES = ['PRESENT', 'LATE', 'INCOMPLETE', 'ABSENT'] as const;

// Bir çalışan + bir takvim günü için TEK satır (attendance processor'ın
// ürettiği türetilmiş kayıt) — raw_punches'ın aksine bu YENİDEN
// işlenebilir/üzerine yazılabilir (aynı gün için processor tekrar
// çalıştırılırsa upsert edilir).
export const pdksAttendanceRecords = mysqlTable('pdks_attendance_records', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  employeeId: char('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  workDate: date('work_date', { mode: 'string' }).notNull(),
  shiftId: char('shift_id', { length: 36 }).references(() => shifts.id),
  checkInAt: timestamp('check_in_at'),
  checkOutAt: timestamp('check_out_at'),
  workedMinutes: int('worked_minutes'),
  lateMinutes: int('late_minutes').notNull().default(0),
  earlyLeaveMinutes: int('early_leave_minutes').notNull().default(0),
  status: mysqlEnum('status', PDKS_ATTENDANCE_STATUSES).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
}, (table) => [uniqueIndex('udx_pdks_attendance_employee_date').on(table.employeeId, table.workDate)]);

// --- İK Faz 3 — İzin + Fazla Mesai + Devamsızlık (İK Mimarisi raporu §09
// Faz 3): jenerik workflow motoruna İKİ yeni documentType ('LEAVE',
// 'OVERTIME') — motor kodu (workflow/engine.ts) SIFIR değişti, yalnızca
// procAwards/procRequests'in submit/actOnXStep desenini birebir izleyen
// yeni bir çift lib fonksiyonu (bkz. lib/hr/leave.ts). "Devamsızlık" ayrı
// bir üçüncü documentType DEĞİL — rapor yalnızca LEAVE/OVERTIME diyor;
// devamsızlık (plansız/mazeretsiz gaybubet) LEAVE_TYPES'a 'ABSENCE' olarak
// eklendi, çünkü veri şekli (tarih aralığı+sebep+onay) izinle BİREBİR aynı,
// yalnızca "önceden mi sonradan mı bildirildiği" anlamı farklı.

export const LEAVE_TYPES = ['ANNUAL', 'SICK', 'UNPAID', 'ABSENCE', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT', 'OTHER'] as const;
// proc_awards/proc_requests İLE AYNI durum makinesi — generic workflow
// motoruna devrediliyor (madde 174, 184-190).
export const LEAVE_REQUEST_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'CANCELLED'] as const;

export const leaveRequests = mysqlTable('leave_requests', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  leaveNo: varchar('leave_no', { length: 32 }).notNull(),
  employeeId: char('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  leaveType: mysqlEnum('leave_type', LEAVE_TYPES).notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }).notNull(),
  dayCount: decimal('day_count', { precision: 5, scale: 2 }).notNull(),
  reason: text('reason'),
  status: mysqlEnum('status', LEAVE_REQUEST_STATUSES).notNull().default('DRAFT'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  submittedAt: timestamp('submitted_at'),
  completedAt: timestamp('completed_at')
}, (table) => [uniqueIndex('udx_leave_requests_company_no').on(table.companyId, table.leaveNo)]);

// Yasal/kıdem bazlı hak ediş hesaplaması BİLİNÇLİ OLARAK burada YOK
// (madde 33/199'un "mevzuat kod içine yazılmaz" ilkesi, Bordro Motoru
// fazına — Faz 6 — kadar aynı disiplin) — entitlementDays İK tarafından
// doğrudan girilir, sistem yalnızca kullanılan/kalan bakiyeyi hesaplar
// (bkz. lib/hr/leave.ts getLeaveBalance).
export const leaveEntitlements = mysqlTable('leave_entitlements', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  employeeId: char('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  year: int('year').notNull(),
  leaveType: mysqlEnum('leave_type', LEAVE_TYPES).notNull(),
  entitlementDays: decimal('entitlement_days', { precision: 5, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
}, (table) => [uniqueIndex('udx_leave_entitlements_employee_year_type').on(table.employeeId, table.year, table.leaveType)]);

export const OVERTIME_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'CANCELLED'] as const;

export const overtimeRequests = mysqlTable('overtime_requests', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  overtimeNo: varchar('overtime_no', { length: 32 }).notNull(),
  employeeId: char('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  workDate: date('work_date', { mode: 'string' }).notNull(),
  hours: decimal('hours', { precision: 5, scale: 2 }).notNull(),
  reason: text('reason'),
  status: mysqlEnum('status', OVERTIME_STATUSES).notNull().default('DRAFT'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  submittedAt: timestamp('submitted_at'),
  completedAt: timestamp('completed_at')
}, (table) => [uniqueIndex('udx_overtime_requests_company_no').on(table.companyId, table.overtimeNo)]);

// --- İK Faz 4 — Erişim Kontrolü (İK Mimarisi raporu §06, §09 Faz 4):
// PDKS'ten AYRI ama AYNI cihaz-adapter altyapısını (pdksDevices) paylaşan
// bir alt-domain — "aynı Integration Gateway, farklı event türü" (madde
// 53/164: CardDetected → giriş/çıkış PDKS'e, kapı-açma Erişim Log'a).
// Bu yüzden access_logs YENİ bir cihaz tablosu AÇMIYOR, doğrudan
// pdksDevices.id'ye referans veriyor.

export const accessZones = mysqlTable('access_zones', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  name: varchar('name', { length: 150 }).notNull(),
  branchId: char('branch_id', { length: 36 }).references(() => branches.id),
  description: varchar('description', { length: 255 }).notNull().default(''),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_access_zones_company_code').on(table.companyId, table.code)]);

export const accessGroups = mysqlTable('access_groups', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  name: varchar('name', { length: 150 }).notNull(),
  description: varchar('description', { length: 255 }).notNull().default(''),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_access_groups_company_code').on(table.companyId, table.code)]);

// Bir grup birden fazla bölgeye erişebilir (madde 87 — Access Group ↔
// Access Zone çoktan-çoğa).
export const accessGroupZones = mysqlTable('access_group_zones', {
  id: char('id', { length: 36 }).primaryKey(),
  groupId: char('group_id', { length: 36 }).notNull().references(() => accessGroups.id, { onDelete: 'cascade' }),
  zoneId: char('zone_id', { length: 36 }).notNull().references(() => accessZones.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_access_group_zones_group_zone').on(table.groupId, table.zoneId)]);

// validFrom/validUntil — orijinal master prompt'un "temporary access"
// istediği kapsam (örn. 2 haftalığına saha teknisyenine sunucu odası
// erişimi): NULL ise süresiz üyelik.
export const accessGroupMembers = mysqlTable('access_group_members', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  groupId: char('group_id', { length: 36 }).notNull().references(() => accessGroups.id, { onDelete: 'cascade' }),
  employeeId: char('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  validFrom: date('valid_from', { mode: 'string' }),
  validUntil: date('valid_until', { mode: 'string' }),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const ACCESS_CARD_STATUSES = ['ACTIVE', 'LOST', 'REVOKED', 'EXPIRED'] as const;

// madde 86-88 — kart yönetimi.
export const accessCards = mysqlTable('access_cards', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  employeeId: char('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  cardNumber: varchar('card_number', { length: 64 }).notNull(),
  status: mysqlEnum('status', ACCESS_CARD_STATUSES).notNull().default('ACTIVE'),
  issuedAt: timestamp('issued_at').notNull().defaultNow(),
  revokedAt: timestamp('revoked_at')
}, (table) => [uniqueIndex('udx_access_cards_company_number').on(table.companyId, table.cardNumber)]);

export const ACCESS_LOG_RESULTS = ['GRANTED', 'DENIED'] as const;

// PDKS'in pdksRawPunches'ı İLE AYNI "silinmez günlük" ilkesi — bir erişim
// denemesinin KENDİSİ asla güncellenmez/silinmez, yalnızca yeni satırlar
// eklenir. GRANTED/DENIED kararı recordAccessAttempt'in KENDİSİ tarafından
// verilir (raw_punch'ın aksine, burada karar VERME işi bu katmanın asıl
// değeri — madde 84-85).
export const accessLogs = mysqlTable('access_logs', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  deviceId: char('device_id', { length: 36 }).notNull().references(() => pdksDevices.id),
  zoneId: char('zone_id', { length: 36 }).notNull().references(() => accessZones.id),
  cardId: char('card_id', { length: 36 }).references(() => accessCards.id),
  employeeId: char('employee_id', { length: 36 }).references(() => employees.id),
  accessAt: timestamp('access_at').notNull(),
  result: mysqlEnum('result', ACCESS_LOG_RESULTS).notNull(),
  reason: varchar('reason', { length: 100 }).notNull().default(''),
  recordedByUserId: char('recorded_by_user_id', { length: 36 }).references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [index('idx_access_logs_employee_date').on(table.employeeId, table.accessAt)]);

// --- İK Faz 5 — Compensation + Bonus/Ödül (İK Mimarisi raporu §09 Faz 5) ---

// employee_contracts'ın (Faz 1) AYNI versiyon zinciri ilkesi: yeni bir
// maaş kaydı oluşturulduğunda önceki ACTIVE kayıt SUPERSEDED'e çevrilir,
// SİLİNMEZ (madde 39-41'in "geçmiş bordro/maaş kaydı değişmez" ilkesiyle
// tutarlı). Terfi/Transfer/Maaş Değişikliği'nin KENDİ onay akışı (madde
// 100-103) BİLİNÇLİ OLARAK yok — Faz 0'da employees.managerEmployeeId
// için verilen AYNI karar: bu, İK'nın doğrudan düzenleyebildiği bir CRUD,
// onay zinciri ileri bir faz. Alan-seviyesi izin (§142, "Müdür maaş
// göremesin") de raporun kendi notuyla (§02 satır 5) HENÜZ yok — bu bir
// eksiklik DEĞİL, raporun kendi ilan ettiği, Faz 11 KVKK sertleştirmesine
// bırakılan bir sınır.
export const employeeCompensations = mysqlTable('emp_compensations', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  employeeId: char('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  effectiveDate: date('effective_date', { mode: 'string' }).notNull(),
  baseSalary: decimal('base_salary', { precision: 14, scale: 2 }).notNull(),
  currencyCode: char('currency_code', { length: 3 }).notNull().references(() => currencies.code),
  changeReason: varchar('change_reason', { length: 100 }).notNull().default(''),
  status: mysqlEnum('status', ['ACTIVE', 'SUPERSEDED'] as const).notNull().default('ACTIVE'),
  version: int('version').notNull().default(1),
  supersedesId: char('supersedes_id', { length: 36 }).references((): AnyMySqlColumn => employeeCompensations.id),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const BONUS_TYPES = ['PERFORMANCE', 'HOLIDAY', 'REFERRAL', 'RETENTION', 'OTHER'] as const;
// leave_requests/overtime_requests İLE BİREBİR AYNI durum makinesi —
// jenerik workflow motoruna documentType='BONUS' ile devrediliyor.
export const BONUS_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'CANCELLED'] as const;

export const bonusRequests = mysqlTable('bonus_requests', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  bonusNo: varchar('bonus_no', { length: 32 }).notNull(),
  employeeId: char('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
  bonusType: mysqlEnum('bonus_type', BONUS_TYPES).notNull(),
  amount: decimal('amount', { precision: 14, scale: 2 }).notNull(),
  currencyCode: char('currency_code', { length: 3 }).notNull().references(() => currencies.code),
  reason: text('reason'),
  status: mysqlEnum('status', BONUS_STATUSES).notNull().default('DRAFT'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  submittedAt: timestamp('submitted_at'),
  completedAt: timestamp('completed_at')
}, (table) => [uniqueIndex('udx_bonus_requests_company_no').on(table.companyId, table.bonusNo)]);

// --- Core Security Platform (KVKK + Güvenlik + Audit Platformu Mimarisi
// raporu) — Faz 1-10, TÜMÜ tek migration'da (schema tasarımı bir bütün,
// kullanıcının "hiçbirşeyi atlama" talebiyle). Yalnızca Dashboard +
// /dashboard/security altındaki YENİ sayfalar bu altyapıyı kullanır;
// mevcut IT/Muhasebe/Satınalma/Depo/İK sayfaları bilinçli olarak
// DOKUNULMADI (kullanıcı onayı, tasarım kapsamı ayrı bir karardı). ---

// Faz 4 — Oturum Yönetimi (madde 15). users.sessionToken'ın YERİNİ alır:
// çoklu eşzamanlı web oturumu + tek tek uzaktan iptal artık gerçek (eski
// model: yeni giriş eskiyi ezerdi, TEK aktif oturum). Mobil kendi
// users.mobileSessionToken modelini KORUYOR (itandroid'in beklediği
// davranış değişmedi) — user_devices (aşağıda) yalnızca mobil için
// GÖRÜNÜRLÜK/iptal ekliyor, doğrulama mantığını değiştirmiyor.
export const userSessions = mysqlTable('user_sessions', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionToken: varchar('session_token', { length: 128 }).notNull(),
  ip: varchar('ip', { length: 64 }),
  userAgent: varchar('user_agent', { length: 255 }).notNull().default(''),
  deviceLabel: varchar('device_label', { length: 150 }).notNull().default(''),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  revoked: boolean('revoked').notNull().default(false),
  revokedAt: timestamp('revoked_at'),
  revokedByUserId: char('revoked_by_user_id', { length: 36 }).references(() => users.id)
}, (table) => [index('idx_user_sessions_user').on(table.userId)]);

// Faz 4 (mobil kısmı) — madde 16. Gerçek doğrulama HÂLÂ
// users.mobileSessionToken'a karşı yapılıyor (mobile-auth.ts değişmedi);
// bu tablo yalnızca "hangi cihazlar bağlı, hangisi kaybolduysa iptal et"
// görünürlüğünü sağlıyor — her mobil girişte bir satır YAZILIR (henüz
// OKUNMUYOR/zorunlu kılınmıyor, admin panelinden "revoked" işaretlemek
// gelecekte gerçek bir mobileSessionToken temizlemesine BAĞLANABİLİR).
export const userDevices = mysqlTable('user_devices', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  userId: char('user_id', { length: 36 }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  platform: varchar('platform', { length: 32 }).notNull().default('MOBILE'),
  appVersion: varchar('app_version', { length: 32 }).notNull().default(''),
  osVersion: varchar('os_version', { length: 32 }).notNull().default(''),
  lastSeenAt: timestamp('last_seen_at').notNull().defaultNow(),
  trusted: boolean('trusted').notNull().default(true),
  revoked: boolean('revoked').notNull().default(false),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Faz 6 — Güvenlik Olayı / Risk Motoru (madde 27-29).
export const SECURITY_EVENT_TYPES = ['MASS_EXPORT', 'OFF_HOURS_ACCESS', 'REPEATED_FAILED_LOGIN', 'SENSITIVE_DATA_BURST', 'PRIVILEGE_ESCALATION', 'MANUAL_FLAG', 'OTHER'] as const;
export const SECURITY_EVENT_STATUSES = ['DETECTED', 'INVESTIGATING', 'RESOLVED', 'FALSE_POSITIVE'] as const;

export const securityEvents = mysqlTable('security_events', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  eventType: mysqlEnum('event_type', SECURITY_EVENT_TYPES).notNull(),
  riskLevel: mysqlEnum('risk_level', AUDIT_RISK_LEVELS).notNull(),
  actedByUserId: char('acted_by_user_id', { length: 36 }).references(() => users.id),
  description: text('description').notNull(),
  metadata: json('metadata'),
  status: mysqlEnum('status', SECURITY_EVENT_STATUSES).notNull().default('DETECTED'),
  resolvedByUserId: char('resolved_by_user_id', { length: 36 }).references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  resolutionNote: text('resolution_note'),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [index('idx_security_events_company_status').on(table.companyId, table.status)]);

// Faz 7 — Saklama / Silme / Anonimleştirme (madde 23-26). Süre değerleri
// KOD İÇİNE GÖMÜLMEDİ — bu tablo İK Mimarisi raporlarının "mevzuat motoru"
// ilkesiyle AYNI disiplin, gerçek süreleri hukuki doğrulama sonrası İK/
// Muhasebe girer (rapor §02'nin disclaimer'ı).
export const RETENTION_DELETE_METHODS = ['HARD_DELETE', 'ANONYMIZE', 'ARCHIVE'] as const;

export const retentionPolicies = mysqlTable('retention_policies', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  dataType: varchar('data_type', { length: 100 }).notNull(),
  legalBasis: varchar('legal_basis', { length: 255 }).notNull().default(''),
  retentionYears: int('retention_years').notNull(),
  startEvent: varchar('start_event', { length: 100 }).notNull().default(''),
  deleteMethod: mysqlEnum('delete_method', RETENTION_DELETE_METHODS).notNull().default('ANONYMIZE'),
  legalHoldSupported: boolean('legal_hold_supported').notNull().default(true),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
}, (table) => [uniqueIndex('udx_retention_policies_company_type').on(table.companyId, table.dataType)]);

// madde 24 — bir kayıt üzerinde dava/denetim/inceleme varsa silmeyi
// engeller. entityType/entityId polimorfik (document_attachments İLE AYNI
// desen) — herhangi bir tabloya bağlanabilir.
export const legalHolds = mysqlTable('legal_holds', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  entityType: varchar('entity_type', { length: 64 }).notNull(),
  entityId: char('entity_id', { length: 36 }).notNull(),
  reason: text('reason').notNull(),
  active: boolean('active').notNull().default(true),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  releasedAt: timestamp('released_at')
}, (table) => [index('idx_legal_holds_entity').on(table.entityType, table.entityId)]);

// Faz 8 — KVKK Veri Sahibi Talepleri (madde 22). leave_requests/
// bonus_requests İLE AYNI durum makinesi, jenerik workflow motoruna
// documentType='DATA_SUBJECT_REQUEST' ile bağlanabilir.
export const DSR_TYPES = ['ACCESS', 'CORRECTION', 'DELETION', 'RESTRICTION', 'OBJECTION', 'PORTABILITY', 'OTHER'] as const;
export const DSR_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'REVISION_REQUIRED', 'CANCELLED'] as const;

export const dataSubjectRequests = mysqlTable('data_subject_requests', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  requestNo: varchar('request_no', { length: 32 }).notNull(),
  requestType: mysqlEnum('request_type', DSR_TYPES).notNull(),
  subjectName: varchar('subject_name', { length: 255 }).notNull(),
  subjectIdentifier: varchar('subject_identifier', { length: 100 }).notNull().default(''),
  relatedEmployeeId: char('related_employee_id', { length: 36 }).references(() => employees.id),
  description: text('description').notNull(),
  status: mysqlEnum('status', DSR_STATUSES).notNull().default('DRAFT'),
  resolutionNote: text('resolution_note'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  submittedAt: timestamp('submitted_at'),
  completedAt: timestamp('completed_at')
}, (table) => [uniqueIndex('udx_data_subject_requests_company_no').on(table.companyId, table.requestNo)]);

// Faz 3 — Veri Sınıflandırma / Kişisel Veri Envanteri (madde 3-4). Bu bir
// ÇALIŞMA ZAMANI kontrolü DEĞİL — bir REHBER/envanter; gerçek alan-
// seviyesi maskeleme lib/security/masking.ts'te KOD İÇİNDE ayrıca
// uygulanır (bu tablo o kodun DAYANDIĞI dokümantasyon, tersi değil).
export const DATA_CLASSIFICATIONS = ['PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'PERSONAL', 'SPECIAL_CATEGORY', 'FINANCIAL', 'HIGHLY_CONFIDENTIAL', 'SYSTEM_SECURITY'] as const;

export const personalDataInventory = mysqlTable('personal_data_inventory', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  tableName: varchar('table_name', { length: 100 }).notNull(),
  columnName: varchar('column_name', { length: 100 }).notNull(),
  dataCategory: varchar('data_category', { length: 100 }).notNull().default(''),
  classification: mysqlEnum('classification', DATA_CLASSIFICATIONS).notNull(),
  purpose: varchar('purpose', { length: 255 }).notNull().default(''),
  legalBasis: varchar('legal_basis', { length: 255 }).notNull().default(''),
  encryptionRequired: boolean('encryption_required').notNull().default(false),
  maskingRequired: boolean('masking_required').notNull().default(false),
  exportAllowed: boolean('export_allowed').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_personal_data_inventory_table_column').on(table.companyId, table.tableName, table.columnName)]);

// Faz 9 — Segregation of Duties (madde 58). Şimdilik tek, genel bir kural
// türü uygulanıyor: CREATOR_CANNOT_APPROVE (bir belgeyi oluşturan kişi
// aynı belgeyi onaylayamaz) — lib/security/sod.ts bu tabloyu documentType
// bazında aktif/pasif yapmak için okur, workflow/engine.ts'in kendisi
// DEĞİŞMEDİ (actOnStepInTx'in ÇAĞRILDIĞI noktada ek bir kontrol).
export const roleConflictRules = mysqlTable('role_conflict_rules', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  documentType: varchar('document_type', { length: 64 }).notNull(),
  rule: varchar('rule', { length: 64 }).notNull(),
  description: varchar('description', { length: 255 }).notNull().default(''),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_role_conflict_company_doctype_rule').on(table.companyId, table.documentType, table.rule)]);

// Faz 10 — Break-Glass Erişim (madde 38-39). Tek-fabrika kurulumda
// isFactoryAdmin ZATEN koşulsuz tam yetki taşıyor (requireDepartmentAccess
// fallback'i) — bu tablo o yetkiyi KISITLAMIYOR, yalnızca "normal iş akışı
// dışında, gerekçeli bir erişim" senaryosunu LOGLANABİLİR kılıyor (örn.
// destek personeli senaryosu, madde 39). start/end otomatik sona erme
// alanları taşır, gerçek zorlayıcı (enforcement) bağlanması ileri bir faz.
export const BREAK_GLASS_STATUSES = ['PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED'] as const;

export const breakGlassAccess = mysqlTable('break_glass_access', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  requestedByUserId: char('requested_by_user_id', { length: 36 }).notNull().references(() => users.id),
  reason: text('reason').notNull(),
  ticketReference: varchar('ticket_reference', { length: 100 }).notNull().default(''),
  scope: varchar('scope', { length: 255 }).notNull().default(''),
  status: mysqlEnum('status', BREAK_GLASS_STATUSES).notNull().default('PENDING'),
  approvedByUserId: char('approved_by_user_id', { length: 36 }).references(() => users.id),
  startAt: timestamp('start_at'),
  endAt: timestamp('end_at'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- Holding ERP Faz 1 — Satış & CRM (MASTER-ERP-ROADMAP.md). §150 Single
// Source of Truth: "Customer → Master Data" — parties tablosu (CUSTOMER rolü
// zaten şemada VARDI, master-data/parties.ts + price-lists sayfası zaten
// kullanıyordu, yalnızca gerçek bir SATIŞ modülü onu tüketmiyordu) YENİDEN
// KULLANILIYOR, ayrı bir customers tablosu AÇILMADI. Sevkiyat, mevcut
// inv_reservations/stock_movements'a (Depo Faz 2A) bağlanır — Satınalma'nın
// zaten kullandığı sourceType/sourceId polimorfik desenle (bu kez
// sourceType='SALES_ORDER'). Fatura onayı, Satınalma'nın vendor-invoice
// akışıyla BİREBİR aynı "opsiyonel muhasebe entegrasyonu" deseniyle
// (yalnızca hesap kodları verilirse fiş üretir) çalışır.
//
// "Servis" (satış-sonrası) BİLİNÇLİ OLARAK bu faza DAHİL EDİLMEDİ — IT
// domain'i zaten tam bir saha-servis/iş emri altyapısına sahip
// (work_orders/wo_checklists, FIELD-SERVICE.md); paralel bir servis tablosu
// açmak §149 "No Duplication" ilkesini ihlal ederdi. Gerçek entegrasyon
// (satış siparişi → saha servis iş emri) iki tarafı da analiz eden AYRI bir
// faz olarak MASTER-ERP-ROADMAP.md'ye eklenecek.

// --- Aday Müşteri (Lead) — henüz bir Party DEĞİL, kalifiye olunca
// convertLeadToOpportunity ile bir parties satırına (CUSTOMER rolüyle) ve
// bir opportunities satırına dönüşür. ---

export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED', 'CONVERTED'] as const;

export const leads = mysqlTable('leads', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  contactName: varchar('contact_name', { length: 255 }).notNull(),
  companyName: varchar('company_name', { length: 255 }).notNull().default(''),
  email: varchar('email', { length: 255 }).notNull().default(''),
  phone: varchar('phone', { length: 32 }).notNull().default(''),
  source: varchar('source', { length: 100 }).notNull().default(''),
  status: mysqlEnum('status', LEAD_STATUSES).notNull().default('NEW'),
  assignedToUserId: char('assigned_to_user_id', { length: 36 }).references(() => users.id),
  notes: text('notes'),
  convertedPartyId: char('converted_party_id', { length: 36 }).references(() => parties.id),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow().onUpdateNow()
});

export const OPPORTUNITY_STAGES = ['NEW', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const;

export const opportunities = mysqlTable('opportunities', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  partyId: char('party_id', { length: 36 }).notNull().references(() => parties.id),
  leadId: char('lead_id', { length: 36 }).references(() => leads.id),
  name: varchar('name', { length: 255 }).notNull(),
  stage: mysqlEnum('stage', OPPORTUNITY_STAGES).notNull().default('NEW'),
  estimatedValue: decimal('estimated_value', { precision: 20, scale: 6 }),
  currencyCode: char('currency_code', { length: 3 }).references(() => currencies.code),
  expectedCloseDate: date('expected_close_date', { mode: 'string' }),
  assignedToUserId: char('assigned_to_user_id', { length: 36 }).references(() => users.id),
  lostReason: text('lost_reason'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  closedAt: timestamp('closed_at')
});

// --- Teklif (Quote) ---

export const SALES_QUOTE_STATUSES = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'] as const;

export const salesQuotes = mysqlTable('sales_quotes', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  quoteNo: varchar('quote_no', { length: 32 }).notNull(),
  partyId: char('party_id', { length: 36 }).notNull().references(() => parties.id),
  opportunityId: char('opportunity_id', { length: 36 }).references(() => opportunities.id),
  quoteDate: date('quote_date', { mode: 'string' }).notNull(),
  validUntil: date('valid_until', { mode: 'string' }),
  currencyCode: char('currency_code', { length: 3 }).notNull().references(() => currencies.code),
  status: mysqlEnum('status', SALES_QUOTE_STATUSES).notNull().default('DRAFT'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_sales_quotes_company_no').on(table.companyId, table.quoteNo)]);

export const salesQuoteLines = mysqlTable('sales_quote_lines', {
  id: char('id', { length: 36 }).primaryKey(),
  quoteId: char('quote_id', { length: 36 }).notNull().references(() => salesQuotes.id, { onDelete: 'cascade' }),
  productId: char('product_id', { length: 36 }).notNull().references(() => products.id),
  quantity: decimal('quantity', { precision: 20, scale: 6 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 20, scale: 6 }).notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }),
  taxRatePercent: decimal('tax_rate_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  lineTotal: decimal('line_total', { precision: 20, scale: 6 }).notNull()
});

// --- Sipariş (Sales Order) — jenerik workflow motoruna documentType='SALES_ORDER'
// olarak bağlanır (leave/bonus/DSR İLE AYNI create-draft→submit→onay deseni).

export const SALES_ORDER_STATUSES = ['DRAFT', 'SUBMITTED', 'CONFIRMED', 'REJECTED', 'REVISION_REQUIRED', 'IN_FULFILLMENT', 'SHIPPED', 'INVOICED', 'COMPLETED', 'CANCELLED'] as const;

export const salesOrders = mysqlTable('sales_orders', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  orderNo: varchar('order_no', { length: 32 }).notNull(),
  partyId: char('party_id', { length: 36 }).notNull().references(() => parties.id),
  quoteId: char('quote_id', { length: 36 }).references(() => salesQuotes.id),
  orderDate: date('order_date', { mode: 'string' }).notNull(),
  currencyCode: char('currency_code', { length: 3 }).notNull().references(() => currencies.code),
  status: mysqlEnum('status', SALES_ORDER_STATUSES).notNull().default('DRAFT'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  submittedAt: timestamp('submitted_at'),
  confirmedAt: timestamp('confirmed_at'),
  completedAt: timestamp('completed_at')
}, (table) => [uniqueIndex('udx_sales_orders_company_no').on(table.companyId, table.orderNo)]);

export const salesOrderLines = mysqlTable('sales_order_lines', {
  id: char('id', { length: 36 }).primaryKey(),
  orderId: char('order_id', { length: 36 }).notNull().references(() => salesOrders.id, { onDelete: 'cascade' }),
  productId: char('product_id', { length: 36 }).notNull().references(() => products.id),
  quantity: decimal('quantity', { precision: 20, scale: 6 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 20, scale: 6 }).notNull(),
  discountPercent: decimal('discount_percent', { precision: 5, scale: 2 }),
  taxRatePercent: decimal('tax_rate_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  lineTotal: decimal('line_total', { precision: 20, scale: 6 }).notNull(),
  // Kısmi sevkiyat/faturalama takibi — Satınalma'nın procPoLines'ında
  // AYRI bir "received" alanı olmaması (orada satır-bazlı mal kabul kaydı
  // proc_receipt_lines'ta tutuluyor) İLE FARKLI bir tercih: burada satır
  // üzerinde doğrudan kümülatif alan tutmak, "ne kadarı sevk edildi" sorgusunu
  // her seferinde receipt/shipment satırlarını toplamaktan daha basit kılıyor
  // — küçük bir tutarlılık riski (iki yerde sayı) kabul edildi, KISITLI
  // OLARAK yalnızca bu iki alan için (shipShipmentLine/invoiceLine INSERT'i
  // İLE AYNI transaction'da güncellenir, asla bağımsız).
  shippedQuantity: decimal('shipped_quantity', { precision: 20, scale: 6 }).notNull().default('0'),
  invoicedQuantity: decimal('invoiced_quantity', { precision: 20, scale: 6 }).notNull().default('0')
});

// --- Sevkiyat (Shipment) ---

export const SALES_SHIPMENT_STATUSES = ['DRAFT', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const;

export const salesShipments = mysqlTable('sales_shipments', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  shipmentNo: varchar('shipment_no', { length: 32 }).notNull(),
  orderId: char('order_id', { length: 36 }).notNull().references(() => salesOrders.id),
  warehouseId: char('warehouse_id', { length: 36 }).notNull().references(() => warehouses.id),
  shipmentDate: date('shipment_date', { mode: 'string' }).notNull(),
  status: mysqlEnum('status', SALES_SHIPMENT_STATUSES).notNull().default('DRAFT'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_sales_shipments_company_no').on(table.companyId, table.shipmentNo)]);

export const salesShipmentLines = mysqlTable('sales_shipment_lines', {
  id: char('id', { length: 36 }).primaryKey(),
  shipmentId: char('shipment_id', { length: 36 }).notNull().references(() => salesShipments.id, { onDelete: 'cascade' }),
  orderLineId: char('order_line_id', { length: 36 }).notNull().references(() => salesOrderLines.id),
  quantity: decimal('quantity', { precision: 20, scale: 6 }).notNull()
});

// --- Fatura (Sales Invoice) — Satınalma'nın vendor-invoice'uyla AYNI
// "opsiyonel muhasebe entegrasyonu" deseni (approveSalesInvoice, hesap
// kodları verilirse fiş üretir).

export const SALES_INVOICE_STATUSES = ['DRAFT', 'APPROVED', 'CANCELLED'] as const;

export const salesInvoices = mysqlTable('sales_invoices', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  invoiceNo: varchar('invoice_no', { length: 32 }).notNull(),
  orderId: char('order_id', { length: 36 }).references(() => salesOrders.id),
  partyId: char('party_id', { length: 36 }).notNull().references(() => parties.id),
  invoiceDate: date('invoice_date', { mode: 'string' }).notNull(),
  currencyCode: char('currency_code', { length: 3 }).notNull().references(() => currencies.code),
  status: mysqlEnum('status', SALES_INVOICE_STATUSES).notNull().default('DRAFT'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  approvedAt: timestamp('approved_at')
}, (table) => [uniqueIndex('udx_sales_invoices_company_no').on(table.companyId, table.invoiceNo)]);

export const salesInvoiceLines = mysqlTable('sales_invoice_lines', {
  id: char('id', { length: 36 }).primaryKey(),
  invoiceId: char('invoice_id', { length: 36 }).notNull().references(() => salesInvoices.id, { onDelete: 'cascade' }),
  orderLineId: char('order_line_id', { length: 36 }).references(() => salesOrderLines.id),
  productId: char('product_id', { length: 36 }).notNull().references(() => products.id),
  quantity: decimal('quantity', { precision: 20, scale: 6 }).notNull(),
  unitPrice: decimal('unit_price', { precision: 20, scale: 6 }).notNull(),
  taxRatePercent: decimal('tax_rate_percent', { precision: 5, scale: 2 }).notNull().default('0'),
  lineTotal: decimal('line_total', { precision: 20, scale: 6 }).notNull()
});

// --- Tahsilat (Collection) ---

export const SALES_COLLECTION_METHODS = ['CASH', 'BANK', 'CHECK', 'OTHER'] as const;

export const salesCollections = mysqlTable('sales_collections', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  invoiceId: char('invoice_id', { length: 36 }).notNull().references(() => salesInvoices.id),
  collectionDate: date('collection_date', { mode: 'string' }).notNull(),
  amount: decimal('amount', { precision: 20, scale: 6 }).notNull(),
  currencyCode: char('currency_code', { length: 3 }).notNull().references(() => currencies.code),
  method: mysqlEnum('method', SALES_COLLECTION_METHODS).notNull().default('BANK'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- Müşteri Şikayeti (Complaint) ---

export const COMPLAINT_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] as const;
export const COMPLAINT_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

export const customerComplaints = mysqlTable('customer_complaints', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  complaintNo: varchar('complaint_no', { length: 32 }).notNull(),
  partyId: char('party_id', { length: 36 }).notNull().references(() => parties.id),
  orderId: char('order_id', { length: 36 }).references(() => salesOrders.id),
  subject: varchar('subject', { length: 255 }).notNull(),
  description: text('description').notNull(),
  status: mysqlEnum('status', COMPLAINT_STATUSES).notNull().default('OPEN'),
  priority: mysqlEnum('priority', COMPLAINT_PRIORITIES).notNull().default('MEDIUM'),
  assignedToUserId: char('assigned_to_user_id', { length: 36 }).references(() => users.id),
  resolutionNote: text('resolution_note'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at')
}, (table) => [uniqueIndex('udx_customer_complaints_company_no').on(table.companyId, table.complaintNo)]);

// --- Holding ERP Faz 2 — Üretim Çekirdeği (MASTER-ERP-ROADMAP.md).
// Üretim operasyon kaydı BİLİNÇLİ OLARAK "prodOperations" (`prod_operations`)
// adını taşıyor — hem IT domain'inin ZATEN VAR OLAN `workOrders`/
// `wo_checklists` (saha servis iş emri) tablolarıyla İSİM ÇAKIŞMASI olmasın
// diye (ikisi kavramsal olarak tamamen ayrı — biri üretim operasyonu,
// diğeri IT/saha bakım işi), hem de MySQL'in 64 karakterlik FK-adı sınırını
// aşmamak için (aşağıdaki tablo tanımının kendi yorumu — GERÇEK bir
// migration hatasıyla bulundu).
//
// BOM/Routing, employee_contracts/emp_compensations İLE AYNI immutable
// versiyon zinciri desenini kullanır (yeni versiyon → önceki ACTIVE
// SUPERSEDED'e döner, SİLİNMEZ) — bir üretim emri her zaman "o anki ACTIVE
// BOM/Routing"a göre planlanır, versiyon numarası donmuş olarak saklanır
// (bomId/routingId doğrudan o versiyona işaret eder, "en güncel" sorgusuna
// değil — geçmiş bir üretim emrinin hangi reçeteyle üretildiği asla
// değişmemeli).

// --- İş Merkezi (Work Center) ---

export const workCenters = mysqlTable('work_centers', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  code: varchar('code', { length: 32 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  capacityPerHour: decimal('capacity_per_hour', { precision: 20, scale: 6 }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_work_center_company_code').on(table.companyId, table.code)]);

// --- BOM (Bill of Materials / Ürün Ağacı) ---

export const BOM_STATUSES = ['ACTIVE', 'SUPERSEDED'] as const;

export const boms = mysqlTable('boms', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  // Bu BOM'un ÜRETTİĞİ ürün (mamul/yarı mamul) — bileşenler bomLines'ta.
  productId: char('product_id', { length: 36 }).notNull().references(() => products.id),
  code: varchar('code', { length: 32 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  version: int('version').notNull().default(1),
  status: mysqlEnum('status', BOM_STATUSES).notNull().default('ACTIVE'),
  // madde 25 — "1 birim baz miktar" varsayımı yerine parti/batch bazlı BOM
  // desteği (ör. "bu reçete 1 değil 100 birim üretir" — kimya/gıda
  // üretiminde yaygın). Üretim emri miktarı bu birime göre ölçeklenir.
  baseQuantity: decimal('base_quantity', { precision: 20, scale: 6 }).notNull().default('1'),
  unitId: char('unit_id', { length: 36 }).notNull().references(() => units.id),
  effectiveFrom: date('effective_from', { mode: 'string' }),
  effectiveTo: date('effective_to', { mode: 'string' }),
  supersedesId: char('supersedes_id', { length: 36 }).references((): AnyMySqlColumn => boms.id),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_boms_company_code_version').on(table.companyId, table.code, table.version)]);

export const bomLines = mysqlTable('bom_lines', {
  id: char('id', { length: 36 }).primaryKey(),
  bomId: char('bom_id', { length: 36 }).notNull().references(() => boms.id, { onDelete: 'cascade' }),
  lineOrder: int('line_order').notNull().default(0),
  componentProductId: char('component_product_id', { length: 36 }).notNull().references(() => products.id),
  quantity: decimal('quantity', { precision: 20, scale: 6 }).notNull(),
  unitId: char('unit_id', { length: 36 }).notNull().references(() => units.id),
  // madde 25 — "fire" (üretim kaybı yüzdesi, ör. kesim firesi). Gerekli
  // miktar = quantity × (1 + scrapPercent/100).
  scrapPercent: decimal('scrap_percent', { precision: 5, scale: 2 }),
  // madde 25 — "alternatif malzeme". Tek bir alternatif YETERLİ (birden
  // fazla alternatif zinciri gerçek bir ihtiyaç doğana kadar aşırı
  // mühendislik olurdu, madde 67).
  alternativeComponentProductId: char('alternative_component_product_id', { length: 36 }).references(() => products.id)
});

// --- Routing (Rota / Operasyon Sırası) ---

export const ROUTING_STATUSES = ['ACTIVE', 'SUPERSEDED'] as const;

export const routings = mysqlTable('routings', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  productId: char('product_id', { length: 36 }).notNull().references(() => products.id),
  code: varchar('code', { length: 32 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  version: int('version').notNull().default(1),
  status: mysqlEnum('status', ROUTING_STATUSES).notNull().default('ACTIVE'),
  supersedesId: char('supersedes_id', { length: 36 }).references((): AnyMySqlColumn => routings.id),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_routings_company_code_version').on(table.companyId, table.code, table.version)]);

export const routingOperations = mysqlTable('routing_operations', {
  id: char('id', { length: 36 }).primaryKey(),
  routingId: char('routing_id', { length: 36 }).notNull().references(() => routings.id, { onDelete: 'cascade' }),
  operationOrder: int('operation_order').notNull(),
  workCenterId: char('work_center_id', { length: 36 }).notNull().references(() => workCenters.id),
  name: varchar('name', { length: 255 }).notNull(),
  setupTimeMinutes: decimal('setup_time_minutes', { precision: 10, scale: 2 }),
  runTimeMinutesPerUnit: decimal('run_time_minutes_per_unit', { precision: 10, scale: 4 }),
  description: text('description')
});

// --- Üretim Emri (Production Order) — documentType='PRODUCTION_ORDER'
// jenerik onay motoruna bağlanır (sales_orders İLE AYNI create-draft→
// submit→onay deseni).

export const PRODUCTION_ORDER_STATUSES = ['DRAFT', 'SUBMITTED', 'REJECTED', 'REVISION_REQUIRED', 'RELEASED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export const productionOrders = mysqlTable('production_orders', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  orderNo: varchar('order_no', { length: 32 }).notNull(),
  productId: char('product_id', { length: 36 }).notNull().references(() => products.id),
  // O ANDA ACTIVE olan BOM/Routing'in DONMUŞ referansı (madde başındaki
  // yorum — geçmişe dönük değişmezlik).
  bomId: char('bom_id', { length: 36 }).notNull().references(() => boms.id),
  routingId: char('routing_id', { length: 36 }).references(() => routings.id),
  quantity: decimal('quantity', { precision: 20, scale: 6 }).notNull(),
  unitId: char('unit_id', { length: 36 }).notNull().references(() => units.id),
  warehouseId: char('warehouse_id', { length: 36 }).notNull().references(() => warehouses.id),
  plannedStartDate: date('planned_start_date', { mode: 'string' }),
  plannedEndDate: date('planned_end_date', { mode: 'string' }),
  status: mysqlEnum('status', PRODUCTION_ORDER_STATUSES).notNull().default('DRAFT'),
  // madde (Satış→MRP→Üretim zinciri) — Faz 1'in sales_orders'ına opsiyonel
  // izlenebilirlik bağlantısı (bu üretim emri hangi satış siparişi İÇİN
  // açıldı). MRP (Faz 3) bu alanı otomatik dolduracak, Faz 2'de ELLE
  // seçilebilir bir alan.
  salesOrderId: char('sales_order_id', { length: 36 }).references(() => salesOrders.id),
  materialsIssuedAt: timestamp('materials_issued_at'),
  goodQuantity: decimal('good_quantity', { precision: 20, scale: 6 }).notNull().default('0'),
  scrapQuantity: decimal('scrap_quantity', { precision: 20, scale: 6 }).notNull().default('0'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  submittedAt: timestamp('submitted_at'),
  releasedAt: timestamp('released_at'),
  completedAt: timestamp('completed_at')
}, (table) => [uniqueIndex('udx_production_orders_company_no').on(table.companyId, table.orderNo)]);

// --- İş Emri (Work Order) — bir üretim emrinin, routing'inin HER operasyonu
// için otomatik üretilen alt-kaydı (routing yoksa hiç üretilmez — üretim
// emri iş emri OLMADAN da malzeme çıkışı/tamamlanabilir, madde başındaki
// "opsiyonel entegrasyon" ilkesiyle tutarlı).

export const PRODUCTION_WORK_ORDER_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

// GERÇEK bulgu (migrate.ts, 2026-08-30): "production_work_orders" tablo adı
// + "production_order_id"/"production_orders" referansları birleşince
// MySQL'in 64 karakterlik tanımlayıcı sınırını AŞAN bir FK constraint adı
// üretiyordu (ER_TOO_LONG_IDENT) — tablo "prod_operations", sütun "order_id"
// olarak kısaltıldı (kavramsal anlam DEĞİŞMEDİ, yalnızca isimler kısaldı).
export const prodOperations = mysqlTable('prod_operations', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  orderId: char('order_id', { length: 36 }).notNull().references(() => productionOrders.id, { onDelete: 'cascade' }),
  routingOpId: char('routing_op_id', { length: 36 }).references(() => routingOperations.id),
  operationOrder: int('operation_order').notNull(),
  workCenterId: char('work_center_id', { length: 36 }).references(() => workCenters.id),
  // Holding ERP Faz 4 (MES) — OPSİYONEL, dosyanın SONUNDA tanımlı `machines`
  // tablosuna ileri-referans (products/stockItems'ın AYNI AnyMySqlColumn
  // lazy-ref tekniği). Boş kalabilir — her operasyon bir makineye bağlı
  // OLMAK ZORUNDA değil (elle/işçilik operasyonları için).
  machineId: char('machine_id', { length: 36 }).references((): AnyMySqlColumn => machines.id),
  name: varchar('name', { length: 255 }).notNull(),
  status: mysqlEnum('status', PRODUCTION_WORK_ORDER_STATUSES).notNull().default('PENDING'),
  assignedToUserId: char('assigned_to_user_id', { length: 36 }).references(() => users.id),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  goodQuantity: decimal('good_quantity', { precision: 20, scale: 6 }).notNull().default('0'),
  scrapQuantity: decimal('scrap_quantity', { precision: 20, scale: 6 }).notNull().default('0'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- Holding ERP Faz 3 — MRP (Material Requirements Planning,
// MASTER-ERP-ROADMAP.md). madde 19'un beş girdisi: Satış siparişleri +
// Minimum stok + Mevcut stok + Açık satın alma + Açık üretim. Tahmin
// ("forecast") KASITLI OLARAK bu fazın kapsamı DIŞINDA — hiçbir talep-tahmin
// altyapısı (istatistiksel/manuel tahmin girişi) bu projede henüz yok, sıfır
// veriyle "tahmin" hesaplamak anlamlı bir sonuç üretmezdi; gerçek bir
// tüketici doğduğunda (BI/Faz 12 civarı) eklenecek, TODO not edildi.
//
// Bu bir emir/işlem tablosu DEĞİL, bir PLANLAMA ÇIKTISI: runMrp() net
// ihtiyacı hesaplar (BOM'u çok-seviyeli PATLATARAK — bir mamul için önerilen
// üretim, kendi bileşenleri için YENİ satırlar üretir, parentId ile
// izlenebilir), mrp_planned_orders'a SUGGESTED olarak yazar. Kullanıcı her
// öneriyi GERÇEK bir productionOrder/procRequest'e dönüştürmeyi (ya da
// iptal etmeyi) seçer — MRP hiçbir zaman OTOMATİK bir sipariş açmaz.

export const MRP_RUN_STATUSES = ['RUNNING', 'COMPLETED', 'FAILED'] as const;

export const mrpRuns = mysqlTable('mrp_runs', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  warehouseId: char('warehouse_id', { length: 36 }).notNull().references(() => warehouses.id),
  runDate: date('run_date', { mode: 'string' }).notNull(),
  status: mysqlEnum('status', MRP_RUN_STATUSES).notNull().default('RUNNING'),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at')
});

export const MRP_PLANNED_ORDER_TYPES = ['PRODUCTION', 'PURCHASE'] as const;
export const MRP_PLANNED_ORDER_STATUSES = ['SUGGESTED', 'CONVERTED', 'CANCELLED'] as const;
export const MRP_DEMAND_SOURCES = ['SALES_ORDER', 'MIN_STOCK', 'BOM_EXPLOSION'] as const;

export const mrpPlannedOrders = mysqlTable('mrp_planned_orders', {
  id: char('id', { length: 36 }).primaryKey(),
  mrpRunId: char('mrp_run_id', { length: 36 }).notNull().references(() => mrpRuns.id, { onDelete: 'cascade' }),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  productId: char('product_id', { length: 36 }).notNull().references(() => products.id),
  quantity: decimal('quantity', { precision: 20, scale: 6 }).notNull(),
  unitId: char('unit_id', { length: 36 }).notNull().references(() => units.id),
  warehouseId: char('warehouse_id', { length: 36 }).notNull().references(() => warehouses.id),
  dueDate: date('due_date', { mode: 'string' }),
  orderType: mysqlEnum('order_type', MRP_PLANNED_ORDER_TYPES).notNull(),
  status: mysqlEnum('status', MRP_PLANNED_ORDER_STATUSES).notNull().default('SUGGESTED'),
  demandSource: mysqlEnum('demand_source', MRP_DEMAND_SOURCES).notNull(),
  // BOM patlatmasının kendi kendine referansı — KISALTILMIŞ ad
  // (prod_operations'ın 2026-08-31 ER_TOO_LONG_IDENT dersiyle AYNI önlem,
  // bu kez MIGRATION ÇALIŞMADAN ÖNCE uygulandı).
  parentId: char('parent_id', { length: 36 }).references((): AnyMySqlColumn => mrpPlannedOrders.id),
  convertedOrderType: varchar('converted_order_type', { length: 32 }),
  convertedOrderId: char('converted_order_id', { length: 36 }),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- Holding ERP Faz 4 — MES (Manufacturing Execution System,
// MASTER-ERP-ROADMAP.md). madde 20'nin listesi (makine/operatör/duruş/
// arıza/hurda/çevrim süresi/performans/OEE) — Faz 2'nin work_centers/
// prod_operations'ının ÜZERİNE, onu TEKRARLAMADAN inşa edilir: "operatör"
// zaten prod_operations.assignedToUserId, "üretim miktarı/hurda" zaten
// prod_operations.goodQuantity/scrapQuantity (Faz 2). Bu fazın GERÇEK katkısı
// yalnızca ikisi: (1) work_center'dan daha GRANÜLER bir `machines` varlığı
// + operasyonun HANGİ makinede yapıldığı (prod_operations.machineId), (2)
// Duruş (machine_downtimes) — OEE'nin Availability bileşeni bu OLMADAN
// hesaplanamaz. OEE'nin kendisi (Availability × Performance × Quality) AYRI
// bir tablo DEĞİL — tamamen mevcut veriden (prod_operations'ın started/
// completedAt + good/scrapQuantity + machine_downtimes) TALEP ÜZERİNE
// hesaplanan, saklanmayan bir rapor (lib/mes/oee.ts).
//
// madde 21 (PLC/SCADA/IoT/OPC-UA/MQTT) — GERÇEK donanım entegrasyonu bu
// fazın KAPSAMI DIŞINDA (master prompt'un kendi sözü: "hazırlığa hazır ol",
// "entegre et" DEMİYOR). "Hazır API" burada zaten VAR: recordDowntimeStart/
// End gibi fonksiyonlar bir insanın UI'dan tıklamasıyla da, gelecekte bir
// PLC/OPC-UA köprüsünün programatik çağrısıyla da AYNI şekilde çalışır —
// ayrıca sahte bir "event bus" soyutlaması icat edilmedi (ARCHITECTURE-GAP-
// REPORT.md'nin kendi bulgusu: gerçek bir tüketicisi olmayan altyapı bu
// projenin ilkesine aykırı).

export const machines = mysqlTable('machines', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  workCenterId: char('work_center_id', { length: 36 }).notNull().references(() => workCenters.id),
  code: varchar('code', { length: 32 }).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  // OEE'nin Performance bileşeni İÇİN — boşsa Performance/OEE hesaplanamaz
  // (Availability ve Quality yine de hesaplanabilir), lib/mes/oee.ts bunu
  // açıkça `performance: null` olarak işaretler, SESSİZCE 1.0 varsaymaz.
  idealCycleTimeSeconds: decimal('ideal_cycle_time_seconds', { precision: 10, scale: 2 }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_machine_company_code').on(table.companyId, table.code)]);

// madde 3 — kod içine sabit gömülmeyen duruş nedeni referans tablosu
// (departmentTypes/itAssetTypes İLE AYNI desen). category, OEE'nin
// Availability hesabında PLANNED duruşun (mola, planlı bakım) UNPLANNED'dan
// (arıza, malzeme yokluğu) AYRI muamele görmesini sağlar.
export const DOWNTIME_CATEGORIES = ['PLANNED', 'UNPLANNED'] as const;

export const downtimeReasons = mysqlTable('downtime_reasons', {
  code: varchar('code', { length: 32 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  category: mysqlEnum('category', DOWNTIME_CATEGORIES).notNull()
});

export const machineDowntimes = mysqlTable('machine_downtimes', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  machineId: char('machine_id', { length: 36 }).notNull().references(() => machines.id),
  // OPSİYONEL izlenebilirlik — bu duruş HANGİ üretim operasyonu sırasında
  // yaşandı (OEE hesabı bu alanı kullanır). Boş kalabilir (ör. vardiya
  // arası, hiçbir operasyona bağlı olmayan bir duruş).
  operationId: char('operation_id', { length: 36 }).references(() => prodOperations.id),
  reasonCode: varchar('reason_code', { length: 32 }).notNull().references(() => downtimeReasons.code),
  startedAt: timestamp('started_at').notNull(),
  // NULL = duruş HÂLÂ devam ediyor (recordDowntimeEnd ile kapatılır).
  endedAt: timestamp('ended_at'),
  notes: text('notes'),
  recordedByUserId: char('recorded_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// --- Holding ERP Faz 5 (Kalite) — Giriş/Proses/Final muayene + NCR/CAPA +
// Tedarikçi Kalite. Bağımlılık: Faz 2 (Üretim) + Satınalma (proc_receipts/
// proc_pos, zaten var). Master prompt madde-özeti: "Giriş/proses/final
// kalite, NCR/CAPA/8D, tedarikçi kalite (Satın Alma'nın tedarikçi kaydına
// bağlanır)" — MASTER-ERP-ROADMAP.md Faz 5.
//
// sourceType/sourceId — accounting_journals/stock_movements/inv_reservations/
// budget_commitments'ın ZATEN kullandığı AYNI polimorfik desen (3 farklı
// muayene kaynağı için 3 ayrı FK kolonu AÇILMADI): 'PROC_RECEIPT_LINE'
// (Giriş), 'PROD_OPERATION' (Proses), 'PRODUCTION_ORDER' (Final). `type`
// alanı sourceType'tan AYRI tutuldu çünkü kalite panosunun tip bazlı
// filtreleme/gruplama için her seferinde sourceType string'ini yorumlaması
// yerine doğrudan sorgulanabilir bir kolona ihtiyacı var.
export const QUALITY_INSPECTION_TYPES = ['INCOMING', 'IN_PROCESS', 'FINAL'] as const;
export const QUALITY_INSPECTION_RESULTS = ['PASS', 'FAIL', 'CONDITIONAL'] as const;

export const qualityInspections = mysqlTable('quality_inspections', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  inspectionNo: varchar('inspection_no', { length: 32 }).notNull(),
  type: mysqlEnum('type', QUALITY_INSPECTION_TYPES).notNull(),
  sourceType: varchar('source_type', { length: 64 }).notNull(),
  sourceId: char('source_id', { length: 36 }).notNull(),
  // OPSİYONEL — Giriş muayenesinde ürün kimliği proc_po_lines'ın kendi
  // productId TAŞIMAMASI (yalnızca serbest metin `description`) yüzünden
  // satınalma zincirinden GÜVENİLİR şekilde çözülemiyor; muayeneyi yapan
  // kişi biliyorsa elle seçer, bilmiyorsa boş bırakılabilir (Faz 4'ün
  // idealCycleTimeSeconds'ıyla AYNI "dürüst opsiyonellik" ilkesi).
  productId: char('product_id', { length: 36 }).references(() => products.id),
  inspectedQty: decimal('inspected_qty', { precision: 20, scale: 6 }).notNull(),
  passedQty: decimal('passed_qty', { precision: 20, scale: 6 }).notNull(),
  failedQty: decimal('failed_qty', { precision: 20, scale: 6 }).notNull(),
  result: mysqlEnum('result', QUALITY_INSPECTION_RESULTS).notNull(),
  notes: text('notes'),
  inspectedByUserId: char('inspected_by_user_id', { length: 36 }).notNull().references(() => users.id),
  inspectedAt: timestamp('inspected_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_quality_inspections_company_no').on(table.companyId, table.inspectionNo)]);

// NCR/CAPA/8D — customer_complaints'in KENDİ deseniyle (status alanı +
// doğrudan aksiyon fonksiyonları, generic workflow motoruna BAĞLANMADI —
// bilinçli kapsam kararı, complaints İLE AYNI gerekçe: bu bir onay zinciri
// değil, bir soruşturma/düzeltme iş akışı) — ama "8D" burada 8 ayrı sabit
// kolon olarak ZORLANMADI (metodolojinin ismi, literal 8 alan gerektirmiyor
// — OEE'nin gerçek zamanlı her metriği saklamaması İLE AYNI "isme değil
// ihtiyaca göre modelle" kararı): rootCause/correctiveAction/
// preventiveAction üç metin alanı 8D'nin özünü (D4 kök neden, D5-D6
// düzeltici, D7 önleyici) karşılıyor.
export const NCR_SEVERITIES = ['MINOR', 'MAJOR', 'CRITICAL'] as const;
export const NCR_STATUSES = ['OPEN', 'INVESTIGATING', 'CORRECTIVE_ACTION', 'VERIFICATION', 'CLOSED', 'REJECTED'] as const;

export const ncrRecords = mysqlTable('ncr_records', {
  id: char('id', { length: 36 }).primaryKey(),
  companyId: char('company_id', { length: 36 }).notNull().references(() => companies.id, { onDelete: 'cascade' }),
  ncrNo: varchar('ncr_no', { length: 32 }).notNull(),
  // OPSİYONEL — bir NCR başarısız bir muayeneden DOĞABİLİR (en yaygın yol)
  // ya da doğrudan (elle fark edilen bir uygunsuzluk) açılabilir.
  inspectionId: char('inspection_id', { length: 36 }).references(() => qualityInspections.id),
  // Tedarikçi Kalite'nin GERÇEK bağlantı noktası (madde: "Satın Alma'nın
  // tedarikçi kaydına bağlanır") — parties'in ZATEN var olan SUPPLIER
  // rolünü kullanır, ayrı bir "vendor" kaydı AÇILMADI (§150).
  supplierPartyId: char('supplier_party_id', { length: 36 }).references(() => parties.id),
  productId: char('product_id', { length: 36 }).references(() => products.id),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description').notNull(),
  severity: mysqlEnum('severity', NCR_SEVERITIES).notNull().default('MINOR'),
  status: mysqlEnum('status', NCR_STATUSES).notNull().default('OPEN'),
  rootCause: text('root_cause'),
  correctiveAction: text('corrective_action'),
  preventiveAction: text('preventive_action'),
  assignedToUserId: char('assigned_to_user_id', { length: 36 }).references(() => users.id),
  createdByUserId: char('created_by_user_id', { length: 36 }).notNull().references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  closedAt: timestamp('closed_at')
}, (table) => [uniqueIndex('udx_ncr_records_company_no').on(table.companyId, table.ncrNo)]);
