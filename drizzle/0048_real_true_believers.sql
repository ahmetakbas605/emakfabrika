CREATE TABLE `legal_collaterals` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`contract_id` char(36),
	`collateral_type` enum('LETTER_OF_GUARANTEE','CASH_DEPOSIT','CHECK','PROMISSORY_NOTE','OTHER') NOT NULL,
	`amount` decimal(20,6) NOT NULL,
	`currency_code` char(3),
	`provider` varchar(255) NOT NULL DEFAULT '',
	`issue_date` date,
	`expiry_date` date,
	`status` enum('ACTIVE','RELEASED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
	`notes` text,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `legal_collaterals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `legal_contracts` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`contract_no` varchar(32) NOT NULL,
	`title` varchar(255) NOT NULL,
	`contract_type` enum('SUPPLIER','CUSTOMER','LEASE','NDA','SERVICE','OTHER') NOT NULL,
	`status` enum('DRAFT','ACTIVE','EXPIRED','TERMINATED') NOT NULL DEFAULT 'DRAFT',
	`counterparty_party_id` char(36),
	`counterparty_name` varchar(255) NOT NULL DEFAULT '',
	`start_date` date,
	`end_date` date,
	`value` decimal(20,6),
	`currency_code` char(3),
	`owner_user_id` char(36),
	`notes` text,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `legal_contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_legal_contract_company_no` UNIQUE(`company_id`,`contract_no`)
);
--> statement-breakpoint
CREATE TABLE `legal_lawsuits` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`case_no` varchar(32) NOT NULL,
	`title` varchar(255) NOT NULL,
	`company_role` enum('PLAINTIFF','DEFENDANT') NOT NULL,
	`counterparty_party_id` char(36),
	`counterparty_name` varchar(255) NOT NULL DEFAULT '',
	`contract_id` char(36),
	`status` enum('OPEN','IN_PROGRESS','SETTLED','WON','LOST','CLOSED') NOT NULL DEFAULT 'OPEN',
	`claim_amount` decimal(20,6),
	`currency_code` char(3),
	`court_name` varchar(255) NOT NULL DEFAULT '',
	`filed_date` date,
	`owner_user_id` char(36),
	`notes` text,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`closed_at` timestamp,
	CONSTRAINT `legal_lawsuits_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_legal_lawsuit_company_no` UNIQUE(`company_id`,`case_no`)
);
--> statement-breakpoint
CREATE TABLE `risk_register_entries` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`risk_no` varchar(32) NOT NULL,
	`title` varchar(255) NOT NULL,
	`category` enum('LEGAL','FINANCIAL','OPERATIONAL','STRATEGIC','COMPLIANCE','OTHER') NOT NULL,
	`description` text,
	`probability` int NOT NULL,
	`impact` int NOT NULL,
	`score` int NOT NULL,
	`owner_user_id` char(36),
	`mitigation` text,
	`status` enum('OPEN','MITIGATING','CLOSED') NOT NULL DEFAULT 'OPEN',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`closed_at` timestamp,
	CONSTRAINT `risk_register_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_risk_company_no` UNIQUE(`company_id`,`risk_no`)
);
--> statement-breakpoint
ALTER TABLE `legal_collaterals` ADD CONSTRAINT `legal_collaterals_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_collaterals` ADD CONSTRAINT `legal_collaterals_contract_id_legal_contracts_id_fk` FOREIGN KEY (`contract_id`) REFERENCES `legal_contracts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_collaterals` ADD CONSTRAINT `legal_collaterals_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_collaterals` ADD CONSTRAINT `legal_collaterals_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_contracts` ADD CONSTRAINT `legal_contracts_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_contracts` ADD CONSTRAINT `legal_contracts_counterparty_party_id_parties_id_fk` FOREIGN KEY (`counterparty_party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_contracts` ADD CONSTRAINT `legal_contracts_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_contracts` ADD CONSTRAINT `legal_contracts_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_contracts` ADD CONSTRAINT `legal_contracts_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_lawsuits` ADD CONSTRAINT `legal_lawsuits_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_lawsuits` ADD CONSTRAINT `legal_lawsuits_counterparty_party_id_parties_id_fk` FOREIGN KEY (`counterparty_party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_lawsuits` ADD CONSTRAINT `legal_lawsuits_contract_id_legal_contracts_id_fk` FOREIGN KEY (`contract_id`) REFERENCES `legal_contracts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_lawsuits` ADD CONSTRAINT `legal_lawsuits_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_lawsuits` ADD CONSTRAINT `legal_lawsuits_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `legal_lawsuits` ADD CONSTRAINT `legal_lawsuits_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `risk_register_entries` ADD CONSTRAINT `risk_register_entries_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `risk_register_entries` ADD CONSTRAINT `risk_register_entries_owner_user_id_users_id_fk` FOREIGN KEY (`owner_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `risk_register_entries` ADD CONSTRAINT `risk_register_entries_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;