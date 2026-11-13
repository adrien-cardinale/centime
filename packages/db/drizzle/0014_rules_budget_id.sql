ALTER TABLE `rules` ADD `budget_id` text;--> statement-breakpoint
CREATE INDEX `rules_budget_id_idx` ON `rules` (`budget_id`);--> statement-breakpoint
UPDATE `rules` SET `budget_id` = (SELECT `b`.`id` FROM `budgets` `b` WHERE `b`.`category_id` = `rules`.`category_id` AND `b`.`deleted_at` IS NULL ORDER BY `b`.`created_at` DESC LIMIT 1), `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), `sync_version` = NULL
WHERE `deleted_at` IS NULL AND `mark_as_transfer` = 0 AND `priority` = 60 AND `category_id` IS NOT NULL
AND EXISTS (SELECT 1 FROM `budgets` `b` WHERE `b`.`category_id` = `rules`.`category_id` AND `b`.`deleted_at` IS NULL)
AND `id` = (SELECT `r`.`id` FROM `rules` `r` WHERE `r`.`category_id` = `rules`.`category_id` AND `r`.`mark_as_transfer` = 0 AND `r`.`deleted_at` IS NULL ORDER BY `r`.`created_at` LIMIT 1);--> statement-breakpoint
UPDATE `rules` SET `deleted_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), `updated_at` = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), `sync_version` = NULL
WHERE `deleted_at` IS NULL AND `category_id` IS NULL AND `mark_as_transfer` = 0;
