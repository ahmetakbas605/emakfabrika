ALTER TABLE `users` ADD `failed_login_attempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `session_token` varchar(128);--> statement-breakpoint
ALTER TABLE `users` ADD `session_expires_at` timestamp;