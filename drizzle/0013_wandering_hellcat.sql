CREATE TABLE `ip_addresses` (
	`id` char(36) NOT NULL,
	`subnet_id` char(36) NOT NULL,
	`ip_address` varchar(45) NOT NULL,
	`ip_version` enum('IPV4','IPV6') NOT NULL DEFAULT 'IPV4',
	`status` enum('AVAILABLE','ASSIGNED','RESERVED','CONFLICT','BLOCKED','UNKNOWN') NOT NULL DEFAULT 'AVAILABLE',
	CONSTRAINT `ip_addresses_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_ip_subnet_address` UNIQUE(`subnet_id`,`ip_address`)
);
--> statement-breakpoint
CREATE TABLE `ip_assignments` (
	`id` char(36) NOT NULL,
	`ip_address_id` char(36) NOT NULL,
	`asset_id` char(36),
	`network_interface_id` char(36),
	`assignment_type` enum('STATIC','DHCP','RESERVED') NOT NULL DEFAULT 'STATIC',
	`assigned_at` timestamp NOT NULL DEFAULT (now()),
	`released_at` timestamp,
	CONSTRAINT `ip_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `network_interfaces` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`asset_id` char(36) NOT NULL,
	`name` varchar(64) NOT NULL,
	`mac_address` varchar(17) NOT NULL DEFAULT '',
	`interface_type` enum('ETHERNET','FIBER','WIFI') NOT NULL DEFAULT 'ETHERNET',
	`switch_port_id` char(36),
	`vlan_id` char(36),
	`status` varchar(32) NOT NULL DEFAULT 'UP',
	CONSTRAINT `network_interfaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `network_subnets` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`branch_id` char(36),
	`cidr` varchar(64) NOT NULL,
	`gateway` varchar(64) NOT NULL DEFAULT '',
	`dns_primary` varchar(64) NOT NULL DEFAULT '',
	`dns_secondary` varchar(64) NOT NULL DEFAULT '',
	`vlan_id` char(36),
	`dhcp_enabled` boolean NOT NULL DEFAULT false,
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `network_subnets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `network_vlans` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`branch_id` char(36),
	`vlan_number` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`subnet_id` char(36),
	`gateway` varchar(64) NOT NULL DEFAULT '',
	`dhcp_enabled` boolean NOT NULL DEFAULT false,
	`purpose` varchar(255) NOT NULL DEFAULT '',
	`network_zone` varchar(64) NOT NULL DEFAULT '',
	`security_level` varchar(32) NOT NULL DEFAULT '',
	CONSTRAINT `network_vlans_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_vlan_company_branch_number` UNIQUE(`company_id`,`branch_id`,`vlan_number`)
);
--> statement-breakpoint
ALTER TABLE `ip_addresses` ADD CONSTRAINT `ip_addresses_subnet_id_network_subnets_id_fk` FOREIGN KEY (`subnet_id`) REFERENCES `network_subnets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ip_assignments` ADD CONSTRAINT `ip_assignments_ip_address_id_ip_addresses_id_fk` FOREIGN KEY (`ip_address_id`) REFERENCES `ip_addresses`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ip_assignments` ADD CONSTRAINT `ip_assignments_asset_id_it_assets_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `it_assets`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ip_assignments` ADD CONSTRAINT `ip_assignments_network_interface_id_network_interfaces_id_fk` FOREIGN KEY (`network_interface_id`) REFERENCES `network_interfaces`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_interfaces` ADD CONSTRAINT `network_interfaces_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_interfaces` ADD CONSTRAINT `network_interfaces_asset_id_it_assets_id_fk` FOREIGN KEY (`asset_id`) REFERENCES `it_assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_interfaces` ADD CONSTRAINT `network_interfaces_switch_port_id_network_interfaces_id_fk` FOREIGN KEY (`switch_port_id`) REFERENCES `network_interfaces`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_interfaces` ADD CONSTRAINT `network_interfaces_vlan_id_network_vlans_id_fk` FOREIGN KEY (`vlan_id`) REFERENCES `network_vlans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_subnets` ADD CONSTRAINT `network_subnets_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_subnets` ADD CONSTRAINT `network_subnets_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_subnets` ADD CONSTRAINT `network_subnets_vlan_id_network_vlans_id_fk` FOREIGN KEY (`vlan_id`) REFERENCES `network_vlans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_vlans` ADD CONSTRAINT `network_vlans_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_vlans` ADD CONSTRAINT `network_vlans_branch_id_branches_id_fk` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `network_vlans` ADD CONSTRAINT `network_vlans_subnet_id_network_subnets_id_fk` FOREIGN KEY (`subnet_id`) REFERENCES `network_subnets`(`id`) ON DELETE no action ON UPDATE no action;