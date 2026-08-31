CREATE TABLE `proj_progress_payments` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`project_id` char(36) NOT NULL,
	`milestone_id` char(36),
	`payment_no` varchar(32) NOT NULL,
	`period_start` date NOT NULL,
	`period_end` date NOT NULL,
	`amount` decimal(20,6) NOT NULL,
	`status` enum('DRAFT','APPROVED','PAID') NOT NULL DEFAULT 'DRAFT',
	`payment_date` date,
	`notes` text,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proj_progress_payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_proj_pp_company_no` UNIQUE(`company_id`,`payment_no`)
);
--> statement-breakpoint
CREATE TABLE `project_milestones` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`project_id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`target_date` date NOT NULL,
	`status` enum('PENDING','COMPLETED') NOT NULL DEFAULT 'PENDING',
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_milestones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `project_tasks` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`project_id` char(36) NOT NULL,
	`parent_task_id` char(36),
	`name` varchar(255) NOT NULL,
	`status` enum('TODO','IN_PROGRESS','DONE','CANCELLED') NOT NULL DEFAULT 'TODO',
	`assigned_to_user_id` char(36),
	`start_date` date,
	`due_date` date,
	`completed_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `project_tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`status` enum('PLANNING','ACTIVE','ON_HOLD','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PLANNING',
	`start_date` date,
	`end_date` date,
	`budget_amount` decimal(20,6),
	`manager_user_id` char(36),
	`department_id` char(36),
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_project_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
ALTER TABLE `proc_requests` ADD `project_id` char(36);--> statement-breakpoint
ALTER TABLE `proj_progress_payments` ADD CONSTRAINT `proj_progress_payments_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proj_progress_payments` ADD CONSTRAINT `proj_progress_payments_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proj_progress_payments` ADD CONSTRAINT `proj_progress_payments_milestone_id_project_milestones_id_fk` FOREIGN KEY (`milestone_id`) REFERENCES `project_milestones`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proj_progress_payments` ADD CONSTRAINT `proj_progress_payments_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_milestones` ADD CONSTRAINT `project_milestones_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_milestones` ADD CONSTRAINT `project_milestones_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_tasks` ADD CONSTRAINT `project_tasks_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_tasks` ADD CONSTRAINT `project_tasks_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_tasks` ADD CONSTRAINT `project_tasks_parent_task_id_project_tasks_id_fk` FOREIGN KEY (`parent_task_id`) REFERENCES `project_tasks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `project_tasks` ADD CONSTRAINT `project_tasks_assigned_to_user_id_users_id_fk` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_manager_user_id_users_id_fk` FOREIGN KEY (`manager_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_requests` ADD CONSTRAINT `proc_requests_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;