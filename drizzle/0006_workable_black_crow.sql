PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_announcement_dismissals` (
	`id` text PRIMARY KEY NOT NULL,
	`announcement_id` text NOT NULL,
	`user_id` text NOT NULL,
	`dismissed_at` integer NOT NULL,
	FOREIGN KEY (`announcement_id`) REFERENCES `announcements`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `anonymous_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_announcement_dismissals`("id", "announcement_id", "user_id", "dismissed_at") SELECT "id", "announcement_id", "user_id", "dismissed_at" FROM `announcement_dismissals`;--> statement-breakpoint
DROP TABLE `announcement_dismissals`;--> statement-breakpoint
ALTER TABLE `__new_announcement_dismissals` RENAME TO `announcement_dismissals`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_announcement_dismissals` ON `announcement_dismissals` (`announcement_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_announcement_dismissals_user` ON `announcement_dismissals` (`user_id`,`dismissed_at`);