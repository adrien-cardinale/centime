ALTER TABLE `budgets` ADD `kind` text DEFAULT 'envelope' NOT NULL;--> statement-breakpoint
ALTER TABLE `budgets` ADD `due_day` integer;--> statement-breakpoint
ALTER TABLE `budgets` ADD `due_month` integer;--> statement-breakpoint
ALTER TABLE `budgets` ADD `end_date` text;--> statement-breakpoint
INSERT INTO `budgets` (`id`, `created_at`, `updated_at`, `deleted_at`, `kind`, `category_id`, `amount`, `period`, `rollover`, `start_date`, `due_day`, `due_month`, `end_date`)
SELECT `id`, `created_at`, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), `deleted_at`, CASE WHEN `expected_amount` > 0 THEN 'income' ELSE 'expense' END, `category_id`, abs(`expected_amount`), `periodicity`, 0, `start_date`, `due_day`, `due_month`, `end_date`
FROM `fixed_items` WHERE `category_id` IS NOT NULL;--> statement-breakpoint
DROP TABLE `fixed_items`;
