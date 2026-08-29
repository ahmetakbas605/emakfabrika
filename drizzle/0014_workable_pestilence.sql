CREATE TABLE `diagram_versions` (
	`id` char(36) NOT NULL,
	`diagram_id` char(36) NOT NULL,
	`version_no` int NOT NULL,
	`created_by` char(36) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `diagram_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_diagram_version_no` UNIQUE(`diagram_id`,`version_no`)
);
--> statement-breakpoint
CREATE TABLE `network_diagrams` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`current_version_id` char(36),
	CONSTRAINT `network_diagrams_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `network_links` (
	`id` char(36) NOT NULL,
	`diagram_version_id` char(36) NOT NULL,
	`source_node_id` char(36) NOT NULL,
	`target_node_id` char(36) NOT NULL,
	`port` varchar(64) NOT NULL DEFAULT '',
	`vlan_id` char(36),
	`bandwidth` varchar(64) NOT NULL DEFAULT '',
	`interface_name` varchar(64) NOT NULL DEFAULT '',
	CONSTRAINT `network_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `network_nodes` (
	`id` char(36) NOT NULL,
	`diagram_version_id` char(36) NOT NULL,
	`node_type` enum('FIREWALL','ROUTER','SWITCH','SERVER','ACCESS_POINT','PRINTER','COMPUTER','CAMERA','NVR','INTERNET','CLOUD') NOT NULL,
	`linked_asset_id` char(36),
	`label` varchar(255) NOT NULL DEFAULT '',
	`position_x` int NOT NULL DEFAULT 0,
	`position_y` int NOT NULL DEFAULT 0,
	CONSTRAINT `network_nodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `diagram_versions` ADD CONSTRAINT `diagram_versions_diagram_id_network_diagrams_id_fk` FOREIGN KEY (`diagram_id`) REFERENCES `network_diagrams`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `diagram_versions` ADD CONSTRAINT `diagram_versions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_diagrams` ADD CONSTRAINT `network_diagrams_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_diagrams` ADD CONSTRAINT `network_diagrams_current_version_id_diagram_versions_id_fk` FOREIGN KEY (`current_version_id`) REFERENCES `diagram_versions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_links` ADD CONSTRAINT `network_links_diagram_version_id_diagram_versions_id_fk` FOREIGN KEY (`diagram_version_id`) REFERENCES `diagram_versions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_links` ADD CONSTRAINT `network_links_source_node_id_network_nodes_id_fk` FOREIGN KEY (`source_node_id`) REFERENCES `network_nodes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_links` ADD CONSTRAINT `network_links_target_node_id_network_nodes_id_fk` FOREIGN KEY (`target_node_id`) REFERENCES `network_nodes`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_links` ADD CONSTRAINT `network_links_vlan_id_network_vlans_id_fk` FOREIGN KEY (`vlan_id`) REFERENCES `network_vlans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_nodes` ADD CONSTRAINT `network_nodes_diagram_version_id_diagram_versions_id_fk` FOREIGN KEY (`diagram_version_id`) REFERENCES `diagram_versions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_nodes` ADD CONSTRAINT `network_nodes_linked_asset_id_it_assets_id_fk` FOREIGN KEY (`linked_asset_id`) REFERENCES `it_assets`(`id`) ON DELETE no action ON UPDATE no action;