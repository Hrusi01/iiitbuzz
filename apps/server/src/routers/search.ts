import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

import { searchThreads } from "@/service/searchThread.service";
import { searchTopics } from "@/service/searchTopic.service";
import { searchPosts } from "@/service/searchPost.service";
import { generalSearch } from "@/service/searchGeneral.service";

export async function searchRoutes(fastify: FastifyInstance) {
    
    fastify.get(
        "/search/thread",
        async (req: FastifyRequest, reply: FastifyReply) => {
            const q = (req.query as any).q || "";
            const page = Number((req.query as any).page) || 1;

            return await searchThreads(q, page);
        }
    );

    fastify.get(
        "/search/topic",
        async (req: FastifyRequest, reply: FastifyReply) => {
            const q = (req.query as any).q || "";
            const page = Number((req.query as any).page) || 1;

            return await searchTopics(q, page);
        }
    );

    fastify.get(
        "/search/post",
        async (req: FastifyRequest, reply: FastifyReply) => {
            const q = (req.query as any).q || "";
            const page = Number((req.query as any).page) || 1;

            return await searchPosts(q, page);
        }
    );

    fastify.get(
        "/search",
        async (req: FastifyRequest, reply: FastifyReply) => {
            const q = (req.query as any).q || "";
            const page = Number((req.query as any).page) || 1;

            return await generalSearch(q, page);
        }
    );
}
