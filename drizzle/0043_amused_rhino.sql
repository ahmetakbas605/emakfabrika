CREATE TABLE `downtime_reasons` (
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` enum('PLANNED','UNPLANNED') NOT NULL,
	CONSTRAINT `downtime_reasons_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `machine_downtimes` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`machine_id` char(36) NOT NULL,
	`operation_id` char(36),
	`reason_code` varchar(32) NOT NULL,
	`started_at` timestamp NOT NULL,
	`ended_at` timestamp,
	`notes` text,
	`recorded_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `machine_downtimes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `machines` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`work_center_id` char(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`ideal_cycle_time_seconds` decimal(10,2),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `machines_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_machine_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
ALTER TABLE `prod_operations` ADD `machine_id` char(36);--> statement-breakpoint
ALTER TABLE `machine_downtimes` ADD CONSTRAINT `machine_downtimes_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `machine_downtimes` ADD CONSTRAINT `machine_downtimes_machine_id_machines_id_fk` FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `machine_downtimes` ADD CONSTRAINT `machine_downtimes_operation_id_prod_operations_id_fk` FOREIGN KEY (`operation_id`) REFERENCES `prod_operations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `machine_downtimes` ADD CONSTRAINT `machine_downtimes_reason_code_downtime_reasons_code_fk` FOREIGN KEY (`reason_code`) REFERENCES `downtime_reasons`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `machine_downtimes` ADD CONSTRAINT `machine_downtimes_recorded_by_user_id_users_id_fk` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `machines` ADD CONSTRAINT `machines_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `machines` ADD CONSTRAINT `machines_work_center_id_work_centers_id_fk` FOREIGN KEY (`work_center_id`) REFERENCES `work_centers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prod_operations` ADD CONSTRAINT `prod_operations_machine_id_machines_id_fk` FOREIGN KEY (`machine_id`) REFERENCES `machines`(`id`) ON DELETE no action ON UPDATE no action;