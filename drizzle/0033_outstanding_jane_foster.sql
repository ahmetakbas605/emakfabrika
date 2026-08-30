CREATE TABLE `leave_entitlements` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`year` int NOT NULL,
	`leave_type` enum('ANNUAL','SICK','UNPAID','ABSENCE','MATERNITY','PATERNITY','BEREAVEMENT','OTHER') NOT NULL,
	`entitlement_days` decimal(5,2) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leave_entitlements_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_leave_entitlements_employee_year_type` UNIQUE(`employee_id`,`year`,`leave_type`)
);
--> statement-breakpoint
CREATE TABLE `leave_requests` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`leave_type` enum('ANNUAL','SICK','UNPAID','ABSENCE','MATERNITY','PATERNITY','BEREAVEMENT','OTHER') NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`day_count` decimal(5,2) NOT NULL,
	`reason` text,
	`status` enum('DRAFT','SUBMITTED','APPROVED','REJECTED','REVISION_REQUIRED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`submitted_at` timestamp,
	`completed_at` timestamp,
	CONSTRAINT `leave_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `overtime_requests` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`work_date` date NOT NULL,
	`hours` decimal(5,2) NOT NULL,
	`reason` text,
	`status` enum('DRAFT','SUBMITTED','APPROVED','REJECTED','REVISION_REQUIRED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`submitted_at` timestamp,
	`completed_at` timestamp,
	CONSTRAINT `overtime_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `leave_entitlements` ADD CONSTRAINT `leave_entitlements_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_entitlements` ADD CONSTRAINT `leave_entitlements_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD CONSTRAINT `leave_requests_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `overtime_requests` ADD CONSTRAINT `overtime_requests_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `overtime_requests` ADD CONSTRAINT `overtime_requests_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `overtime_requests` ADD CONSTRAINT `overtime_requests_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;