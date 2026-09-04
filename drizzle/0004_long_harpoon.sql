CREATE TABLE `announcement_dismissals` (
	`id` text PRIMARY KEY NOT NULL,
	`announcement_id` text NOT NULL,
	`user_id` text NOT NULL,
	`dismissed_at` integer NOT NULL,
	FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `registered_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_announcement_dismissals` ON `announcement_dismissals` (`announcement_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_announcement_dismissals_user` ON `announcement_dismissals` (`user_id`,`dismissed_at`);