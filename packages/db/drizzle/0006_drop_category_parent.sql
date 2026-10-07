PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TEMP TABLE `category_roots` AS
WITH RECURSIVE `walk`(`id`, `root_id`, `depth`) AS (
	SELECT `id`, `id`, 0 FROM `categories` WHERE `deleted_at` IS NULL AND `parent_id` IS NULL
	UNION ALL
	SELECT `c`.`id`, `w`.`root_id`, `w`.`depth` + 1 FROM `categories` `c` JOIN `walk` `w` ON `c`.`parent_id` = `w`.`id` WHERE `c`.`deleted_at` IS NULL AND `w`.`depth` < 20
)
SELECT `id`, `root_id` FROM `walk`;--> statement-breakpoint
INSERT INTO `themes` (`id`, `created_at`, `updated_at`, `name`, `color`, `icon`)
SELECT `id`, `created_at`, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), `name`, `color`, `icon` FROM `categories`
WHERE `id` IN (SELECT `root_id` FROM `category_roots` WHERE `id` <> `root_id`);--> statement-breakpoint
UPDATE `categories` SET `theme_id` = (SELECT `root_id` FROM `category_roots` WHERE `category_roots`.`id` = `categories`.`id`), `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), `sync_version` = NULL
WHERE `id` IN (SELECT `id` FROM `category_roots` WHERE `id` <> `root_id`);--> statement-breakpoint
UPDATE `categories` SET `deleted_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), `sync_version` = NULL
WHERE `id` IN (SELECT `root_id` FROM `category_roots` WHERE `id` <> `root_id`)
AND NOT EXISTS (SELECT 1 FROM `transactions` WHERE `category_id` = `categories`.`id` AND `deleted_at` IS NULL)
AND NOT EXISTS (SELECT 1 FROM `rules` WHERE `category_id` = `categories`.`id` AND `deleted_at` IS NULL)
AND NOT EXISTS (SELECT 1 FROM `fixed_items` WHERE `category_id` = `categories`.`id` AND `deleted_at` IS NULL)
AND NOT EXISTS (SELECT 1 FROM `budgets` WHERE `category_id` = `categories`.`id` AND `deleted_at` IS NULL);--> statement-breakpoint
UPDATE `categories` SET `theme_id` = `id`, `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), `sync_version` = NULL
WHERE `deleted_at` IS NULL AND `id` IN (SELECT `root_id` FROM `category_roots` WHERE `id` <> `root_id`);--> statement-breakpoint
DROP TABLE `category_roots`;--> statement-breakpoint
CREATE TABLE `__new_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`sync_version` integer,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`icon` text,
	`theme_id` text,
	FOREIGN KEY (`theme_id`) REFERENCES `themes`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_categories`("id", "created_at", "updated_at", "deleted_at", "sync_version", "name", "color", "icon", "theme_id") SELECT "id", "created_at", "updated_at", "deleted_at", "sync_version", "name", "color", "icon", "theme_id" FROM `categories`;--> statement-breakpoint
DROP TABLE `categories`;--> statement-breakpoint
ALTER TABLE `__new_categories` RENAME TO `categories`;--> statement-breakpoint
CREATE INDEX `categories_sync_version_idx` ON `categories` (`sync_version`);--> statement-breakpoint
CREATE INDEX `categories_theme_id_idx` ON `categories` (`theme_id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;