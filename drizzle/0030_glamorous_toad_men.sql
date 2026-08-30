CREATE TABLE `employee_addresses` (
	`id` char(36) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`address_type` enum('HOME','WORK','OTHER') NOT NULL DEFAULT 'HOME',
	`line` text NOT NULL,
	`city` varchar(100) NOT NULL DEFAULT '',
	`district` varchar(100) NOT NULL DEFAULT '',
	`postal_code` varchar(16) NOT NULL DEFAULT '',
	`country` varchar(100) NOT NULL DEFAULT 'Türkiye',
	`is_primary` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employee_addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee_contacts` (
	`id` char(36) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`contact_type` enum('PHONE_MOBILE','PHONE_HOME','PHONE_WORK','EMAIL_PERSONAL','EMAIL_WORK','OTHER') NOT NULL,
	`value` varchar(255) NOT NULL,
	`is_primary` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employee_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employee_emergency_contacts` (
	`id` char(36) NOT NULL,
	`employee_id` char(36) NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`relationship` varchar(100) NOT NULL DEFAULT '',
	`phone` varchar(32) NOT NULL,
	`is_primary` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `employee_emergency_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`employee_number` varchar(32) NOT NULL,
	`first_name` varchar(100) NOT NULL,
	`last_name` varchar(100) NOT NULL,
	`preferred_name` varchar(100),
	`gender` varchar(32),
	`birth_date` date,
	`nationality` varchar(100),
	`identity_reference` varchar(32),
	`marital_status` varchar(32),
	`employment_status` enum('ACTIVE','ON_LEAVE','SUSPENDED','TERMINATED') NOT NULL DEFAULT 'ACTIVE',
	`hire_date` date NOT NULL,
	`termination_date` date,
	`department_id` char(36),
	`position_id` char(36),
	`manager_employee_id` char(36),
	`cost_center_id` char(36),
	`branch_id` char(36),
	`work_location` varchar(255) NOT NULL DEFAULT '',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `employees_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_employees_company_number` UNIQUE(`company_id`,`employee_number`)
);
--> statement-breakpoint
ALTER TABLE `departments` ADD `parent_department_id` char(36);--> statement-breakpoint
ALTER TABLE `users` ADD `employee_id` char(36);--> statement-breakpoint
ALTER TABLE `employee_addresses` ADD CONSTRAINT `employee_addresses_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_contacts` ADD CONSTRAINT `employee_contacts_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employee_emergency_contacts` ADD CONSTRAINT `employee_emergency_contacts_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_position_id_positions_id_fk` FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_manager_employee_id_employees_id_fk` FOREIGN KEY (`manager_employee_id`) REFERENCES `employees`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_cost_center_id_cost_centers_id_fk` FOREIGN KEY (`cost_center_id`) REFERENCES `cost_centers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `employees` ADD CONSTRAINT `employees_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `departments` ADD CONSTRAINT `departments_parent_department_id_departments_id_fk` FOREIGN KEY (`parent_department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_employee_id_employees_id_fk` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`id`) ON DELETE no action ON UPDATE no action;