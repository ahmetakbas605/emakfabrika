CREATE TABLE `budget_items` (
	`id` char(36) NOT NULL,
	`budget_id` char(36) NOT NULL,
	`account_id` char(36) NOT NULL,
	`cost_center_id` char(36),
	`month` int,
	`planned_amount` decimal(20,6) NOT NULL,
	CONSTRAINT `budget_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`period_start` date NOT NULL,
	`period_end` date NOT NULL,
	`status` enum('DRAFT','ACTIVE','CLOSED') NOT NULL DEFAULT 'DRAFT',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `budgets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `cost_centers` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `cost_centers_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_cost_center_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `depreciation_runs` (
	`id` char(36) NOT NULL,
	`fixed_asset_id` char(36) NOT NULL,
	`period_date` date NOT NULL,
	`amount` decimal(20,6) NOT NULL,
	`journal_id` char(36) NOT NULL,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `depreciation_runs_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_depreciation_asset_period` UNIQUE(`fixed_asset_id`,`period_date`)
);
--> statement-breakpoint
CREATE TABLE `fixed_assets` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`accounting_account_id` char(36) NOT NULL,
	`accum_depr_account_id` char(36) NOT NULL,
	`depr_exp_account_id` char(36) NOT NULL,
	`purchase_date` date NOT NULL,
	`purchase_cost` decimal(20,6) NOT NULL,
	`useful_life_years` int NOT NULL,
	`depreciation_method` enum('STRAIGHT_LINE') NOT NULL DEFAULT 'STRAIGHT_LINE',
	`status` enum('ACTIVE','DISPOSED') NOT NULL DEFAULT 'ACTIVE',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fixed_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `budget_items` ADD CONSTRAINT `budget_items_budget_id_budgets_id_fk` FOREIGN KEY (`budget_id`) REFERENCES `budgets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_items` ADD CONSTRAINT `budget_items_account_id_accounting_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `accounting_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_items` ADD CONSTRAINT `budget_items_cost_center_id_cost_centers_id_fk` FOREIGN KEY (`cost_center_id`) REFERENCES `cost_centers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budgets` ADD CONSTRAINT `budgets_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cost_centers` ADD CONSTRAINT `cost_centers_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `depreciation_runs` ADD CONSTRAINT `depreciation_runs_fixed_asset_id_fixed_assets_id_fk` FOREIGN KEY (`fixed_asset_id`) REFERENCES `fixed_assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `depreciation_runs` ADD CONSTRAINT `depreciation_runs_journal_id_accounting_journals_id_fk` FOREIGN KEY (`journal_id`) REFERENCES `accounting_journals`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `depreciation_runs` ADD CONSTRAINT `depreciation_runs_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fixed_assets` ADD CONSTRAINT `fixed_assets_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fixed_assets` ADD CONSTRAINT `fixed_assets_accounting_account_id_accounting_accounts_id_fk` FOREIGN KEY (`accounting_account_id`) REFERENCES `accounting_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fixed_assets` ADD CONSTRAINT `fixed_assets_accum_depr_account_id_accounting_accounts_id_fk` FOREIGN KEY (`accum_depr_account_id`) REFERENCES `accounting_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fixed_assets` ADD CONSTRAINT `fixed_assets_depr_exp_account_id_accounting_accounts_id_fk` FOREIGN KEY (`depr_exp_account_id`) REFERENCES `accounting_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `fixed_assets` ADD CONSTRAINT `fixed_assets_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;