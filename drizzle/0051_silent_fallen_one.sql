CREATE TABLE `integration_events` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`event_type` varchar(64) NOT NULL,
	`source_module` varchar(32) NOT NULL,
	`entity_id` char(36),
	`payload` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `integration_events` ADD CONSTRAINT `integration_events_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_integration_events_company_type` ON `integration_events` (`company_id`,`event_type`);