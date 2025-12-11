import { z } from "zod";
import type { threads } from "@/db/schema/thread.schema";

export type Thread = typeof threads.$inferSelect;

//Thread ID Parameter Schema
export const threadIdParamsSchema = z.object({
    id: z.string().uuid({ message: "Invalid Thread ID format (must be UUID)" }),
});
export type ThreadIdParams = z.infer<typeof threadIdParamsSchema>;

//2. Topic ID Parameter Schema (NEWLY ADDED)
export const topicIdParamsSchema = z.object({
    topicId: z.string().uuid({ message: "Invalid Topic ID format (must be UUID)" }),
});
export type TopicIdParams = z.infer<typeof topicIdParamsSchema>;

//3. Create Thread Schema
export const createThreadSchema = z.object({
    threadTitle: z.string().min(1, "Thread title cannot be empty").max(255, "Thread title is too long"),
    topicId: z.string().uuid({ message: "Invalid Topic ID format" }),
});
export type CreateThreadInput = z.infer<typeof createThreadSchema>;

// 4. Update Thread Schema
export const updateThreadSchema = z
    .object({
        threadTitle: z.string().min(1, "Thread title cannot be empty").max(255, "Thread title is too long").optional(),
        // optionally allow moving thread to another topic
        topicId: z.string().uuid({ message: "Invalid Topic ID format" }).optional(),
        // lock/pin handled by separate endpoints in many systems, skip for now
    })
    // Refinement to ensure the update object is not empty
    .refine((data) => {
        // Check if at least one key (threadTitle or topicId) is present
        return Object.keys(data).some(key => data[key as keyof typeof data] !== undefined);
    }, {
        message: "At least one field (threadTitle or topicId) must be provided for update.",
    });
export type UpdateThreadInput = z.infer<typeof updateThreadSchema>;