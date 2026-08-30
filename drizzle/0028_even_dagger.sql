CREATE TABLE `proc_tender_bid_lines` (
	`id` char(36) NOT NULL,
	`bid_id` char(36) NOT NULL,
	`tender_line_id` char(36) NOT NULL,
	`unit_price` decimal(20,6) NOT NULL,
	`discount_percent` decimal(5,2),
	`tax_percent` decimal(5,2),
	`delivery_days` int,
	`is_alternative` boolean NOT NULL DEFAULT false,
	`alternative_description` varchar(255) NOT NULL DEFAULT '',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proc_tender_bid_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proc_tender_bids` (
	`id` char(36) NOT NULL,
	`tender_id` char(36) NOT NULL,
	`supplier_party_id` char(36) NOT NULL,
	`version` int NOT NULL,
	`currency_code` char(3) NOT NULL,
	`valid_until` date,
	`payment_terms` varchar(255) NOT NULL DEFAULT '',
	`delivery_days` int,
	`bid_bond_reference` varchar(255) NOT NULL DEFAULT '',
	`notes` text,
	`submitted_by_user_id` char(36) NOT NULL,
	`submitted_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proc_tender_bids_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_proc_tender_bid_version` UNIQUE(`tender_id`,`supplier_party_id`,`version`)
);
--> statement-breakpoint
ALTER TABLE `proc_award_lines` MODIFY COLUMN `rfq_line_id` char(36);--> statement-breakpoint
ALTER TABLE `proc_award_lines` MODIFY COLUMN `quotation_line_id` char(36);--> statement-breakpoint
ALTER TABLE `proc_awards` MODIFY COLUMN `rfq_id` char(36);--> statement-breakpoint
ALTER TABLE `proc_tenders` MODIFY COLUMN `status` enum('DRAFT','PUBLISHED','OPENED','AWARDED','CANCELLED') NOT NULL DEFAULT 'DRAFT';--> statement-breakpoint
ALTER TABLE `proc_award_lines` ADD `tender_line_id` char(36);--> statement-breakpoint
ALTER TABLE `proc_award_lines` ADD `tender_bid_line_id` char(36);--> statement-breakpoint
ALTER TABLE `proc_awards` ADD `tender_id` char(36);--> statement-breakpoint
ALTER TABLE `proc_tenders` ADD `opened_at` timestamp;--> statement-breakpoint
ALTER TABLE `proc_tenders` ADD `opened_by_user_id` char(36);--> statement-breakpoint
ALTER TABLE `proc_tender_bid_lines` ADD CONSTRAINT `proc_tender_bid_lines_bid_id_proc_tender_bids_id_fk` FOREIGN KEY (`bid_id`) REFERENCES `proc_tender_bids`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_tender_bid_lines` ADD CONSTRAINT `proc_tender_bid_lines_tender_line_id_proc_tender_lines_id_fk` FOREIGN KEY (`tender_line_id`) REFERENCES `proc_tender_lines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_tender_bids` ADD CONSTRAINT `proc_tender_bids_tender_id_proc_tenders_id_fk` FOREIGN KEY (`tender_id`) REFERENCES `proc_tenders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_tender_bids` ADD CONSTRAINT `proc_tender_bids_supplier_party_id_parties_id_fk` FOREIGN KEY (`supplier_party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_tender_bids` ADD CONSTRAINT `proc_tender_bids_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_tender_bids` ADD CONSTRAINT `proc_tender_bids_submitted_by_user_id_users_id_fk` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_award_lines` ADD CONSTRAINT `proc_award_lines_tender_line_id_proc_tender_lines_id_fk` FOREIGN KEY (`tender_line_id`) REFERENCES `proc_tender_lines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_award_lines` ADD CONSTRAINT `proc_award_lines_tender_bid_line_id_proc_tender_bid_lines_id_fk` FOREIGN KEY (`tender_bid_line_id`) REFERENCES `proc_tender_bid_lines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_awards` ADD CONSTRAINT `proc_awards_tender_id_proc_tenders_id_fk` FOREIGN KEY (`tender_id`) REFERENCES `proc_tenders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_tenders` ADD CONSTRAINT `proc_tenders_opened_by_user_id_users_id_fk` FOREIGN KEY (`opened_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;