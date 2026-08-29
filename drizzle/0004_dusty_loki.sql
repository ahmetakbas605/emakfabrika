CREATE TABLE `check_events` (
	`id` char(36) NOT NULL,
	`check_id` char(36) NOT NULL,
	`from_status` varchar(32) NOT NULL,
	`to_status` varchar(32) NOT NULL,
	`counter_account_code` varchar(32),
	`journal_id` char(36),
	`note` text,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `check_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checks` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`direction` enum('RECEIVED','ISSUED') NOT NULL,
	`check_no` varchar(64) NOT NULL DEFAULT '',
	`bank_name` varchar(255) NOT NULL DEFAULT '',
	`party_name` varchar(255) NOT NULL DEFAULT '',
	`amount` decimal(20,6) NOT NULL,
	`due_date` date NOT NULL,
	`status` varchar(32) NOT NULL,
	`accounting_account_id` char(36) NOT NULL,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `checks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `check_events` ADD CONSTRAINT `check_events_check_id_checks_id_fk` FOREIGN KEY (`check_id`) REFERENCES `checks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `check_events` ADD CONSTRAINT `check_events_journal_id_accounting_journals_id_fk` FOREIGN KEY (`journal_id`) REFERENCES `accounting_journals`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `check_events` ADD CONSTRAINT `check_events_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checks` ADD CONSTRAINT `checks_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checks` ADD CONSTRAINT `checks_accounting_account_id_accounting_accounts_id_fk` FOREIGN KEY (`accounting_account_id`) REFERENCES `accounting_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checks` ADD CONSTRAINT `checks_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;