CREATE TABLE `announcements` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text DEFAULT 'global' NOT NULL,
	`board_id` text,
	`level` text DEFAULT 'info' NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`starts_at` integer NOT NULL,
	`ends_at` integer,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `anonymous_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer NOT NULL,
	`revoked_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `anonymous_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_anonymous_sessions_token_hash` ON `anonymous_sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_anonymous_sessions_user_id` ON `anonymous_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `anonymous_users` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`avatar_seed` text NOT NULL,
	`created_at` integer NOT NULL,
	`deletion_requested_at` integer
);
--> statement-breakpoint
CREATE TABLE `boards` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`icon` text DEFAULT 'message-circle' NOT NULL,
	`accent` text DEFAULT '#d9ff57' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_boards_slug` ON `boards` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_boards_status_sort_order` ON `boards` (`status`,`sort_order`);--> statement-breakpoint
CREATE TABLE `browsing_history` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`post_id` text NOT NULL,
	`max_read_floor` integer DEFAULT 1 NOT NULL,
	`anchor_reply_id` text,
	`last_viewed_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `anonymous_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_browsing_history_user_post` ON `browsing_history` (`user_id`,`post_id`);--> statement-breakpoint
CREATE INDEX `idx_browsing_history_user_last_viewed` ON `browsing_history` (`user_id`,`last_viewed_at`);--> statement-breakpoint
CREATE TABLE `post_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`tag_id` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_post_tags_post_tag` ON `post_tags` (`post_id`,`tag_id`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`board_id` text NOT NULL,
	`author_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`next_floor_no` integer DEFAULT 2 NOT NULL,
	`up_count` integer DEFAULT 0 NOT NULL,
	`down_count` integer DEFAULT 0 NOT NULL,
	`reply_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`last_replied_at` integer NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`author_id`) REFERENCES `anonymous_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_posts_public_id` ON `posts` (`public_id`);--> statement-breakpoint
CREATE INDEX `idx_posts_board_status_last_reply` ON `posts` (`board_id`,`status`,`last_replied_at`);--> statement-breakpoint
CREATE INDEX `idx_posts_status_created_at` ON `posts` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `replies` (
	`id` text PRIMARY KEY NOT NULL,
	`public_id` text NOT NULL,
	`post_id` text NOT NULL,
	`author_id` text NOT NULL,
	`floor_no` integer NOT NULL,
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
CREATE UNIQUE INDEX `uq_replies_public_id` ON `replies` (`public_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_replies_post_floor` ON `replies` (`post_id`,`floor_no`);--> statement-breakpoint
CREATE INDEX `idx_replies_post_status_floor` ON `replies` (`post_id`,`status`,`floor_no`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`id` text PRIMARY KEY NOT NULL,
	`version` integer NOT NULL,
	`settings_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#d9ff57' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_tags_slug` ON `tags` (`slug`);--> statement-breakpoint
CREATE TABLE `thread_aliases` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` text NOT NULL,
	`user_id` text NOT NULL,
	`alias_index` integer NOT NULL,
	`avatar_seed` text NOT NULL,
	FOREIGN KEY (`post_id`) REFERENCES `posts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `anonymous_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_thread_aliases_post_user` ON `thread_aliases` (`post_id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `uq_thread_aliases_post_index` ON `thread_aliases` (`post_id`,`alias_index`);--> statement-breakpoint
CREATE TABLE `votes` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`value` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `anonymous_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_votes_user_target` ON `votes` (`user_id`,`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `idx_votes_target` ON `votes` (`target_type`,`target_id`);