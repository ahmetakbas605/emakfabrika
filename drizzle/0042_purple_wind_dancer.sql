CREATE TABLE `mrp_planned_orders` (
	`id` char(36) NOT NULL,
	`mrp_run_id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	`unit_id` char(36) NOT NULL,
	`warehouse_id` char(36) NOT NULL,
	`due_date` date,
	`order_type` enum('PRODUCTION','PURCHASE') NOT NULL,
	`status` enum('SUGGESTED','CONVERTED','CANCELLED') NOT NULL DEFAULT 'SUGGESTED',
	`demand_source` enum('SALES_ORDER','MIN_STOCK','BOM_EXPLOSION') NOT NULL,
	`parent_id` char(36),
	`converted_order_type` varchar(32),
	`converted_order_id` char(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `mrp_planned_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `mrp_runs` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`warehouse_id` char(36) NOT NULL,
	`run_date` date NOT NULL,
	`status` enum('RUNNING','COMPLETED','FAILED') NOT NULL DEFAULT 'RUNNING',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `mrp_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `stock_items` ADD `min_qty` decimal(20,6);--> statement-breakpoint
ALTER TABLE `mrp_planned_orders` ADD CONSTRAINT `mrp_planned_orders_mrp_run_id_mrp_runs_id_fk` FOREIGN KEY (`mrp_run_id`) REFERENCES `mrp_runs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mrp_planned_orders` ADD CONSTRAINT `mrp_planned_orders_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mrp_planned_orders` ADD CONSTRAINT `mrp_planned_orders_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mrp_planned_orders` ADD CONSTRAINT `mrp_planned_orders_unit_id_units_id_fk` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mrp_planned_orders` ADD CONSTRAINT `mrp_planned_orders_warehouse_id_warehouses_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mrp_planned_orders` ADD CONSTRAINT `mrp_planned_orders_parent_id_mrp_planned_orders_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `mrp_planned_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mrp_runs` ADD CONSTRAINT `mrp_runs_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mrp_runs` ADD CONSTRAINT `mrp_runs_warehouse_id_warehouses_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mrp_runs` ADD CONSTRAINT `mrp_runs_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;