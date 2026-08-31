CREATE TABLE `ncr_records` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`ncr_no` varchar(32) NOT NULL,
	`inspection_id` char(36),
	`supplier_party_id` char(36),
	`product_id` char(36),
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`severity` enum('MINOR','MAJOR','CRITICAL') NOT NULL DEFAULT 'MINOR',
	`status` enum('OPEN','INVESTIGATING','CORRECTIVE_ACTION','VERIFICATION','CLOSED','REJECTED') NOT NULL DEFAULT 'OPEN',
	`root_cause` text,
	`corrective_action` text,
	`preventive_action` text,
	`assigned_to_user_id` char(36),
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`closed_at` timestamp,
	CONSTRAINT `ncr_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_ncr_records_company_no` UNIQUE(`company_id`,`ncr_no`)
);
--> statement-breakpoint
CREATE TABLE `quality_inspections` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`inspection_no` varchar(32) NOT NULL,
	`type` enum('INCOMING','IN_PROCESS','FINAL') NOT NULL,
	`source_type` varchar(64) NOT NULL,
	`source_id` char(36) NOT NULL,
	`product_id` char(36),
	`inspected_qty` decimal(20,6) NOT NULL,
	`passed_qty` decimal(20,6) NOT NULL,
	`failed_qty` decimal(20,6) NOT NULL,
	`result` enum('PASS','FAIL','CONDITIONAL') NOT NULL,
	`notes` text,
	`inspected_by_user_id` char(36) NOT NULL,
	`inspected_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quality_inspections_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_quality_inspections_company_no` UNIQUE(`company_id`,`inspection_no`)
);
--> statement-breakpoint
ALTER TABLE `ncr_records` ADD CONSTRAINT `ncr_records_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ncr_records` ADD CONSTRAINT `ncr_records_inspection_id_quality_inspections_id_fk` FOREIGN KEY (`inspection_id`) REFERENCES `quality_inspections`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ncr_records` ADD CONSTRAINT `ncr_records_supplier_party_id_parties_id_fk` FOREIGN KEY (`supplier_party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ncr_records` ADD CONSTRAINT `ncr_records_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ncr_records` ADD CONSTRAINT `ncr_records_assigned_to_user_id_users_id_fk` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ncr_records` ADD CONSTRAINT `ncr_records_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quality_inspections` ADD CONSTRAINT `quality_inspections_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quality_inspections` ADD CONSTRAINT `quality_inspections_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `quality_inspections` ADD CONSTRAINT `quality_inspections_inspected_by_user_id_users_id_fk` FOREIGN KEY (`inspected_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;