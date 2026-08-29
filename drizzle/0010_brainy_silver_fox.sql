CREATE TABLE `maint_plans` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`asset_id` char(36),
	`title` varchar(255) NOT NULL,
	`maintenance_type` enum('PREVENTIVE','CORRECTIVE','PREDICTIVE','INSPECTION','CALIBRATION') NOT NULL,
	`frequency` enum('DAILY','WEEKLY','MONTHLY','QUARTERLY','ANNUAL') NOT NULL,
	`interval_value` int NOT NULL DEFAULT 1,
	`start_date` date NOT NULL,
	`next_due_date` date NOT NULL,
	`assigned_technician_id` char(36),
	`checklist_template_id` char(36),
	`estimated_duration_minutes` int,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `maint_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `maint_work_orders` (
	`id` char(36) NOT NULL,
	`maintenance_plan_id` char(36) NOT NULL,
	`work_order_id` char(36) NOT NULL,
	`scheduled_date` date NOT NULL,
	`generated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `maint_work_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `maint_work_orders_work_order_id_unique` UNIQUE(`work_order_id`),
	CONSTRAINT `udx_maint_wo_plan_date` UNIQUE(`maintenance_plan_id`,`scheduled_date`)
);
--> statement-breakpoint
ALTER TABLE `maint_plans` ADD CONSTRAINT `maint_plans_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maint_plans` ADD CONSTRAINT `maint_plans_asset_id_it_assets_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `it_assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maint_plans` ADD CONSTRAINT `maint_plans_assigned_technician_id_users_id_fk` FOREIGN KEY (`assigned_technician_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maint_plans` ADD CONSTRAINT `maint_plans_checklist_template_id_checklist_templates_id_fk` FOREIGN KEY (`checklist_template_id`) REFERENCES `checklist_templates`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maint_work_orders` ADD CONSTRAINT `maint_work_orders_maintenance_plan_id_maint_plans_id_fk` FOREIGN KEY (`maintenance_plan_id`) REFERENCES `maint_plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maint_work_orders` ADD CONSTRAINT `maint_work_orders_work_order_id_work_orders_id_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE cascade ON UPDATE no action;