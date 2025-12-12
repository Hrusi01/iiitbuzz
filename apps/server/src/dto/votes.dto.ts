import { z } from "zod";

export const postIdParamsSchema = z.object({
	id: z.string().uuid(),
});
export const votePayloadSchema = z.object({
	voteValue: z.literal(1).or(z.literal(-1)).or(z.literal(0)),
});
export type VotePayloadInput = z.infer<typeof votePayloadSchema>;
