ALTER TABLE `leave_requests` ADD `leave_no` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `overtime_requests` ADD `overtime_no` varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE `leave_requests` ADD CONSTRAINT `udx_leave_requests_company_no` UNIQUE(`company_id`,`leave_no`);--> statement-breakpoint
ALTER TABLE `overtime_requests` ADD CONSTRAINT `udx_overtime_requests_company_no` UNIQUE(`company_id`,`overtime_no`);