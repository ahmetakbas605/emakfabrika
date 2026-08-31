CREATE TABLE `eam_asset_types` (
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	CONSTRAINT `eam_asset_types_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `eam_assets` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`branch_id` char(36),
	`location_note` varchar(255) NOT NULL DEFAULT '',
	`asset_type_code` varchar(32) NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`manufacturer` varchar(255) NOT NULL DEFAULT '',
	`model` varchar(255) NOT NULL DEFAULT '',
	`serial_number` varchar(255) NOT NULL DEFAULT '',
	`status` enum('IN_SERVICE','UNDER_MAINTENANCE','OUT_OF_SERVICE','DECOMMISSIONED') NOT NULL DEFAULT 'IN_SERVICE',
	`responsible_user_id` char(36),
	`department_id` char(36),
	`purchase_date` date,
	`purchase_cost` decimal(20,6),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `eam_assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_eam_asset_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `energy_meters` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`energy_type` enum('ELECTRICITY','NATURAL_GAS','WATER','STEAM','COMPRESSED_AIR') NOT NULL,
	`unit` varchar(16) NOT NULL,
	`work_center_id` char(36),
	`eam_asset_id` char(36),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `energy_meters_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_energy_meter_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `energy_readings` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`meter_id` char(36) NOT NULL,
	`period_start` date NOT NULL,
	`period_end` date NOT NULL,
	`consumption` decimal(20,6) NOT NULL,
	`cost` decimal(20,6),
	`recorded_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `energy_readings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `maint_plans` ADD `eam_asset_id` char(36);--> statement-breakpoint
ALTER TABLE `maint_plans` ADD `department_id` char(36);--> statement-breakpoint
ALTER TABLE `eam_assets` ADD CONSTRAINT `eam_assets_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `eam_assets` ADD CONSTRAINT `eam_assets_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `eam_assets` ADD CONSTRAINT `eam_assets_asset_type_code_eam_asset_types_code_fk` FOREIGN KEY (`asset_type_code`) REFERENCES `eam_asset_types`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `eam_assets` ADD CONSTRAINT `eam_assets_responsible_user_id_users_id_fk` FOREIGN KEY (`responsible_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `eam_assets` ADD CONSTRAINT `eam_assets_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `energy_meters` ADD CONSTRAINT `energy_meters_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `energy_meters` ADD CONSTRAINT `energy_meters_work_center_id_work_centers_id_fk` FOREIGN KEY (`work_center_id`) REFERENCES `work_centers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `energy_meters` ADD CONSTRAINT `energy_meters_eam_asset_id_eam_assets_id_fk` FOREIGN KEY (`eam_asset_id`) REFERENCES `eam_assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `energy_readings` ADD CONSTRAINT `energy_readings_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `energy_readings` ADD CONSTRAINT `energy_readings_meter_id_energy_meters_id_fk` FOREIGN KEY (`meter_id`) REFERENCES `energy_meters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `energy_readings` ADD CONSTRAINT `energy_readings_recorded_by_user_id_users_id_fk` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maint_plans` ADD CONSTRAINT `maint_plans_eam_asset_id_eam_assets_id_fk` FOREIGN KEY (`eam_asset_id`) REFERENCES `eam_assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maint_plans` ADD CONSTRAINT `maint_plans_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;