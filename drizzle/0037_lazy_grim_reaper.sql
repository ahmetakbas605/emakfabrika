CREATE TABLE `break_glass_access` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`requested_by_user_id` char(36) NOT NULL,
	`reason` text NOT NULL,
	`ticket_reference` varchar(100) NOT NULL DEFAULT '',
	`scope` varchar(255) NOT NULL DEFAULT '',
	`status` enum('PENDING','ACTIVE','EXPIRED','REVOKED') NOT NULL DEFAULT 'PENDING',
	`approved_by_user_id` char(36),
	`start_at` timestamp,
	`end_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `break_glass_access_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `data_subject_requests` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`request_no` varchar(32) NOT NULL,
	`request_type` enum('ACCESS','CORRECTION','DELETION','RESTRICTION','OBJECTION','PORTABILITY','OTHER') NOT NULL,
	`subject_name` varchar(255) NOT NULL,
	`subject_identifier` varchar(100) NOT NULL DEFAULT '',
	`related_employee_id` char(36),
	`description` text NOT NULL,
	`status` enum('DRAFT','SUBMITTED','APPROVED','REJECTED','REVISION_REQUIRED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`resolution_note` text,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`submitted_at` timestamp,
	`completed_at` timestamp,
	CONSTRAINT `data_subject_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_data_subject_requests_company_no` UNIQUE(`company_id`,`request_no`)
);
--> statement-breakpoint
CREATE TABLE `legal_holds` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`entity_type` varchar(64) NOT NULL,
	`entity_id` char(36) NOT NULL,
	`reason` text NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`released_at` timestamp,
	CONSTRAINT `legal_holds_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `personal_data_inventory` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`table_name` varchar(100) NOT NULL,
	`column_name` varchar(100) NOT NULL,
	`data_category` varchar(100) NOT NULL DEFAULT '',
	`classification` enum('PUBLIC','INTERNAL','CONFIDENTIAL','PERSONAL','SPECIAL_CATEGORY','FINANCIAL','HIGHLY_CONFIDENTIAL','SYSTEM_SECURITY') NOT NULL,
	`purpose` varchar(255) NOT NULL DEFAULT '',
	`legal_basis` varchar(255) NOT NULL DEFAULT '',
	`encryption_required` boolean NOT NULL DEFAULT false,
	`masking_required` boolean NOT NULL DEFAULT false,
	`export_allowed` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `personal_data_inventory_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_personal_data_inventory_table_column` UNIQUE(`company_id`,`table_name`,`column_name`)
);
--> statement-breakpoint
CREATE TABLE `retention_policies` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`data_type` varchar(100) NOT NULL,
	`legal_basis` varchar(255) NOT NULL DEFAULT '',
	`retention_years` int NOT NULL,
	`start_event` varchar(100) NOT NULL DEFAULT '',
	`delete_method` enum('HARD_DELETE','ANONYMIZE','ARCHIVE') NOT NULL DEFAULT 'ANONYMIZE',
	`legal_hold_supported` boolean NOT NULL DEFAULT true,
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `retention_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_retention_policies_company_type` UNIQUE(`company_id`,`data_type`)
);
--> statement-breakpoint
CREATE TABLE `role_conflict_rules` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`document_type` varchar(64) NOT NULL,
	`rule` varchar(64) NOT NULL,
	`description` varchar(255) NOT NULL DEFAULT '',
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `role_conflict_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_role_conflict_company_doctype_rule` UNIQUE(`company_id`,`document_type`,`rule`)
);
--> statement-breakpoint
CREATE TABLE `security_events` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`event_type` enum('MASS_EXPORT','OFF_HOURS_ACCESS','REPEATED_FAILED_LOGIN','SENSITIVE_DATA_BURST','PRIVILEGE_ESCALATION','MANUAL_FLAG','OTHER') NOT NULL,
	`risk_level` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL,
	`acted_by_user_id` char(36),
	`description` text NOT NULL,
	`metadata` json,
	`status` enum('DETECTED','INVESTIGATING','RESOLVED','FALSE_POSITIVE') NOT NULL DEFAULT 'DETECTED',
	`resolved_by_user_id` char(36),
	`resolved_at` timestamp,
	`resolution_note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `security_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_devices` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`platform` varchar(32) NOT NULL DEFAULT 'MOBILE',
	`app_version` varchar(32) NOT NULL DEFAULT '',
	`os_version` varchar(32) NOT NULL DEFAULT '',
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
	`trusted` boolean NOT NULL DEFAULT true,
	`revoked` boolean NOT NULL DEFAULT false,
	`revoked_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_devices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`session_token` varchar(128) NOT NULL,
	`ip` varchar(64),
	`user_agent` varchar(255) NOT NULL DEFAULT '',
	`device_label` varchar(150) NOT NULL DEFAULT '',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`last_activity_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	`revoked` boolean NOT NULL DEFAULT false,
	`revoked_at` timestamp,
	`revoked_by_user_id` char(36),
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `approval_actions` ADD `signature_type` enum('ACKNOWLEDGEMENT','QUALIFIED_ESIGNATURE') DEFAULT 'ACKNOWLEDGEMENT' NOT NULL;--> statement-breakpoint
ALTER TABLE `approval_instances` ADD `invalidated` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `approval_instances` ADD `invalidated_at` timestamp;--> statement-breakpoint
ALTER TABLE `approval_instances` ADD `invalidated_reason` varchar(255);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `module` varchar(64);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `session_id` char(36);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `changed_fields` json;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `risk_level` enum('LOW','MEDIUM','HIGH','CRITICAL') DEFAULT 'LOW' NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `result` enum('SUCCESS','FAILURE') DEFAULT 'SUCCESS' NOT NULL;--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `previous_hash` varchar(64);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `current_hash` varchar(64);--> statement-breakpoint
ALTER TABLE `users` ADD `totp_secret_encrypted` text;--> statement-breakpoint
ALTER TABLE `users` ADD `mfa_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `mfa_recovery_codes_hash` json;--> statement-breakpoint
ALTER TABLE `users` ADD `mfa_enabled_at` timestamp;--> statement-breakpoint
ALTER TABLE `break_glass_access` ADD CONSTRAINT `break_glass_access_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `break_glass_access` ADD CONSTRAINT `break_glass_access_requested_by_user_id_users_id_fk` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `break_glass_access` ADD CONSTRAINT `break_glass_access_approved_by_user_id_users_id_fk` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_subject_requests` ADD CONSTRAINT `data_subject_requests_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_subject_requests` ADD CONSTRAINT `data_subject_requests_related_employee_id_employees_id_fk` FOREIGN KEY (`related_employee_id`) REFERENCES `employees`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_subject_requests` ADD CONSTRAINT `data_subject_requests_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_holds` ADD CONSTRAINT `legal_holds_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_holds` ADD CONSTRAINT `legal_holds_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `personal_data_inventory` ADD CONSTRAINT `personal_data_inventory_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `retention_policies` ADD CONSTRAINT `retention_policies_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_conflict_rules` ADD CONSTRAINT `role_conflict_rules_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_events` ADD CONSTRAINT `security_events_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_events` ADD CONSTRAINT `security_events_acted_by_user_id_users_id_fk` FOREIGN KEY (`acted_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `security_events` ADD CONSTRAINT `security_events_resolved_by_user_id_users_id_fk` FOREIGN KEY (`resolved_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_devices` ADD CONSTRAINT `user_devices_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_devices` ADD CONSTRAINT `user_devices_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_revoked_by_user_id_users_id_fk` FOREIGN KEY (`revoked_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_legal_holds_entity` ON `legal_holds` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `idx_security_events_company_status` ON `security_events` (`company_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_user_sessions_user` ON `user_sessions` (`user_id`);