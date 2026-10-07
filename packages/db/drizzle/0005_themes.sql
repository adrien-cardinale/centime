CREATE TABLE `themes` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`sync_version` integer,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`icon` text
);
--> statement-breakpoint
CREATE INDEX `themes_sync_version_idx` ON `themes` (`sync_version`);--> statement-breakpoint
ALTER TABLE `categories` ADD `theme_id` text REFERENCES themes(id);--> statement-breakpoint
CREATE INDEX `categories_theme_id_idx` ON `categories` (`theme_id`);