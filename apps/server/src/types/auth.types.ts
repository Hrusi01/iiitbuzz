import type { FastifyReply, FastifyRequest } from "fastify";

export interface AuthenticatedRequest extends FastifyRequest {
	user: { id: string; username: string | null; email: string | null; firstName: string | null; lastName: string | null; totalPosts: number | null; pronouns: string | null; bio: string | null; branch: string | null; passingOutYear: string | null; };
	userId: string;
}

export type AuthenticationMiddleware = (
	request: FastifyRequest,
	reply: FastifyReply,
) => Promise<void>;

export type AuthenticatedRouteHandler = (
	request: AuthenticatedRequest,
	reply: FastifyReply,
) => Promise<void>;
