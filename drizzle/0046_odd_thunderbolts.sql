CREATE TABLE `vehicle_expenses` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`vehicle_id` char(36) NOT NULL,
	`expense_type` enum('FUEL','HGS','TOLL','WASH','PARKING','OTHER') NOT NULL,
	`expense_date` date NOT NULL,
	`amount` decimal(20,6) NOT NULL,
	`quantity` decimal(20,6),
	`odometer_km` decimal(20,2),
	`notes` text,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vehicle_expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vehicle_insurances` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`vehicle_id` char(36) NOT NULL,
	`policy_no` varchar(64) NOT NULL,
	`provider` varchar(255) NOT NULL DEFAULT '',
	`coverage_type` varchar(100) NOT NULL DEFAULT '',
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`premium` decimal(20,6),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vehicle_insurances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`plate_no` varchar(32) NOT NULL,
	`brand` varchar(100) NOT NULL DEFAULT '',
	`model` varchar(100) NOT NULL DEFAULT '',
	`year` int,
	`vin` varchar(64) NOT NULL DEFAULT '',
	`fuel_type` enum('GASOLINE','DIESEL','LPG','ELECTRIC','HYBRID') NOT NULL DEFAULT 'DIESEL',
	`status` enum('ACTIVE','UNDER_MAINTENANCE','OUT_OF_SERVICE','SOLD') NOT NULL DEFAULT 'ACTIVE',
	`registration_expiry_date` date,
	`responsible_user_id` char(36),
	`department_id` char(36),
	`purchase_date` date,
	`purchase_cost` decimal(20,6),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vehicles_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_vehicle_company_plate` UNIQUE(`company_id`,`plate_no`)
);
--> statement-breakpoint
ALTER TABLE `eam_assets` ADD `location_id` char(36);--> statement-breakpoint
ALTER TABLE `maint_plans` ADD `vehicle_id` char(36);--> statement-breakpoint
ALTER TABLE `vehicle_expenses` ADD CONSTRAINT `vehicle_expenses_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicle_expenses` ADD CONSTRAINT `vehicle_expenses_vehicle_id_vehicles_id_fk` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicle_expenses` ADD CONSTRAINT `vehicle_expenses_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicle_insurances` ADD CONSTRAINT `vehicle_insurances_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicle_insurances` ADD CONSTRAINT `vehicle_insurances_vehicle_id_vehicles_id_fk` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_responsible_user_id_users_id_fk` FOREIGN KEY (`responsible_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `vehicles` ADD CONSTRAINT `vehicles_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `eam_assets` ADD CONSTRAINT `eam_assets_location_id_it_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `it_locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `maint_plans` ADD CONSTRAINT `maint_plans_vehicle_id_vehicles_id_fk` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE no action ON UPDATE no action;