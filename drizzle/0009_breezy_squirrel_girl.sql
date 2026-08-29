CREATE TABLE `checklist_template_items` (
	`id` char(36) NOT NULL,
	`template_id` char(36) NOT NULL,
	`label` varchar(255) NOT NULL,
	`order_index` int NOT NULL DEFAULT 0,
	CONSTRAINT `checklist_template_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `checklist_templates` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	CONSTRAINT `checklist_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_checklist_template_company_code` UNIQUE(`company_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `it_policies` (
	`company_id` char(36) NOT NULL,
	`continuous_location_tracking_enabled` boolean NOT NULL DEFAULT false,
	CONSTRAINT `it_policies_company_id` PRIMARY KEY(`company_id`)
);
--> statement-breakpoint
CREATE TABLE `technician_locations` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`work_order_id` char(36),
	`latitude` decimal(10,7) NOT NULL,
	`longitude` decimal(10,7) NOT NULL,
	`source` enum('ARRIVAL_BUTTON','CONTINUOUS') NOT NULL,
	`recorded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `technician_locations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wo_checklist_items` (
	`id` char(36) NOT NULL,
	`checklist_id` char(36) NOT NULL,
	`label` varchar(255) NOT NULL,
	`order_index` int NOT NULL DEFAULT 0,
	`checked` boolean NOT NULL DEFAULT false,
	`note` text,
	`checked_at` timestamp,
	`checked_by` char(36),
	CONSTRAINT `wo_checklist_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `wo_checklists` (
	`id` char(36) NOT NULL,
	`work_order_id` char(36) NOT NULL,
	`template_id` char(36),
	CONSTRAINT `wo_checklists_id` PRIMARY KEY(`id`),
	CONSTRAINT `wo_checklists_work_order_id_unique` UNIQUE(`work_order_id`)
);
--> statement-breakpoint
CREATE TABLE `work_order_parts` (
	`id` char(36) NOT NULL,
	`work_order_id` char(36) NOT NULL,
	`stock_item_id` char(36) NOT NULL,
	`stock_movement_id` char(36) NOT NULL,
	`quantity` decimal(20,6) NOT NULL,
	`unit_cost` decimal(20,6) NOT NULL,
	`billable` boolean NOT NULL DEFAULT false,
	`consumed_at` timestamp NOT NULL DEFAULT (now()),
	`consumed_by_user_id` char(36) NOT NULL,
	CONSTRAINT `work_order_parts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `work_orders` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`ticket_id` char(36) NOT NULL,
	`arrived_at` timestamp,
	`arrival_latitude` decimal(10,7),
	`arrival_longitude` decimal(10,7),
	`customer_name` varchar(255),
	`signature_note` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `work_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `work_orders_ticket_id_unique` UNIQUE(`ticket_id`)
);
--> statement-breakpoint
ALTER TABLE `service_desk_tickets` ADD `ticket_type` enum('STANDARD','FIELD_SERVICE') DEFAULT 'STANDARD' NOT NULL;--> statement-breakpoint
ALTER TABLE `ticket_work_logs` ADD `billable` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `checklist_template_items` ADD CONSTRAINT `checklist_template_items_template_id_checklist_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `checklist_templates`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `checklist_templates` ADD CONSTRAINT `checklist_templates_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `it_policies` ADD CONSTRAINT `it_policies_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `technician_locations` ADD CONSTRAINT `technician_locations_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `technician_locations` ADD CONSTRAINT `technician_locations_work_order_id_work_orders_id_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wo_checklist_items` ADD CONSTRAINT `wo_checklist_items_checklist_id_wo_checklists_id_fk` FOREIGN KEY (`checklist_id`) REFERENCES `wo_checklists`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wo_checklist_items` ADD CONSTRAINT `wo_checklist_items_checked_by_users_id_fk` FOREIGN KEY (`checked_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wo_checklists` ADD CONSTRAINT `wo_checklists_work_order_id_work_orders_id_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `wo_checklists` ADD CONSTRAINT `wo_checklists_template_id_checklist_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `checklist_templates`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_order_parts` ADD CONSTRAINT `work_order_parts_work_order_id_work_orders_id_fk` FOREIGN KEY (`work_order_id`) REFERENCES `work_orders`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_order_parts` ADD CONSTRAINT `work_order_parts_stock_item_id_stock_items_id_fk` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_order_parts` ADD CONSTRAINT `work_order_parts_stock_movement_id_stock_movements_id_fk` FOREIGN KEY (`stock_movement_id`) REFERENCES `stock_movements`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_order_parts` ADD CONSTRAINT `work_order_parts_consumed_by_user_id_users_id_fk` FOREIGN KEY (`consumed_by_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `work_orders` ADD CONSTRAINT `work_orders_ticket_id_service_desk_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `service_desk_tickets`(`id`) ON DELETE cascade ON UPDATE no action;