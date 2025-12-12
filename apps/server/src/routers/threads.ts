import { eq, sql, desc, isNull, and } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import {
    createThreadSchema,
    threadIdParamsSchema,
    topicIdParamsSchema, 
    updateThreadSchema,
    paginationQuerySchema, PaginationQueryInput
} from "@/dto/threads.dto";
import { DrizzleClient } from "../db/index";
import { threads as threadsTable } from "../db/schema/thread.schema";
import { users as usersTable } from "../db/schema/user.schema"; // Required for joins
import { topics as topicsTable } from "../db/schema/topic.schema"; // Required for joins
import { authenticateUser } from "./auth";

export async function threadRoutes(fastify: FastifyInstance) {








    //creating the thread 


    fastify.post(
        "/threads/new",
        { preHandler: authenticateUser },
        async (request, reply) => {
            const userid = request.userId;
            
            // usrer id check for authentication 
            if (!userid) {
                 return reply.status(401).send({ error: "Unauthorized", success: false });
            }

            const user = await DrizzleClient.query.users.findFirst({
                where: (u, { eq }) => eq(u.id, userid),
            });
            if (!user) {
                return reply.status(404).send({ error: "User not found", success: false });
            }
            
			// validation response checking using zods error
            const parsed = createThreadSchema.safeParse(request.body);
            if (!parsed.success) {
                
                return reply.status(400).send({
                    error: "Invalid request body",
                    details: parsed.error.issues,
                    success: false
                });
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











    //read opration with vieew count +1


    fastify.get("/threads/:id", async (request, reply) => {
        const params = threadIdParamsSchema.safeParse(request.params);
        if (!params.success)
            return reply.status(400).send({ success: false, error: "Invalid thread id" });

        const threadId = params.data.id;

        try {
            await DrizzleClient.update(threadsTable)
                .set({ viewCount: sql`${threadsTable.viewCount} + 1` })
                .where(eq(threadsTable.id, threadId));

            
            const selection = {
                id: threadsTable.id,
                threadTitle: threadsTable.threadTitle,
                viewCount: threadsTable.viewCount,
                createdAt: threadsTable.createdAt,
                isLocked: threadsTable.isLocked,
                topicId: threadsTable.topicId,
                creatorUsername: usersTable.username, 
                topicName: topicsTable.topicName,
            };

            //thread data feteching using left join where thread.created by = user id 
			//left join where thread.topic id=topic table id
            const result = await DrizzleClient.select(selection)
            .from(threadsTable)
            .leftJoin(usersTable, eq(threadsTable.createdBy, usersTable.id))
            .leftJoin(topicsTable, eq(threadsTable.topicId, topicsTable.id))
            .where(
                and(

					/*this condition check that if the thread is soft delete or not as if 
					deletedat is null then only fetch the thread

					hides the soft deleted threads
					*/
			
                    eq(threadsTable.id, threadId),
                    isNull(threadsTable.deletedAt) 
                )
            )
            .limit(1);
            const thread = result[0];
        //thread error handeling 
            if (!thread) {
                return reply.status(404).send({ success: false, error: "Thread not found or deleted" });
            }

            return reply.status(200).send({ success: true, thread: thread });
        } catch (error) {
            fastify.log.error("Error fetching thread:", error);
            return reply.status(500).send({
                error: "Failed to fetch thread",
                success: false,
                details: error instanceof Error ? error.message : "Unknown error",
            });
        }
    });






    //reading all thread using topic id  using pagination
fastify.get("/threads/topic/:topicId", async (request, reply) => {
    
    const params = topicIdParamsSchema.safeParse(request.params);
    if (!params.success)
        return reply.status(400).send({ success: false, error: "Invalid topic id" });

    const topicId = params.data.topicId;
    const query = paginationQuerySchema.safeParse(request.query);
    if (!query.success)
        return reply.status(400).send({ success: false, error: "Invalid pagination parameters" });
    
    const { page, limit } = query.data;

    const offset = (page - 1) * limit; 

    try {
        const threads = await DrizzleClient.select({
            id: threadsTable.id,
            threadTitle: threadsTable.threadTitle,
            viewCount: threadsTable.viewCount,
            createdAt: threadsTable.createdAt,
            isLocked: threadsTable.isLocked,
            creatorUsername: usersTable.username,
        })
        .from(threadsTable)
        .where(
            and(
                eq(threadsTable.topicId, topicId),
                isNull(threadsTable.deletedAt) 
            )
        )
        .leftJoin(usersTable, eq(threadsTable.createdBy, usersTable.id))
        .orderBy(desc(threadsTable.createdAt))
        .limit(limit)
        .offset(offset);
        const [countResult] = await DrizzleClient.select({
            count: sql<number>`cast(count(${threadsTable.id}) as integer)`.as('count')
        })
        .from(threadsTable)
        .where(
            and(
                eq(threadsTable.topicId, topicId),
                isNull(threadsTable.deletedAt)
            )
        );
        const totalThreads = countResult?.count ?? 0;
        const totalPages = Math.ceil(totalThreads / limit);


        return reply.status(200).send({ 
            success: true, 
            threads: threads,
            metadata: {
                totalItems: totalThreads,
                totalPages: totalPages,
                currentPage: page,
                limit: limit,
            }
        });
    } catch (error) {
        fastify.log.error("Error fetching threads by topic:", error);
        return reply.status(500).send({
            error: "Failed to fetch threads",
            success: false,
            details: error instanceof Error ? error.message : "Unknown error",
        });
    }
});











    //updating the thread using thread id 
    fastify.patch(
        "/threads/:id",
        { preHandler: authenticateUser },
        async (request, reply) => {
            const authUserId = request.userId;

            const params = threadIdParamsSchema.safeParse(request.params);
            if (!params.success)
                return reply.status(400).send({ success: false, error: "Invalid thread id" });
            
            const body = updateThreadSchema.safeParse(request.body);
            if (!body.success)
                return reply.status(400).send({ success: false, error: "Invalid request body" });

            // Ensure thread exists and is not deleted
            const thread = await DrizzleClient.query.threads.findFirst({
                where: (t, { eq, isNull, and }) => and(eq(t.id, params.data.id), isNull(t.deletedAt)),
            });
            
            if (!thread)
                return reply.status(404).send({ success: false, error: "Thread not found or deleted" });
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





    /*delete thread  that is  soft delete it will only hide from the user but will stay in data base
	   by marking delete date
	*/
    fastify.delete(
        "/threads/:id",
        { preHandler: authenticateUser },
        async (request, reply) => {
            const authUserId = request.userId;
    

            const params = threadIdParamsSchema.safeParse(request.params);
            if (!params.success)
                return reply.status(400).send({ success: false, error: "Invalid thread id" });
            
            const thread = await DrizzleClient.query.threads.findFirst({
                where: (t, { eq, isNull, and }) => and(eq(t.id, params.data.id), isNull(t.deletedAt)),
            });
            
            if (!thread)
                return reply.status(404).send({ success: false, error: "Thread not found or already deleted" });
            if (thread.createdBy !== authUserId)
                return reply.status(403).send({ success: false, error: "Forbidden" });

            // soft delete algorithm
            const [deletedThread] = await DrizzleClient.update(threadsTable)
                .set({
                    deletedAt: new Date().toISOString(),
                    deletedBy: authUserId,
                })
                .where(eq(threadsTable.id, params.data.id))
                .returning();


            //if thread is not exist then it will give 500 internal serever error    
            if (!deletedThread) {
                return reply.status(500).send({ success: false, error: "Failed to perform soft delete" });
            }

            return reply.status(200).send({ success: true, message: `Thread ${deletedThread.id} soft-deleted.`, thread: deletedThread });
        },
    );
}
