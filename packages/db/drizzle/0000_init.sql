CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`identifier` text NOT NULL,
	`currency` text DEFAULT 'CHF' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_identifier_unique` ON `accounts` (`identifier`);--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`category_id` text NOT NULL,
	`amount` real NOT NULL,
	`period` text NOT NULL,
	`rollover` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`name` text NOT NULL,
	`color` text NOT NULL,
	`icon` text,
	`parent_id` text,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `csv_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`name` text NOT NULL,
	`config` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `fixed_items` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`name` text NOT NULL,
	`expected_amount` real NOT NULL,
	`periodicity` text NOT NULL,
	`due_day` integer,
	`due_month` integer,
	`category_id` text,
	`start_date` text NOT NULL,
	`end_date` text,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `imports` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`file_name` text NOT NULL,
	`format` text NOT NULL,
	`profile_id` text,
	`imported_at` text NOT NULL,
	`inserted_count` integer DEFAULT 0 NOT NULL,
	`skipped_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `csv_profiles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `rules` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`pattern` text NOT NULL,
	`match_kind` text NOT NULL,
	`field` text NOT NULL,
	`category_id` text,
	`fixed_item_id` text,
	`mark_as_transfer` integer DEFAULT false NOT NULL,
	`priority` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fixed_item_id`) REFERENCES `fixed_items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`account_id` text NOT NULL,
	`booking_date` text NOT NULL,
	`value_date` text,
	`raw_label` text NOT NULL,
	`merchant` text,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`category_id` text,
	`fixed_item_id` text,
	`is_transfer` integer DEFAULT false NOT NULL,
	`import_id` text,
	`source_ref` text,
	`fingerprint` text NOT NULL,
	`balance_after` real,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`fixed_item_id`) REFERENCES `fixed_items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`import_id`) REFERENCES `imports`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transactions_account_id_idx` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `transactions_booking_date_idx` ON `transactions` (`booking_date`);--> statement-breakpoint
CREATE INDEX `transactions_category_id_idx` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_fingerprint_idx` ON `transactions` (`fingerprint`);