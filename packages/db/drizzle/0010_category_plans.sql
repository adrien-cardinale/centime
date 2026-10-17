PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TEMP TABLE `fixed_item_moves` AS
SELECT `f`.`id` AS `fixed_item_id`, `f`.`name` AS `name`, `c`.`theme_id` AS `theme_id`, COALESCE(`c`.`color`, '#4a84c4') AS `color`
FROM `fixed_items` `f` LEFT JOIN `categories` `c` ON `c`.`id` = `f`.`category_id` AND `c`.`deleted_at` IS NULL
WHERE `f`.`deleted_at` IS NULL AND (
	`c`.`id` IS NULL
	OR EXISTS (SELECT 1 FROM `budgets` `b` WHERE `b`.`category_id` = `f`.`category_id` AND `b`.`deleted_at` IS NULL)
	OR EXISTS (
		SELECT 1 FROM `fixed_items` `o`
		WHERE `o`.`category_id` = `f`.`category_id` AND `o`.`deleted_at` IS NULL
		AND (`o`.`created_at` < `f`.`created_at` OR (`o`.`created_at` = `f`.`created_at` AND `o`.`id` < `f`.`id`))
	)
);--> statement-breakpoint
INSERT INTO `categories` (`id`, `created_at`, `updated_at`, `name`, `color`, `theme_id`)
SELECT `fixed_item_id`, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), `name`, `color`, `theme_id` FROM `fixed_item_moves`;--> statement-breakpoint
UPDATE `fixed_items` SET `category_id` = `id`, `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), `sync_version` = NULL
WHERE `id` IN (SELECT `fixed_item_id` FROM `fixed_item_moves`);--> statement-breakpoint
DROP TABLE `fixed_item_moves`;--> statement-breakpoint
UPDATE `transactions` SET `category_id` = (SELECT `f`.`category_id` FROM `fixed_items` `f` WHERE `f`.`id` = `transactions`.`fixed_item_id`), `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), `sync_version` = NULL
WHERE `deleted_at` IS NULL AND `is_split` = 0
AND `fixed_item_id` IN (SELECT `id` FROM `fixed_items` WHERE `deleted_at` IS NULL)
AND `category_id` IS NOT (SELECT `f`.`category_id` FROM `fixed_items` `f` WHERE `f`.`id` = `transactions`.`fixed_item_id`);--> statement-breakpoint
UPDATE `rules` SET `category_id` = (SELECT `f`.`category_id` FROM `fixed_items` `f` WHERE `f`.`id` = `rules`.`fixed_item_id`), `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), `sync_version` = NULL
WHERE `deleted_at` IS NULL
AND `fixed_item_id` IN (SELECT `id` FROM `fixed_items` WHERE `deleted_at` IS NULL)
AND `category_id` IS NOT (SELECT `f`.`category_id` FROM `fixed_items` `f` WHERE `f`.`id` = `rules`.`fixed_item_id`);--> statement-breakpoint
UPDATE `rules` SET `deleted_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), `sync_version` = NULL
WHERE `deleted_at` IS NULL AND `category_id` IS NULL AND `mark_as_transfer` = 0;--> statement-breakpoint
CREATE TABLE `__new_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`sync_version` integer,
	`pattern` text NOT NULL,
	`match_kind` text NOT NULL,
	`field` text NOT NULL,
	`category_id` text,
	`mark_as_transfer` integer DEFAULT false NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_rules`("id", "created_at", "updated_at", "deleted_at", "sync_version", "pattern", "match_kind", "field", "category_id", "mark_as_transfer", "priority") SELECT "id", "created_at", "updated_at", "deleted_at", "sync_version", "pattern", "match_kind", "field", "category_id", "mark_as_transfer", "priority" FROM `rules`;--> statement-breakpoint
DROP TABLE `rules`;--> statement-breakpoint
ALTER TABLE `__new_rules` RENAME TO `rules`;--> statement-breakpoint
CREATE INDEX `rules_sync_version_idx` ON `rules` (`sync_version`);--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`sync_version` integer,
	`account_id` text NOT NULL,
	`booking_date` text NOT NULL,
	`value_date` text,
	`raw_label` text NOT NULL,
	`merchant` text,
	`provider_category` text,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`category_id` text,
	`is_transfer` integer DEFAULT false NOT NULL,
	`is_split` integer DEFAULT false NOT NULL,
	`import_id` text,
	`source_ref` text,
	`fingerprint` text NOT NULL,
	`balance_after` real,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "created_at", "updated_at", "deleted_at", "sync_version", "account_id", "booking_date", "value_date", "raw_label", "merchant", "provider_category", "amount", "currency", "status", "category_id", "is_transfer", "is_split", "import_id", "source_ref", "fingerprint", "balance_after") SELECT "id", "created_at", "updated_at", "deleted_at", "sync_version", "account_id", "booking_date", "value_date", "raw_label", "merchant", "provider_category", "amount", "currency", "status", "category_id", "is_transfer", "is_split", "import_id", "source_ref", "fingerprint", "balance_after" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE INDEX `transactions_account_id_idx` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `transactions_booking_date_idx` ON `transactions` (`booking_date`);--> statement-breakpoint
CREATE INDEX `transactions_category_id_idx` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_fingerprint_idx` ON `transactions` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `transactions_sync_version_idx` ON `transactions` (`sync_version`);--> statement-breakpoint
PRAGMA foreign_keys=ON;