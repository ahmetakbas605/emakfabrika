CREATE TABLE `proc_po_lines` (
	`id` char(36) NOT NULL,
	`po_id` char(36) NOT NULL,
	`award_line_id` char(36) NOT NULL,
	`description` varchar(255) NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	`unit_id` char(36) NOT NULL,
	`unit_price` decimal(20,6) NOT NULL,
	`line_total` decimal(20,6) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proc_po_lines_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_proc_po_lines_award_line` UNIQUE(`award_line_id`)
);
--> statement-breakpoint
CREATE TABLE `proc_pos` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`award_id` char(36) NOT NULL,
	`supplier_party_id` char(36) NOT NULL,
	`po_no` varchar(32) NOT NULL,
	`status` enum('DRAFT','ISSUED','ACKNOWLEDGED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`currency_code` char(3) NOT NULL,
	`delivery_location` varchar(255) NOT NULL DEFAULT '',
	`payment_terms` varchar(255) NOT NULL DEFAULT '',
	`warranty_requirement` varchar(255) NOT NULL DEFAULT '',
	`notes` text,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`issued_at` timestamp,
	`acknowledged_at` timestamp,
	`cancelled_at` timestamp,
	CONSTRAINT `proc_pos_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_proc_pos_company_no` UNIQUE(`company_id`,`po_no`)
);
--> statement-breakpoint
ALTER TABLE `proc_po_lines` ADD CONSTRAINT `proc_po_lines_po_id_proc_pos_id_fk` FOREIGN KEY (`po_id`) REFERENCES `proc_pos`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_po_lines` ADD CONSTRAINT `proc_po_lines_award_line_id_proc_award_lines_id_fk` FOREIGN KEY (`award_line_id`) REFERENCES `proc_award_lines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_po_lines` ADD CONSTRAINT `proc_po_lines_unit_id_units_id_fk` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_pos` ADD CONSTRAINT `proc_pos_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_pos` ADD CONSTRAINT `proc_pos_award_id_proc_awards_id_fk` FOREIGN KEY (`award_id`) REFERENCES `proc_awards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_pos` ADD CONSTRAINT `proc_pos_supplier_party_id_parties_id_fk` FOREIGN KEY (`supplier_party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_pos` ADD CONSTRAINT `proc_pos_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_pos` ADD CONSTRAINT `proc_pos_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;