CREATE TABLE `backup_jobs` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`asset_id` char(36) NOT NULL,
	`source` varchar(255) NOT NULL,
	`destination` varchar(255) NOT NULL,
	`schedule` varchar(64) NOT NULL DEFAULT '',
	`retention_days` int NOT NULL DEFAULT 30,
	`encryption` boolean NOT NULL DEFAULT false,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `backup_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `backup_results` (
	`id` char(36) NOT NULL,
	`backup_job_id` char(36) NOT NULL,
	`started_at` timestamp NOT NULL,
	`finished_at` timestamp,
	`result` enum('SUCCESS','FAILED','PARTIAL') NOT NULL,
	`size_bytes` decimal(20,0),
	`verification_status` varchar(32) NOT NULL DEFAULT '',
	`error_message` text,
	CONSTRAINT `backup_results_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `endpoint_compliance` (
	`id` char(36) NOT NULL,
	`asset_id` char(36) NOT NULL,
	`antivirus_status` varchar(32) NOT NULL DEFAULT 'UNKNOWN',
	`firewall_status` varchar(32) NOT NULL DEFAULT 'UNKNOWN',
	`encryption_status` varchar(32) NOT NULL DEFAULT 'UNKNOWN',
	`patch_status` varchar(32) NOT NULL DEFAULT 'UNKNOWN',
	`os_support_status` varchar(32) NOT NULL DEFAULT 'UNKNOWN',
	`overall` enum('COMPLIANT','NON_COMPLIANT','UNKNOWN') NOT NULL DEFAULT 'UNKNOWN',
	`checked_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `endpoint_compliance_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitor_targets` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`asset_id` char(36) NOT NULL,
	`target_type` enum('PING','SNMP','SERVICE','PORT') NOT NULL,
	`credential_id` char(36),
	`config` json,
	`interval_seconds` int NOT NULL DEFAULT 300,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `monitor_targets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitoring_alerts` (
	`id` char(36) NOT NULL,
	`target_id` char(36) NOT NULL,
	`severity` enum('CRITICAL','HIGH','MEDIUM','LOW','INFO') NOT NULL,
	`message` text NOT NULL,
	`status` enum('OPEN','ACKNOWLEDGED','RESOLVED') NOT NULL DEFAULT 'OPEN',
	`correlation_group_id` char(36),
	`incident_id` char(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monitoring_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `monitoring_availability` (
	`id` char(36) NOT NULL,
	`target_id` char(36) NOT NULL,
	`date` date NOT NULL,
	`uptime_seconds` int NOT NULL DEFAULT 0,
	`downtime_seconds` int NOT NULL DEFAULT 0,
	`availability_percent` decimal(5,2) NOT NULL DEFAULT '0',
	CONSTRAINT `monitoring_availability_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_availability_target_date` UNIQUE(`target_id`,`date`)
);
--> statement-breakpoint
CREATE TABLE `monitoring_metrics` (
	`id` char(36) NOT NULL,
	`target_id` char(36) NOT NULL,
	`metric_name` varchar(64) NOT NULL,
	`value` decimal(20,6) NOT NULL,
	`recorded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `monitoring_metrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `network_credentials` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`asset_id` char(36),
	`credential_type` enum('SSH','SNMP_COMMUNITY','API_KEY','VPN') NOT NULL,
	`label` varchar(255) NOT NULL DEFAULT '',
	`encrypted_secret` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `network_credentials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `backup_jobs` ADD CONSTRAINT `backup_jobs_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backup_jobs` ADD CONSTRAINT `backup_jobs_asset_id_it_assets_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `it_assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `backup_results` ADD CONSTRAINT `backup_results_backup_job_id_backup_jobs_id_fk` FOREIGN KEY (`backup_job_id`) REFERENCES `backup_jobs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `endpoint_compliance` ADD CONSTRAINT `endpoint_compliance_asset_id_it_assets_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `it_assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monitor_targets` ADD CONSTRAINT `monitor_targets_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monitor_targets` ADD CONSTRAINT `monitor_targets_asset_id_it_assets_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `it_assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monitor_targets` ADD CONSTRAINT `monitor_targets_credential_id_network_credentials_id_fk` FOREIGN KEY (`credential_id`) REFERENCES `network_credentials`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monitoring_alerts` ADD CONSTRAINT `monitoring_alerts_target_id_monitor_targets_id_fk` FOREIGN KEY (`target_id`) REFERENCES `monitor_targets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monitoring_alerts` ADD CONSTRAINT `monitoring_alerts_incident_id_incidents_id_fk` FOREIGN KEY (`incident_id`) REFERENCES `incidents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monitoring_availability` ADD CONSTRAINT `monitoring_availability_target_id_monitor_targets_id_fk` FOREIGN KEY (`target_id`) REFERENCES `monitor_targets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `monitoring_metrics` ADD CONSTRAINT `monitoring_metrics_target_id_monitor_targets_id_fk` FOREIGN KEY (`target_id`) REFERENCES `monitor_targets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_credentials` ADD CONSTRAINT `network_credentials_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_credentials` ADD CONSTRAINT `network_credentials_asset_id_it_assets_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `it_assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_metric_target_recorded` ON `monitoring_metrics` (`target_id`,`recorded_at`);