CREATE TABLE `bank_accounts` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`iban` varchar(34) NOT NULL DEFAULT '',
	`accounting_account_id` char(36) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'TRY',
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bank_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bank_transactions` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`bank_account_id` char(36) NOT NULL,
	`transaction_type` enum('IN','OUT') NOT NULL,
	`method` enum('HAVALE','EFT','FAST','KREDI_KARTI','POS','KOMISYON','DIGER') NOT NULL DEFAULT 'HAVALE',
	`amount` decimal(20,6) NOT NULL,
	`counter_account_code` varchar(32) NOT NULL,
	`description` text,
	`transaction_date` date NOT NULL,
	`journal_id` char(36),
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bank_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cash_accounts` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`accounting_account_id` char(36) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'TRY',
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cash_accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cash_transactions` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`cash_account_id` char(36) NOT NULL,
	`transaction_type` enum('IN','OUT') NOT NULL,
	`amount` decimal(20,6) NOT NULL,
	`counter_account_code` varchar(32) NOT NULL,
	`description` text,
	`transaction_date` date NOT NULL,
	`journal_id` char(36),
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cash_transactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `bank_accounts` ADD CONSTRAINT `bank_accounts_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_accounts` ADD CONSTRAINT `bank_accounts_accounting_account_id_accounting_accounts_id_fk` FOREIGN KEY (`accounting_account_id`) REFERENCES `accounting_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD CONSTRAINT `bank_transactions_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD CONSTRAINT `bank_transactions_bank_account_id_bank_accounts_id_fk` FOREIGN KEY (`bank_account_id`) REFERENCES `bank_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD CONSTRAINT `bank_transactions_journal_id_accounting_journals_id_fk` FOREIGN KEY (`journal_id`) REFERENCES `accounting_journals`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD CONSTRAINT `bank_transactions_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_accounts` ADD CONSTRAINT `cash_accounts_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_accounts` ADD CONSTRAINT `cash_accounts_accounting_account_id_accounting_accounts_id_fk` FOREIGN KEY (`accounting_account_id`) REFERENCES `accounting_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_transactions` ADD CONSTRAINT `cash_transactions_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_transactions` ADD CONSTRAINT `cash_transactions_cash_account_id_cash_accounts_id_fk` FOREIGN KEY (`cash_account_id`) REFERENCES `cash_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_transactions` ADD CONSTRAINT `cash_transactions_journal_id_accounting_journals_id_fk` FOREIGN KEY (`journal_id`) REFERENCES `accounting_journals`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_transactions` ADD CONSTRAINT `cash_transactions_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;