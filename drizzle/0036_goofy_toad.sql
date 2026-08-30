CREATE TABLE `bonus_requests` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`bonus_no` varchar(32) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`bonus_type` enum('PERFORMANCE','HOLIDAY','REFERRAL','RETENTION','OTHER') NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`currency_code` char(3) NOT NULL,
	`reason` text,
	`status` enum('DRAFT','SUBMITTED','APPROVED','REJECTED','REVISION_REQUIRED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`submitted_at` timestamp,
	`completed_at` timestamp,
	CONSTRAINT `bonus_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_bonus_requests_company_no` UNIQUE(`company_id`,`bonus_no`)
);
--> statement-breakpoint
CREATE TABLE `emp_compensations` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`effective_date` date NOT NULL,
	`base_salary` decimal(14,2) NOT NULL,
	`currency_code` char(3) NOT NULL,
	`change_reason` varchar(100) NOT NULL DEFAULT '',
	`status` enum('ACTIVE','SUPERSEDED') NOT NULL DEFAULT 'ACTIVE',
	`version` int NOT NULL DEFAULT 1,
	`supersedes_id` char(36),
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `emp_compensations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `bonus_requests` ADD CONSTRAINT `bonus_requests_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bonus_requests` ADD CONSTRAINT `bonus_requests_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bonus_requests` ADD CONSTRAINT `bonus_requests_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bonus_requests` ADD CONSTRAINT `bonus_requests_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emp_compensations` ADD CONSTRAINT `emp_compensations_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emp_compensations` ADD CONSTRAINT `emp_compensations_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emp_compensations` ADD CONSTRAINT `emp_compensations_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emp_compensations` ADD CONSTRAINT `emp_compensations_supersedes_id_emp_compensations_id_fk` FOREIGN KEY (`supersedes_id`) REFERENCES `emp_compensations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `emp_compensations` ADD CONSTRAINT `emp_compensations_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;