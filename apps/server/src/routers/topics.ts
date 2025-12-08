import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { DrizzleClient } from "@/db/index";
import { topics as topicsTable } from "@/db/schema/topic.schema";
import {
	createTopicSchema,
	topicIdParamsSchema,
	updateTopicSchema,
} from "@/dto/topics.dto";
import { authenticateUser } from "./auth";

export async function topicRoutes(fastify: FastifyInstance) {
	fastify.post(
		"/topics",
		{ preHandler: authenticateUser },
		async (request, reply) => {
			const userId = request.userId;
			if (!userId)
				return reply
					.status(401)
					.send({ success: false, error: "Unauthorized" });

			const parsed = createTopicSchema.safeParse(request.body);
			if (!parsed.success) {
				return reply
					.status(400)
					.send({ success: false, error: "Invalid request body" });
			}
			const { name, description } = parsed.data;

			// Ensure user exists
			const user = await DrizzleClient.query.users.findFirst({
				where: (u, { eq }) => eq(u.id, userId),
			});
			if (!user)
				return reply
					.status(404)
					.send({ success: false, error: "User not found" });

			type NewTopic = typeof topicsTable.$inferInsert;
			const toInsert: NewTopic = {
				topicName: name,
				topicDescription: description,
				createdBy: userId,
			};
			try {
				const [topic] = await DrizzleClient.insert(topicsTable)
					.values(toInsert)
					.returning();
				return reply.status(201).send({ success: true, topic });
			} catch (error) {
				fastify.log.error({ err: error }, "Failed to create topic");
				return reply
					.status(500)
					.send({ success: false, error: "Failed to create topic" });
			}
		},
	);

	fastify.patch(
		"/topics/:id",
		{ preHandler: authenticateUser },
		async (request, reply) => {
			const userId = request.userId;
			if (!userId)
				return reply
					.status(401)
					.send({ success: false, error: "Unauthorized" });

			const params = topicIdParamsSchema.safeParse(request.params);
			if (!params.success)
				return reply
					.status(400)
					.send({ success: false, error: "Invalid topic id" });
			const body = updateTopicSchema.safeParse(request.body);
			if (!body.success)
				return reply
					.status(400)
					.send({ success: false, error: "Invalid request body" });

			const topic = await DrizzleClient.query.topics.findFirst({
				where: (t, { eq }) => eq(t.id, params.data.id),
			});
			if (!topic)
				return reply
					.status(404)
					.send({ success: false, error: "Topic not found" });
			if (topic.createdBy !== userId)
				return reply.status(403).send({ success: false, error: "Forbidden" });

			const updates: Partial<typeof topicsTable.$inferInsert> = {
				topicName: body.data.name ?? undefined,
				topicDescription: body.data.description ?? undefined,
				updatedBy: userId,
				updatedAt: new Date().toISOString(),
			};

			try {
				const [updated] = await DrizzleClient.update(topicsTable)
					.set(updates)
					.where(eq(topicsTable.id, params.data.id))
					.returning();
				return reply.status(200).send({ success: true, topic: updated });
			} catch (error) {
				fastify.log.error({ err: error }, "Failed to update topic");
				return reply
					.status(500)
					.send({ success: false, error: "Failed to update topic" });
			}
		},
	);

	fastify.delete(
		"/topics/:id",
		{ preHandler: authenticateUser },
		async (request, reply) => {
			const userId = request.userId;
			if (!userId)
				return reply
					.status(401)
					.send({ success: false, error: "Unauthorized" });
			const params = topicIdParamsSchema.safeParse(request.params);
			if (!params.success)
				return reply
					.status(400)
					.send({ success: false, error: "Invalid topic id" });

			const topic = await DrizzleClient.query.topics.findFirst({
				where: (t, { eq }) => eq(t.id, params.data.id),
			});
			if (!topic)
				return reply
					.status(404)
					.send({ success: false, error: "Topic not found" });
			if (topic.createdBy !== userId)
				return reply.status(403).send({ success: false, error: "Forbidden" });

			try {
				await DrizzleClient.delete(topicsTable).where(
					eq(topicsTable.id, params.data.id),
				);
				return reply.status(204).send();
			} catch (error) {
				fastify.log.error({ err: error }, "Failed to delete topic");
				return reply
					.status(500)
					.send({ success: false, error: "Failed to delete topic" });
			}
		},
	);
}
