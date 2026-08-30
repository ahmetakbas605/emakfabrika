CREATE TABLE `bom_lines` (
	`id` char(36) NOT NULL,
	`bom_id` char(36) NOT NULL,
	`line_order` int NOT NULL DEFAULT 0,
	`component_product_id` char(36) NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	`unit_id` char(36) NOT NULL,
	`scrap_percent` decimal(5,2),
	`alternative_component_product_id` char(36),
	CONSTRAINT `bom_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `boms` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`status` enum('ACTIVE','SUPERSEDED') NOT NULL DEFAULT 'ACTIVE',
	`base_quantity` decimal(20,6) NOT NULL DEFAULT '1',
	`unit_id` char(36) NOT NULL,
	`effective_from` date,
	`effective_to` date,
	`supersedes_id` char(36),
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `boms_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_boms_company_code_version` UNIQUE(`company_id`,`code`,`version`)
);
--> statement-breakpoint
CREATE TABLE `prod_operations` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`order_id` char(36) NOT NULL,
	`routing_op_id` char(36),
	`operation_order` int NOT NULL,
	`work_center_id` char(36),
	`name` varchar(255) NOT NULL,
	`status` enum('PENDING','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING',
	`assigned_to_user_id` char(36),
	`started_at` timestamp,
	`completed_at` timestamp,
	`good_quantity` decimal(20,6) NOT NULL DEFAULT '0',
	`scrap_quantity` decimal(20,6) NOT NULL DEFAULT '0',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `prod_operations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `production_orders` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`order_no` varchar(32) NOT NULL,
	`product_id` char(36) NOT NULL,
	`bom_id` char(36) NOT NULL,
	`routing_id` char(36),
	`quantity` decimal(20,6) NOT NULL,
	`unit_id` char(36) NOT NULL,
	`warehouse_id` char(36) NOT NULL,
	`planned_start_date` date,
	`planned_end_date` date,
	`status` enum('DRAFT','SUBMITTED','REJECTED','REVISION_REQUIRED','RELEASED','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`sales_order_id` char(36),
	`materials_issued_at` timestamp,
	`good_quantity` decimal(20,6) NOT NULL DEFAULT '0',
	`scrap_quantity` decimal(20,6) NOT NULL DEFAULT '0',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`submitted_at` timestamp,
	`released_at` timestamp,
	`completed_at` timestamp,
	CONSTRAINT `production_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_production_orders_company_no` UNIQUE(`company_id`,`order_no`)
);
--> statement-breakpoint
CREATE TABLE `routing_operations` (
	`id` char(36) NOT NULL,
	`routing_id` char(36) NOT NULL,
	`operation_order` int NOT NULL,
	`work_center_id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`setup_time_minutes` decimal(10,2),
	`run_time_minutes_per_unit` decimal(10,4),
	`description` text,
	CONSTRAINT `routing_operations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `routings` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`status` enum('ACTIVE','SUPERSEDED') NOT NULL DEFAULT 'ACTIVE',
	`supersedes_id` char(36),
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `routings_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_routings_company_code_version` UNIQUE(`company_id`,`code`,`version`)
);
--> statement-breakpoint
CREATE TABLE `work_centers` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`capacity_per_hour` decimal(20,6),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `work_centers_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_work_center_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
ALTER TABLE `bom_lines` ADD CONSTRAINT `bom_lines_bom_id_boms_id_fk` FOREIGN KEY (`bom_id`) REFERENCES `boms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bom_lines` ADD CONSTRAINT `bom_lines_component_product_id_products_id_fk` FOREIGN KEY (`component_product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bom_lines` ADD CONSTRAINT `bom_lines_unit_id_units_id_fk` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bom_lines` ADD CONSTRAINT `bom_lines_alternative_component_product_id_products_id_fk` FOREIGN KEY (`alternative_component_product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `boms` ADD CONSTRAINT `boms_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `boms` ADD CONSTRAINT `boms_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `boms` ADD CONSTRAINT `boms_unit_id_units_id_fk` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `boms` ADD CONSTRAINT `boms_supersedes_id_boms_id_fk` FOREIGN KEY (`supersedes_id`) REFERENCES `boms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `boms` ADD CONSTRAINT `boms_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prod_operations` ADD CONSTRAINT `prod_operations_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prod_operations` ADD CONSTRAINT `prod_operations_order_id_production_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `production_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prod_operations` ADD CONSTRAINT `prod_operations_routing_op_id_routing_operations_id_fk` FOREIGN KEY (`routing_op_id`) REFERENCES `routing_operations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prod_operations` ADD CONSTRAINT `prod_operations_work_center_id_work_centers_id_fk` FOREIGN KEY (`work_center_id`) REFERENCES `work_centers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `prod_operations` ADD CONSTRAINT `prod_operations_assigned_to_user_id_users_id_fk` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_bom_id_boms_id_fk` FOREIGN KEY (`bom_id`) REFERENCES `boms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_routing_id_routings_id_fk` FOREIGN KEY (`routing_id`) REFERENCES `routings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_unit_id_units_id_fk` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_warehouse_id_warehouses_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_sales_order_id_sales_orders_id_fk` FOREIGN KEY (`sales_order_id`) REFERENCES `sales_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `production_orders` ADD CONSTRAINT `production_orders_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `routing_operations` ADD CONSTRAINT `routing_operations_routing_id_routings_id_fk` FOREIGN KEY (`routing_id`) REFERENCES `routings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `routing_operations` ADD CONSTRAINT `routing_operations_work_center_id_work_centers_id_fk` FOREIGN KEY (`work_center_id`) REFERENCES `work_centers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `routings` ADD CONSTRAINT `routings_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `routings` ADD CONSTRAINT `routings_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `routings` ADD CONSTRAINT `routings_supersedes_id_routings_id_fk` FOREIGN KEY (`supersedes_id`) REFERENCES `routings`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `routings` ADD CONSTRAINT `routings_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_centers` ADD CONSTRAINT `work_centers_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;