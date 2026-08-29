CREATE TABLE `brands` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `brands_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `currencies` (
	`code` char(3) NOT NULL,
	`name` varchar(100) NOT NULL,
	`symbol` varchar(8) NOT NULL DEFAULT '',
	`decimal_places` int NOT NULL DEFAULT 2,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `currencies_code` PRIMARY KEY(`code`)
);
--> statement-breakpoint
CREATE TABLE `doc_number_seqs` (
	`company_id` char(36) NOT NULL,
	`sequence_key` varchar(32) NOT NULL,
	`year` int NOT NULL,
	`last_number` int NOT NULL DEFAULT 0,
	CONSTRAINT `udx_doc_number_seq` UNIQUE(`company_id`,`sequence_key`,`year`)
);
--> statement-breakpoint
CREATE TABLE `exchange_rates` (
	`id` char(36) NOT NULL,
	`currency_code` char(3) NOT NULL,
	`rate_date` date NOT NULL,
	`rate` decimal(20,6) NOT NULL,
	`rate_type` enum('BUY','SELL','EFFECTIVE','CENTRAL_BANK','CUSTOM') NOT NULL DEFAULT 'EFFECTIVE',
	`source` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `exchange_rates_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_exchange_rate_currency_date_type` UNIQUE(`currency_code`,`rate_date`,`rate_type`)
);
--> statement-breakpoint
CREATE TABLE `inv_balances` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`warehouse_id` char(36) NOT NULL,
	`stock_item_id` char(36) NOT NULL,
	`qty` decimal(20,6) NOT NULL DEFAULT '0',
	`avg_cost` decimal(20,6) NOT NULL DEFAULT '0',
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inv_balances_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_inv_balance_warehouse_item` UNIQUE(`warehouse_id`,`stock_item_id`)
);
--> statement-breakpoint
CREATE TABLE `inv_reservations` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`warehouse_id` char(36) NOT NULL,
	`stock_item_id` char(36) NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	`source_type` varchar(64),
	`source_id` char(36),
	`status` enum('ACTIVE','RELEASED','CONSUMED') NOT NULL DEFAULT 'ACTIVE',
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`released_at` timestamp,
	CONSTRAINT `inv_reservations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `parties` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`party_type` enum('PERSON','COMPANY') NOT NULL DEFAULT 'COMPANY',
	`code` varchar(32) NOT NULL,
	`legal_name` varchar(255) NOT NULL,
	`trade_name` varchar(255) NOT NULL DEFAULT '',
	`tax_number` varchar(11) NOT NULL DEFAULT '',
	`tax_office` varchar(255) NOT NULL DEFAULT '',
	`email` varchar(255) NOT NULL DEFAULT '',
	`phone` varchar(32) NOT NULL DEFAULT '',
	`website` varchar(255) NOT NULL DEFAULT '',
	`currency_code` char(3),
	`payment_term_id` char(36),
	`credit_limit` decimal(20,6),
	`active` boolean NOT NULL DEFAULT true,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `parties_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_party_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `party_addresses` (
	`id` char(36) NOT NULL,
	`party_id` char(36) NOT NULL,
	`address_type` enum('BILLING','SHIPPING','OTHER') NOT NULL DEFAULT 'OTHER',
	`label` varchar(100) NOT NULL DEFAULT '',
	`address_line` text,
	`city` varchar(100) NOT NULL DEFAULT '',
	`district` varchar(100) NOT NULL DEFAULT '',
	`country` varchar(100) NOT NULL DEFAULT 'Türkiye',
	`is_default` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `party_addresses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `party_contacts` (
	`id` char(36) NOT NULL,
	`party_id` char(36) NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`title` varchar(100) NOT NULL DEFAULT '',
	`email` varchar(255) NOT NULL DEFAULT '',
	`phone` varchar(32) NOT NULL DEFAULT '',
	`is_primary` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `party_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `party_roles` (
	`id` char(36) NOT NULL,
	`party_id` char(36) NOT NULL,
	`role` enum('CUSTOMER','SUPPLIER') NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `party_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_party_role` UNIQUE(`party_id`,`role`)
);
--> statement-breakpoint
CREATE TABLE `payment_terms` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(100) NOT NULL,
	`net_days` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `payment_terms_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_payment_term_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `price_list_items` (
	`id` char(36) NOT NULL,
	`price_list_id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`price` decimal(20,6) NOT NULL,
	`discount_percent` decimal(5,2),
	`tax_inclusive` boolean NOT NULL DEFAULT false,
	CONSTRAINT `price_list_items_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_price_list_item` UNIQUE(`price_list_id`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `price_lists` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`currency_code` char(3) NOT NULL,
	`valid_from` date,
	`valid_to` date,
	`party_id` char(36),
	`active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `price_lists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `product_barcodes` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`barcode` varchar(64) NOT NULL,
	`barcode_type` enum('EAN13','EAN8','UPC','CODE128','CUSTOM') NOT NULL DEFAULT 'EAN13',
	CONSTRAINT `product_barcodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_product_barcode_company` UNIQUE(`company_id`,`barcode`)
);
--> statement-breakpoint
CREATE TABLE `product_cats` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`parent_category_id` char(36),
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `product_cats_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_product_cat_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `product_suppliers` (
	`id` char(36) NOT NULL,
	`product_id` char(36) NOT NULL,
	`supplier_party_id` char(36) NOT NULL,
	`supplier_sku` varchar(64) NOT NULL DEFAULT '',
	`purchase_price` decimal(20,6),
	`currency_code` char(3),
	`lead_time_days` int,
	`min_order_qty` decimal(20,6),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `product_suppliers_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_product_supplier` UNIQUE(`product_id`,`supplier_party_id`)
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`sku` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`short_name` varchar(100) NOT NULL DEFAULT '',
	`description` text,
	`brand_id` char(36),
	`category_id` char(36),
	`product_type` enum('STOCK_ITEM','SERVICE','ASSET','KIT','NON_STOCK','CONSUMABLE','SPARE_PART') NOT NULL DEFAULT 'STOCK_ITEM',
	`base_unit_id` char(36) NOT NULL,
	`purchase_unit_id` char(36),
	`sales_unit_id` char(36),
	`tracking_type` enum('NONE','SERIAL','LOT') NOT NULL DEFAULT 'NONE',
	`parent_product_id` char(36),
	`tax_rate_percent` decimal(5,2),
	`active` boolean NOT NULL DEFAULT true,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `products_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_product_company_sku` UNIQUE(`company_id`,`sku`)
);
--> statement-breakpoint
CREATE TABLE `stock_transfers` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`transfer_no` varchar(32) NOT NULL,
	`source_warehouse_id` char(36) NOT NULL,
	`destination_warehouse_id` char(36) NOT NULL,
	`status` enum('DRAFT','REQUESTED','APPROVED','IN_TRANSIT','RECEIVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`requested_by_user_id` char(36) NOT NULL,
	`approved_by_user_id` char(36),
	`received_by_user_id` char(36),
	`requested_at` timestamp NOT NULL DEFAULT (now()),
	`approved_at` timestamp,
	`shipped_at` timestamp,
	`received_at` timestamp,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `stock_transfers_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_stock_transfer_company_no` UNIQUE(`company_id`,`transfer_no`)
);
--> statement-breakpoint
CREATE TABLE `transfer_lines` (
	`id` char(36) NOT NULL,
	`transfer_id` char(36) NOT NULL,
	`stock_item_id` char(36) NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	`received_quantity` decimal(20,6),
	CONSTRAINT `transfer_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(16) NOT NULL,
	`name` varchar(100) NOT NULL,
	`base_unit_id` char(36),
	`conversion_factor` decimal(20,6),
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `units_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_unit_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `wh_locations` (
	`id` char(36) NOT NULL,
	`warehouse_id` char(36) NOT NULL,
	`parent_location_id` char(36),
	`location_type` enum('ZONE','AISLE','RACK','SHELF','BIN') NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL DEFAULT '',
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `wh_locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `stock_items` ADD `product_id` char(36);--> statement-breakpoint
ALTER TABLE `stock_movements` ADD `location_id` char(36);--> statement-breakpoint
ALTER TABLE `brands` ADD CONSTRAINT `brands_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `doc_number_seqs` ADD CONSTRAINT `doc_number_seqs_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `exchange_rates` ADD CONSTRAINT `exchange_rates_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inv_balances` ADD CONSTRAINT `inv_balances_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inv_balances` ADD CONSTRAINT `inv_balances_warehouse_id_warehouses_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inv_balances` ADD CONSTRAINT `inv_balances_stock_item_id_stock_items_id_fk` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inv_reservations` ADD CONSTRAINT `inv_reservations_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inv_reservations` ADD CONSTRAINT `inv_reservations_warehouse_id_warehouses_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inv_reservations` ADD CONSTRAINT `inv_reservations_stock_item_id_stock_items_id_fk` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inv_reservations` ADD CONSTRAINT `inv_reservations_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `parties` ADD CONSTRAINT `parties_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `parties` ADD CONSTRAINT `parties_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `parties` ADD CONSTRAINT `parties_payment_term_id_payment_terms_id_fk` FOREIGN KEY (`payment_term_id`) REFERENCES `payment_terms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `parties` ADD CONSTRAINT `parties_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `party_addresses` ADD CONSTRAINT `party_addresses_party_id_parties_id_fk` FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `party_contacts` ADD CONSTRAINT `party_contacts_party_id_parties_id_fk` FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `party_roles` ADD CONSTRAINT `party_roles_party_id_parties_id_fk` FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payment_terms` ADD CONSTRAINT `payment_terms_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_list_items` ADD CONSTRAINT `price_list_items_price_list_id_price_lists_id_fk` FOREIGN KEY (`price_list_id`) REFERENCES `price_lists`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_list_items` ADD CONSTRAINT `price_list_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_lists` ADD CONSTRAINT `price_lists_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_lists` ADD CONSTRAINT `price_lists_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `price_lists` ADD CONSTRAINT `price_lists_party_id_parties_id_fk` FOREIGN KEY (`party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_barcodes` ADD CONSTRAINT `product_barcodes_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_barcodes` ADD CONSTRAINT `product_barcodes_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_cats` ADD CONSTRAINT `product_cats_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_cats` ADD CONSTRAINT `product_cats_parent_category_id_product_cats_id_fk` FOREIGN KEY (`parent_category_id`) REFERENCES `product_cats`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_suppliers` ADD CONSTRAINT `product_suppliers_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_suppliers` ADD CONSTRAINT `product_suppliers_supplier_party_id_parties_id_fk` FOREIGN KEY (`supplier_party_id`) REFERENCES `parties`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `product_suppliers` ADD CONSTRAINT `product_suppliers_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_brand_id_brands_id_fk` FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_product_cats_id_fk` FOREIGN KEY (`category_id`) REFERENCES `product_cats`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_base_unit_id_units_id_fk` FOREIGN KEY (`base_unit_id`) REFERENCES `units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_purchase_unit_id_units_id_fk` FOREIGN KEY (`purchase_unit_id`) REFERENCES `units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_sales_unit_id_units_id_fk` FOREIGN KEY (`sales_unit_id`) REFERENCES `units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_parent_product_id_products_id_fk` FOREIGN KEY (`parent_product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `products` ADD CONSTRAINT `products_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_source_warehouse_id_warehouses_id_fk` FOREIGN KEY (`source_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_destination_warehouse_id_warehouses_id_fk` FOREIGN KEY (`destination_warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_requested_by_user_id_users_id_fk` FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_approved_by_user_id_users_id_fk` FOREIGN KEY (`approved_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_transfers` ADD CONSTRAINT `stock_transfers_received_by_user_id_users_id_fk` FOREIGN KEY (`received_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transfer_lines` ADD CONSTRAINT `transfer_lines_transfer_id_stock_transfers_id_fk` FOREIGN KEY (`transfer_id`) REFERENCES `stock_transfers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transfer_lines` ADD CONSTRAINT `transfer_lines_stock_item_id_stock_items_id_fk` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `units` ADD CONSTRAINT `units_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `units` ADD CONSTRAINT `units_base_unit_id_units_id_fk` FOREIGN KEY (`base_unit_id`) REFERENCES `units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wh_locations` ADD CONSTRAINT `wh_locations_warehouse_id_warehouses_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wh_locations` ADD CONSTRAINT `wh_locations_parent_location_id_wh_locations_id_fk` FOREIGN KEY (`parent_location_id`) REFERENCES `wh_locations`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_items` ADD CONSTRAINT `stock_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `stock_movements` ADD CONSTRAINT `stock_movements_location_id_wh_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `wh_locations`(`id`) ON DELETE no action ON UPDATE no action;