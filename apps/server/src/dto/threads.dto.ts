import { z } from "zod";
import type { threads } from "@/db/schema/thread.schema";

export type Thread = typeof threads.$inferSelect;

//threadid,topic id ,create thread,update  parameter schema
export const threadIdParamsSchema = z.object({
	id: z.string().uuid({ message: "Invalid Thread ID format (must be UUID)" }),
});
export type ThreadIdParams = z.infer<typeof threadIdParamsSchema>;

export const topicIdParamsSchema = z.object({
	topicId: z
		.string()
		.uuid({ message: "Invalid Topic ID format (must be UUID)" }),
});
export type TopicIdParams = z.infer<typeof topicIdParamsSchema>;

export const createThreadSchema = z.object({
	threadTitle: z
		.string()
		.min(1, "Thread title cannot be empty")
		.max(255, "Thread title is too long"),
	topicId: z.string().uuid({ message: "Invalid Topic ID format" }),
});
export type CreateThreadInput = z.infer<typeof createThreadSchema>;

//update thread
export const updateThreadSchema = z
	.object({
		threadTitle: z
			.string()
			.min(1, "Thread title cannot be empty")
			.max(255, "Thread title is too long")
			.optional(),
		// optionally allow moving thread to another topic
		topicId: z.string().uuid({ message: "Invalid Topic ID format" }).optional(),
	})

	//checking object is empty or not
	.refine(
		(data) => {
			//checking one key should present in obj it loops all the key
			return Object.keys(data).some(
				(key) => data[key as keyof typeof data] !== undefined,
			);
		},
		{
			message:
				"At least one field (threadTitle or topicId) must be provided for update",
		},
	);
export type UpdateThreadInput = z.infer<typeof updateThreadSchema>;

//PAGINATION QUERY SCHEMA
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export const paginationQuerySchema = z.object({
	page: z.preprocess(
		(val) => (val ? Number(val) : 1),
		z.number().int().min(1, "Page number must be 1 or greater"),
	),
	limit: z.preprocess(
		(val) => (val ? Number(val) : DEFAULT_LIMIT),
		z
			.number()
			.int()
			.min(1, "Limit must be 1 or greater")
			.max(MAX_LIMIT, `Limit cannot exceed ${MAX_LIMIT}`),
	),
});
export type PaginationQueryInput = z.infer<typeof paginationQuerySchema>;
