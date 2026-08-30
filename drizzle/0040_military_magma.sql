CREATE TABLE `customer_complaints` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`complaint_no` varchar(32) NOT NULL,
	`party_id` char(36) NOT NULL,
	`order_id` char(36),
	`subject` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`status` enum('OPEN','IN_PROGRESS','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
	`priority` enum('LOW','MEDIUM','HIGH','CRITICAL') NOT NULL DEFAULT 'MEDIUM',
	`assigned_to_user_id` char(36),
	`resolution_note` text,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`resolved_at` timestamp,
	CONSTRAINT `customer_complaints_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_customer_complaints_company_no` UNIQUE(`company_id`,`complaint_no`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`contact_name` varchar(255) NOT NULL,
	`company_name` varchar(255) NOT NULL DEFAULT '',
	`email` varchar(255) NOT NULL DEFAULT '',
	`phone` varchar(32) NOT NULL DEFAULT '',
	`source` varchar(100) NOT NULL DEFAULT '',
	`status` enum('NEW','CONTACTED','QUALIFIED','DISQUALIFIED','CONVERTED') NOT NULL DEFAULT 'NEW',
	`assigned_to_user_id` char(36),
	`notes` text,
	`converted_party_id` char(36),
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `opportunities` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`party_id` char(36) NOT NULL,
	`lead_id` char(36),
	`name` varchar(255) NOT NULL,
	`stage` enum('NEW','QUALIFICATION','PROPOSAL','NEGOTIATION','WON','LOST') NOT NULL DEFAULT 'NEW',
	`estimated_value` decimal(20,6),
	`currency_code` char(3),
	`expected_close_date` date,
	`assigned_to_user_id` char(36),
	`lost_reason` text,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`closed_at` timestamp,
	CONSTRAINT `opportunities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_collections` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`invoice_id` char(36) NOT NULL,
	`collection_date` date NOT NULL,
	`amount` decimal(20,6) NOT NULL,
	`currency_code` char(3) NOT NULL,
	`method` enum('CASH','BANK','CHECK','OTHER') NOT NULL DEFAULT 'BANK',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_collections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_invoice_lines` (
	`id` char(36) NOT NULL,
	`invoice_id` char(36) NOT NULL,
	`order_line_id` char(36),
	`product_id` char(36) NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	`unit_price` decimal(20,6) NOT NULL,
	`tax_rate_percent` decimal(5,2) NOT NULL DEFAULT '0',
	`line_total` decimal(20,6) NOT NULL,
	CONSTRAINT `sales_invoice_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_invoices` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`invoice_no` varchar(32) NOT NULL,
	`order_id` char(36),
	`party_id` char(36) NOT NULL,
	`invoice_date` date NOT NULL,
	`currency_code` char(3) NOT NULL,
	`status` enum('DRAFT','APPROVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`approved_at` timestamp,
	CONSTRAINT `sales_invoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_sales_invoices_company_no` UNIQUE(`company_id`,`invoice_no`)
);
--> statement-breakpoint
CREATE TABLE `sales_order_lines` (
	`id` char(36) NOT NULL,
	`order_id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	`unit_price` decimal(20,6) NOT NULL,
	`discount_percent` decimal(5,2),
	`tax_rate_percent` decimal(5,2) NOT NULL DEFAULT '0',
	`line_total` decimal(20,6) NOT NULL,
	`shipped_quantity` decimal(20,6) NOT NULL DEFAULT '0',
	`invoiced_quantity` decimal(20,6) NOT NULL DEFAULT '0',
	CONSTRAINT `sales_order_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_orders` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`order_no` varchar(32) NOT NULL,
	`party_id` char(36) NOT NULL,
	`quote_id` char(36),
	`order_date` date NOT NULL,
	`currency_code` char(3) NOT NULL,
	`status` enum('DRAFT','SUBMITTED','CONFIRMED','REJECTED','REVISION_REQUIRED','IN_FULFILLMENT','SHIPPED','INVOICED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`submitted_at` timestamp,
	`confirmed_at` timestamp,
	`completed_at` timestamp,
	CONSTRAINT `sales_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_sales_orders_company_no` UNIQUE(`company_id`,`order_no`)
);
--> statement-breakpoint
CREATE TABLE `sales_quote_lines` (
	`id` char(36) NOT NULL,
	`quote_id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	`unit_price` decimal(20,6) NOT NULL,
	`discount_percent` decimal(5,2),
	`tax_rate_percent` decimal(5,2) NOT NULL DEFAULT '0',
	`line_total` decimal(20,6) NOT NULL,
	CONSTRAINT `sales_quote_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_quotes` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`quote_no` varchar(32) NOT NULL,
	`party_id` char(36) NOT NULL,
	`opportunity_id` char(36),
	`quote_date` date NOT NULL,
	`valid_until` date,
	`currency_code` char(3) NOT NULL,
	`status` enum('DRAFT','SENT','ACCEPTED','REJECTED','EXPIRED','CONVERTED') NOT NULL DEFAULT 'DRAFT',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_quotes_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_sales_quotes_company_no` UNIQUE(`company_id`,`quote_no`)
);
--> statement-breakpoint
CREATE TABLE `sales_shipment_lines` (
	`id` char(36) NOT NULL,
	`shipment_id` char(36) NOT NULL,
	`order_line_id` char(36) NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	CONSTRAINT `sales_shipment_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_shipments` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`shipment_no` varchar(32) NOT NULL,
	`order_id` char(36) NOT NULL,
	`warehouse_id` char(36) NOT NULL,
	`shipment_date` date NOT NULL,
	`status` enum('DRAFT','SHIPPED','DELIVERED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sales_shipments_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_sales_shipments_company_no` UNIQUE(`company_id`,`shipment_no`)
);
--> statement-breakpoint
ALTER TABLE `customer_complaints` ADD CONSTRAINT `customer_complaints_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_complaints` ADD CONSTRAINT `customer_complaints_party_id_parties_id_fk` FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_complaints` ADD CONSTRAINT `customer_complaints_order_id_sales_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `sales_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_complaints` ADD CONSTRAINT `customer_complaints_assigned_to_user_id_users_id_fk` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customer_complaints` ADD CONSTRAINT `customer_complaints_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_assigned_to_user_id_users_id_fk` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_converted_party_id_parties_id_fk` FOREIGN KEY (`converted_party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `leads` ADD CONSTRAINT `leads_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `opportunities` ADD CONSTRAINT `opportunities_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `opportunities` ADD CONSTRAINT `opportunities_party_id_parties_id_fk` FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `opportunities` ADD CONSTRAINT `opportunities_lead_id_leads_id_fk` FOREIGN KEY (`lead_id`) REFERENCES `leads`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `opportunities` ADD CONSTRAINT `opportunities_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `opportunities` ADD CONSTRAINT `opportunities_assigned_to_user_id_users_id_fk` FOREIGN KEY (`assigned_to_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `opportunities` ADD CONSTRAINT `opportunities_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_collections` ADD CONSTRAINT `sales_collections_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_collections` ADD CONSTRAINT `sales_collections_invoice_id_sales_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoices`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_collections` ADD CONSTRAINT `sales_collections_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_collections` ADD CONSTRAINT `sales_collections_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_invoice_lines` ADD CONSTRAINT `sales_invoice_lines_invoice_id_sales_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `sales_invoices`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_invoice_lines` ADD CONSTRAINT `sales_invoice_lines_order_line_id_sales_order_lines_id_fk` FOREIGN KEY (`order_line_id`) REFERENCES `sales_order_lines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_invoice_lines` ADD CONSTRAINT `sales_invoice_lines_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_order_id_sales_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `sales_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_party_id_parties_id_fk` FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_invoices` ADD CONSTRAINT `sales_invoices_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_order_lines` ADD CONSTRAINT `sales_order_lines_order_id_sales_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `sales_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_order_lines` ADD CONSTRAINT `sales_order_lines_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_party_id_parties_id_fk` FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_quote_id_sales_quotes_id_fk` FOREIGN KEY (`quote_id`) REFERENCES `sales_quotes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_orders` ADD CONSTRAINT `sales_orders_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_quote_lines` ADD CONSTRAINT `sales_quote_lines_quote_id_sales_quotes_id_fk` FOREIGN KEY (`quote_id`) REFERENCES `sales_quotes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_quote_lines` ADD CONSTRAINT `sales_quote_lines_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_quotes` ADD CONSTRAINT `sales_quotes_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_quotes` ADD CONSTRAINT `sales_quotes_party_id_parties_id_fk` FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_quotes` ADD CONSTRAINT `sales_quotes_opportunity_id_opportunities_id_fk` FOREIGN KEY (`opportunity_id`) REFERENCES `opportunities`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_quotes` ADD CONSTRAINT `sales_quotes_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_quotes` ADD CONSTRAINT `sales_quotes_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_shipment_lines` ADD CONSTRAINT `sales_shipment_lines_shipment_id_sales_shipments_id_fk` FOREIGN KEY (`shipment_id`) REFERENCES `sales_shipments`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_shipment_lines` ADD CONSTRAINT `sales_shipment_lines_order_line_id_sales_order_lines_id_fk` FOREIGN KEY (`order_line_id`) REFERENCES `sales_order_lines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_shipments` ADD CONSTRAINT `sales_shipments_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_shipments` ADD CONSTRAINT `sales_shipments_order_id_sales_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `sales_orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_shipments` ADD CONSTRAINT `sales_shipments_warehouse_id_warehouses_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_shipments` ADD CONSTRAINT `sales_shipments_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;