CREATE TABLE `kb_articles` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`category_id` char(36),
	`title` varchar(255) NOT NULL,
	`content` text NOT NULL,
	`author_user_id` char(36) NOT NULL,
	`view_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `kb_articles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kb_categories` (
	`id` char(36) NOT NULL,
	`company_id` char(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`parent_category_id` char(36),
	CONSTRAINT `kb_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `kb_articles` ADD CONSTRAINT `kb_articles_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kb_articles` ADD CONSTRAINT `kb_articles_category_id_kb_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `kb_categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kb_articles` ADD CONSTRAINT `kb_articles_author_user_id_users_id_fk` FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kb_categories` ADD CONSTRAINT `kb_categories_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `kb_categories` ADD CONSTRAINT `kb_categories_parent_category_id_kb_categories_id_fk` FOREIGN KEY (`parent_category_id`) REFERENCES `kb_categories`(`id`) ON DELETE no action ON UPDATE no action;