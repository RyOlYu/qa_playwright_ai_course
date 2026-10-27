import { program } from "commander";
import * as fs from "node:fs";
import * as http from "node:http";
import * as path from "node:path";
import { createSession, parseSid, publicUser, requireAdmin, requireUser, sendError } from "./auth.mjs";
import { audit, buildSeedDb, hashPassword, loadDb, nextId, nowIso, saveDb, sendJson } from "./db.mjs";

program.option('--port <number>', 'server port number');
program.parse(process.argv);
const opts = program.opts();

const PORT = opts.port ?? 3000;
const __dirname = import.meta.dirname;
const DATA_FILE = path.join(__dirname, "..", "data", "app.json");

const db = loadDb(DATA_FILE);

const CATEGORIES = ["paper", "pens", "notebooks", "other"];
const SORT_FIELDS = ["name", "price", "created_at"];
const PAGE_SIZE = 10;

function save() {
    saveDb(DATA_FILE, db);
}

function httpError(httpCode, code, message) {
    const error = new Error(message);
    error.http = httpCode;
    error.code = code;
    return error;
}

function validateLogin(body) {
    const login = typeof body.login === "string"
        ? body.login.trim().toLowerCase()
        : "";

    const password = typeof body.password === "string"
        ? body.password
        : "";

    if (!login || !password) {
        throw httpError(422, "VALIDATION", "Логин и пароль обязательны");
    }

    if (!/^[a-z0-9_]{3,32}$/.test(login)) {
        throw httpError(422, "VALIDATION", "Логин: 3–32 символа [a-z0-9_]");
    }

    if (password.length < 8 || password.length > 64) {
        throw httpError(422, "VALIDATION", "Пароль: 8–64 символа");
    }

    return { login, password };
}

function validateProfilePatch(user, body) {
    const firstName = typeof body.first_name === "string"
        ? body.first_name.trim()
        : user.first_name;

    const lastName = typeof body.last_name === "string"
        ? body.last_name.trim()
        : user.last_name;

    const email = typeof body.email === "string"
        ? body.email.trim()
        : user.email;

    if (!firstName || firstName.length > 40) {
        throw httpError(422, "VALIDATION", "Имя: 1–40 символов");
    }

    if (!lastName || lastName.length > 40) {
        throw httpError(422, "VALIDATION", "Фамилия: 1–40 символов");
    }

    if (!email || email.length > 80 || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) {
        throw httpError(422, "VALIDATION", "Некорректный email");
    }

    const emailTaken = db.users.some(
        (item) => item.id !== user.id && item.email.toLowerCase() === email.toLowerCase()
    );

    if (emailTaken) {
        throw httpError(409, "CONFLICT", "Email уже занят");
    }

    return {
        first_name: firstName,
        last_name: lastName,
        email,
    };
}

function parseCatalogQuery(searchParams) {
    const q = (searchParams.get("q") ?? "").trim();
    const category = searchParams.get("category") ?? "all";
    const sort = searchParams.get("sort") ?? "name";
    const dir = searchParams.get("dir") ?? "asc";
    const pageRaw = searchParams.get("page") ?? "1";
    const page = Number(pageRaw);

    if (!Number.isInteger(page) || page < 1) {
        throw httpError(422, "VALIDATION", "page должен быть целым числом, начиная с 1");
    }

    if (!["all", ...CATEGORIES].includes(category)) {
        throw httpError(422, "VALIDATION", "Неизвестная категория");
    }

    if (!SORT_FIELDS.includes(sort)) {
        throw httpError(422, "VALIDATION", "Неизвестная сортировка");
    }

    if (!["asc", "desc"].includes(dir)) {
        throw httpError(422, "VALIDATION", "Неизвестное направление сортировки");
    }

    return {
        q,
        category,
        sort,
        dir,
        page,
    };
}

function publicProduct(product) {
    return {
        id: product.id,
        name: product.name,
        description: product.description,
        price: product.price,
        category: product.category,
        stock: product.stock,
        created_at: product.created_at,
    };
}

function parseInteger(value, fieldName, min, max) {
    if (value === undefined || value === null || value === "") {
        throw httpError(422, "VALIDATION", `${fieldName}: укажите значение`);
    }

    const numeric = Number(value);

    if (!Number.isInteger(numeric) || numeric < min || numeric > max) {
        throw httpError(422, "VALIDATION", `${fieldName}: целое число от ${min} до ${max}`);
    }

    return numeric;
}

function parseActive(value) {
    if (value === true || value === 1 || value === "1") {
        return 1;
    }

    if (value === false || value === 0 || value === "0") {
        return 0;
    }

    throw httpError(422, "VALIDATION", "is_active должен быть 0 или 1");
}

function ensureUniqueProductName(name, excludeId = null) {
    const duplicate = db.products.some(
        (product) => product.id !== excludeId && product.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
        throw httpError(409, "CONFLICT", "Товар с таким названием уже существует");
    }
}

function validateProductCreate(body) {
    if (
        typeof body.name !== "string" ||
        body.name.trim().length === 0 ||
        body.name.trim().length > 80
    ) {
        throw httpError(422, "VALIDATION", "Название товара: 1–80 символов");
    }

    const name = body.name.trim();

    const description = typeof body.description === "string"
        ? body.description
        : "";

    if (description.length > 500) {
        throw httpError(422, "VALIDATION", "Описание: не больше 500 символов");
    }

    const price = parseInteger(body.price, "Цена", 0, 1_000_000);
    const stock = parseInteger(body.stock, "Остаток", 0, 100_000);

    if (!CATEGORIES.includes(body.category)) {
        throw httpError(422, "VALIDATION", "Неизвестная категория");
    }

    let isActive = 1;

    if (body.is_active !== undefined) {
        isActive = parseActive(body.is_active);
    }

    return {
        name,
        description,
        price,
        category: body.category,
        stock,
        is_active: isActive,
    };
}

function validateProductPatch(body) {
    const patch = {};

    if ("name" in body) {
        if (
            typeof body.name !== "string" ||
            body.name.trim().length === 0 ||
            body.name.trim().length > 80
        ) {
            throw httpError(422, "VALIDATION", "Название товара: 1–80 символов");
        }

        patch.name = body.name.trim();
    }

    if ("description" in body) {
        const description = typeof body.description === "string"
            ? body.description
            : "";

        if (description.length > 500) {
            throw httpError(422, "VALIDATION", "Описание: не больше 500 символов");
        }

        patch.description = description;
    }

    if ("price" in body) {
        patch.price = parseInteger(body.price, "Цена", 0, 1_000_000);
    }

    if ("category" in body) {
        if (!CATEGORIES.includes(body.category)) {
            throw httpError(422, "VALIDATION", "Неизвестная категория");
        }

        patch.category = body.category;
    }

    if ("stock" in body) {
        patch.stock = parseInteger(body.stock, "Остаток", 0, 100_000);
    }

    if ("is_active" in body) {
        patch.is_active = parseActive(body.is_active);
    }

    if (Object.keys(patch).length === 0) {
        throw httpError(422, "VALIDATION", "Нет данных для обновления");
    }

    return patch;
}

async function handleDebug(req, res) {
    const debugError = String(req.headers["x-debug-error"] ?? "");

    if (["429", "500", "502", "503"].includes(debugError)) {
        const status = Number(debugError);
        sendError(res, status, debugError, `Учебная ошибка ${debugError}`);
        return true;
    }

    const delayRaw = Number(req.headers["x-debug-delay-ms"]);

    if (Number.isFinite(delayRaw) && delayRaw > 0) {
        const delay = Math.min(delayRaw, 30000);
        await new Promise((resolve) => setTimeout(resolve, delay));
    }

    return false;
}

function mimeForFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    const types = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".svg": "image/svg+xml",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".ico": "image/x-icon",
    };

    return types[ext] ?? "application/octet-stream";
}

async function serveStatic(req, res, url) {
    if (req.method !== "GET") {
        sendError(res, 405, "METHOD_NOT_ALLOWED", "Метод не поддерживается");
        return;
    }

    let pathname;

    try {
        pathname = decodeURIComponent(url.pathname);
    } catch {
        pathname = url.pathname;
    }
    const ui = path.join(__dirname, '..', 'ui');

    const exactRoutes = [
        "/login",
        "/catalog",
        "/profile",
        "/admin/products"
    ];
    if (req.url === '/' || exactRoutes.some(r => req.url.includes(r))) {
        let indexHtmlPath = path.join(ui, "index.html");
        const data = (await fs.promises.readFile(indexHtmlPath)).toString();
        // res.writeHead(200, {
        //     "content-type": mimeForFile(indexHtmlPath),
        // });

        res.end(data);
    } else if (req.url.includes('app.js')) {
        let appJsPath = path.join(ui, "app.js");
        const ff = fs.readFileSync(appJsPath).toString();
        res.writeHead(200, {
            "content-type": mimeForFile(appJsPath),
        });
        res.end(ff);
    } else if (req.url.includes('bootstrap.js')) {
        let appJsPath = path.join(ui, "bootstrap.js");
        res.writeHead(200, {
            "content-type": mimeForFile(appJsPath),
        });
        res.end(fs.readFileSync(appJsPath).toString());
    } else if (req.url.includes('bootstrap.css')) {
        let appJsPath = path.join(ui, "bootstrap.css");
        res.writeHead(200, {
            "content-type": mimeForFile(appJsPath),
        });
        res.end(fs.readFileSync(appJsPath).toString());

    } else {
        sendError(res, 404, "NOT_FOUND", "Не найдено");
    }
}


async function readBody(req) {
    const chunks = [];

    for await (const chunk of req) {
        chunks.push(chunk);
    }

    const raw = Buffer.concat(chunks).toString("utf8");

    if (raw.trim() === "") {
        return {};
    }

    try {
        return JSON.parse(raw);
    } catch {
        const error = new Error("Некорректный JSON");
        error.http = 400;
        error.code = "BAD_JSON";
        throw error;
    }
}

const server = http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
        if (req.url === '/' && req.method === 'HEAD') {
            res.end('ok');
        }
        
        if (!url.pathname.startsWith("/api/")) {
            await serveStatic(req, res, url);
            return;
        }

        if (await handleDebug(req, res)) {
            return;
        }



        if (req.method === 'POST' && req.url.includes("api/_qa/reset")) {
            Object.assign(db, buildSeedDb());   // пересев в памяти
            save();                              // и файл пересоздан с нуля
            res.writeHead(204);
            res.end();
            return;
        }


        if (req.method === 'POST' && req.url.includes("api/_stop_server")) {
            console.log('---------- stop server' );
            server.close();
            process.kill();
        }

        const parts = url.pathname.split("/").filter(Boolean);

        if (req.method === "POST" && url.pathname === "/api/login") {
            const body = await readBody(req);
            const { login, password } = validateLogin(body);

            const user = db.users.find((item) => item.login === login);

            if (user && user.is_blocked) {
                sendError(res, 403, "BLOCKED", "Учётная запись заблокирована");
                return;
            }

            const passwordValid =
                user &&
                user.password_hash === hashPassword(password, user.password_salt);

            if (!passwordValid) {
                sendError(res, 401, "UNAUTHORIZED", "Неверный логин или пароль");
                return;
            }

            const token = createSession(db, user.id);
            audit(db, user.id, "login", { login: user.login });
            save();

            res.setHeader("Set-Cookie", `sid=${token}; HttpOnly; Path=/; Max-Age=7200`);
            sendJson(res, 200, { user: publicUser(user) });
            return;
        }

        if (req.method === "POST" && url.pathname === "/api/logout") {
            const token = parseSid(req);

            const session = db.sessions.find(
                (item) => item.token === token && item.expires_at > nowIso()
            );

            if (!session) {
                sendError(res, 401, "UNAUTHORIZED", "Сессия не найдена");
                return;
            }

            const user = db.users.find((item) => item.id === session.user_id);

            db.sessions = db.sessions.filter((item) => item.id !== session.id);
            audit(db, user?.id ?? null, "logout", {});
            save();

            res.setHeader("Set-Cookie", "sid=; HttpOnly; Path=/; Max-Age=0");
            res.writeHead(204);
            res.end();
            return;
        }

        if (req.method === "GET" && url.pathname === "/api/me") {
            const user = requireUser(db, req, res);

            if (!user) {
                return;
            }

            sendJson(res, 200, { user: publicUser(user) });
            return;
        }

        if (url.pathname === "/api/profile") {
            const user = requireUser(db, req, res);

            if (!user) {
                return;
            }

            if (req.method === "GET") {
                sendJson(res, 200, { user: publicUser(user) });
                return;
            }

            if (req.method === "PATCH") {
                const body = await readBody(req);
                const patch = validateProfilePatch(user, body);

                Object.assign(user, patch, {
                    updated_at: nowIso(),
                });

                audit(db, user.id, "profile_update", patch);
                save();

                sendJson(res, 200, { user: publicUser(user) });
                return;
            }
        }

        if (url.pathname === "/api/products" && req.method === "GET") {
            const user = requireUser(db, req, res);

            if (!user) {
                return;
            }

            const query = parseCatalogQuery(url.searchParams);

            let items = db.products.filter((product) => product.is_active === 1);

            if (query.q) {
                const q = query.q.toLowerCase();
                items = items.filter((product) => product.name.toLowerCase().includes(q));
            }

            if (query.category !== "all") {
                items = items.filter((product) => product.category === query.category);
            }

            items.sort((left, right) => {
                let result = 0;

                if (query.sort === "price") {
                    result = left.price - right.price;
                } else if (query.sort === "created_at") {
                    result = left.created_at.localeCompare(right.created_at);
                } else {
                    result = left.name.localeCompare(right.name, "ru");
                }

                return query.dir === "desc" ? -result : result;
            });

            const total = items.length;
            const start = (query.page - 1) * PAGE_SIZE;
            const pageItems = items.slice(start, start + PAGE_SIZE);

            sendJson(res, 200, {
                items: pageItems.map(publicProduct),
                page: query.page,
                pageSize: PAGE_SIZE,
                total,
            });

            return;
        }

        if (parts[1] === "products" && parts.length === 3 && req.method === "GET") {
            const user = requireUser(db, req, res);

            if (!user) {
                return;
            }

            const id = Number(parts[2]);

            const product = db.products.find((item) => item.id === id);

            if (!product || product.is_active !== 1) {
                sendError(res, 404, "NOT_FOUND", "Товар не найден");
                return;
            }

            sendJson(res, 200, publicProduct(product));
            return;
        }

        if (parts[1] === "admin" && parts[2] === "products") {
            const admin = requireAdmin(db, req, res);

            if (!admin) {
                return;
            }

            if (parts.length === 3 && req.method === "GET") {
                const items = db.products
                    .slice()
                    .sort((left, right) => right.created_at.localeCompare(left.created_at));

                sendJson(res, 200, {
                    items,
                    total: items.length,
                });

                return;
            }

            if (parts.length === 3 && req.method === "POST") {
                const body = await readBody(req);
                const draft = validateProductCreate(body);

                ensureUniqueProductName(draft.name);

                const product = {
                    id: nextId(db, "products"),
                    name: draft.name,
                    description: draft.description,
                    price: draft.price,
                    category: draft.category,
                    stock: draft.stock,
                    is_active: draft.is_active,
                    created_at: nowIso(),
                    updated_at: nowIso(),
                };

                db.products.push(product);
                audit(db, admin.id, "product_create", {
                    product_id: product.id,
                    name: product.name,
                });

                save();
                sendJson(res, 201, product);
                return;
            }

            if (parts.length === 4 && req.method === "PATCH") {
                const id = Number(parts[3]);
                const product = db.products.find((item) => item.id === id);

                if (!product) {
                    sendError(res, 404, "NOT_FOUND", "Товар не найден");
                    return;
                }

                const body = await readBody(req);
                const patch = validateProductPatch(body);

                if (patch.name) {
                    ensureUniqueProductName(patch.name, product.id);
                }

                Object.assign(product, patch, {
                    updated_at: nowIso(),
                });

                audit(db, admin.id, "product_update", {
                    product_id: product.id,
                    ...patch,
                });

                save();
                sendJson(res, 200, product);
                return;
            }

            if (parts.length === 5 && req.method === "POST") {
                const id = Number(parts[3]);
                const action = parts[4];

                if (!["hide", "show"].includes(action)) {
                    sendError(res, 404, "NOT_FOUND", "API не найден");
                    return;
                }

                const product = db.products.find((item) => item.id === id);

                if (!product) {
                    sendError(res, 404, "NOT_FOUND", "Товар не найден");
                    return;
                }

                product.is_active = action === "hide" ? 0 : 1;
                product.updated_at = nowIso();

                audit(db, admin.id, action === "hide" ? "product_hide" : "product_show", {
                    product_id: product.id,
                });

                save();
                sendJson(res, 200, product);
                return;
            }
        }

        sendError(res, 404, "NOT_FOUND", "API не найден");
    } catch (error) {
        if (error.http && error.code) {
            sendError(res, error.http, error.code, error.message);
            return;
        }

        console.error(error);

        if (!res.headersSent) {
            sendError(res, 500, "INTERNAL", "Внутренняя ошибка сервера");
        }
    }
});

server.listen(PORT, () => {
    console.log(`Сервер запущен: http://localhost:${PORT}`);
});