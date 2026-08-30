ALTER TABLE `proc_comm_evals` DROP FOREIGN KEY `proc_comm_evals_quotation_id_proc_quotations_id_fk`;
--> statement-breakpoint
ALTER TABLE `proc_comm_evals` MODIFY COLUMN `quotation_id` char(36);--> statement-breakpoint
ALTER TABLE `proc_tech_evals` MODIFY COLUMN `quotation_line_id` char(36);--> statement-breakpoint
ALTER TABLE `proc_comm_evals` ADD `tender_bid_id` char(36);--> statement-breakpoint
ALTER TABLE `proc_tech_evals` ADD `tender_bid_line_id` char(36);--> statement-breakpoint
ALTER TABLE `proc_comm_evals` ADD CONSTRAINT `udx_proc_comm_eval_tbid` UNIQUE(`tender_bid_id`);--> statement-breakpoint
ALTER TABLE `proc_tech_evals` ADD CONSTRAINT `udx_proc_tech_eval_tbid_line` UNIQUE(`tender_bid_line_id`);--> statement-breakpoint
ALTER TABLE `proc_comm_evals` ADD CONSTRAINT `proc_comm_evals_tender_bid_id_proc_tender_bids_id_fk` FOREIGN KEY (`tender_bid_id`) REFERENCES `proc_tender_bids`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_comm_evals` ADD CONSTRAINT `proc_comm_evals_quotation_id_proc_quotations_id_fk` FOREIGN KEY (`quotation_id`) REFERENCES `proc_quotations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_tech_evals` ADD CONSTRAINT `proc_tech_evals_tender_bid_line_id_proc_tender_bid_lines_id_fk` FOREIGN KEY (`tender_bid_line_id`) REFERENCES `proc_tender_bid_lines`(`id`) ON DELETE cascade ON UPDATE no action;