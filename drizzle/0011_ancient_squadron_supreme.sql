CREATE TABLE `media_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`object_key` text NOT NULL,
	`content_type` text NOT NULL,
	`extension` text NOT NULL,
	`size` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`completed_at` integer,
	FOREIGN KEY (`owner_id`) REFERENCES `anonymous_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_media_uploads_owner_created` ON `media_uploads` (`owner_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_media_uploads_status_expiry` ON `media_uploads` (`status`,`expires_at`);