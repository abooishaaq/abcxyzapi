import { Buyer, Seller } from "@prisma/client";
import fastify, {
    FastifyInstance,
    FastifyReply,
    FastifyRequest,
} from "fastify";
import jwt from "jsonwebtoken";
import prisma from "./prisma";
import authRoutes from "./routes/auth";
import buyerRoutes from "./routes/buyer";
import sellerRoutes from "./routes/seller";

declare module "fastify" {
    interface FastifyRequest {
        user: {
            id: string;
            username: string;
            buyer?: Buyer;
            seller?: Seller;
        };
    }
}

const app = fastify({ logger: true });

app.register(authRoutes);

const unauth = (reply: FastifyReply) => {
    reply.code(401).send({
        error: "Unauthorized",
    });
};

app.register(async (app: FastifyInstance) => {
    app.addHook(
        "onRequest",
        async (request: FastifyRequest, reply: FastifyReply) => {
            const auth = request.headers.authorization;

            if (!auth) {
                return unauth(reply);
            }

            const [type, token] = auth.split(" ");

            if (type !== "Bearer") {
                return unauth(reply);
            }

            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET) as {
                    id: string;
                };

                if (!decoded || !decoded.id) {
                    return unauth(reply);
                }

                const user = await prisma.user.findFirst({
                    where: {
                        id: decoded.id,
                    },
                    select: {
                        id: true,
                        username: true,
                        buyer: true,
                        seller: true,
                    },
                });

                request.user = user;
            } catch (error) {
                return unauth(reply);
            }
        }
    );

    app.register(buyerRoutes);
    app.register(sellerRoutes);
});

app.listen({ port: 1337 });
