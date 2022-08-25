import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import Joi from "joi";

import prisma from "../prisma";

const create_catalog = Joi.object({
    name: Joi.string().required(),
    products: Joi.array()
        .items(
            Joi.object({
                name: Joi.string().required(),
                price: Joi.number().required(),
            })
        )
        .required(),
});

const routes = async (app: FastifyInstance) => {
    app.addHook(
        "onRequest",
        async (request: FastifyRequest, reply: FastifyReply) => {
            console.log(request.user);
            if (!request.user || request.user.buyer) {
                return reply.code(401).send({
                    error: "Unauthorized",
                });
            }
        }
    );

    app.post("/api/seller/create-catalog", async (request, reply) => {
        try {
            const { products, name } = await create_catalog.validateAsync(
                request.body
            );

            // disconnect existing catalog from seller

            const seller = await prisma.seller.findFirst({
                where: {
                    id: request.user.seller.id,
                },
                select: {
                    catalog: {
                        select: {
                            id: true,
                            products: true,
                        },
                    },
                },
            });

            // create new catalog

            await prisma.catalog.create({
                data: {
                    name,
                    products: {
                        create: products.map((product) => ({
                            name: product.name,
                            price: product.price,
                        })),
                    },
                    seller: {
                        connect: {
                            id: request.user.seller.id,
                        },
                    },
                },
            });

            // delete old catalog

            if (seller.catalog) {
                await prisma.product.deleteMany({
                    where: {
                        catalog: {
                            id: seller.catalog.id,
                        },
                    },
                });

                await prisma.catalog.delete({
                    where: {
                        id: seller.catalog.id,
                    },
                });
            }

            reply.send({
                message: "Catalog updated",
            });
        } catch (error) {
            console.log(error);

            reply.code(400).send({
                error: "Bad Request",
            });
        }
    });

    app.get("/api/seller/orders", async (request, reply) => {
        const orders = await prisma.order.findMany({
            where: {
                seller: {
                    id: request.user.seller.id,
                },
            },
            select: {
                id: true,
                products: true,
                buyer: true,
            },
        });

        reply.send({ orders });
    });
};

export default routes;
