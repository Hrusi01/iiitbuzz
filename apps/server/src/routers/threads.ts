import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
	createThreadSchema,
	threadIdParamsSchema,
	updateThreadSchema,
} from "@/dto/threads.dto";
import { DrizzleClient } from "../db/index";
import { threads as threadsTable } from "../db/schema/thread.schema";
import { authenticateUser } from "./auth";

export async function threadRoutes(fastify: FastifyInstance) {
	fastify.post(
		"/threads/new",
		{ preHandler: authenticateUser },
		async (request, reply) => {
			const userid = request.userId;
			if (!userid) {
				return reply
					.status(401)
					.send({ error: "Unauthorized", success: false });
			}
			const user = await DrizzleClient.query.users.findFirst({
				where: (u, { eq }) => eq(u.id, userid),
			});
			if (!user) {
				return reply
					.status(404)
					.send({ error: "User not found", success: false });
			}
			const parsed = createThreadSchema.safeParse(request.body);
			if (!parsed.success) {
				return reply
					.status(400)
					.send({ error: "Invalid request body", success: false });
			}

			const data = parsed.data;

			type NewThread = typeof threadsTable.$inferInsert;
			const toInsert: NewThread = {
				topicId: data.topicId,
				threadTitle: data.threadTitle,
				createdBy: userid,
				viewCount: 0,
			};
			try {
				const [newThread] = await DrizzleClient.insert(threadsTable)
					.values(toInsert)
					.returning();
				return reply.status(201).send({ success: true, thread: newThread });
			} catch (error) {
				fastify.log.error("Error creating thread:", error);
				return reply.status(500).send({
					error: "Failed to create thread",
					success: false,
					details: error instanceof Error ? error.message : "Unknown error",
				});
			}
		},
	);

	fastify.patch(
		"/threads/:id",
		{ preHandler: authenticateUser },
		async (request, reply) => {
			const authUserId = request.userId;
			if (!authUserId)
				return reply
					.status(401)
					.send({ success: false, error: "Unauthorized" });
			const params = threadIdParamsSchema.safeParse(request.params);
			if (!params.success)
				return reply
					.status(400)
					.send({ success: false, error: "Invalid thread id" });
			const body = updateThreadSchema.safeParse(request.body);
			if (!body.success)
				return reply
					.status(400)
					.send({ success: false, error: "Invalid request body" });

			const thread = await DrizzleClient.query.threads.findFirst({
				where: (t, { eq }) => eq(t.id, params.data.id),
			});
			if (!thread)
				return reply
					.status(404)
					.send({ success: false, error: "Thread not found" });
			if (thread.createdBy !== authUserId)
				return reply.status(403).send({ success: false, error: "Forbidden" });

			const updates: Partial<typeof threadsTable.$inferInsert> = {
				threadTitle: body.data.threadTitle ?? undefined,
				topicId: body.data.topicId ?? undefined,
				updatedBy: authUserId,
				updatedAt: new Date().toISOString(),
			};
			const [updated] = await DrizzleClient.update(threadsTable)
				.set(updates)
				.where(eq(threadsTable.id, params.data.id))
				.returning();
			return reply.status(200).send({ success: true, thread: updated });
		},
	);

	fastify.delete(
		"/threads/:id",
		{ preHandler: authenticateUser },
		async (request, reply) => {
			const authUserId = request.userId;
			if (!authUserId)
				return reply
					.status(401)
					.send({ success: false, error: "Unauthorized" });
			const params = threadIdParamsSchema.safeParse(request.params);
			if (!params.success)
				return reply
					.status(400)
					.send({ success: false, error: "Invalid thread id" });
			const thread = await DrizzleClient.query.threads.findFirst({
				where: (t, { eq }) => eq(t.id, params.data.id),
			});
			if (!thread)
				return reply
					.status(404)
					.send({ success: false, error: "Thread not found" });
			if (thread.createdBy !== authUserId)
				return reply.status(403).send({ success: false, error: "Forbidden" });
			await DrizzleClient.delete(threadsTable).where(
				eq(threadsTable.id, params.data.id),
			);
			return reply.status(204).send();
		},
	);
}
