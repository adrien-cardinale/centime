CREATE TABLE `receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`deleted_at` text,
	`sync_version` integer,
	`account_id` text NOT NULL,
	`transaction_id` text,
	`captured_at` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`merchant` text,
	`total` real,
	`receipt_date` text,
	`note` text,
	`lines_json` text,
	`status` text NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `receipts_account_id_idx` ON `receipts` (`account_id`);--> statement-breakpoint
CREATE INDEX `receipts_transaction_id_idx` ON `receipts` (`transaction_id`);--> statement-breakpoint
CREATE INDEX `receipts_status_idx` ON `receipts` (`status`);--> statement-breakpoint
CREATE INDEX `receipts_sync_version_idx` ON `receipts` (`sync_version`);