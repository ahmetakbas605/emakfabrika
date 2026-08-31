CREATE TABLE `env_emission_records` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`record_date` date NOT NULL,
	`emission_type` enum('CO2','NOX','SOX','PARTICULATE','OTHER') NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	`unit` varchar(16) NOT NULL,
	`source` varchar(255) NOT NULL DEFAULT '',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `env_emission_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `env_permits` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`permit_no` varchar(32) NOT NULL,
	`permit_type` enum('EMISSION','WASTE','WATER','AIR','OTHER') NOT NULL,
	`issuing_authority` varchar(255) NOT NULL DEFAULT '',
	`issue_date` date,
	`expiry_date` date,
	`status` enum('ACTIVE','EXPIRED','RENEWAL_PENDING') NOT NULL DEFAULT 'ACTIVE',
	`notes` text,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `env_permits_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_env_permit_company_no` UNIQUE(`company_id`,`permit_no`)
);
--> statement-breakpoint
CREATE TABLE `env_waste_records` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`record_date` date NOT NULL,
	`waste_type` enum('HAZARDOUS','NON_HAZARDOUS','RECYCLABLE') NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	`unit` varchar(16) NOT NULL,
	`disposal_method` enum('LANDFILL','INCINERATION','RECYCLING','OTHER') NOT NULL,
	`disposal_company` varchar(255) NOT NULL DEFAULT '',
	`notes` text,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `env_waste_records_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rnd_lab_tests` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`prototype_id` char(36),
	`test_no` varchar(32) NOT NULL,
	`test_name` varchar(255) NOT NULL,
	`test_date` date,
	`status` enum('PLANNED','IN_PROGRESS','COMPLETED','FAILED') NOT NULL DEFAULT 'PLANNED',
	`result_summary` text,
	`performed_by_user_id` char(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rnd_lab_tests_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_rnd_lab_test_company_no` UNIQUE(`company_id`,`test_no`)
);
--> statement-breakpoint
CREATE TABLE `rnd_prototypes` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`project_id` char(36),
	`prototype_no` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`status` enum('DESIGN','BUILDING','TESTING','APPROVED','REJECTED') NOT NULL DEFAULT 'DESIGN',
	`description` text,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rnd_prototypes_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_rnd_prototype_company_no` UNIQUE(`company_id`,`prototype_no`)
);
--> statement-breakpoint
CREATE TABLE `safety_incidents` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`incident_no` varchar(32) NOT NULL,
	`incident_type` enum('ACCIDENT','NEAR_MISS','OCCUPATIONAL_ILLNESS') NOT NULL,
	`severity` enum('MINOR','MODERATE','SEVERE','FATAL') NOT NULL DEFAULT 'MINOR',
	`incident_date` date NOT NULL,
	`location` varchar(255) NOT NULL DEFAULT '',
	`employee_id` char(36),
	`description` text NOT NULL,
	`root_cause` text,
	`corrective_action` text,
	`status` enum('OPEN','INVESTIGATING','CLOSED') NOT NULL DEFAULT 'OPEN',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`closed_at` timestamp,
	CONSTRAINT `safety_incidents_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_safety_incident_company_no` UNIQUE(`company_id`,`incident_no`)
);
--> statement-breakpoint
ALTER TABLE `env_emission_records` ADD CONSTRAINT `env_emission_records_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `env_emission_records` ADD CONSTRAINT `env_emission_records_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `env_permits` ADD CONSTRAINT `env_permits_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `env_permits` ADD CONSTRAINT `env_permits_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `env_waste_records` ADD CONSTRAINT `env_waste_records_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `env_waste_records` ADD CONSTRAINT `env_waste_records_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rnd_lab_tests` ADD CONSTRAINT `rnd_lab_tests_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rnd_lab_tests` ADD CONSTRAINT `rnd_lab_tests_prototype_id_rnd_prototypes_id_fk` FOREIGN KEY (`prototype_id`) REFERENCES `rnd_prototypes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rnd_lab_tests` ADD CONSTRAINT `rnd_lab_tests_performed_by_user_id_users_id_fk` FOREIGN KEY (`performed_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rnd_prototypes` ADD CONSTRAINT `rnd_prototypes_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rnd_prototypes` ADD CONSTRAINT `rnd_prototypes_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `rnd_prototypes` ADD CONSTRAINT `rnd_prototypes_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `safety_incidents` ADD CONSTRAINT `safety_incidents_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `safety_incidents` ADD CONSTRAINT `safety_incidents_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `safety_incidents` ADD CONSTRAINT `safety_incidents_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;