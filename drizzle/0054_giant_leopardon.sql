CREATE TABLE `marketing_contract_lines` (
	`id` char(36) NOT NULL,
	`contract_id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	`unit_price` decimal(20,6) NOT NULL,
	`delivery_term` enum('EX_WORKS','DELIVERED','FOB','CIF','OTHER') NOT NULL DEFAULT 'EX_WORKS',
	`delivery_note` varchar(500) NOT NULL DEFAULT '',
	CONSTRAINT `marketing_contract_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_contracts` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`department_id` char(36) NOT NULL,
	`contract_no` varchar(32) NOT NULL,
	`title` varchar(255) NOT NULL,
	`party_id` char(36) NOT NULL,
	`status` enum('DRAFT','SUBMITTED','SIGNED','ACTIVE','EXPIRED','TERMINATED') NOT NULL DEFAULT 'DRAFT',
	`currency_code` char(3) NOT NULL,
	`start_date` date,
	`end_date` date,
	`counterparty_is_contractor` boolean NOT NULL DEFAULT false,
	`signed_at` timestamp,
	`signed_by_user_id` char(36),
	`counterparty_signatory` varchar(255) NOT NULL DEFAULT '',
	`termination_reason` varchar(500) NOT NULL DEFAULT '',
	`notes` varchar(1000) NOT NULL DEFAULT '',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketing_contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_marketing_contract_company_no` UNIQUE(`company_id`,`contract_no`)
);
--> statement-breakpoint
ALTER TABLE `marketing_contract_lines` ADD CONSTRAINT `marketing_contract_lines_contract_id_marketing_contracts_id_fk` FOREIGN KEY (`contract_id`) REFERENCES `marketing_contracts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_contract_lines` ADD CONSTRAINT `marketing_contract_lines_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_contracts` ADD CONSTRAINT `marketing_contracts_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_contracts` ADD CONSTRAINT `marketing_contracts_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_contracts` ADD CONSTRAINT `marketing_contracts_party_id_parties_id_fk` FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_contracts` ADD CONSTRAINT `marketing_contracts_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_contracts` ADD CONSTRAINT `marketing_contracts_signed_by_user_id_users_id_fk` FOREIGN KEY (`signed_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_contracts` ADD CONSTRAINT `marketing_contracts_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;