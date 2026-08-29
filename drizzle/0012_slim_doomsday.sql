CREATE TABLE `contract_assets` (
	`contract_id` char(36) NOT NULL,
	`asset_id` char(36) NOT NULL,
	CONSTRAINT `udx_contract_asset` UNIQUE(`contract_id`,`asset_id`)
);
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`vendor_id` char(36),
	`title` varchar(255) NOT NULL,
	`contract_type` enum('SUPPORT','MAINTENANCE','SERVICE','LEASE','OTHER') NOT NULL DEFAULT 'OTHER',
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`cost` decimal(20,6),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `contracts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `license_assignments` (
	`id` char(36) NOT NULL,
	`license_id` char(36) NOT NULL,
	`installation_id` char(36) NOT NULL,
	`assigned_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `license_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `license_assignments_installation_id_unique` UNIQUE(`installation_id`)
);
--> statement-breakpoint
CREATE TABLE `sw_installations` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`asset_id` char(36) NOT NULL,
	`installed_version` varchar(64) NOT NULL DEFAULT '',
	`installed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sw_installations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sw_licenses` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`vendor_id` char(36),
	`license_key` varchar(255) NOT NULL DEFAULT '',
	`seats` int NOT NULL DEFAULT 1,
	`purchase_date` date,
	`expires_at` date,
	`cost` decimal(20,6),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sw_licenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sw_products` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`publisher` varchar(255) NOT NULL DEFAULT '',
	`vendor_id` char(36),
	CONSTRAINT `sw_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`contact_name` varchar(255) NOT NULL DEFAULT '',
	`contact_email` varchar(255) NOT NULL DEFAULT '',
	`contact_phone` varchar(32) NOT NULL DEFAULT '',
	`accounting_account_id` char(36),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vendors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `warranties` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`asset_id` char(36) NOT NULL,
	`vendor_id` char(36),
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`terms` text,
	`cost` decimal(20,6),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `warranties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `contract_assets` ADD CONSTRAINT `contract_assets_contract_id_contracts_id_fk` FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contract_assets` ADD CONSTRAINT `contract_assets_asset_id_it_assets_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `it_assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_vendor_id_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `license_assignments` ADD CONSTRAINT `license_assignments_license_id_sw_licenses_id_fk` FOREIGN KEY (`license_id`) REFERENCES `sw_licenses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `license_assignments` ADD CONSTRAINT `license_assignments_installation_id_sw_installations_id_fk` FOREIGN KEY (`installation_id`) REFERENCES `sw_installations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sw_installations` ADD CONSTRAINT `sw_installations_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sw_installations` ADD CONSTRAINT `sw_installations_product_id_sw_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `sw_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sw_installations` ADD CONSTRAINT `sw_installations_asset_id_it_assets_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `it_assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sw_licenses` ADD CONSTRAINT `sw_licenses_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sw_licenses` ADD CONSTRAINT `sw_licenses_product_id_sw_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `sw_products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sw_licenses` ADD CONSTRAINT `sw_licenses_vendor_id_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sw_products` ADD CONSTRAINT `sw_products_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sw_products` ADD CONSTRAINT `sw_products_vendor_id_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vendors` ADD CONSTRAINT `vendors_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vendors` ADD CONSTRAINT `vendors_accounting_account_id_accounting_accounts_id_fk` FOREIGN KEY (`accounting_account_id`) REFERENCES `accounting_accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warranties` ADD CONSTRAINT `warranties_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warranties` ADD CONSTRAINT `warranties_asset_id_it_assets_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `it_assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `warranties` ADD CONSTRAINT `warranties_vendor_id_vendors_id_fk` FOREIGN KEY (`vendor_id`) REFERENCES `vendors`(`id`) ON DELETE no action ON UPDATE no action;