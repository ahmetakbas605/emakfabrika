CREATE TABLE `marketing_store_sale_lines` (
	`id` char(36) NOT NULL,
	`sale_id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	`unit_price` decimal(20,6) NOT NULL,
	CONSTRAINT `marketing_store_sale_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_store_sales` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`store_id` char(36) NOT NULL,
	`shift_id` char(36) NOT NULL,
	`sale_no` varchar(32) NOT NULL,
	`party_id` char(36),
	`total_amount` decimal(20,6) NOT NULL,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketing_store_sales_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_marketing_store_sale_company_no` UNIQUE(`company_id`,`sale_no`)
);
--> statement-breakpoint
CREATE TABLE `marketing_store_shifts` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`store_id` char(36) NOT NULL,
	`status` enum('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
	`opened_at` timestamp NOT NULL DEFAULT (now()),
	`opened_by_user_id` char(36) NOT NULL,
	`closed_at` timestamp,
	`closed_by_user_id` char(36),
	`total_amount` decimal(20,6),
	`cash_transaction_id` char(36),
	CONSTRAINT `marketing_store_shifts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_stores` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`department_id` char(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`store_type` enum('POS','ORDER_INTAKE') NOT NULL DEFAULT 'ORDER_INTAKE',
	`location` varchar(255) NOT NULL DEFAULT '',
	`warehouse_id` char(36),
	`cash_account_id` char(36),
	`sales_revenue_account_code` varchar(32),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketing_stores_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_marketing_store_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
ALTER TABLE `marketing_store_sale_lines` ADD CONSTRAINT `marketing_store_sale_lines_sale_id_marketing_store_sales_id_fk` FOREIGN KEY (`sale_id`) REFERENCES `marketing_store_sales`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_store_sale_lines` ADD CONSTRAINT `marketing_store_sale_lines_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_store_sales` ADD CONSTRAINT `marketing_store_sales_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_store_sales` ADD CONSTRAINT `marketing_store_sales_store_id_marketing_stores_id_fk` FOREIGN KEY (`store_id`) REFERENCES `marketing_stores`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_store_sales` ADD CONSTRAINT `marketing_store_sales_shift_id_marketing_store_shifts_id_fk` FOREIGN KEY (`shift_id`) REFERENCES `marketing_store_shifts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_store_sales` ADD CONSTRAINT `marketing_store_sales_party_id_parties_id_fk` FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_store_sales` ADD CONSTRAINT `marketing_store_sales_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_store_shifts` ADD CONSTRAINT `marketing_store_shifts_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_store_shifts` ADD CONSTRAINT `marketing_store_shifts_store_id_marketing_stores_id_fk` FOREIGN KEY (`store_id`) REFERENCES `marketing_stores`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_store_shifts` ADD CONSTRAINT `marketing_store_shifts_opened_by_user_id_users_id_fk` FOREIGN KEY (`opened_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_store_shifts` ADD CONSTRAINT `marketing_store_shifts_closed_by_user_id_users_id_fk` FOREIGN KEY (`closed_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_store_shifts` ADD CONSTRAINT `fk_mkt_shift_cash_txn` FOREIGN KEY (`cash_transaction_id`) REFERENCES `cash_transactions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_stores` ADD CONSTRAINT `marketing_stores_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_stores` ADD CONSTRAINT `marketing_stores_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_stores` ADD CONSTRAINT `marketing_stores_warehouse_id_warehouses_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_stores` ADD CONSTRAINT `marketing_stores_cash_account_id_cash_accounts_id_fk` FOREIGN KEY (`cash_account_id`) REFERENCES `cash_accounts`(`id`) ON DELETE no action ON UPDATE no action;