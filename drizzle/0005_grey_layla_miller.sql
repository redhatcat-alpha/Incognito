PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_replies` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`post_id` text NOT NULL,
	`author_id` text NOT NULL,
	`floor_no` integer DEFAULT 0 NOT NULL,
	`body` text NOT NULL,
	`quote_reply_id` text,
	`status` text DEFAULT 'published' NOT NULL,
	`up_count` integer DEFAULT 0 NOT NULL,
	`down_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `anonymous_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_replies`("id", "public_id", "post_id", "author_id", "floor_no", "body", "quote_reply_id", "status", "up_count", "down_count", "created_at", "updated_at") SELECT "id", "public_id", "post_id", "author_id", "floor_no", "body", "quote_reply_id", "status", "up_count", "down_count", "created_at", "updated_at" FROM `replies`;--> statement-breakpoint
DROP TABLE `replies`;--> statement-breakpoint
ALTER TABLE `__new_replies` RENAME TO `replies`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `uq_replies_public_id` ON `replies` (`public_id`);--> statement-breakpoint
CREATE INDEX `idx_replies_post_status_floor` ON `replies` (`post_id`,`status`,`floor_no`);