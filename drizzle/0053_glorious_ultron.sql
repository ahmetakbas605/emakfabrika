CREATE TABLE `weighbridge_tickets` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`weighbridge_id` char(36) NOT NULL,
	`ticket_no` varchar(32) NOT NULL,
	`purpose` enum('SALES_QUANTITY','ROAD_LEGAL_CHECK') NOT NULL,
	`direction` enum('OUTBOUND','INBOUND') NOT NULL DEFAULT 'OUTBOUND',
	`status` enum('DRAFT','COMPLETED','CANCELLED','REVERSED') NOT NULL DEFAULT 'DRAFT',
	`plate_no` varchar(20) NOT NULL,
	`driver_name` varchar(255) NOT NULL DEFAULT '',
	`carrier_name` varchar(255) NOT NULL DEFAULT '',
	`party_id` char(36),
	`product_id` char(36),
	`order_line_id` char(36),
	`gross_kg` decimal(20,3),
	`tare_kg` decimal(20,3),
	`net_kg` decimal(20,3),
	`first_weighed_at` timestamp,
	`second_weighed_at` timestamp,
	`road_legal_ok` boolean,
	`notes` varchar(1000) NOT NULL DEFAULT '',
	`reversal_of_ticket_id` char(36),
	`cancel_reason` varchar(500) NOT NULL DEFAULT '',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `weighbridge_tickets_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_weighbridge_ticket_company_no` UNIQUE(`company_id`,`ticket_no`)
);
--> statement-breakpoint
CREATE TABLE `weighbridges` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`department_id` char(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`location` varchar(255) NOT NULL DEFAULT '',
	`capacity_kg` decimal(20,3),
	`road_legal_limit_kg` decimal(20,3),
	`tolerance_percent` decimal(6,3) NOT NULL DEFAULT '0',
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weighbridges_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_weighbridge_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
ALTER TABLE `weighbridge_tickets` ADD CONSTRAINT `weighbridge_tickets_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weighbridge_tickets` ADD CONSTRAINT `weighbridge_tickets_weighbridge_id_weighbridges_id_fk` FOREIGN KEY (`weighbridge_id`) REFERENCES `weighbridges`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weighbridge_tickets` ADD CONSTRAINT `weighbridge_tickets_party_id_parties_id_fk` FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weighbridge_tickets` ADD CONSTRAINT `weighbridge_tickets_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weighbridge_tickets` ADD CONSTRAINT `weighbridge_tickets_order_line_id_sales_order_lines_id_fk` FOREIGN KEY (`order_line_id`) REFERENCES `sales_order_lines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weighbridge_tickets` ADD CONSTRAINT `weighbridge_tickets_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weighbridges` ADD CONSTRAINT `weighbridges_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `weighbridges` ADD CONSTRAINT `weighbridges_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE cascade ON UPDATE no action;