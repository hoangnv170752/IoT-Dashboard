import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { JwtPayload } from '../services/auth.js';
import { UserRole } from '@prisma/client';
declare module '@fastify/jwt' {
    interface FastifyJWT {
        payload: JwtPayload;
        user: JwtPayload;
    }
}
export declare function authenticate(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
export declare function requireRole(...allowedRoles: UserRole[]): (request: FastifyRequest, reply: FastifyReply) => Promise<undefined>;
export declare function requireSysAdmin(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
export declare function requireTenantAdmin(request: FastifyRequest, reply: FastifyReply): Promise<undefined>;
export declare function requirePermission(resource: string, action: string): (request: FastifyRequest, reply: FastifyReply) => Promise<undefined>;
export declare function getTenantScope(request: FastifyRequest): string | null;
export declare function withTenantScope(request: FastifyRequest, where?: Record<string, unknown>): Record<string, unknown>;
export declare function getCompanyScope(request: FastifyRequest): string | null;
export declare function withCompanyScope(request: FastifyRequest, where?: Record<string, unknown>): Record<string, unknown>;
export declare function optionalAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void>;
export declare function registerJwt(fastify: FastifyInstance): Promise<void>;
//# sourceMappingURL=auth.d.ts.map