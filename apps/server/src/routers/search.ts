import type { FastifyInstance } from "fastify";
import { searchQuerySchema } from "@/dto/search.dto";
import { fullTextSearch } from "../service/search.service";

export async function searchRoutes(fastify: FastifyInstance) {
	fastify.get("/search", async (request, reply) => {
		const parsed = searchQuerySchema.safeParse(request.query);

		if (!parsed.success) {
			return reply.status(400).send({
				success: false,
				error: "Invalid search query",
				details: parsed.error.issues,
			});
		}

		const searchQuery = parsed.data.q;

		try {
			const results = await fullTextSearch(searchQuery);

			return reply.status(200).send({
				success: true,
				query: searchQuery,
				results: results,
			});
		} catch (error) {
    console.log("SEARCH ERROR:", error);
    fastify.log.error(error);
    return reply
        .status(500)
        .send({ success: false, error: String(error) });
}

	});
}
