CREATE TABLE `treasury_cash_flow_items` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`direction` enum('INFLOW','OUTFLOW') NOT NULL,
	`description` varchar(255) NOT NULL,
	`amount` decimal(20,6) NOT NULL,
	`currency_code` char(3) NOT NULL,
	`expected_date` date NOT NULL,
	`status` enum('FORECAST','REALIZED','CANCELLED') NOT NULL DEFAULT 'FORECAST',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `treasury_cash_flow_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `treasury_cash_flow_items` ADD CONSTRAINT `treasury_cash_flow_items_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treasury_cash_flow_items` ADD CONSTRAINT `treasury_cash_flow_items_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `treasury_cash_flow_items` ADD CONSTRAINT `treasury_cash_flow_items_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;