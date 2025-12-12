import { z } from "zod";

export const searchQuerySchema = z.object({
	q: z.string().min(3, "Search query must be at least 3 characters long."),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
