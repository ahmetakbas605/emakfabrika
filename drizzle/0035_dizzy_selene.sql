CREATE TABLE `access_cards` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`card_number` varchar(64) NOT NULL,
	`status` enum('ACTIVE','LOST','REVOKED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
	`issued_at` timestamp NOT NULL DEFAULT (now()),
	`revoked_at` timestamp,
	CONSTRAINT `access_cards_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_access_cards_company_number` UNIQUE(`company_id`,`card_number`)
);
--> statement-breakpoint
CREATE TABLE `access_group_members` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`group_id` char(36) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`valid_from` date,
	`valid_until` date,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `access_group_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `access_group_zones` (
	`id` char(36) NOT NULL,
	`group_id` char(36) NOT NULL,
	`zone_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `access_group_zones_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_access_group_zones_group_zone` UNIQUE(`group_id`,`zone_id`)
);
--> statement-breakpoint
CREATE TABLE `access_groups` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(150) NOT NULL,
	`description` varchar(255) NOT NULL DEFAULT '',
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `access_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_access_groups_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `access_logs` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`device_id` char(36) NOT NULL,
	`zone_id` char(36) NOT NULL,
	`card_id` char(36),
	`employee_id` char(36),
	`access_at` timestamp NOT NULL,
	`result` enum('GRANTED','DENIED') NOT NULL,
	`reason` varchar(100) NOT NULL DEFAULT '',
	`recorded_by_user_id` char(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `access_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `access_zones` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(150) NOT NULL,
	`branch_id` char(36),
	`description` varchar(255) NOT NULL DEFAULT '',
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `access_zones_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_access_zones_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
ALTER TABLE `access_cards` ADD CONSTRAINT `access_cards_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_cards` ADD CONSTRAINT `access_cards_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_group_members` ADD CONSTRAINT `access_group_members_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_group_members` ADD CONSTRAINT `access_group_members_group_id_access_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `access_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_group_members` ADD CONSTRAINT `access_group_members_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_group_zones` ADD CONSTRAINT `access_group_zones_group_id_access_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `access_groups`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_group_zones` ADD CONSTRAINT `access_group_zones_zone_id_access_zones_id_fk` FOREIGN KEY (`zone_id`) REFERENCES `access_zones`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_groups` ADD CONSTRAINT `access_groups_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_logs` ADD CONSTRAINT `access_logs_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_logs` ADD CONSTRAINT `access_logs_device_id_pdks_devices_id_fk` FOREIGN KEY (`device_id`) REFERENCES `pdks_devices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_logs` ADD CONSTRAINT `access_logs_zone_id_access_zones_id_fk` FOREIGN KEY (`zone_id`) REFERENCES `access_zones`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_logs` ADD CONSTRAINT `access_logs_card_id_access_cards_id_fk` FOREIGN KEY (`card_id`) REFERENCES `access_cards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_logs` ADD CONSTRAINT `access_logs_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_logs` ADD CONSTRAINT `access_logs_recorded_by_user_id_users_id_fk` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_zones` ADD CONSTRAINT `access_zones_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `access_zones` ADD CONSTRAINT `access_zones_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_access_logs_employee_date` ON `access_logs` (`employee_id`,`access_at`);