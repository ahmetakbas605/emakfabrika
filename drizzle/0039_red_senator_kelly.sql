CREATE TABLE `holdings` (
	`id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `holdings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `companies` ADD `holding_id` char(36);--> statement-breakpoint
ALTER TABLE `users` ADD `is_holding_admin` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD CONSTRAINT `companies_holding_id_holdings_id_fk` FOREIGN KEY (`holding_id`) REFERENCES `holdings`(`id`) ON DELETE no action ON UPDATE no action;