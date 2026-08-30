CREATE TABLE `pdks_attendance_records` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`work_date` date NOT NULL,
	`shift_id` char(36),
	`check_in_at` timestamp,
	`check_out_at` timestamp,
	`worked_minutes` int,
	`late_minutes` int NOT NULL DEFAULT 0,
	`early_leave_minutes` int NOT NULL DEFAULT 0,
	`status` enum('PRESENT','LATE','INCOMPLETE','ABSENT') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pdks_attendance_records_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_pdks_attendance_employee_date` UNIQUE(`employee_id`,`work_date`)
);
--> statement-breakpoint
CREATE TABLE `pdks_devices` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(150) NOT NULL,
	`adapter_type` enum('MANUAL','GENERIC_RFID','ZKTECO','HIKVISION') NOT NULL DEFAULT 'MANUAL',
	`branch_id` char(36),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pdks_devices_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_pdks_devices_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `pdks_raw_punches` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`device_id` char(36) NOT NULL,
	`employee_id` char(36),
	`card_reference` varchar(100),
	`punch_at` timestamp NOT NULL,
	`direction` enum('IN','OUT','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
	`raw_payload` json,
	`processed` boolean NOT NULL DEFAULT false,
	`recorded_by_user_id` char(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `pdks_raw_punches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(100) NOT NULL,
	`start_time` time NOT NULL,
	`end_time` time NOT NULL,
	`break_minutes` int NOT NULL DEFAULT 0,
	`grace_minutes` int NOT NULL DEFAULT 0,
	`crosses_midnight` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shifts_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_shifts_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
ALTER TABLE `employees` ADD `shift_id` char(36);--> statement-breakpoint
ALTER TABLE `pdks_attendance_records` ADD CONSTRAINT `pdks_attendance_records_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pdks_attendance_records` ADD CONSTRAINT `pdks_attendance_records_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pdks_attendance_records` ADD CONSTRAINT `pdks_attendance_records_shift_id_shifts_id_fk` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pdks_devices` ADD CONSTRAINT `pdks_devices_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pdks_devices` ADD CONSTRAINT `pdks_devices_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pdks_raw_punches` ADD CONSTRAINT `pdks_raw_punches_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pdks_raw_punches` ADD CONSTRAINT `pdks_raw_punches_device_id_pdks_devices_id_fk` FOREIGN KEY (`device_id`) REFERENCES `pdks_devices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pdks_raw_punches` ADD CONSTRAINT `pdks_raw_punches_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `pdks_raw_punches` ADD CONSTRAINT `pdks_raw_punches_recorded_by_user_id_users_id_fk` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_pdks_raw_punches_employee_date` ON `pdks_raw_punches` (`employee_id`,`punch_at`);--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_shift_id_shifts_id_fk` FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON DELETE no action ON UPDATE no action;