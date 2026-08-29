CREATE TABLE `monitoring_metrics_daily_agg` (
	`id` char(36) NOT NULL,
	`target_id` char(36) NOT NULL,
	`metric_name` varchar(64) NOT NULL,
	`date` date NOT NULL,
	`avg_value` decimal(20,6) NOT NULL,
	`min_value` decimal(20,6) NOT NULL,
	`max_value` decimal(20,6) NOT NULL,
	`sample_count` int NOT NULL,
	CONSTRAINT `monitoring_metrics_daily_agg_id` PRIMARY KEY(`id`),
	CONSTRAINT `udx_metric_agg_target_name_date` UNIQUE(`target_id`,`metric_name`,`date`)
);
--> statement-breakpoint
ALTER TABLE `monitoring_metrics_daily_agg` ADD CONSTRAINT `monitoring_metrics_daily_agg_target_id_monitor_targets_id_fk` FOREIGN KEY (`target_id`) REFERENCES `monitor_targets`(`id`) ON DELETE cascade ON UPDATE no action;