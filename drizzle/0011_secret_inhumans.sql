CREATE TABLE `ticket_escalations` (
	`id` char(36) NOT NULL,
	`ticket_id` char(36) NOT NULL,
	`level` int NOT NULL,
	`escalated_to_role_code` varchar(64) NOT NULL,
	`escalated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ticket_escalations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `sla_policies` ADD `escalation_chain` json;--> statement-breakpoint
ALTER TABLE `ticket_escalations` ADD CONSTRAINT `ticket_escalations_ticket_id_service_desk_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `service_desk_tickets`(`id`) ON DELETE cascade ON UPDATE no action;