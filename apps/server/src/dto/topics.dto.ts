import { z } from "zod";
import type { topics } from "@/db/schema/topic.schema";

export type Topic = typeof topics.$inferSelect;

export const topicIdParamsSchema = z.object({
	id: z.string().uuid(),
});

export const createTopicSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().min(1).max(500),
});

export type CreateTopicInput = z.infer<typeof createTopicSchema>;

export const updateTopicSchema = z
	.object({
		name: z.string().min(1).max(100).optional(),
		description: z.string().min(1).max(500).optional(),
	})
	.refine((data) => Object.keys(data).length > 0, {
		message: "At least one field must be provided",
	});
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;
