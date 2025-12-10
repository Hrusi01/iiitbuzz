import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { DrizzleClient } from "@/db/index";
import { posts as postsTable } from "@/db/schema/post.schema";
import {
	createPostSchema,
	postIdParamsSchema,
	updatePostSchema,
} from "@/dto/posts.dto";
import { authenticateUser } from "./auth";

export async function postRoutes(fastify: FastifyInstance) {

	fastify.get(
        "/threads/:threadId/posts",
        { preHandler: authenticateUser },
        async (request, reply) => {
            const userId = request.userId;
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized", success: false });
            }
            const user = await DrizzleClient.query.users.findFirst({
                where: (u, { eq }) => eq(u.id, userId),
            });
            if (!user) {
                return reply.status(404).send({ error: "User not found", success: false });
            }
            const { threadId } = request.params as { threadId: string };
            if (!threadId) {
                return reply.status(400).send({ success: false, error: "Invalid thread ID" });
            }
            try {
                const threadPosts = await DrizzleClient.query.posts.findMany({
                    where: (p, { eq }) => eq(p.threadId, threadId),
                    orderBy: (p, { asc }) => [asc(p.createdAt)],
                });
                return reply.status(200).send({ success: true, posts: threadPosts });
            } catch (error) {
                fastify.log.error("Error fetching posts for thread:", error);
                return reply.status(500).send({ success: false, error: "Failed to fetch posts" });
            }
        }
    );
	
    fastify.get(
        "/posts/:id",
        { preHandler: authenticateUser },
        async (request, reply) => {
            const userId = request.userId;
            if (!userId) {
                return reply.status(401).send({ error: "Unauthorized", success: false });
            }
            const user = await DrizzleClient.query.users.findFirst({
                where: (u, { eq }) => eq(u.id, userId),
            });
            if (!user) {
                return reply.status(404).send({ error: "User not found", success: false });
            }
            const { id } = request.params as { id: string };
            if (!id) {
                return reply.status(400).send({ success: false, error: "Invalid post id" });
            }
            try {
                const post = await DrizzleClient.query.posts.findFirst({
                    where: (p, { eq }) => eq(p.id, id),
                });
                if (!post) {
                    return reply.status(404).send({ success: false, error: "Post not found" });
                }
                return reply.status(200).send({ success: true, post });
            } catch (error) {
                fastify.log.error("Error fetching post:", error);
                return reply.status(500).send({ success: false, error: "Failed to fetch post" });
            }
        }
    );

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
}
