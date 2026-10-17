UPDATE `budgets` SET `kind` = 'envelope', `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), `sync_version` = NULL WHERE `kind` = 'expense';--> statement-breakpoint
ALTER TABLE `budgets` DROP COLUMN `due_day`;--> statement-breakpoint
ALTER TABLE `budgets` DROP COLUMN `due_month`;--> statement-breakpoint
ALTER TABLE `budgets` DROP COLUMN `end_date`;