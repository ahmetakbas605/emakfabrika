CREATE TABLE `change_approvals` (
	`id` char(36) NOT NULL,
	`change_id` char(36) NOT NULL,
	`approved_by_user_id` char(36) NOT NULL,
	`decision` enum('APPROVED','REJECTED') NOT NULL,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `change_approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `changes` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`risk_level` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
	`impact_level` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
	`status` enum('DRAFT','SCHEDULED','IN_PROGRESS','COMPLETED','FAILED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`requested_by_user_id` char(36) NOT NULL,
	`scheduled_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `changes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`severity` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
	`status` enum('OPEN','INVESTIGATING','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
	`opened_by_user_id` char(36) NOT NULL,
	`resolved_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `incidents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `problem_incidents` (
	`problem_id` char(36) NOT NULL,
	`incident_id` char(36) NOT NULL,
	CONSTRAINT `udx_problem_incident` UNIQUE(`problem_id`,`incident_id`)
);
--> statement-breakpoint
CREATE TABLE `problems` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`title` varchar(255) NOT NULL,
	`root_cause` text,
	`status` enum('OPEN','ROOT_CAUSE_IDENTIFIED','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
	`opened_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `problems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_desk_tickets` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`department_id` char(36) NOT NULL,
	`ticket_no` varchar(32) NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(64) NOT NULL DEFAULT '',
	`priority` enum('LOW','NORMAL','HIGH','CRITICAL') NOT NULL DEFAULT 'NORMAL',
	`status` enum('NEW','TRIAGED','ASSIGNED','ACCEPTED','ON_THE_WAY','ARRIVED','INSPECTION','WORKING','WAITING','TESTING','RESOLVED','USER_APPROVAL_PENDING','CLOSED') NOT NULL DEFAULT 'NEW',
	`requested_by_user_id` char(36) NOT NULL,
	`related_asset_id` char(36),
	`related_ci_id` char(36),
	`sla_policy_id` char(36),
	`sla_due_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`closed_at` timestamp,
	CONSTRAINT `service_desk_tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_ticket_company_no` UNIQUE(`company_id`,`ticket_no`)
);
--> statement-breakpoint
CREATE TABLE `sla_policies` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`priority` enum('LOW','NORMAL','HIGH','CRITICAL') NOT NULL,
	`response_minutes` int NOT NULL,
	`resolution_hours` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `sla_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_sla_policy_company_priority` UNIQUE(`company_id`,`priority`)
);
--> statement-breakpoint
CREATE TABLE `ticket_assignments` (
	`id` char(36) NOT NULL,
	`ticket_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`role` enum('LEADER','MEMBER') NOT NULL,
	`assigned_at` timestamp NOT NULL DEFAULT (now()),
	`unassigned_at` timestamp,
	`assigned_by` char(36) NOT NULL,
	CONSTRAINT `ticket_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticket_comments` (
	`id` char(36) NOT NULL,
	`ticket_id` char(36) NOT NULL,
	`author_user_id` char(36) NOT NULL,
	`body` text NOT NULL,
	`is_internal` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticket_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticket_incidents` (
	`ticket_id` char(36) NOT NULL,
	`incident_id` char(36) NOT NULL,
	CONSTRAINT `udx_ticket_incident` UNIQUE(`ticket_id`,`incident_id`)
);
--> statement-breakpoint
CREATE TABLE `ticket_number_counters` (
	`company_id` char(36) NOT NULL,
	`year` int NOT NULL,
	`last_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `udx_ticket_counter_company_year` UNIQUE(`company_id`,`year`)
);
--> statement-breakpoint
CREATE TABLE `ticket_status_history` (
	`id` char(36) NOT NULL,
	`ticket_id` char(36) NOT NULL,
	`from_status` varchar(32) NOT NULL,
	`to_status` varchar(32) NOT NULL,
	`changed_by` char(36) NOT NULL,
	`note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticket_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticket_work_logs` (
	`id` char(36) NOT NULL,
	`ticket_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`minutes_spent` int NOT NULL,
	`note` text,
	`logged_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticket_work_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `change_approvals` ADD CONSTRAINT `change_approvals_change_id_changes_id_fk` FOREIGN KEY (`change_id`) REFERENCES `changes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `change_approvals` ADD CONSTRAINT `change_approvals_approved_by_user_id_users_id_fk` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `changes` ADD CONSTRAINT `changes_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `changes` ADD CONSTRAINT `changes_requested_by_user_id_users_id_fk` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `incidents` ADD CONSTRAINT `incidents_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `incidents` ADD CONSTRAINT `incidents_opened_by_user_id_users_id_fk` FOREIGN KEY (`opened_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `problem_incidents` ADD CONSTRAINT `problem_incidents_problem_id_problems_id_fk` FOREIGN KEY (`problem_id`) REFERENCES `problems`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `problem_incidents` ADD CONSTRAINT `problem_incidents_incident_id_incidents_id_fk` FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `problems` ADD CONSTRAINT `problems_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `problems` ADD CONSTRAINT `problems_opened_by_user_id_users_id_fk` FOREIGN KEY (`opened_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_desk_tickets` ADD CONSTRAINT `service_desk_tickets_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_desk_tickets` ADD CONSTRAINT `service_desk_tickets_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_desk_tickets` ADD CONSTRAINT `service_desk_tickets_requested_by_user_id_users_id_fk` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_desk_tickets` ADD CONSTRAINT `service_desk_tickets_related_asset_id_it_assets_id_fk` FOREIGN KEY (`related_asset_id`) REFERENCES `it_assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_desk_tickets` ADD CONSTRAINT `service_desk_tickets_related_ci_id_configuration_items_id_fk` FOREIGN KEY (`related_ci_id`) REFERENCES `configuration_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_desk_tickets` ADD CONSTRAINT `service_desk_tickets_sla_policy_id_sla_policies_id_fk` FOREIGN KEY (`sla_policy_id`) REFERENCES `sla_policies`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sla_policies` ADD CONSTRAINT `sla_policies_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_assignments` ADD CONSTRAINT `ticket_assignments_ticket_id_service_desk_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `service_desk_tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_assignments` ADD CONSTRAINT `ticket_assignments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_assignments` ADD CONSTRAINT `ticket_assignments_assigned_by_users_id_fk` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_comments` ADD CONSTRAINT `ticket_comments_ticket_id_service_desk_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `service_desk_tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_comments` ADD CONSTRAINT `ticket_comments_author_user_id_users_id_fk` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_incidents` ADD CONSTRAINT `ticket_incidents_ticket_id_service_desk_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `service_desk_tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_incidents` ADD CONSTRAINT `ticket_incidents_incident_id_incidents_id_fk` FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_number_counters` ADD CONSTRAINT `ticket_number_counters_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_status_history` ADD CONSTRAINT `ticket_status_history_ticket_id_service_desk_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `service_desk_tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_status_history` ADD CONSTRAINT `ticket_status_history_changed_by_users_id_fk` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_work_logs` ADD CONSTRAINT `ticket_work_logs_ticket_id_service_desk_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `service_desk_tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ticket_work_logs` ADD CONSTRAINT `ticket_work_logs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_ticket_status` ON `service_desk_tickets` (`status`);--> statement-breakpoint
CREATE INDEX `idx_ticket_priority` ON `service_desk_tickets` (`priority`);