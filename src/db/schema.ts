import { mysqlTable, char, varchar, int, decimal, json, timestamp, date, boolean, mysqlEnum, text, index, uniqueIndex, type AnyMySqlColumn } from 'drizzle-orm/mysql-core';

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

// PDF madde 79 — idempotency (API-ARCHITECTURE.md §4).
export const idempotencyKeys = mysqlTable('idempotency_keys', {
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  requestHash: varchar('request_hash', { length: 64 }).notNull(),
  responseSnapshot: json('response_snapshot'),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_idempotency_key_endpoint').on(table.idempotencyKey, table.endpoint)]);
