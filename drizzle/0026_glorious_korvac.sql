CREATE TABLE `proc_receipt_lines` (
	`id` char(36) NOT NULL,
	`receipt_id` char(36) NOT NULL,
	`po_line_id` char(36) NOT NULL,
	`received_qty` decimal(20,6) NOT NULL,
	`warehouse_id` char(36),
	`stock_item_id` char(36),
	`stock_movement_id` char(36),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proc_receipt_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proc_receipts` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`po_id` char(36) NOT NULL,
	`receipt_no` varchar(32) NOT NULL,
	`receipt_date` date NOT NULL,
	`notes` text,
	`received_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proc_receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_proc_receipts_company_no` UNIQUE(`company_id`,`receipt_no`)
);
--> statement-breakpoint
CREATE TABLE `proc_vinvoice_lines` (
	`id` char(36) NOT NULL,
	`invoice_id` char(36) NOT NULL,
	`po_line_id` char(36) NOT NULL,
	`invoiced_qty` decimal(20,6) NOT NULL,
	`invoiced_unit_price` decimal(20,6) NOT NULL,
	`line_total` decimal(20,6) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `proc_vinvoice_lines_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proc_vinvoices` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`po_id` char(36) NOT NULL,
	`supplier_invoice_no` varchar(64) NOT NULL,
	`invoice_date` date NOT NULL,
	`currency_code` char(3) NOT NULL,
	`status` enum('DRAFT','APPROVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
	`notes` text,
	`created_by_user_id` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`approved_at` timestamp,
	CONSTRAINT `proc_vinvoices_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_proc_vinvoices_company_no` UNIQUE(`company_id`,`supplier_invoice_no`)
);
--> statement-breakpoint
ALTER TABLE `proc_receipt_lines` ADD CONSTRAINT `proc_receipt_lines_receipt_id_proc_receipts_id_fk` FOREIGN KEY (`receipt_id`) REFERENCES `proc_receipts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_receipt_lines` ADD CONSTRAINT `proc_receipt_lines_po_line_id_proc_po_lines_id_fk` FOREIGN KEY (`po_line_id`) REFERENCES `proc_po_lines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_receipt_lines` ADD CONSTRAINT `proc_receipt_lines_warehouse_id_warehouses_id_fk` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_receipt_lines` ADD CONSTRAINT `proc_receipt_lines_stock_item_id_stock_items_id_fk` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_receipt_lines` ADD CONSTRAINT `proc_receipt_lines_stock_movement_id_stock_movements_id_fk` FOREIGN KEY (`stock_movement_id`) REFERENCES `stock_movements`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_receipts` ADD CONSTRAINT `proc_receipts_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_receipts` ADD CONSTRAINT `proc_receipts_po_id_proc_pos_id_fk` FOREIGN KEY (`po_id`) REFERENCES `proc_pos`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_receipts` ADD CONSTRAINT `proc_receipts_received_by_user_id_users_id_fk` FOREIGN KEY (`received_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_vinvoice_lines` ADD CONSTRAINT `proc_vinvoice_lines_invoice_id_proc_vinvoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `proc_vinvoices`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_vinvoice_lines` ADD CONSTRAINT `proc_vinvoice_lines_po_line_id_proc_po_lines_id_fk` FOREIGN KEY (`po_line_id`) REFERENCES `proc_po_lines`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_vinvoices` ADD CONSTRAINT `proc_vinvoices_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_vinvoices` ADD CONSTRAINT `proc_vinvoices_po_id_proc_pos_id_fk` FOREIGN KEY (`po_id`) REFERENCES `proc_pos`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_vinvoices` ADD CONSTRAINT `proc_vinvoices_currency_code_currencies_code_fk` FOREIGN KEY (`currency_code`) REFERENCES `currencies`(`code`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `proc_vinvoices` ADD CONSTRAINT `proc_vinvoices_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;