CREATE TABLE `journal_number_counters` (
	`company_id` char(36) NOT NULL,
	`year` int NOT NULL,
	`last_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `udx_journal_counter_company_year` UNIQUE(`company_id`,`year`)
);
--> statement-breakpoint
ALTER TABLE `journal_number_counters` ADD CONSTRAINT `journal_number_counters_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;