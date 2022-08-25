import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import Joi from "joi";

import prisma from "../prisma";

const create_order_schema = Joi.object({
    productIds: Joi.array().items(Joi.string()).required(),
});

const routes = async (app: FastifyInstance) => {
    app.addHook(
        "onRequest",
        async (request: FastifyRequest, reply: FastifyReply) => {
            if (!request.user || request.user.seller) {
                return reply.code(401).send({
                    error: "Unauthorized",
                });
            }
        }
    );

    app.get("/api/buyer/list-of-sellers", async (request, reply) => {
        const sellers = await prisma.seller.findMany({
            select: {
                id: true,
                user: {
                    select: {
                        username: true,
                    },
                },
            },
        });

        reply.send({ sellers });
    });

    app.get("/api/buyer/seller-catalog/:seller_id", async (request, reply) => {
        const { seller_id } = request.params as { seller_id: string };

        if (!seller_id) {
            return reply.code(400).send({
                error: "Bad Request",
            });
        }

        const seller = await prisma.seller.findFirst({
            where: {
                id: seller_id,
            },
            select: {
                catalog: {
                    select: {
                        id: true,
                        name: true,
                        products: true,
                    },
                },
            },
        });

        if (!seller) {
            return reply.code(404).send({
                error: "Seller not found",
            });
        }

        const { catalog } = seller;

        reply.send({ catalog });
    });

    app.post("/api/buyer/create-order/:seller_id", async (request, reply) => {
        const { seller_id } = request.params as { seller_id: string };

        if (!seller_id) {
            return reply.code(400).send({
                error: "Bad Request",
            });
        }

        try {
            const { productIds } = await create_order_schema.validateAsync(
                request.body
            );

            const products = await prisma.product.findMany({
                where: {
                    id: {
                        in: productIds,
                    },
                },
            });

            if (products.length !== productIds.length) {
                return reply.code(400).send({
                    error: "Bad Request",
                });
            }

            // create order
            const order = await prisma.order.create({
                data: {
                    seller: {
                        connect: {
                            id: seller_id,
                        },
                    },
                    buyer: {
                        connect: {
                            id: request.user.buyer.id,
                        },
                    },
                },
            });

            // push order to product.orders

            for (const product of products) {
                await prisma.product.update({
                    where: {
                        id: product.id,
                    },
                    data: {
                        orders: {
                            connect: {
                                id: order.id,
                            },
                        },
                    },
                });
            }

            reply.status(200).send({
                message: "Order created",
            });
        } catch (error) {
            reply.code(400).send({
                error: "Bad Request",
            });
        }
    });
};

export default routes;
