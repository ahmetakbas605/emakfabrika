CREATE TABLE `occupational_health_records` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`record_type` enum('EXAMINATION','HEALTH_REPORT','PERIODIC_FOLLOWUP') NOT NULL,
	`exam_kind` enum('PRE_EMPLOYMENT','PERIODIC','RETURN_TO_WORK','JOB_CHANGE','COMPLAINT','OTHER') NOT NULL DEFAULT 'OTHER',
	`title` varchar(255) NOT NULL,
	`physician_name` varchar(255) NOT NULL DEFAULT '',
	`institution` varchar(255) NOT NULL DEFAULT '',
	`performed_at` date,
	`next_due_date` date,
	`result` enum('PENDING','FIT','FIT_WITH_RESTRICTION','TEMPORARILY_UNFIT','UNFIT') NOT NULL DEFAULT 'PENDING',
	`restriction_note` varchar(500) NOT NULL DEFAULT '',
	`notes` varchar(1000) NOT NULL DEFAULT '',
	`status` enum('ACTIVE','ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `occupational_health_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `occupational_health_records` ADD CONSTRAINT `occupational_health_records_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `occupational_health_records` ADD CONSTRAINT `occupational_health_records_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;