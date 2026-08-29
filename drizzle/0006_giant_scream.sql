CREATE TABLE `stock_items` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`sku` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`unit` varchar(16) NOT NULL DEFAULT 'ADET',
	`current_qty` decimal(20,6) NOT NULL DEFAULT '0',
	`avg_cost` decimal(20,6) NOT NULL DEFAULT '0',
	`accounting_account_id` char(36),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_stock_item_company_sku` UNIQUE(`company_id`,`sku`)
);
--> statement-breakpoint
CREATE TABLE `stock_movements` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`warehouse_id` char(36) NOT NULL,
	`stock_item_id` char(36) NOT NULL,
	`movement_type` enum('IN','OUT') NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	`unit_cost` decimal(20,6),
	`counter_account_code` varchar(32),
	`journal_id` char(36),
	`source_type` varchar(64),
	`source_id` char(36),
	`description` text,
	`transaction_date` date NOT NULL,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_movements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `warehouses` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`branch_id` char(36),
	`name` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warehouses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `stock_items` ADD CONSTRAINT `stock_items_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_items` ADD CONSTRAINT `stock_items_accounting_account_id_accounting_accounts_id_fk` FOREIGN KEY (`accounting_account_id`) REFERENCES `accounting_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_warehouse_id_warehouses_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_stock_item_id_stock_items_id_fk` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_journal_id_accounting_journals_id_fk` FOREIGN KEY (`journal_id`) REFERENCES `accounting_journals`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouses` ADD CONSTRAINT `warehouses_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warehouses` ADD CONSTRAINT `warehouses_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;