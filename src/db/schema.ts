import { mysqlTable, char, varchar, int, decimal, json, timestamp, date, boolean, mysqlEnum, text, index, uniqueIndex } from 'drizzle-orm/mysql-core';

// Faz 2 (Database) + Faz 3 (Tenant/Auth) + Faz 4 (Accounting Core) — bkz.
// DATABASE-ARCHITECTURE.md §5. CHAR(36) UUID stratejisi: §2. Bu fabrikanın
// KENDİ MySQL veritabanı (kiracı sınırı = DB sınırı) — hiçbir tabloda
// tenant_id/organization_id YOK, en dış seviye zaten company.

// --- Şirket / Şube / Departman (TENANT-ARCHITECTURE.md §1-3) ---

export const ACCOUNTING_MODES = ['PRE_ACCOUNTING', 'FULL_ACCOUNTING'] as const;

export const companies = mysqlTable('companies', {
  id: char('id', { length: 36 }).primaryKey(),
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
  // Web oturumu — emakerp'in "database session" deseniyle AYNI: JWT çerezi
  // yalnızca bir İŞARETÇİ taşır, gerçek doğrulama HER İSTEKTE bu sütunlara
  // karşı yapılır (bkz. lib/dal.ts:getSession) — bu sayede yeni bir girişte
  // eski oturum geçersiz kılınabilir (yalnızca JWT süresine güvenmiyoruz).
  sessionToken: varchar('session_token', { length: 128 }),
  sessionExpiresAt: timestamp('session_expires_at'),
  // Mobil oturum — emakerp'in requireMobileUser deseniyle AYNI (opak Bearer
  // <userId>.<token>), ayrı bir "sessions" tablosu YOK (SECURITY-ARCHITECTURE.md §1).
  mobileSessionToken: varchar('mobile_session_token', { length: 128 }),
  mobileSessionExpiresAt: timestamp('mobile_session_expires_at'),
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
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
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
  journalDate: date('journal_date').notNull(),
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
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
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
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),
  sector: varchar('sector', { length: 64 }),
  rate: decimal('rate', { precision: 10, scale: 6 }).notNull(),
  fractionLabel: varchar('fraction_label', { length: 16 }),
  status: mysqlEnum('status', RULE_STATUSES).notNull().default('ACTIVE'),
  sourceReference: text('source_reference'),
  version: int('version').notNull().default(1),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [index('idx_withholding_rules_code_effective').on(table.ruleCode, table.effectiveFrom)]);

// PDF madde 79 — idempotency (API-ARCHITECTURE.md §4).
export const idempotencyKeys = mysqlTable('idempotency_keys', {
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  requestHash: varchar('request_hash', { length: 64 }).notNull(),
  responseSnapshot: json('response_snapshot'),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_idempotency_key_endpoint').on(table.idempotencyKey, table.endpoint)]);
