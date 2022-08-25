import { FastifyInstance } from "fastify";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Joi from "joi";

import prisma from "../prisma";

const register_schema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
    buyer: Joi.boolean().required(),
});

const login_schema = Joi.object({
    username: Joi.string().required(),
    password: Joi.string().required(),
});

const routes = async (app: FastifyInstance) => {
    app.post("/api/auth/register", async (request, reply) => {
        try {
            const { username, password, buyer } =
                await register_schema.validateAsync(request.body);

            const hashed = await bcrypt.hash(password, 10);

            const user = await prisma.user.create({
                data: {
                    username,
                    password: hashed,
                },
            });

            if (buyer) {
                await prisma.buyer.create({
                    data: {
                        user: {
                            connect: {
                                id: user.id,
                            },
                        },
                    },
                });
            } else {
                await prisma.seller.create({
                    data: {
                        user: {
                            connect: {
                                id: user.id,
                            },
                        },
                    },
                });
            }

            return reply.status(200).send({
                message: "User created",
            });
        } catch (error) {
            return reply.status(400).send({
                error: error.message,
            });
        }
    });

    app.post("/api/auth/login", async (request, reply) => {
        try {
            const { username, password } = await login_schema.validateAsync(
                request.body
            );

            const user = await prisma.user.findFirst({
                where: {
                    username,
                },
            });

            if (!user) {
                return reply.code(401).send({
                    error: "Account not found",
                });
            }

            const valid = await bcrypt.compare(password, user.password);

            if (!valid) {
                return reply.code(401).send({
                    error: "Invalid password",
                });
            }

            const token = jwt.sign(
                {
                    id: user.id,
                },
                process.env.JWT_SECRET
            );

            return reply.status(200).send({
                token,
            });
        } catch (error) {
            return reply.status(400).send({
                error: error.message,
            });
        }
    });
};

export default routes;
