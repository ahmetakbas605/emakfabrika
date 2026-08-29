CREATE TABLE `proc_request_lines` (
	`id` char(36) NOT NULL,
	`request_id` char(36) NOT NULL,
	`line_no` int NOT NULL,
	`product_id` char(36),
	`stock_item_id` char(36),
	`description` varchar(255) NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	`unit_id` char(36) NOT NULL,
	`preferred_brand` varchar(255) NOT NULL DEFAULT '',
	`alternative_brand` varchar(255) NOT NULL DEFAULT '',
	`model` varchar(255) NOT NULL DEFAULT '',
	`technical_spec` json,
	`estimated_unit_price` decimal(20,6),
	`estimated_total` decimal(20,6),
	`warehouse_id` char(36),
	`delivery_location` varchar(255) NOT NULL DEFAULT '',
	`stock_status` enum('PENDING','STOCK_AVAILABLE','STOCK_PARTIAL','STOCK_UNAVAILABLE','NEW_PURCHASE_REQUIRED') NOT NULL DEFAULT 'PENDING',
	`reserved_qty` decimal(20,6),
	`purchase_qty` decimal(20,6),
	`reservation_id` char(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proc_request_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proc_requests` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`department_id` char(36),
	`request_no` varchar(32) NOT NULL,
	`request_type` enum('NORMAL','URGENT','EMERGENCY','PROJECT','PRODUCTION','MAINTENANCE','IT','OFFICE','RAW_MATERIAL','SERVICE','CAPEX','OPEX','STOCK_REPLENISHMENT') NOT NULL DEFAULT 'NORMAL',
	`priority` enum('LOW','NORMAL','HIGH','CRITICAL') NOT NULL DEFAULT 'NORMAL',
	`status` enum('DRAFT','SUBMITTED','APPROVED','REJECTED','REVISION_REQUIRED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`requested_by_user_id` char(36) NOT NULL,
	`cost_center_id` char(36),
	`budget_item_id` char(36),
	`budget_commitment_id` char(36),
	`capex_opex` enum('CAPEX','OPEX'),
	`requested_delivery_date` date,
	`justification` text,
	`estimated_total` decimal(20,6),
	`currency_code` char(3),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`submitted_at` timestamp,
	`completed_at` timestamp,
	CONSTRAINT `proc_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_proc_request_company_no` UNIQUE(`company_id`,`request_no`)
);
--> statement-breakpoint
ALTER TABLE `proc_request_lines` ADD CONSTRAINT `proc_request_lines_request_id_proc_requests_id_fk` FOREIGN KEY (`request_id`) REFERENCES `proc_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_request_lines` ADD CONSTRAINT `proc_request_lines_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_request_lines` ADD CONSTRAINT `proc_request_lines_stock_item_id_stock_items_id_fk` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_request_lines` ADD CONSTRAINT `proc_request_lines_unit_id_units_id_fk` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_request_lines` ADD CONSTRAINT `proc_request_lines_warehouse_id_warehouses_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_request_lines` ADD CONSTRAINT `proc_request_lines_reservation_id_inv_reservations_id_fk` FOREIGN KEY (`reservation_id`) REFERENCES `inv_reservations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_requests` ADD CONSTRAINT `proc_requests_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_requests` ADD CONSTRAINT `proc_requests_department_id_departments_id_fk` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_requests` ADD CONSTRAINT `proc_requests_requested_by_user_id_users_id_fk` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_requests` ADD CONSTRAINT `proc_requests_cost_center_id_cost_centers_id_fk` FOREIGN KEY (`cost_center_id`) REFERENCES `cost_centers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_requests` ADD CONSTRAINT `proc_requests_budget_item_id_budget_items_id_fk` FOREIGN KEY (`budget_item_id`) REFERENCES `budget_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_requests` ADD CONSTRAINT `proc_requests_budget_commitment_id_budget_commitments_id_fk` FOREIGN KEY (`budget_commitment_id`) REFERENCES `budget_commitments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_requests` ADD CONSTRAINT `proc_requests_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;