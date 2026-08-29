CREATE TABLE `proc_award_lines` (
	`id` char(36) NOT NULL,
	`award_id` char(36) NOT NULL,
	`rfq_line_id` char(36) NOT NULL,
	`supplier_party_id` char(36) NOT NULL,
	`quotation_line_id` char(36) NOT NULL,
	`awarded_qty` decimal(20,6) NOT NULL,
	`awarded_unit_price` decimal(20,6) NOT NULL,
	`awarded_total` decimal(20,6) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proc_award_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proc_awards` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`rfq_id` char(36) NOT NULL,
	`award_no` varchar(32) NOT NULL,
	`status` enum('DRAFT','SUBMITTED','APPROVED','REJECTED','REVISION_REQUIRED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`submitted_at` timestamp,
	`completed_at` timestamp,
	CONSTRAINT `proc_awards_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_proc_award_company_no` UNIQUE(`company_id`,`award_no`)
);
--> statement-breakpoint
ALTER TABLE `proc_rfqs` MODIFY COLUMN `status` enum('DRAFT','SENT','CLOSED','AWARDED','CANCELLED') NOT NULL DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE `proc_award_lines` ADD CONSTRAINT `proc_award_lines_award_id_proc_awards_id_fk` FOREIGN KEY (`award_id`) REFERENCES `proc_awards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_award_lines` ADD CONSTRAINT `proc_award_lines_rfq_line_id_proc_rfq_lines_id_fk` FOREIGN KEY (`rfq_line_id`) REFERENCES `proc_rfq_lines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_award_lines` ADD CONSTRAINT `proc_award_lines_supplier_party_id_parties_id_fk` FOREIGN KEY (`supplier_party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_award_lines` ADD CONSTRAINT `proc_award_lines_quotation_line_id_proc_quotation_lines_id_fk` FOREIGN KEY (`quotation_line_id`) REFERENCES `proc_quotation_lines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_awards` ADD CONSTRAINT `proc_awards_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_awards` ADD CONSTRAINT `proc_awards_rfq_id_proc_rfqs_id_fk` FOREIGN KEY (`rfq_id`) REFERENCES `proc_rfqs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_awards` ADD CONSTRAINT `proc_awards_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;