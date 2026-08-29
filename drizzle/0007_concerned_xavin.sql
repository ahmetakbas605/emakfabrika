CREATE TABLE `ci_key_counters` (
	`company_id` char(36) NOT NULL,
	`asset_type_code` varchar(32) NOT NULL,
	`last_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `udx_ci_key_counter` UNIQUE(`company_id`,`asset_type_code`)
);
--> statement-breakpoint
CREATE TABLE `ci_relationships` (
	`id` char(36) NOT NULL,
	`source_ci_id` char(36) NOT NULL,
	`target_ci_id` char(36) NOT NULL,
	`relationship_type` enum('DEPENDS_ON','RUNS_ON','CONNECTED_TO','HOSTED_ON','LOCATED_IN','OWNED_BY','USED_BY','BACKED_UP_BY','MONITORED_BY','PROTECTED_BY','LICENSED_BY','SUPPORTED_BY','CONTRACTED_BY','PARENT_OF','CHILD_OF') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ci_relationships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `computer_details` (
	`asset_id` char(36) NOT NULL,
	`hostname` varchar(255) NOT NULL DEFAULT '',
	`os` varchar(255) NOT NULL DEFAULT '',
	`os_version` varchar(100) NOT NULL DEFAULT '',
	`cpu` varchar(255) NOT NULL DEFAULT '',
	`ram_gb` int,
	`storage_gb` int,
	`last_user` varchar(255) NOT NULL DEFAULT '',
	`antivirus_status` varchar(64) NOT NULL DEFAULT '',
	`encryption_enabled` boolean NOT NULL DEFAULT false,
	CONSTRAINT `computer_details_asset_id` PRIMARY KEY(`asset_id`)
);
--> statement-breakpoint
CREATE TABLE `configuration_items` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`ci_type` enum('ASSET','SERVICE','APPLICATION','DATABASE') NOT NULL DEFAULT 'ASSET',
	`linked_asset_id` char(36),
	`name` varchar(255) NOT NULL,
	`ci_key` varchar(64) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'ACTIVE',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `configuration_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_ci_company_key` UNIQUE(`company_id`,`ci_key`)
);
--> statement-breakpoint
CREATE TABLE `it_asset_assignments` (
	`id` char(36) NOT NULL,
	`asset_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`assigned_at` timestamp NOT NULL DEFAULT (now()),
	`returned_at` timestamp,
	`assignment_type` enum('PERMANENT','TEMPORARY','SHARED') NOT NULL DEFAULT 'PERMANENT',
	`assigned_by` char(36) NOT NULL,
	`reason` text,
	CONSTRAINT `it_asset_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `it_asset_status_history` (
	`id` char(36) NOT NULL,
	`asset_id` char(36) NOT NULL,
	`from_status` varchar(32) NOT NULL,
	`to_status` varchar(32) NOT NULL,
	`changed_by` char(36) NOT NULL,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `it_asset_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `it_asset_types` (
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	CONSTRAINT `it_asset_types_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `it_assets` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`branch_id` char(36),
	`location_id` char(36),
	`department_id` char(36),
	`asset_type_code` varchar(32) NOT NULL,
	`asset_tag` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`manufacturer` varchar(255) NOT NULL DEFAULT '',
	`model` varchar(255) NOT NULL DEFAULT '',
	`serial_number` varchar(255) NOT NULL DEFAULT '',
	`status` enum('IN_STOCK','ASSIGNED','INSTALLED','IN_SERVICE','UNDER_MAINTENANCE','REPAIR','LOST','STOLEN','RETIRED','DISPOSED','UNKNOWN') NOT NULL DEFAULT 'IN_STOCK',
	`owner_user_id` char(36),
	`responsible_technician_id` char(36),
	`purchase_date` date,
	`purchase_cost` decimal(20,6),
	`warranty_start` date,
	`warranty_end` date,
	`last_inventory_scan_at` timestamp,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `it_assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_it_asset_company_tag` UNIQUE(`company_id`,`asset_tag`)
);
--> statement-breakpoint
CREATE TABLE `it_locations` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`branch_id` char(36),
	`parent_location_id` char(36),
	`location_type` enum('BUILDING','FLOOR','ROOM','RACK','DESK','DATA_CENTER') NOT NULL,
	`name` varchar(255) NOT NULL,
	`rack_units` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `it_locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ci_key_counters` ADD CONSTRAINT `ci_key_counters_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ci_relationships` ADD CONSTRAINT `ci_relationships_source_ci_id_configuration_items_id_fk` FOREIGN KEY (`source_ci_id`) REFERENCES `configuration_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ci_relationships` ADD CONSTRAINT `ci_relationships_target_ci_id_configuration_items_id_fk` FOREIGN KEY (`target_ci_id`) REFERENCES `configuration_items`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `computer_details` ADD CONSTRAINT `computer_details_asset_id_it_assets_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `it_assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `configuration_items` ADD CONSTRAINT `configuration_items_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `configuration_items` ADD CONSTRAINT `configuration_items_linked_asset_id_it_assets_id_fk` FOREIGN KEY (`linked_asset_id`) REFERENCES `it_assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `it_asset_assignments` ADD CONSTRAINT `it_asset_assignments_asset_id_it_assets_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `it_assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `it_asset_assignments` ADD CONSTRAINT `it_asset_assignments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `it_asset_assignments` ADD CONSTRAINT `it_asset_assignments_assigned_by_users_id_fk` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `it_asset_status_history` ADD CONSTRAINT `it_asset_status_history_asset_id_it_assets_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `it_assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `it_asset_status_history` ADD CONSTRAINT `it_asset_status_history_changed_by_users_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `it_assets` ADD CONSTRAINT `it_assets_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `it_assets` ADD CONSTRAINT `it_assets_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `it_assets` ADD CONSTRAINT `it_assets_location_id_it_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `it_locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `it_assets` ADD CONSTRAINT `it_assets_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `it_assets` ADD CONSTRAINT `it_assets_asset_type_code_it_asset_types_code_fk` FOREIGN KEY (`asset_type_code`) REFERENCES `it_asset_types`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `it_assets` ADD CONSTRAINT `it_assets_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `it_assets` ADD CONSTRAINT `it_assets_responsible_technician_id_users_id_fk` FOREIGN KEY (`responsible_technician_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `it_assets` ADD CONSTRAINT `it_assets_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `it_locations` ADD CONSTRAINT `it_locations_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `it_locations` ADD CONSTRAINT `it_locations_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;