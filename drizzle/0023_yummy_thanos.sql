CREATE TABLE `proc_comm_evals` (
	`id` char(36) NOT NULL,
	`quotation_id` char(36) NOT NULL,
	`score` decimal(5,2) NOT NULL,
	`notes` text,
	`evaluated_by_user_id` char(36) NOT NULL,
	`evaluated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proc_comm_evals_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_proc_comm_eval_quotation` UNIQUE(`quotation_id`)
);
--> statement-breakpoint
CREATE TABLE `proc_scoring_weights` (
	`company_id` char(36) NOT NULL,
	`price_weight` decimal(5,2) NOT NULL DEFAULT '50',
	`technical_weight` decimal(5,2) NOT NULL DEFAULT '20',
	`delivery_weight` decimal(5,2) NOT NULL DEFAULT '10',
	`commercial_weight` decimal(5,2) NOT NULL DEFAULT '20',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `proc_scoring_weights_company_id` PRIMARY KEY(`company_id`)
);
--> statement-breakpoint
CREATE TABLE `proc_tech_evals` (
	`id` char(36) NOT NULL,
	`quotation_line_id` char(36) NOT NULL,
	`compliance_status` enum('COMPLIANT','PARTIALLY_COMPLIANT','NON_COMPLIANT','ALTERNATIVE_ACCEPTED','REJECTED') NOT NULL,
	`reason` text,
	`evaluated_by_user_id` char(36) NOT NULL,
	`evaluated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proc_tech_evals_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_proc_tech_eval_line` UNIQUE(`quotation_line_id`)
);
--> statement-breakpoint
ALTER TABLE `proc_comm_evals` ADD CONSTRAINT `proc_comm_evals_quotation_id_proc_quotations_id_fk` FOREIGN KEY (`quotation_id`) REFERENCES `proc_quotations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_comm_evals` ADD CONSTRAINT `proc_comm_evals_evaluated_by_user_id_users_id_fk` FOREIGN KEY (`evaluated_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_scoring_weights` ADD CONSTRAINT `proc_scoring_weights_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_tech_evals` ADD CONSTRAINT `proc_tech_evals_quotation_line_id_proc_quotation_lines_id_fk` FOREIGN KEY (`quotation_line_id`) REFERENCES `proc_quotation_lines`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_tech_evals` ADD CONSTRAINT `proc_tech_evals_evaluated_by_user_id_users_id_fk` FOREIGN KEY (`evaluated_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;