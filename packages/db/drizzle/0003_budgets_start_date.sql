ALTER TABLE `budgets` ADD `start_date` text DEFAULT '1970-01-01' NOT NULL;--> statement-breakpoint
UPDATE `budgets` SET `start_date` = substr(`created_at`, 1, 10);
