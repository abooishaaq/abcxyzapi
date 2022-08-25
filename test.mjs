import test from "ava";
import axios from "axios";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import crypto from "node:crypto";

const buyer_username = "buyer-" + nanoid();
const seller_username = "seller-" + nanoid();
const password = crypto.randomBytes(128).toString("base64");

const url = "http://localhost:1337";

let buyer_token;
let seller_token;

test.serial("create buyer account", async (t) => {
    const res = await axios.post(`${url}/api/auth/register`, {
        username: buyer_username,
        password,
        buyer: true,
    });

    t.is(res.status, 200);
});

test.serial("create seller account", async (t) => {
    const res = await axios.post(`${url}/api/auth/register`, {
        username: seller_username,
        password,
        buyer: false,
    });

    t.is(res.status, 200);
});

test.serial("login as buyer", async (t) => {
    const res = await axios.post(`${url}/api/auth/login`, {
        username: buyer_username,
        password,
    });

    t.is(res.status, 200);
    buyer_token = res.data.token;
});

test.serial("login as seller", async (t) => {
    const res = await axios.post(`${url}/api/auth/login`, {
        username: seller_username,
        password,
    });

    t.is(res.status, 200);
    seller_token = res.data.token;
});

test.serial("using buyer's account: get list of sellers", async (t) => {
    const res = await axios.get(`${url}/api/buyer/list-of-sellers`, {
        headers: {
            Authorization: `Bearer ${buyer_token}`,
        },
    });

    t.is(res.status, 200);
    t.is(
        res.data.sellers.filter(
            (seller) => seller.user.username === seller_username
        ).length,
        1
    );
});

const catalog = {
    name: "catalog",
    products: [
        {
            name: "product 1",
            price: 1,
        },
        {
            name: "product 2",
            price: 2,
        },
    ],
};

test.serial("using seller's account: create catalog", async (t) => {
    const res = await axios.post(`${url}/api/seller/create-catalog`, catalog, {
        headers: {
            Authorization: `Bearer ${seller_token}`,
        },
    });

    t.is(res.status, 200);
});

test.serial(
    "using buyer's account: get seller's catalog and order it all",
    async (t) => {
        const { data } = await axios.get(`${url}/api/buyer/list-of-sellers`, {
            headers: {
                Authorization: `Bearer ${buyer_token}`,
            },
        });

        const sellerId = data.sellers.find(
            (seller) => seller.user.username === seller_username
        ).id;

        const res = await axios.get(
            `${url}/api/buyer/seller-catalog/${sellerId}`,
            {
                headers: {
                    Authorization: `Bearer ${buyer_token}`,
                },
            }
        );

        t.is(res.status, 200);
        t.is(res.data.catalog.name, catalog.name);
        t.is(res.data.catalog.products.length, catalog.products.length);
        t.is(res.data.catalog.products[0].name, catalog.products[0].name);
        t.is(res.data.catalog.products[0].price, catalog.products[0].price);

        const productIds = res.data.catalog.products.map(
            (product) => product.id
        );

        const res2 = await axios.post(
            `${url}/api/buyer/create-order/${sellerId}`,
            {
                productIds,
            },
            {
                headers: {
                    Authorization: `Bearer ${buyer_token}`,
                },
            }
        );
        t.is(res2.status, 200);
    }
);

test.serial("using seller's account: get list of orders", async (t) => {
    const res = await axios.get(`${url}/api/seller/orders`, {
        headers: {
            Authorization: `Bearer ${seller_token}`,
        },
    });

    t.is(res.status, 200);
    t.is(res.data.orders.length, 1);
    t.is(res.data.orders[0].products.length, 2);
    t.is(res.data.orders[0].products[0].name, catalog.products[0].name);
});

test.serial("using seller's account: access buyer api", async (t) => {
    try {
        await axios.get(`${url}/api/buyer/list-of-sellers`, {
            headers: {
                Authorization: `Bearer ${seller_token}`,
            },
        });
    } catch (e) {
        t.is(e.response.status, 401);
    }
});

test.serial("using buyer's account: access seller api", async (t) => {
    try {
        await axios.get(`${url}/api/seller/orders`, {
            headers: {
                Authorization: `Bearer ${buyer_token}`,
            },
        });
    } catch (e) {
        t.is(e.response.status, 401);
    }
});
