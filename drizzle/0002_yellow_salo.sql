CREATE TABLE `registered_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `registered_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_registered_sessions_token_hash` ON `registered_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_registered_sessions_user_id` ON `registered_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `registered_users` (
	`id` text PRIMARY KEY NOT NULL,
	`uid` integer NOT NULL,
	`username` text NOT NULL,
	`pass_hash` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`id`) REFERENCES `anonymous_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_registered_users_uid` ON `registered_users` (`uid`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_registered_users_username` ON `registered_users` (`username`);