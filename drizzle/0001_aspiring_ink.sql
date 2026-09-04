CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`details` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`resolved_at` integer,
	FOREIGN KEY (`reporter_id`) REFERENCES `anonymous_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_reports_reporter_target` ON `reports` (`reporter_id`,`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `idx_reports_status_created` ON `reports` (`status`,`created_at`);--> statement-breakpoint
ALTER TABLE `anonymous_users` ADD `history_sync_enabled` integer DEFAULT 1 NOT NULL;