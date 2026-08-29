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

// PDF madde 79 — idempotency (API-ARCHITECTURE.md §4).
export const idempotencyKeys = mysqlTable('idempotency_keys', {
  idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
  endpoint: varchar('endpoint', { length: 255 }).notNull(),
  requestHash: varchar('request_hash', { length: 64 }).notNull(),
  responseSnapshot: json('response_snapshot'),
  createdAt: timestamp('created_at').notNull().defaultNow()
}, (table) => [uniqueIndex('udx_idempotency_key_endpoint').on(table.idempotencyKey, table.endpoint)]);
