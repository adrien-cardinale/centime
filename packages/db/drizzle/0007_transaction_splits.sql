CREATE TABLE `transaction_splits` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`sync_version` integer,
	`transaction_id` text NOT NULL,
	`category_id` text,
	`amount` real NOT NULL,
	`note` text,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transaction_splits_transaction_id_idx` ON `transaction_splits` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `transaction_splits_category_id_idx` ON `transaction_splits` (`category_id`);--> statement-breakpoint
CREATE INDEX `transaction_splits_sync_version_idx` ON `transaction_splits` (`sync_version`);--> statement-breakpoint
ALTER TABLE `transactions` ADD `is_split` integer DEFAULT false NOT NULL;