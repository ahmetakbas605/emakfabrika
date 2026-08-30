CREATE TABLE `proc_tender_lines` (
	`id` char(36) NOT NULL,
	`tender_id` char(36) NOT NULL,
	`src_request_line_id` char(36),
	`product_id` char(36),
	`description` varchar(255) NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	`unit_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proc_tender_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proc_tender_suppliers` (
	`id` char(36) NOT NULL,
	`tender_id` char(36) NOT NULL,
	`supplier_party_id` char(36) NOT NULL,
	`status` enum('INVITED','RESPONDED','DECLINED') NOT NULL DEFAULT 'INVITED',
	`invited_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proc_tender_suppliers_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_proc_tender_supplier` UNIQUE(`tender_id`,`supplier_party_id`)
);
--> statement-breakpoint
CREATE TABLE `proc_tenders` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`tender_no` varchar(32) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('DRAFT','PUBLISHED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`bid_submission_deadline` timestamp,
	`bid_opening_at` timestamp,
	`delivery_location` varchar(255) NOT NULL DEFAULT '',
	`payment_terms` varchar(255) NOT NULL DEFAULT '',
	`warranty_requirement` varchar(255) NOT NULL DEFAULT '',
	`bid_bond_required` boolean NOT NULL DEFAULT false,
	`bid_bond_percent` decimal(5,2),
	`bid_bond_amount` decimal(20,6),
	`open_participation` boolean NOT NULL DEFAULT false,
	`notes` text,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`published_at` timestamp,
	`cancelled_at` timestamp,
	CONSTRAINT `proc_tenders_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_proc_tenders_company_no` UNIQUE(`company_id`,`tender_no`)
);
--> statement-breakpoint
ALTER TABLE `proc_tender_lines` ADD CONSTRAINT `proc_tender_lines_tender_id_proc_tenders_id_fk` FOREIGN KEY (`tender_id`) REFERENCES `proc_tenders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_tender_lines` ADD CONSTRAINT `proc_tender_lines_src_request_line_id_proc_request_lines_id_fk` FOREIGN KEY (`src_request_line_id`) REFERENCES `proc_request_lines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_tender_lines` ADD CONSTRAINT `proc_tender_lines_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_tender_lines` ADD CONSTRAINT `proc_tender_lines_unit_id_units_id_fk` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_tender_suppliers` ADD CONSTRAINT `proc_tender_suppliers_tender_id_proc_tenders_id_fk` FOREIGN KEY (`tender_id`) REFERENCES `proc_tenders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_tender_suppliers` ADD CONSTRAINT `proc_tender_suppliers_supplier_party_id_parties_id_fk` FOREIGN KEY (`supplier_party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_tenders` ADD CONSTRAINT `proc_tenders_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_tenders` ADD CONSTRAINT `proc_tenders_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;