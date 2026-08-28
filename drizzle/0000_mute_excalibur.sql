CREATE TABLE `accounting_accounts` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`parent_account_id` char(36),
	`normal_balance` enum('DEBIT','CREDIT') NOT NULL,
	`account_type` enum('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE') NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounting_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_account_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `accounting_journal_lines` (
	`id` char(36) NOT NULL,
	`journal_id` char(36) NOT NULL,
	`account_id` char(36) NOT NULL,
	`debit` decimal(20,6) NOT NULL DEFAULT '0',
	`credit` decimal(20,6) NOT NULL DEFAULT '0',
	`currency` varchar(3) NOT NULL DEFAULT 'TRY',
	`exchange_rate` decimal(20,6) NOT NULL DEFAULT '1',
	`base_currency_debit` decimal(20,6) NOT NULL DEFAULT '0',
	`base_currency_credit` decimal(20,6) NOT NULL DEFAULT '0',
	`description` text,
	`cost_center_id` char(36),
	`line_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accounting_journal_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `accounting_journals` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`journal_no` varchar(64) NOT NULL,
	`journal_date` date NOT NULL,
	`document_type` varchar(64) NOT NULL,
	`source_type` varchar(64),
	`source_id` char(36),
	`description` text,
	`status` enum('POSTED','REVERSED') NOT NULL DEFAULT 'POSTED',
	`reversal_of_journal_id` char(36),
	`correction_group_id` char(36),
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounting_journals_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_journal_company_no` UNIQUE(`company_id`,`journal_no`)
);
--> statement-breakpoint
CREATE TABLE `accounting_periods` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`period_start` date NOT NULL,
	`period_end` date NOT NULL,
	`status` enum('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
	`closed_at` timestamp,
	`closed_by_user_id` char(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accounting_periods_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `accounting_posting_rules` (
	`id` char(36) NOT NULL,
	`company_id` char(36),
	`document_type` varchar(64) NOT NULL,
	`transaction_type` varchar(64) NOT NULL,
	`debit_account_rule` varchar(128) NOT NULL,
	`credit_account_rule` varchar(128) NOT NULL,
	`tax_account_rule` varchar(128),
	`cost_account_rule` varchar(128),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accounting_posting_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` char(36) NOT NULL,
	`company_id` char(36),
	`user_id` char(36),
	`action` varchar(64) NOT NULL,
	`entity` varchar(64) NOT NULL,
	`entity_id` char(36),
	`old_value` json,
	`new_value` json,
	`ip` varchar(64),
	`device` varchar(255),
	`correlation_id` char(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`address` text,
	`city` varchar(100) NOT NULL DEFAULT '',
	`district` varchar(100) NOT NULL DEFAULT '',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `branches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`tax_id` varchar(11) NOT NULL DEFAULT '',
	`tax_office` varchar(255) NOT NULL DEFAULT '',
	`mersis_no` varchar(32) NOT NULL DEFAULT '',
	`trade_registry_no` varchar(32) NOT NULL DEFAULT '',
	`address` text,
	`city` varchar(100) NOT NULL DEFAULT '',
	`district` varchar(100) NOT NULL DEFAULT '',
	`accounting_mode` enum('PRE_ACCOUNTING','FULL_ACCOUNTING') NOT NULL DEFAULT 'FULL_ACCOUNTING',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `department_types` (
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	CONSTRAINT `department_types_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `departments` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`department_type_code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `departments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `idempotency_keys` (
	`idempotency_key` varchar(128) NOT NULL,
	`endpoint` varchar(255) NOT NULL,
	`request_hash` varchar(64) NOT NULL,
	`response_snapshot` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `udx_idempotency_key_endpoint` UNIQUE(`idempotency_key`,`endpoint`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	CONSTRAINT `permissions_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` char(36) NOT NULL,
	`role_id` char(36) NOT NULL,
	`permission_code` varchar(32) NOT NULL,
	`module_key` varchar(32) NOT NULL,
	CONSTRAINT `role_permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_role_perm_module` UNIQUE(`role_id`,`permission_code`,`module_key`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` char(36) NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `tax_rules` (
	`id` char(36) NOT NULL,
	`rule_code` varchar(64) NOT NULL,
	`rule_name` varchar(255) NOT NULL,
	`description` text,
	`effective_from` date NOT NULL,
	`effective_to` date,
	`country` varchar(2) NOT NULL DEFAULT 'TR',
	`company_type` varchar(64),
	`taxpayer_type` varchar(64),
	`sector` varchar(64),
	`condition` json,
	`calculation_method` varchar(32) NOT NULL DEFAULT 'PERCENTAGE',
	`rate` decimal(10,6),
	`threshold` decimal(20,6),
	`status` enum('ACTIVE','DRAFT','RETIRED') NOT NULL DEFAULT 'ACTIVE',
	`source_reference` text,
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tax_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_department_access` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`department_id` char(36) NOT NULL,
	`role_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_department_access_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_user_dept_role` UNIQUE(`user_id`,`department_id`,`role_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`is_factory_admin` boolean NOT NULL DEFAULT false,
	`mobile_session_token` varchar(128),
	`mobile_session_expires_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `withholding_rules` (
	`id` char(36) NOT NULL,
	`rule_code` varchar(64) NOT NULL,
	`rule_name` varchar(255) NOT NULL,
	`description` text,
	`effective_from` date NOT NULL,
	`effective_to` date,
	`sector` varchar(64),
	`rate` decimal(10,6) NOT NULL,
	`fraction_label` varchar(16),
	`status` enum('ACTIVE','DRAFT','RETIRED') NOT NULL DEFAULT 'ACTIVE',
	`source_reference` text,
	`version` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `withholding_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `accounting_accounts` ADD CONSTRAINT `accounting_accounts_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `accounting_journal_lines` ADD CONSTRAINT `accounting_journal_lines_journal_id_accounting_journals_id_fk` FOREIGN KEY (`journal_id`) REFERENCES `accounting_journals`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `accounting_journal_lines` ADD CONSTRAINT `accounting_journal_lines_account_id_accounting_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `accounting_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `accounting_journals` ADD CONSTRAINT `accounting_journals_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `accounting_journals` ADD CONSTRAINT `accounting_journals_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `accounting_periods` ADD CONSTRAINT `accounting_periods_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `accounting_periods` ADD CONSTRAINT `accounting_periods_closed_by_user_id_users_id_fk` FOREIGN KEY (`closed_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `accounting_posting_rules` ADD CONSTRAINT `accounting_posting_rules_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `branches` ADD CONSTRAINT `branches_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `departments` ADD CONSTRAINT `departments_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `departments` ADD CONSTRAINT `departments_department_type_code_department_types_code_fk` FOREIGN KEY (`department_type_code`) REFERENCES `department_types`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_code_permissions_code_fk` FOREIGN KEY (`permission_code`) REFERENCES `permissions`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_department_access` ADD CONSTRAINT `user_department_access_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_department_access` ADD CONSTRAINT `user_department_access_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_department_access` ADD CONSTRAINT `user_department_access_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_journal_lines_journal` ON `accounting_journal_lines` (`journal_id`);--> statement-breakpoint
CREATE INDEX `idx_journal_lines_account` ON `accounting_journal_lines` (`account_id`);--> statement-breakpoint
CREATE INDEX `idx_periods_company_dates` ON `accounting_periods` (`company_id`,`period_start`,`period_end`);--> statement-breakpoint
CREATE INDEX `idx_audit_company_entity` ON `audit_logs` (`company_id`,`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_tax_rules_code_effective` ON `tax_rules` (`rule_code`,`effective_from`);--> statement-breakpoint
CREATE INDEX `idx_withholding_rules_code_effective` ON `withholding_rules` (`rule_code`,`effective_from`);