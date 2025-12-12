import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { DrizzleClient } from "@/db/index";
import { posts as postsTable } from "@/db/schema/post.schema";
import { users as usersTable } from "@/db/schema/user.schema";
import {
	createPostSchema,
	postIdParamsSchema,
	threadIdParamsSchema,
	updatePostSchema,
} from "@/dto/posts.dto";
import { authenticateUser } from "./auth";

export async function postRoutes(fastify: FastifyInstance) {
	// Create post
	fastify.post(
		"/posts",
		{ preHandler: authenticateUser },
		async (request, reply) => {
			const authUserId = request.userId;
			if (!authUserId)
				return reply
					.status(401)
					.send({ success: false, error: "Unauthorized" });
			const body = createPostSchema.safeParse(request.body);
			if (!body.success)
				return reply
					.status(400)
					.send({ success: false, error: "Invalid request body" });

			// Ensure thread exists
			const thread = await DrizzleClient.query.threads.findFirst({
				where: (t, { eq }) => eq(t.id, body.data.threadId),
			});
			if (!thread)
				return reply
					.status(404)
					.send({ success: false, error: "Thread not found" });

			const toInsert: typeof postsTable.$inferInsert = {
				threadId: body.data.threadId,
				content: body.data.content,
				createdBy: authUserId,
			};
			const [post] = await DrizzleClient.insert(postsTable)
				.values(toInsert)
				.returning();
			return reply.status(201).send({ success: true, post });
		},
	);

	// Update post
	fastify.patch(
		"/posts/:id",
		{ preHandler: authenticateUser },
		async (request, reply) => {
			const authUserId = request.userId;
			if (!authUserId)
				return reply
					.status(401)
					.send({ success: false, error: "Unauthorized" });
			const params = postIdParamsSchema.safeParse(request.params);
			if (!params.success)
				return reply
					.status(400)
					.send({ success: false, error: "Invalid post id" });
			const body = updatePostSchema.safeParse(request.body);
			if (!body.success)
				return reply
					.status(400)
					.send({ success: false, error: "Invalid request body" });

			const post = await DrizzleClient.query.posts.findFirst({
				where: (p, { eq }) => eq(p.id, params.data.id),
			});
			if (!post)
				return reply
					.status(404)
					.send({ success: false, error: "Post not found" });
			if (post.createdBy !== authUserId)
				return reply.status(403).send({ success: false, error: "Forbidden" });

			const updates: Partial<typeof postsTable.$inferInsert> = {
				content: body.data.content ?? undefined,
				updatedBy: authUserId,
				updatedAt: new Date().toISOString(),
			};
			const [updated] = await DrizzleClient.update(postsTable)
				.set(updates)
				.where(eq(postsTable.id, params.data.id))
				.returning();
			return reply.status(200).send({ success: true, post: updated });
		},
	);

	// Delete post
	fastify.delete(
		"/posts/:id",
		{ preHandler: authenticateUser },
		async (request, reply) => {
			const authUserId = request.userId;
			if (!authUserId)
				return reply
					.status(401)
					.send({ success: false, error: "Unauthorized" });
			const params = postIdParamsSchema.safeParse(request.params);
			if (!params.success)
				return reply
					.status(400)
					.send({ success: false, error: "Invalid post id" });
			const post = await DrizzleClient.query.posts.findFirst({
				where: (p, { eq }) => eq(p.id, params.data.id),
			});
			if (!post)
				return reply
					.status(404)
					.send({ success: false, error: "Post not found" });
			if (post.createdBy !== authUserId)
				return reply.status(403).send({ success: false, error: "Forbidden" });
			await DrizzleClient.delete(postsTable).where(
				eq(postsTable.id, params.data.id),
			);
			return reply.status(204).send();
		},
	);

	//GET /posts/thread/<id>?page=1&limit=10
	fastify.get("/posts/thread/:threadId", async (request, reply) => {
		const params = threadIdParamsSchema.safeParse(request.params);

		if (!params.success)
			return reply
				.status(400)
				.send({ success: false, error: "Invalid thread id" });

		const threadId = params.data.threadId;

		interface PaginationQuery {
			page?: string;
			limit?: string;
		}

		const { page: rawPage, limit: rawLimit } = (request.query ??
			{}) as PaginationQuery;

		const page = Math.max(Number(rawPage ?? 1), 1);
		const limit = Math.max(Number(rawLimit ?? 10), 1);
		const offset = (page - 1) * limit;

		try {
			const posts = await DrizzleClient.select({
				id: postsTable.id,
				content: postsTable.content,
				vote: postsTable.vote,
				createdAt: postsTable.createdAt,
				updatedAt: postsTable.updatedAt,
				createdBy: postsTable.createdBy,
				creatorUsername: usersTable.username,
			})
				.from(postsTable)
				.leftJoin(usersTable, eq(postsTable.createdBy, usersTable.id))
				.where(
					and(eq(postsTable.threadId, threadId), isNull(postsTable.deletedAt)),
				)
				.orderBy(desc(postsTable.createdAt))
				.limit(limit)
				.offset(offset);

			const totalCountResult = await DrizzleClient.select({
				count: sql<number>`COUNT(*)`,
			})
				.from(postsTable)
				.where(
					and(eq(postsTable.threadId, threadId), isNull(postsTable.deletedAt)),
				);

			const total = Number(totalCountResult[0].count);
			const totalPages = Math.ceil(total / limit);

			return reply.status(200).send({
				success: true,
				pagination: {
					page,
					limit,
					total,
					totalPages,
					hasNext: page < totalPages,
					hasPrev: page > 1,
				},
				posts,
			});
		} catch (error) {
			fastify.log.error({ err: error }, "Failed to fetch posts by thread ID");
			return reply
				.status(500)
				.send({ success: false, error: "Failed to fetch posts" });
		}
	});

	// GET /posts/:id read single post by id
	fastify.get("/posts/:id", async (request, reply) => {
		const params = postIdParamsSchema.safeParse(request.params);
		if (!params.success)
			return reply
				.status(400)
				.send({ success: false, error: "Invalid post id" });

		try {
			const result = await DrizzleClient.select({
				id: postsTable.id,
				content: postsTable.content,
				vote: postsTable.vote,
				threadId: postsTable.threadId,
				createdAt: postsTable.createdAt,
				updatedAt: postsTable.updatedAt,

				creatorUsername: usersTable.username,
			})
				.from(postsTable)
				.where(
					and(eq(postsTable.id, params.data.id), isNull(postsTable.deletedAt)),
				)
				.leftJoin(usersTable, eq(postsTable.createdBy, usersTable.id))
				.limit(1);

			const post = result[0];

			if (!post) {
				return reply
					.status(404)
					.send({ success: false, error: "Post not found or deleted" });
			}

			return reply.status(200).send({ success: true, post });
		} catch (error) {
			fastify.log.error({ err: error }, "Failed to fetch single post");
			return reply
				.status(500)
				.send({ success: false, error: "Failed to fetch post" });
		}
	});
}

//ci fixing
