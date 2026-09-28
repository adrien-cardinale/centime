CREATE TABLE `api_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`label` text NOT NULL,
	`created_at` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_hash_unique` ON `api_tokens` (`token_hash`);--> statement-breakpoint
ALTER TABLE `accounts` ADD `sync_version` integer;--> statement-breakpoint
CREATE INDEX `accounts_sync_version_idx` ON `accounts` (`sync_version`);--> statement-breakpoint
ALTER TABLE `budgets` ADD `sync_version` integer;--> statement-breakpoint
CREATE INDEX `budgets_sync_version_idx` ON `budgets` (`sync_version`);--> statement-breakpoint
ALTER TABLE `categories` ADD `sync_version` integer;--> statement-breakpoint
CREATE INDEX `categories_sync_version_idx` ON `categories` (`sync_version`);--> statement-breakpoint
ALTER TABLE `csv_profiles` ADD `sync_version` integer;--> statement-breakpoint
CREATE INDEX `csv_profiles_sync_version_idx` ON `csv_profiles` (`sync_version`);--> statement-breakpoint
ALTER TABLE `fixed_items` ADD `sync_version` integer;--> statement-breakpoint
CREATE INDEX `fixed_items_sync_version_idx` ON `fixed_items` (`sync_version`);--> statement-breakpoint
ALTER TABLE `imports` ADD `sync_version` integer;--> statement-breakpoint
CREATE INDEX `imports_sync_version_idx` ON `imports` (`sync_version`);--> statement-breakpoint
ALTER TABLE `rules` ADD `sync_version` integer;--> statement-breakpoint
CREATE INDEX `rules_sync_version_idx` ON `rules` (`sync_version`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `sync_version` integer;--> statement-breakpoint
CREATE INDEX `transactions_sync_version_idx` ON `transactions` (`sync_version`);