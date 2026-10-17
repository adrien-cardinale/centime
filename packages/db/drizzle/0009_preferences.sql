CREATE TABLE `preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`sync_version` integer,
	`key` text NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `preferences_key_unique` ON `preferences` (`key`);--> statement-breakpoint
CREATE INDEX `preferences_sync_version_idx` ON `preferences` (`sync_version`);--> statement-breakpoint
INSERT INTO `preferences` (`id`, `created_at`, `updated_at`, `key`, `value`)
SELECT '64a2e8cc-ced4-4753-bacf-34e21c2e3d97', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), `key`, `value`
FROM `settings` WHERE `key` = 'receipts.ai';--> statement-breakpoint
DELETE FROM `settings` WHERE `key` = 'receipts.ai';
