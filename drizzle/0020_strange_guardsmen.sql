CREATE TABLE `approval_actions` (
	`id` char(36) NOT NULL,
	`step_id` char(36) NOT NULL,
	`acted_by_user_id` char(36) NOT NULL,
	`decision` enum('APPROVE','REJECT','REQUEST_CHANGES','DELEGATE') NOT NULL,
	`comment` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approval_actions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approval_delegations` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`delegator_user_id` char(36) NOT NULL,
	`delegate_user_id` char(36) NOT NULL,
	`starts_at` timestamp NOT NULL,
	`ends_at` timestamp NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approval_delegations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approval_instances` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`document_type` varchar(64) NOT NULL,
	`document_id` char(36) NOT NULL,
	`matched_rule_id` char(36),
	`status` enum('IN_PROGRESS','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'IN_PROGRESS',
	`submitted_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `approval_instances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `approval_step_approvers` (
	`id` char(36) NOT NULL,
	`step_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	CONSTRAINT `approval_step_approvers_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_approval_step_approver` UNIQUE(`step_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `approval_steps` (
	`id` char(36) NOT NULL,
	`instance_id` char(36) NOT NULL,
	`step_order` int NOT NULL,
	`mode` enum('SEQUENTIAL','PARALLEL') NOT NULL DEFAULT 'SEQUENTIAL',
	`quorum` int,
	`status` enum('PENDING','IN_PROGRESS','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approval_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `budget_commitments` (
	`id` char(36) NOT NULL,
	`budget_item_id` char(36) NOT NULL,
	`source_type` varchar(64) NOT NULL,
	`source_id` char(36) NOT NULL,
	`amount` decimal(20,6) NOT NULL,
	`status` enum('RESERVED','CONSUMED','RELEASED') NOT NULL DEFAULT 'RESERVED',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`released_at` timestamp,
	CONSTRAINT `budget_commitments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_attachments` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`entity_type` varchar(64) NOT NULL,
	`entity_id` char(36) NOT NULL,
	`file_name` varchar(255) NOT NULL,
	`mime_type` varchar(127) NOT NULL,
	`size_bytes` int NOT NULL,
	`storage_key` varchar(512) NOT NULL,
	`uploaded_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_attachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `positions` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`title` varchar(100) NOT NULL,
	`approval_level` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `positions_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_position_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `workflow_rules` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`document_type` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`conditions` json,
	`approval_chain` json NOT NULL,
	`priority` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflow_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `position_id` char(36);--> statement-breakpoint
ALTER TABLE `users` ADD `manager_user_id` char(36);--> statement-breakpoint
ALTER TABLE `approval_actions` ADD CONSTRAINT `approval_actions_step_id_approval_steps_id_fk` FOREIGN KEY (`step_id`) REFERENCES `approval_steps`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_actions` ADD CONSTRAINT `approval_actions_acted_by_user_id_users_id_fk` FOREIGN KEY (`acted_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_delegations` ADD CONSTRAINT `approval_delegations_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_delegations` ADD CONSTRAINT `approval_delegations_delegator_user_id_users_id_fk` FOREIGN KEY (`delegator_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_delegations` ADD CONSTRAINT `approval_delegations_delegate_user_id_users_id_fk` FOREIGN KEY (`delegate_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_instances` ADD CONSTRAINT `approval_instances_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_instances` ADD CONSTRAINT `approval_instances_matched_rule_id_workflow_rules_id_fk` FOREIGN KEY (`matched_rule_id`) REFERENCES `workflow_rules`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_instances` ADD CONSTRAINT `approval_instances_submitted_by_user_id_users_id_fk` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_step_approvers` ADD CONSTRAINT `approval_step_approvers_step_id_approval_steps_id_fk` FOREIGN KEY (`step_id`) REFERENCES `approval_steps`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_step_approvers` ADD CONSTRAINT `approval_step_approvers_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_steps` ADD CONSTRAINT `approval_steps_instance_id_approval_instances_id_fk` FOREIGN KEY (`instance_id`) REFERENCES `approval_instances`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_commitments` ADD CONSTRAINT `budget_commitments_budget_item_id_budget_items_id_fk` FOREIGN KEY (`budget_item_id`) REFERENCES `budget_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `budget_commitments` ADD CONSTRAINT `budget_commitments_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_attachments` ADD CONSTRAINT `document_attachments_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_attachments` ADD CONSTRAINT `document_attachments_uploaded_by_user_id_users_id_fk` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `positions` ADD CONSTRAINT `positions_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `workflow_rules` ADD CONSTRAINT `workflow_rules_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_approval_instance_document` ON `approval_instances` (`document_type`,`document_id`);--> statement-breakpoint
CREATE INDEX `idx_attachment_entity` ON `document_attachments` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_workflow_rule_company_doctype` ON `workflow_rules` (`company_id`,`document_type`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_position_id_positions_id_fk` FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_manager_user_id_users_id_fk` FOREIGN KEY (`manager_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;