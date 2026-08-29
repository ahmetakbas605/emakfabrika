CREATE TABLE `proc_quotation_lines` (
	`id` char(36) NOT NULL,
	`quotation_id` char(36) NOT NULL,
	`rfq_line_id` char(36) NOT NULL,
	`unit_price` decimal(20,6) NOT NULL,
	`discount_percent` decimal(5,2),
	`tax_percent` decimal(5,2),
	`delivery_days` int,
	`is_alternative` boolean NOT NULL DEFAULT false,
	`alternative_description` varchar(255) NOT NULL DEFAULT '',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proc_quotation_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proc_quotations` (
	`id` char(36) NOT NULL,
	`rfq_id` char(36) NOT NULL,
	`supplier_party_id` char(36) NOT NULL,
	`version` int NOT NULL,
	`currency_code` char(3) NOT NULL,
	`valid_until` date,
	`payment_terms` varchar(255) NOT NULL DEFAULT '',
	`delivery_days` int,
	`notes` text,
	`submitted_by_user_id` char(36) NOT NULL,
	`submitted_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proc_quotations_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_proc_quotation_version` UNIQUE(`rfq_id`,`supplier_party_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE `proc_rfq_lines` (
	`id` char(36) NOT NULL,
	`rfq_id` char(36) NOT NULL,
	`src_request_line_id` char(36),
	`product_id` char(36),
	`description` varchar(255) NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	`unit_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proc_rfq_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proc_rfq_suppliers` (
	`id` char(36) NOT NULL,
	`rfq_id` char(36) NOT NULL,
	`supplier_party_id` char(36) NOT NULL,
	`status` enum('INVITED','RESPONDED','DECLINED') NOT NULL DEFAULT 'INVITED',
	`invited_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proc_rfq_suppliers_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_proc_rfq_supplier` UNIQUE(`rfq_id`,`supplier_party_id`)
);
--> statement-breakpoint
CREATE TABLE `proc_rfqs` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`rfq_no` varchar(32) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('DRAFT','SENT','CLOSED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`quotation_deadline` timestamp,
	`delivery_location` varchar(255) NOT NULL DEFAULT '',
	`payment_terms` varchar(255) NOT NULL DEFAULT '',
	`warranty_requirement` varchar(255) NOT NULL DEFAULT '',
	`notes` text,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`sent_at` timestamp,
	`closed_at` timestamp,
	CONSTRAINT `proc_rfqs_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_proc_rfq_company_no` UNIQUE(`company_id`,`rfq_no`)
);
--> statement-breakpoint
ALTER TABLE `proc_quotation_lines` ADD CONSTRAINT `proc_quotation_lines_quotation_id_proc_quotations_id_fk` FOREIGN KEY (`quotation_id`) REFERENCES `proc_quotations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_quotation_lines` ADD CONSTRAINT `proc_quotation_lines_rfq_line_id_proc_rfq_lines_id_fk` FOREIGN KEY (`rfq_line_id`) REFERENCES `proc_rfq_lines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_quotations` ADD CONSTRAINT `proc_quotations_rfq_id_proc_rfqs_id_fk` FOREIGN KEY (`rfq_id`) REFERENCES `proc_rfqs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_quotations` ADD CONSTRAINT `proc_quotations_supplier_party_id_parties_id_fk` FOREIGN KEY (`supplier_party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_quotations` ADD CONSTRAINT `proc_quotations_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_quotations` ADD CONSTRAINT `proc_quotations_submitted_by_user_id_users_id_fk` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_rfq_lines` ADD CONSTRAINT `proc_rfq_lines_rfq_id_proc_rfqs_id_fk` FOREIGN KEY (`rfq_id`) REFERENCES `proc_rfqs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_rfq_lines` ADD CONSTRAINT `proc_rfq_lines_src_request_line_id_proc_request_lines_id_fk` FOREIGN KEY (`src_request_line_id`) REFERENCES `proc_request_lines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_rfq_lines` ADD CONSTRAINT `proc_rfq_lines_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_rfq_lines` ADD CONSTRAINT `proc_rfq_lines_unit_id_units_id_fk` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_rfq_suppliers` ADD CONSTRAINT `proc_rfq_suppliers_rfq_id_proc_rfqs_id_fk` FOREIGN KEY (`rfq_id`) REFERENCES `proc_rfqs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_rfq_suppliers` ADD CONSTRAINT `proc_rfq_suppliers_supplier_party_id_parties_id_fk` FOREIGN KEY (`supplier_party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_rfqs` ADD CONSTRAINT `proc_rfqs_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_rfqs` ADD CONSTRAINT `proc_rfqs_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;