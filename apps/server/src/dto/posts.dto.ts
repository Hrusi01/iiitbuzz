import { z } from "zod";
import type { posts } from "@/db/schema/post.schema";

export type Post = typeof posts.$inferSelect;

export const createPostSchema = z.object({
	threadId: z.string().uuid(),
	content: z.string().min(1, "Content is required").max(10_000),
});
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const updatePostSchema = z
	.object({
		content: z.string().min(1).max(10_000).optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided",
	});
export type UpdatePostInput = z.infer<typeof updatePostSchema>;

export const postIdParamsSchema = z.object({
	id: z.string().uuid(),
});

export const threadIdParamsSchema = z.object({
    threadId: z.string().uuid("Invalid Thread ID format (must be UUID)"),
});
export type ThreadIdParamsInput = z.infer<typeof threadIdParamsSchema>;
