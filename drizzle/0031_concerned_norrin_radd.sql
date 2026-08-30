CREATE TABLE `employee_contracts` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`contract_type` enum('INDEFINITE','DEFINITE','PART_TIME','INTERNSHIP','CONSULTANT') NOT NULL,
	`status` enum('ACTIVE','SUPERSEDED','EXPIRED','TERMINATED') NOT NULL DEFAULT 'ACTIVE',
	`start_date` date NOT NULL,
	`end_date` date,
	`probation_end_date` date,
	`weekly_working_hours` decimal(5,2),
	`terms` text,
	`version` int NOT NULL DEFAULT 1,
	`supersedes_id` char(36),
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employee_contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee_qualifications` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`qualification_type` enum('DIPLOMA','CERTIFICATE','TRAINING','LICENSE','OTHER') NOT NULL,
	`name` varchar(255) NOT NULL,
	`institution` varchar(255) NOT NULL DEFAULT '',
	`field_of_study` varchar(255) NOT NULL DEFAULT '',
	`credential_number` varchar(100) NOT NULL DEFAULT '',
	`issue_date` date,
	`expiry_date` date,
	`status` enum('ACTIVE','EXPIRED','REVOKED') NOT NULL DEFAULT 'ACTIVE',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employee_qualifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `document_attachments` ADD `document_category` varchar(64);--> statement-breakpoint
ALTER TABLE `document_attachments` ADD `issue_date` date;--> statement-breakpoint
ALTER TABLE `document_attachments` ADD `expiry_date` date;--> statement-breakpoint
ALTER TABLE `document_attachments` ADD `version` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `document_attachments` ADD `supersedes_id` char(36);--> statement-breakpoint
ALTER TABLE `employee_contracts` ADD CONSTRAINT `employee_contracts_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_contracts` ADD CONSTRAINT `employee_contracts_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_contracts` ADD CONSTRAINT `employee_contracts_supersedes_id_employee_contracts_id_fk` FOREIGN KEY (`supersedes_id`) REFERENCES `employee_contracts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_contracts` ADD CONSTRAINT `employee_contracts_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_qualifications` ADD CONSTRAINT `employee_qualifications_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_qualifications` ADD CONSTRAINT `employee_qualifications_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_attachments` ADD CONSTRAINT `document_attachments_supersedes_id_document_attachments_id_fk` FOREIGN KEY (`supersedes_id`) REFERENCES `document_attachments`(`id`) ON DELETE no action ON UPDATE no action;