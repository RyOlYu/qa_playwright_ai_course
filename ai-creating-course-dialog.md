### USER
есть задача научить студентов тестированию и конкретно e2e тестированию. Студенты умею писать скрипты на js/ts, императивный код. Не умеют в ООП. Другая нейронка написала мне план и задачи по плану, скидываю тебе план и первый блок с задачами. Есть ли замечания по планам и задачам?

### ASSISTANT


### USER
есть задача научить студентов тестированию и конкретно e2e тестированию. Студенты умею писать скрипты на js/ts, императивный код. Не умеют в ООП. Другая нейронка написала мне план и задачи по плану, скидываю тебе план и первый блок с задачами. Напиши код сервера и клиента. Sqlight не используем, просто сохранени-чтение из файла. Клиент на чистом js/html + bootstrap для красоты. Нужно больше деталей?


### ASSISTANT
Да, деталей для старта достаточно. Ниже — рабочий учебный каркас без SQLite и без ООП: сервер на чистом `node:http`, хранение в JSON-файле, клиент на чистом JS/HTML + Bootstrap. Я сразу заложил вещи, нужные для первых задач курса: логин, роли, `data-testid`, одна модалка ошибок, учебные заголовки `X-Debug-Error` и `X-Debug-Delay-Ms`.

> Важно: это можно давать студентам как есть. Если захотите сохранить «учебные дефекты» из описания, их легко добавить позже. Сейчас код сделан максимально предсказуемым для первых тестов.

---

## Структура проекта

```text
north-shelf/
  package.json
  server/
    index.js
    db.js
    auth.js
    http.js
  public/
    index.html
    app.js
  data/
    app.json   # создаётся автоматически при первом запуске
```

---

## 1. `package.json`

```json
{
  "name": "north-shelf",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "start": "node server/index.js"
  }
}
```

Зависимостей нет.

---

## 2. Сервер

### `server/db.js`

```js
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function nowIso() {
  return new Date().toISOString();
}

function hashPassword(password, salt) {
  return crypto.createHash("sha256").update(salt + password).digest("hex");
}

function nextId(db, table) {
  db.seq[table] = (db.seq[table] || 0) + 1;
  return db.seq[table];
}

function audit(db, userId, action, payload) {
  db.audit_log.push({
    id: nextId(db, "audit_log"),
    user_id: userId ?? null,
    action,
    payload: JSON.stringify(payload ?? {}),
    created_at: nowIso(),
  });
}

function makeUser(db, login, password, fields) {
  const salt = crypto.randomBytes(8).toString("hex");

  const user = {
    id: nextId(db, "users"),
    login,
    email: fields.email,
    password_salt: salt,
    password_hash: hashPassword(password, salt),
    first_name: fields.first_name,
    last_name: fields.last_name,
    role: fields.role,
    is_blocked: fields.is_blocked ? 1 : 0,
    created_at: nowIso(),
    updated_at: nowIso(),
  };

  db.users.push(user);
  return user;
}

function seed(dataFile) {
  const db = {
    users: [],
    sessions: [],
    products: [],
    audit_log: [],
    seq: {
      users: 0,
      sessions: 0,
      products: 0,
      audit_log: 0,
    },
  };

  makeUser(db, "anna", "anna-pass", {
    email: "anna@example.com",
    first_name: "Анна",
    last_name: "Покупателева",
    role: "user",
    is_blocked: false,
  });

  makeUser(db, "boris", "boris-pass", {
    email: "boris@example.com",
    first_name: "Борис",
    last_name: "Бывший",
    role: "user",
    is_blocked: true,
  });

  makeUser(db, "kira", "kira-admin", {
    email: "kira@example.com",
    first_name: "Кира",
    last_name: "Админова",
    role: "admin",
    is_blocked: false,
  });

  const categories = ["paper", "pens", "notebooks", "other"];
  const stocks = [0, 1, 10, 999];

  for (let i = 1; i <= 25; i += 1) {
    let name;

    if (i === 1) {
      name = "Тетрадь 48 л.";
    } else if (i <= 5) {
      name = `Тетрадь ${12 * i} л.`;
    } else if (i <= 10) {
      name = `Ручка синяя №${i}`;
    } else if (i <= 15) {
      name = `Блокнот ${i}`;
    } else if (i <= 20) {
      name = `Бумага A4 пачка ${i}`;
    } else {
      name = `Канцелярия образец ${i}`;
    }

    const product = {
      id: nextId(db, "products"),
      name,
      description: `Описание товара: ${name}`,
      price: i === 1 ? 0 : Math.min(199900, i * 7900),
      category: categories[(i - 1) % categories.length],
      stock: stocks[(i - 1) % stocks.length],
      is_active: 1,
      created_at: new Date(Date.now() - i * 86400000).toISOString(),
      updated_at: new Date(Date.now() - i * 86400000).toISOString(),
    };

    db.products.push(product);
  }

  for (let i = 1; i <= 2; i += 1) {
    const product = {
      id: nextId(db, "products"),
      name: `Скрытый товар ${i}`,
      description: "Этот товар снят с витрины.",
      price: 10000 + i * 100,
      category: "other",
      stock: 5,
      is_active: 0,
      created_at: new Date(Date.now() - (30 + i) * 86400000).toISOString(),
      updated_at: new Date(Date.now() - (30 + i) * 86400000).toISOString(),
    };

    db.products.push(product);
  }

  saveDb(dataFile, db);
  return db;
}

function loadDb(dataFile) {
  try {
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, "utf8");
      const db = JSON.parse(raw);

      if (
        db &&
        Array.isArray(db.users) &&
        Array.isArray(db.sessions) &&
        Array.isArray(db.products) &&
        Array.isArray(db.audit_log) &&
        db.seq
      ) {
        return db;
      }
    }
  } catch (error) {
    console.warn("Не удалось прочитать data/app.json, создаём новую базу.", error);
  }

  return seed(dataFile);
}

function saveDb(dataFile, db) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });

  const tmpFile = `${dataFile}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2));
  fs.renameSync(tmpFile, dataFile);
}

module.exports = {
  loadDb,
  saveDb,
  nextId,
  audit,
  nowIso,
  hashPassword,
};
```

---

### `server/http.js`

```js
function sendJson(res, status, body) {
  const json = JSON.stringify(body);

  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(json),
  });

  res.end(json);
}

function sendError(res, http, code, message) {
  sendJson(res, http, {
    error: {
      code,
      http,
      message,
    },
  });
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

module.exports = {
  sendJson,
  sendError,
  readBody,
};
```

---

### `server/auth.js`

```js
const crypto = require("node:crypto");
const { nextId, nowIso } = require("./db");
const { sendError } = require("./http");

function parseCookies(req) {
  const header = req.headers.cookie ?? "";

  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        const key = part.slice(0, index);
        const value = part.slice(index + 1);
        return [key, decodeURIComponent(value)];
      })
  );
}

function parseSid(req) {
  return parseCookies(req).sid ?? null;
}

function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

  db.sessions.push({
    id: nextId(db, "sessions"),
    user_id: userId,
    token,
    expires_at: expiresAt,
    created_at: nowIso(),
  });

  return token;
}

function findUserBySid(db, req) {
  const token = parseSid(req);

  if (!token) {
    return null;
  }

  const session = db.sessions.find(
    (item) => item.token === token && item.expires_at > nowIso()
  );

  if (!session) {
    return null;
  }

  const user = db.users.find((item) => item.id === session.user_id);

  if (!user || user.is_blocked) {
    return null;
  }

  return user;
}

function requireUser(db, req, res) {
  const user = findUserBySid(db, req);

  if (!user) {
    sendError(res, 401, "UNAUTHORIZED", "Требуется вход");
    return null;
  }

  return user;
}

function requireAdmin(db, req, res) {
  const user = requireUser(db, req, res);

  if (!user) {
    return null;
  }

  if (user.role !== "admin") {
    sendError(res, 403, "FORBIDDEN", "Недостаточно прав");
    return null;
  }

  return user;
}

function publicUser(user) {
  return {
    id: user.id,
    login: user.login,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    role: user.role,
  };
}

module.exports = {
  parseSid,
  createSession,
  findUserBySid,
  requireUser,
  requireAdmin,
  publicUser,
};
```

---

### `server/index.js`

```js
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const {
  loadDb,
  saveDb,
  nextId,
  audit,
  nowIso,
  hashPassword,
} = require("./db");

const {
  sendJson,
  sendError,
  readBody,
} = require("./http");

const {
  parseSid,
  createSession,
  requireUser,
  requireAdmin,
  publicUser,
} = require("./auth");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
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

  const safePath = path.normalize(pathname).replace(/^(\.\.(\/|\\|$))+/g, "");
  const publicRoot = path.resolve(PUBLIC_DIR);
  let filePath = path.resolve(path.join(publicRoot, safePath || "index.html"));

  if (!filePath.startsWith(publicRoot)) {
    sendError(res, 404, "NOT_FOUND", "Не найдено");
    return;
  }

  try {
    const stat = await fs.promises.stat(filePath);

    if (stat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    const data = await fs.promises.readFile(filePath);

    res.writeHead(200, {
      "content-type": mimeForFile(filePath),
    });

    res.end(data);
  } catch {
    try {
      const data = await fs.promises.readFile(path.join(publicRoot, "index.html"));

      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
      });

      res.end(data);
    } catch {
      sendError(res, 404, "NOT_FOUND", "Не найдено");
    }
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);

    if (!url.pathname.startsWith("/api/")) {
      await serveStatic(req, res, url);
      return;
    }

    if (await handleDebug(req, res)) {
      return;
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
```

---

## 3. Клиент

### `public/index.html`

```html
<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Северная полка</title>

  <link
    href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
    rel="stylesheet"
  >

  <style>
    body {
      background: #f8f9fa;
    }

    [data-testid="catalog-row"] {
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div id="app" class="min-vh-100"></div>

  <div
    class="modal fade"
    id="errorModal"
    tabindex="-1"
    aria-hidden="true"
    data-testid="app-error"
  >
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">Ошибка</h5>
          <button
            type="button"
            class="btn-close"
            data-bs-dismiss="modal"
            aria-label="Закрыть"
          ></button>
        </div>

        <div class="modal-body">
          <p class="mb-1">
            <span class="fw-semibold">Код:</span>
            <span data-testid="app-error-code"></span>
          </p>

          <p class="mb-0" data-testid="app-error-message"></p>
        </div>

        <div class="modal-footer">
          <button
            type="button"
            class="btn btn-secondary"
            data-bs-dismiss="modal"
            data-testid="app-error-close"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  </div>

  <script
    src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"
  ></script>

  <script type="module" src="/app.js"></script>
</body>
</html>
```

---

### `public/app.js`

```js
let currentUser = null;

const app = document.getElementById("app");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function formatPrice(cents) {
  return `${(Number(cents) / 100).toFixed(2)} ₽`;
}

async function api(method, path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  const options = {
    method,
    headers: {},
    credentials: "same-origin",
    signal: controller.signal,
  };

  if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let response;

  try {
    response = await fetch(path, options);
    clearTimeout(timer);
  } catch {
    clearTimeout(timer);

    throw {
      code: "NETWORK",
      http: 0,
      message: "Нет связи с сервером или истёк таймаут",
    };
  }

  if (response.status === 204) {
    return null;
  }

  let payload = null;

  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = payload?.error ?? {};

    throw {
      code: error.code ?? String(response.status),
      http: error.http ?? response.status,
      message: error.message ?? `HTTP ${response.status}`,
    };
  }

  return payload;
}

function showError(error) {
  const codeElement = document.querySelector('[data-testid="app-error-code"]');
  const messageElement = document.querySelector('[data-testid="app-error-message"]');

  if (codeElement) {
    codeElement.textContent = error.code ?? "UNKNOWN";
  }

  if (messageElement) {
    messageElement.textContent = error.message ?? "Неизвестная ошибка";
  }

  if (window.bootstrap) {
    const modalElement = document.getElementById("errorModal");
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);
    modal.show();
  } else {
    alert(`${error.code ?? "UNKNOWN"}: ${error.message ?? "Неизвестная ошибка"}`);
  }
}

function navigate(url) {
  history.pushState({}, "", url);
  void renderRoute();
}

window.addEventListener("popstate", () => {
  void renderRoute();
});

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-link]");

  if (!link) {
    return;
  }

  event.preventDefault();
  navigate(link.getAttribute("href"));
});

function layout(content) {
  if (!currentUser) {
    return `<main class="container py-4">${content}</main>`;
  }

  const adminLink = currentUser.role === "admin"
    ? `
      <a
        class="nav-link"
        href="/admin/products"
        data-testid="nav-admin-products"
        data-link
      >
        Товары
      </a>
    `
    : "";

  return `
    <nav class="navbar navbar-expand bg-white border-bottom mb-4" data-testid="app-header">
      <div class="container">
        <a class="navbar-brand" href="/" data-link>Северная полка</a>

        <div class="d-flex align-items-center gap-2">
          <a
            class="nav-link"
            href="/catalog"
            data-testid="nav-catalog"
            data-link
          >
            Каталог
          </a>

          <a
            class="nav-link"
            href="/profile"
            data-testid="nav-profile"
            data-link
          >
            Профиль
          </a>

          ${adminLink}

          <span class="badge text-bg-secondary" data-testid="role-badge">
            ${escapeHtml(currentUser.role)}
          </span>

          <button class="btn btn-outline-secondary btn-sm" data-testid="nav-logout">
            Выйти
          </button>
        </div>
      </div>
    </nav>

    <main class="container py-2">
      ${content}
    </main>
  `;
}

function setContent(content) {
  app.innerHTML = layout(content);
  bindLogout();
}

function bindLogout() {
  const button = document.querySelector('[data-testid="nav-logout"]');

  if (!button) {
    return;
  }

  button.addEventListener("click", async () => {
    try {
      await api("POST", "/api/logout");
    } catch {
      // Даже если сервер не ответил, учебный клиент можно вернуть на логин.
    }

    currentUser = null;
    navigate("/login");
  });
}

const routes = [
  {
    pattern: "^/$",
    handler: redirectToStart,
  },
  {
    pattern: "^/login$",
    handler: renderLogin,
  },
  {
    pattern: "^/catalog$",
    handler: renderCatalog,
    auth: true,
  },
  {
    pattern: "^/catalog/(?<id>\\d+)$",
    handler: renderProduct,
    auth: true,
  },
  {
    pattern: "^/profile$",
    handler: renderProfile,
    auth: true,
  },
  {
    pattern: "^/admin/products$",
    handler: renderAdmin,
    auth: true,
    admin: true,
  },
];

function findRoute(pathname) {
  for (const route of routes) {
    const match = pathname.match(new RegExp(route.pattern));

    if (match) {
      return {
        route,
        params: match.groups ?? {},
      };
    }
  }

  return null;
}

function redirectToStart() {
  navigate(currentUser ? "/catalog" : "/login");
}

async function renderRoute() {
  const found = findRoute(location.pathname);

  if (!found) {
    renderNotFound();
    return;
  }

  const { route, params } = found;

  if (route.auth) {
    if (!currentUser) {
      try {
        const data = await api("GET", "/api/me");
        currentUser = data.user;
      } catch (error) {
        if (error.code === "NETWORK") {
          showError(error);
          return;
        }

        const from = encodeURIComponent(location.pathname + location.search);
        navigate(`/login?from=${from}`);
        return;
      }
    }

    if (route.admin && currentUser.role !== "admin") {
      showError({
        code: "403",
        http: 403,
        message: "Недостаточно прав для доступа к этой странице",
      });

      setContent(`
        <div class="alert alert-danger">
          Доступ запрещён
        </div>
      `);

      return;
    }
  }

  if (route.handler === renderLogin && currentUser) {
    navigate("/catalog");
    return;
  }

  try {
    await route.handler(params);
  } catch (error) {
    showError(error);
  }
}

function renderNotFound() {
  setContent(`
    <h1 class="h4 mb-3">Не найдено</h1>

    <p>
      Такой страницы нет.
    </p>

    <a class="btn btn-primary" href="/catalog" data-link>
      Перейти в каталог
    </a>
  `);
}

async function renderLogin() {
  const searchParams = new URLSearchParams(location.search);
  const from = searchParams.get("from")?.startsWith("/")
    ? searchParams.get("from")
    : "/catalog";

  setContent(`
    <div class="row justify-content-center">
      <div class="col-md-5 col-lg-4">
        <div class="card shadow-sm">
          <div class="card-body">
            <h1 class="h4 mb-3">Вход</h1>

            <form data-testid="login-form">
              <div class="mb-3">
                <label class="form-label" for="login-input">Логин</label>
                <input
                  id="login-input"
                  class="form-control"
                  data-testid="login-input"
                  autocomplete="username"
                >
              </div>

              <div class="mb-3">
                <label class="form-label" for="password-input">Пароль</label>
                <input
                  id="password-input"
                  type="password"
                  class="form-control"
                  data-testid="password-input"
                  autocomplete="current-password"
                >
              </div>

              <button class="btn btn-primary w-100" type="submit" data-testid="login-submit">
                Войти
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `);

  const form = document.querySelector('[data-testid="login-form"]');

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const login = document.querySelector('[data-testid="login-input"]').value;
    const password = document.querySelector('[data-testid="password-input"]').value;

    try {
      const data = await api("POST", "/api/login", { login, password });
      currentUser = data.user;
      navigate(from);
    } catch (error) {
      showError(error);
    }
  });
}

async function renderCatalog() {
  const searchParams = new URLSearchParams(location.search);

  const state = {
    q: searchParams.get("q") ?? "",
    category: searchParams.get("category") ?? "all",
    sort: searchParams.get("sort") ?? "name",
    dir: searchParams.get("dir") ?? "asc",
    page: Number(searchParams.get("page") ?? "1"),
  };

  setContent(`
    <h1 class="h4 mb-3">Каталог</h1>

    <div class="row g-2 mb-3">
      <div class="col-md-4">
        <input
          type="search"
          class="form-control"
          placeholder="Поиск"
          data-testid="catalog-search"
          value="${escapeHtml(state.q)}"
        >
      </div>

      <div class="col-md-3">
        <select class="form-select" data-testid="catalog-category">
          <option value="all">Все категории</option>
          <option value="paper">Бумага</option>
          <option value="pens">Ручки</option>
          <option value="notebooks">Тетради</option>
          <option value="other">Прочее</option>
        </select>
      </div>

      <div class="col-md-3">
        <select class="form-select" data-testid="catalog-sort">
          <option value="name:asc">Имя ↑</option>
          <option value="name:desc">Имя ↓</option>
          <option value="price:asc">Цена ↑</option>
          <option value="price:desc">Цена ↓</option>
          <option value="created_at:asc">Создано ↑</option>
          <option value="created_at:desc">Создано ↓</option>
        </select>
      </div>
    </div>

    <div class="table-responsive">
      <table class="table table-hover bg-white" data-testid="catalog-table">
        <thead>
          <tr>
            <th>Название</th>
            <th>Категория</th>
            <th>Цена</th>
            <th>Остаток</th>
            ${currentUser.role === "admin" ? "<th>Действия</th>" : ""}
          </tr>
        </thead>
        <tbody id="catalog-tbody">
          <tr>
            <td colspan="${currentUser.role === "admin" ? 5 : 4}">Загрузка...</td>
          </tr>
        </tbody>
      </table>
    </div>

    <nav data-testid="catalog-pagination">
      <ul class="pagination"></ul>
    </nav>
  `);

  const searchElement = document.querySelector('[data-testid="catalog-search"]');
  const categoryElement = document.querySelector('[data-testid="catalog-category"]');
  const sortElement = document.querySelector('[data-testid="catalog-sort"]');

  categoryElement.value = state.category;
  sortElement.value = `${state.sort}:${state.dir}`;

  function updateUrl(patch) {
    const next = {
      ...state,
      ...patch,
    };

    const query = new URLSearchParams();

    if (next.q) {
      query.set("q", next.q);
    }

    if (next.category && next.category !== "all") {
      query.set("category", next.category);
    }

    if (next.sort !== "name" || next.dir !== "asc") {
      query.set("sort", next.sort);
      query.set("dir", next.dir);
    }

    if (next.page > 1) {
      query.set("page", String(next.page));
    }

    const queryText = query.toString();
    navigate(`/catalog${queryText ? `?${queryText}` : ""}`);
  }

  let debounce;

  searchElement.addEventListener("input", () => {
    clearTimeout(debounce);

    debounce = setTimeout(() => {
      updateUrl({
        q: searchElement.value.trim(),
        page: 1,
      });
    }, 300);
  });

  searchElement.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();

      updateUrl({
        q: searchElement.value.trim(),
        page: 1,
      });
    }
  });

  categoryElement.addEventListener("change", () => {
    updateUrl({
      category: categoryElement.value,
      page: 1,
    });
  });

  sortElement.addEventListener("change", () => {
    const [sort, dir] = sortElement.value.split(":");

    updateUrl({
      sort,
      dir,
      page: 1,
    });
  });

  await loadCatalog(state, updateUrl);
}

async function loadCatalog(state, updateUrl) {
  const tbody = document.getElementById("catalog-tbody");

  try {
    const query = new URLSearchParams({
      q: state.q,
      category: state.category,
      sort: state.sort,
      dir: state.dir,
      page: String(state.page),
    });

    const data = await api("GET", `/api/products?${query.toString()}`);

    renderCatalogRows(data.items, tbody);
    renderCatalogPagination(data, updateUrl);
  } catch (error) {
    showError(error);
    tbody.innerHTML = "";
  }
}

function renderCatalogRows(items, tbody) {
  if (!items.length) {
    tbody.innerHTML = `
      <tr data-testid="catalog-empty">
        <td colspan="${currentUser.role === "admin" ? 5 : 4}">
          Ничего не найдено
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = items
    .map((product) => {
      const adminCell = currentUser.role === "admin"
        ? `
          <td>
            <button
              class="btn btn-sm btn-outline-primary"
              data-testid="catalog-edit"
            >
              Изменить
            </button>
          </td>
        `
        : "";

      return `
        <tr data-testid="catalog-row" data-id="${product.id}">
          <td>${escapeHtml(product.name)}</td>
          <td>${escapeHtml(product.category)}</td>
          <td>${formatPrice(product.price)}</td>
          <td>${product.stock}</td>
          ${adminCell}
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll('[data-testid="catalog-row"]').forEach((row) => {
    row.addEventListener("click", () => {
      navigate(`/catalog/${row.dataset.id}`);
    });
  });

  tbody.querySelectorAll('[data-testid="catalog-edit"]').forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();

      const row = event.target.closest("tr");
      navigate(`/admin/products?edit=${row.dataset.id}`);
    });
  });
}

function renderCatalogPagination(data, updateUrl) {
  const pagination = document.querySelector('[data-testid="catalog-pagination"] ul');

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));

  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  let html = "";

  for (let page = 1; page <= totalPages; page += 1) {
    html += `
      <li class="page-item ${page === data.page ? "active" : ""}">
        <a class="page-link" href="#" data-page="${page}">
          ${page}
        </a>
      </li>
    `;
  }

  pagination.innerHTML = html;

  pagination.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();

      updateUrl({
        page: Number(link.dataset.page),
      });
    });
  });
}

async function renderProduct(params) {
  setContent("<p>Загрузка...</p>");

  try {
    const product = await api("GET", `/api/products/${params.id}`);

    setContent(`
      <a class="btn btn-link mb-3 px-0" href="/catalog" data-link>
        ← Назад в каталог
      </a>

      <div class="card">
        <div class="card-body">
          <h1 class="h4" data-testid="product-title">
            ${escapeHtml(product.name)}
          </h1>

          <p class="fs-4" data-testid="product-price">
            ${formatPrice(product.price)}
          </p>

          <p>
            ${escapeHtml(product.description)}
          </p>

          <dl class="row mb-0">
            <dt class="col-sm-3">Категория</dt>
            <dd class="col-sm-9">${escapeHtml(product.category)}</dd>

            <dt class="col-sm-3">Остаток</dt>
            <dd class="col-sm-9">${product.stock}</dd>
          </dl>
        </div>
      </div>
    `);
  } catch (error) {
    showError(error);
    renderNotFound();
  }
}

async function renderProfile() {
  setContent(`
    <h1 class="h4 mb-3">Профиль</h1>

    <div id="profile-success" class="alert alert-success" hidden data-testid="profile-success">
      Профиль сохранён
    </div>

    <div class="card">
      <div class="card-body">
        <form data-testid="profile-form">
          <div class="mb-3">
            <label class="form-label" for="profile-first-name">Имя</label>
            <input
              id="profile-first-name"
              class="form-control"
              data-testid="profile-first-name"
            >
          </div>

          <div class="mb-3">
            <label class="form-label" for="profile-last-name">Фамилия</label>
            <input
              id="profile-last-name"
              class="form-control"
              data-testid="profile-last-name"
            >
          </div>

          <div class="mb-3">
            <label class="form-label" for="profile-email">Email</label>
            <input
              id="profile-email"
              type="email"
              class="form-control"
              data-testid="profile-email"
            >
          </div>

          <button class="btn btn-primary" type="submit" data-testid="profile-save">
            Сохранить
          </button>
        </form>
      </div>
    </div>
  `);

  const form = document.querySelector('[data-testid="profile-form"]');
  const firstElement = document.querySelector('[data-testid="profile-first-name"]');
  const lastElement = document.querySelector('[data-testid="profile-last-name"]');
  const emailElement = document.querySelector('[data-testid="profile-email"]');
  const successElement = document.getElementById("profile-success");

  try {
    const data = await api("GET", "/api/profile");

    firstElement.value = data.user.first_name;
    lastElement.value = data.user.last_name;
    emailElement.value = data.user.email;
  } catch (error) {
    showError(error);
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      first_name: firstElement.value,
      last_name: lastElement.value,
      email: emailElement.value,
    };

    try {
      const data = await api("PATCH", "/api/profile", payload);
      currentUser = data.user;
      successElement.hidden = false;
    } catch (error) {
      showError(error);
    }
  });
}

async function renderAdmin(params = {}) {
  setContent(`
    <h1 class="h4 mb-3">Управление товарами</h1>

    <div class="card mb-4">
      <div class="card-body">
        <form data-testid="admin-product-form" class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Название</label>
            <input class="form-control" data-testid="admin-product-name">
          </div>

          <div class="col-md-3">
            <label class="form-label">Цена, коп.</label>
            <input
              type="number"
              min="0"
              max="1000000"
              class="form-control"
              data-testid="admin-product-price"
            >
          </div>

          <div class="col-md-3">
            <label class="form-label">Остаток</label>
            <input
              type="number"
              min="0"
              max="100000"
              class="form-control"
              data-testid="admin-product-stock"
            >
          </div>

          <div class="col-md-3">
            <label class="form-label">Категория</label>
            <select class="form-select" data-testid="admin-product-category">
              <option value="paper">paper</option>
              <option value="pens">pens</option>
              <option value="notebooks">notebooks</option>
              <option value="other">other</option>
            </select>
          </div>

          <div class="col-md-9">
            <label class="form-label">Описание</label>
            <textarea
              class="form-control"
              rows="2"
              data-testid="admin-product-description"
            ></textarea>
          </div>

          <div class="col-md-3 d-flex align-items-end">
            <div class="form-check">
              <input
                class="form-check-input"
                type="checkbox"
                checked
                data-testid="admin-product-active"
              >
              <label class="form-check-label">Активен</label>
            </div>
          </div>

          <div class="col-12">
            <button class="btn btn-primary" type="submit" data-testid="admin-product-save">
              Сохранить
            </button>

            <button class="btn btn-outline-secondary" type="button" data-testid="admin-product-reset">
              Очистить
            </button>
          </div>
        </form>
      </div>
    </div>

    <div class="table-responsive">
      <table class="table bg-white">
        <thead>
          <tr>
            <th>ID</th>
            <th>Название</th>
            <th>Цена</th>
            <th>Остаток</th>
            <th>Категория</th>
            <th>Активен</th>
            <th>Действия</th>
          </tr>
        </thead>
        <tbody id="admin-products-tbody">
          <tr>
            <td colspan="7">Загрузка...</td>
          </tr>
        </tbody>
      </table>
    </div>
  `);

  let editingId = params.edit ? Number(params.edit) : null;

  const form = document.querySelector('[data-testid="admin-product-form"]');
  const resetButton = document.querySelector('[data-testid="admin-product-reset"]');

  const nameElement = document.querySelector('[data-testid="admin-product-name"]');
  const priceElement = document.querySelector('[data-testid="admin-product-price"]');
  const stockElement = document.querySelector('[data-testid="admin-product-stock"]');
  const categoryElement = document.querySelector('[data-testid="admin-product-category"]');
  const descriptionElement = document.querySelector('[data-testid="admin-product-description"]');
  const activeElement = document.querySelector('[data-testid="admin-product-active"]');

  function clearForm() {
    editingId = null;
    form.reset();
    activeElement.checked = true;
  }

  function fillForm(product) {
    editingId = product.id;

    nameElement.value = product.name;
    priceElement.value = product.price;
    stockElement.value = product.stock;
    categoryElement.value = product.category;
    descriptionElement.value = product.description;
    activeElement.checked = Boolean(product.is_active);
  }

  async function doAction(id, action) {
    try {
      await api("POST", `/api/admin/products/${id}/${action}`);
      await renderAdmin({});
    } catch (error) {
      showError(error);
    }
  }

  function renderTable(items) {
    const tbody = document.getElementById("admin-products-tbody");

    if (!items.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7">Товаров нет</td>
        </tr>
      `;

      return;
    }

    tbody.innerHTML = items
      .map((product) => {
        const activeBadge = product.is_active
          ? '<span class="badge text-bg-success">Да</span>'
          : '<span class="badge text-bg-secondary">Нет</span>';

        const visibilityButton = product.is_active
          ? `
            <button
              class="btn btn-sm btn-outline-warning"
              data-action="hide"
              data-id="${product.id}"
            >
              Скрыть
            </button>
          `
          : `
            <button
              class="btn btn-sm btn-outline-success"
              data-action="show"
              data-id="${product.id}"
            >
              Показать
            </button>
          `;

        return `
          <tr data-testid="admin-product-row" data-id="${product.id}">
            <td>${product.id}</td>
            <td>${escapeHtml(product.name)}</td>
            <td>${formatPrice(product.price)}</td>
            <td>${product.stock}</td>
            <td>${escapeHtml(product.category)}</td>
            <td>${activeBadge}</td>
            <td class="d-flex gap-1">
              <button
                class="btn btn-sm btn-outline-primary"
                data-edit="${product.id}"
              >
                Изменить
              </button>

              ${visibilityButton}
            </td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll("[data-edit]").forEach((button) => {
      button.addEventListener("click", () => {
        const product = items.find((item) => item.id === Number(button.dataset.edit));

        if (product) {
          fillForm(product);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      });
    });

    tbody.querySelectorAll("[data-action]").forEach((button) => {
      button.addEventListener("click", () => {
        doAction(Number(button.dataset.id), button.dataset.action);
      });
    });
  }

  async function loadProducts() {
    try {
      const data = await api("GET", "/api/admin/products");

      renderTable(data.items);

      if (editingId) {
        const product = data.items.find((item) => item.id === editingId);

        if (product) {
          fillForm(product);
        }
      }
    } catch (error) {
      showError(error);
    }
  }

  resetButton.addEventListener("click", clearForm);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const payload = {
      name: nameElement.value,
      description: descriptionElement.value,
      price: priceElement.value === "" ? null : Number(priceElement.value),
      stock: stockElement.value === "" ? null : Number(stockElement.value),
      category: categoryElement.value,
      is_active: activeElement.checked,
    };

    try {
      if (editingId) {
        await api("PATCH", `/api/admin/products/${editingId}`, payload);
      } else {
        await api("POST", "/api/admin/products", payload);
      }

      await renderAdmin({});
    } catch (error) {
      showError(error);
    }
  });

  await loadProducts();
}

async function init() {
  try {
    const data = await api("GET", "/api/me");
    currentUser = data.user;
  } catch {
    currentUser = null;
  }

  if (location.pathname === "/") {
    navigate(currentUser ? "/catalog" : "/login");
    return;
  }

  await renderRoute();
}

init();
```

---

## Как запускать

Из корня проекта:

```bash
npm start
```

или просто:

```bash
node server/index.js
```

Приложение откроется на:

```text
http://localhost:3000
```

При первом запуске автоматически создастся файл:

```text
data/app.json
```

---

## Учебные пользователи

| Логин   | Пароль       | Роль    | Заблокирован |
| ------- | ------------ | ------- | ------------ |
| `anna`  | `anna-pass`  | `user`  | нет          |
| `boris` | `boris-pass` | `user`  | да           |
| `kira`  | `kira-admin` | `admin` | нет          |

---

## Что уже есть для первых задач

Для задач 1–3 и ближайших автотестов этого достаточно:

- страница `/login`;
- успешный вход `anna`;
- отказ по неверному паролю: `401`;
- отказ заблокированному `boris`: `403`, код `BLOCKED`;
- пустые поля: `422`;
- выход через `/api/logout`;
- редирект гостя на `/login?from=...`;
- каталог с поиском, категорией, сортировкой, пагинацией;
- карточка товара;
- профиль;
- админ-страница товаров;
- одна модалка ошибок;
- `data-testid` на основных элементах;
- учебные заголовки для сети.

---

## Учебные заголовки

Сервер понимает:

```text
X-Debug-Error: 429
X-Debug-Error: 500
X-Debug-Error: 502
X-Debug-Error: 503
```

и

```text
X-Debug-Delay-Ms: 15000
```

Пример через `curl`:

```bash
curl -H "X-Debug-Error: 503" http://localhost:3000/api/products
```

Для браузерных тестов можно ставить через:

```js
await page.setExtraHTTPHeaders({
  "X-Debug-Error": "503",
});
```

или через `APIRequestContext`.

---

## Что можно уточнить дальше

Если нужно, я могу следующим шагом:

1. переделать это под конкретный формат задач `pw-01.md`, `pw-02.md` и т.д.;
2. добавить стартовый набор `tests/` под Playwright;
3. добавить управляемый сброс данных, например `POST /api/debug/reset`;
4. оставить или убрать учебные дефекты из списка: старые сессии, скрытый товар по прямой ссылке, поиск без `trim`;
5. сделать версию без CDN Bootstrap, чтобы всё работало офлайн.

### USER
тебе понятна конечная цель обучения? Помни об одном из фокусов для учащихся - они крайне слабо знакомы с паттернами и подходами к тестированию, терминологией. То есть им нужно в процессе задач это объяснять и желательно давать ссылки на статьи, справочники. Давать пересказ своими словами частей книг по тестированию(если это не нарушает копирайт). И более человеческим языком переписывай текст задач. Дано для задач пиши в стиле bdd - *.feature, ключевые слова на английском - Given, When etc, но сам текст кейсов на русском. Тесты будут проводится на коде который ты скинул выше. Попробуй переписать  2 первых блока с задачами. Задачи выдавай по одной в ответе, но подряд 6 задач  меня не спрашивай о продолжении вывода задач

### ASSISTANT
Да, конечная цель обучения понятна.

Нужно не просто научить студентов писать `page.goto()` и `click()`, а научить их тестировать продукт:  
читать требование, видеть правило, формулировать проверку, подбирать наблюдаемый факт и только потом писать автотест.

Для этой аудитории важно постоянно проговаривать:

- что такое **тест** как вопрос к продукту;
- что такое **оракул** — откуда мы знаем, что должно произойти;
- чем **проверка** отличается от «прогнать клики»;
- почему нельзя смешивать разные ошибки: неверный пароль, заблокированный пользователь, пустые поля;
- почему `waitForTimeout` — плохая замена ожидания состояния;
- почему `data-testid` лучше случайных CSS-селекторов;
- что такое негативный сценарий, граничное значение, класс эквивалентности, контракт, наблюдаемый факт.

Ниже — переписанные задачи первых двух модулей в более человечном стиле.  
Сразу даю 6 задач подряд, как ты просил.

---

## Важное соответствие коду из прошлого ответа

В присланном сервере и клиенте в модалке ошибки сейчас выводится не HTTP-статус, а строковый бизнес-код ошибки из поля `error.code`.

Поэтому в задачах ниже ожидаются коды:

- `UNAUTHORIZED` — вместо «401 неверный пароль / нет сессии»;
- `VALIDATION` — вместо «422 ошибка валидации»;
- `BLOCKED` — вместо «403 заблокированный пользователь».

Это нормально для обучения: студенты сразу видят разницу между техническим кодом ошибки и человекочитаемым сообщением.

Если позже захочешь, чтобы в модалке отображался именно номер статуса `401`, `422`, `403`, достаточно будет поменять одну строку в клиенте. Но для текущего кода ниже задачи написаны под фактическое поведение приложения.

---

# Модуль 1. Требования и тестовая документация

Этот модуль пока без автотестов.  
Студенты должны научиться отвечать на вопрос: «Что именно должно происходить?» — до того, как они начнут кликать браузером.

---

## Задача 1. Кто может войти и чем отличаются отказы

### Зачем эта задача

Разработчик часто пишет тест как сценарий: «ввёл данные — что-то произошло».  
Тестировщик сначала спрашивает: «Какие вообще есть участники? Какие у них права? Что считается успехом? Что считается отказом?»

Если не разделить заранее гостя, обычного пользователя, администратора и заблокированного пользователя, тесты превратятся в кашу: «вход не сработал», хотя причины могут быть разные.

### Немного теории своими словами

В тестировании есть важная мысль: тест не доказывает, что программа работает. Тест задаёт продукту конкретный вопрос и сравнивает фактический ответ с ожидаемым.

Например:

- Вопрос: «Сможет ли Анна войти с верным паролем?»
- Ожидаемый ответ: «Да, попадёт в каталог, роль будет `user`, админ-пункт не появится».
- Вопрос: «Что будет, если ввести неверный пароль?»
- Ожидаемый ответ: «Останемся на странице входа, появится ошибка `UNAUTHORIZED`».
- Вопрос: «Что будет, если входит заблокированный пользователь?»
- Ожидаемый ответ: `BLOCKED`, а не «просто не вошёл».

Такой подход помогает не склеивать разные ситуации в одну.

Из идей Гленфорда Майерса можно вынести простую вещь: цель тестирования — находить расхождения между ожидаемым и фактическим поведением, а не демонстрировать, что код вроде бы запускается.

Из идей Канера и коллег важно понятие **оракула**: источника ожидаемого результата. В нашем курсе оракул — описание витрины и фактическое поведение приложения, а не фантазия «в нормальном магазине должно быть так».

### Дано в стиле BDD

```gherkin
Feature: Правила входа в витрину «Северная полка»

  Scenario: Подготовка карты участников и отказов
    Given описание витрины доступно студенту
    And автотесты ещё не пишутся
    When студент выписывает правила входа
    Then он отдельно описывает гостя, пользователя, администратора и заблокированного пользователя
    And он различает отказ "неверный пароль" и отказ "учётная запись заблокирована"
    And он указывает наблюдаемые факты: URL, бейдж роли, пункт меню, код ошибки
```

### Что нужно сделать

Не писать код и не запускать браузер.  
Нужно прочитать описание витрины и выписать правила входа в виде списка.

Минимум нужно разобрать:

1. Гость без сессии.
2. Обычный пользователь `anna`.
3. Администратор `kira`.
4. Заблокированный пользователь `boris`.
5. Пустые поля логина и пароля.
6. Неизвестный логин.
7. Неверный пароль у известного логина.
8. Прямой переход гостя на `/catalog`.
9. Прямой переход гостя на `/admin/products`.
10. Что такое сессия снаружи: cookie `sid`, а не JWT и не `localStorage`.

### Формат сдачи

Маркированный список правил.

Каждое правило — одно предложение вида:

```text
Если ..., то ... (наблюдаемый факт).
```

Например:

```text
Если гость открывает /catalog, то его перенаправляет на /login?from=/catalog.
```

или:

```text
Если пользователь вводит неверный пароль, то он остаётся на /login и видит модалку ошибки с кодом UNAUTHORIZED.
```

### Что считается сделанным

Сделано, если:

- есть отдельные правила для гостя, `user`, `admin`, `blocked`;
- не смешаны неверный пароль и заблокированная учётка;
- указано, чем отличается вход Анны от входа Киры;
- описан редирект гостя с закрытой страницы;
- сессия описана как cookie `sid`, без ухода в хеши и внутренности сервера;
- нет выдуманных требований, которых нет в описании проекта.

### Типичные ошибки студентов

- «Проверить, что логин работает» без деталей.
- Смешать Бориса и неверный пароль в одну строку.
- Забыть, что администратор видит пункт «Товары».
- Написать правила про безопасность паролей, хотя это не требуется.
- Придумать требование «нулевой остаток скрывать», хотя в приложении такого нет.

### Полезные ссылки и идеи

- Myers, *The Art of Software Testing* — идея, что тест ищет расхождение с ожиданием.
- Kaner, Bach, Pettichord, *Lessons Learned in Software Testing* — идея теста как вопроса и важность оракула.
- Copeland, *A Practitioner's Guide to Software Test Design* — зачем проектировать проверки, а не просто набирать шаги.

---

## Задача 2. Чек-лист входа, который можно прогнать руками

### Зачем эта задача

Чек-лист — это короткий список вопросов к приложению.  
Он нужен, чтобы быстро проверить важную часть системы руками и потом понять, какие из этих проверок можно автоматизировать.

Чек-лист — не тест-кейс с десятком шагов и не автотест.  
Хорошая строка чек-листа отвечает на один вопрос.

### Немного теории своими словами

Разница такая:

- плохая строка: «проверить логин»;
- нормальная строка: «Анна входит с верным паролем → каталог, бейдж `user`, админ-пункт не виден»;
- плохая строка: «негативные сценарии входа»;
- нормальная строка: «Борис входит с верным паролем → остаётся на логине, ошибка `BLOCKED`».

Чек-лист полезен, когда его можно прочитать за минуту и выполнить руками за пять минут.

Хороший чек-лист не описывает каждый пиксель и не пишет «навести мышку, подождать, моргнуть дважды».  
Он фиксирует:

- кто действует;
- какие данные вводит;
- что делает;
- какой наблюдаемый факт ожидает.

### Дано в стиле BDD

```gherkin
Feature: Ручной чек-лист входа и выхода

  Scenario: Чек-лист можно быстро прогнать вручную
    Given витрина запущена
    And есть пользователи из стартовых данных: anna, boris, kira
    When студент составляет чек-лист входа и выхода
    Then каждая строка содержит участника, данные, действие и ожидаемый факт
    And разные отказы не склеиваются в одну строку
    And в списке нет общих фраз вроде "логин работает"
```

### Что нужно сделать

Составить чек-лист только на вход, отказы и выход.

Обязательные строки:

1. успешный вход Анны;
2. пустые поля;
3. неизвестный логин;
4. неверный пароль у известного логина;
5. вход Бориса;
6. выход после успешного входа.

Можно добавить одну-две строки сверху, если они относятся к этой же теме.  
Не нужно тащить сюда поиск по каталогу, профиль, карточку товара и админ-функции.

### Пример хорошей строки

```text
Анна, логин "anna", пароль "anna-pass", нажать «Войти» → открывается /catalog, виден бейдж роли "user", пункт «Товары» отсутствует, модалка ошибки скрыта.
```

### Пример плохой строки

```text
Проверить, что форма входа работает нормально.
```

Плохо, потому что непонятно:

- кто входит;
- какие данные;
- что значит «нормально»;
- какой факт нужно увидеть.

### Что считается сделанным

Сделано, если:

- есть шесть обязательных строк;
- неизвестный логин и неверный пароль идут разными строками;
- Борис не смешан с неверным паролем;
- для пустых полей указан код `VALIDATION`;
- для выхода проверено не только попадание на `/login`, но и поведение при повторном открытии `/catalog`;
- строки короткие и понятные.

### Ориентировочный чек-лист

Ниже — пример, на который можно опираться.  
Студент может формулировать иначе, но смысл должен сохраниться.

| Кто              | Данные                               | Действие       | Ожидаемый факт                                                       |
| ---------------- | ------------------------------------ | -------------- | -------------------------------------------------------------------- |
| Анна             | `anna` / `anna-pass`                 | Войти          | `/catalog`, бейдж `user`, пункта «Товары» нет, модалка ошибки скрыта |
| Гость            | оба поля пустые                      | Нажать «Войти» | остаёмся на `/login`, модалка ошибки видна, код `VALIDATION`         |
| Гость            | неизвестный логин и пароль длиной 8+ | Войти          | остаёмся на `/login`, модалка ошибки видна, код `UNAUTHORIZED`       |
| Анна             | логин верный, пароль неверный        | Войти          | остаёмся на `/login`, модалка ошибки видна, код `UNAUTHORIZED`       |
| Борис            | `boris` / `boris-pass`               | Войти          | остаёмся на `/login`, модалка ошибки видна, код `BLOCKED`            |
| Анна после входа | войти, затем выйти                   | Нажать «Выйти» | `/login`; если после этого открыть `/catalog`, снова требует вход    |

### Типичные ошибки студентов

- одна строка «все негативные сценарии»;
- «пустые поля» без указания кода ошибки;
- выход без проверки повторного доступа к каталогу;
- слишком длинные шаги;
- чек-лист про поиск, профиль и админку, хотя задача только про вход.

### Полезные ссылки и идеи

- Kaner, Bach, Pettichord — тест как вопрос к продукту.
- Copeland — проектирование проверок начинается с понимания правила, а не с кликов.
- Gherkin reference: [https://cucumber.io/docs/gherkin/reference/](https://cucumber.io/docs/gherkin/reference/)

---

## Задача 3. `login.feature`: логин человеческим языком

### Зачем эта задача

Чек-лист удобен для быстрого прогона.  
Но если нужно объяснить сценарий коллеге, лучше читается связный текст в стиле BDD.

Здесь BDD — это не Cucumber, не раннер и не обязательный английский текст.  
Это способ описать:

- в каком состоянии мы начинаем;
- какое действие выполняем;
- какой наблюдаемый факт ожидаем.

### Немного теории своими словами

Формат `Given / When / Then` полезен тем, что заставляет разделять:

- контекст;
- действие;
- результат.

Хороший сценарий читается как простое описание поведения.

Плохо:

```gherkin
Сценарий: Всё работает
  Когда я что-то делаю
  Тогда всё корректно
```

Хорошо:

```gherkin
Given я гость на странице входа
When я вхожу как "anna" с паролем "anna-pass"
Then я оказываюсь в каталоге
And в шапке виден бейдж роли "user"
And пункта «Товары» нет
And модалка ошибки скрыта
```

Ключевые слова остаются английскими: `Given`, `When`, `Then`, `And`.  
Сам текст сценария — русский.

### Дано в стиле BDD

```gherkin
Feature: Живая документация входа

  Scenario: Сценарий входа читается как поведение, а не как код
    Given у студента есть правила входа из задачи 1
    And у студента есть чек-лист из задачи 2
    When студент превращает их в feature-файл
    Then сценарии пишутся на русском языке
    And ключевые слова Given, When, Then остаются английскими
    And каждый сценарий проверяет одно правило
```

### Что нужно сделать

Создать файл:

```text
login.feature
```

В нём должно быть 3–4 сценария.

Обязательно взять разные ситуации, например:

1. успешный вход обычного пользователя;
2. неверный пароль;
3. заблокированная учётка;
4. по желанию: пустые поля или выход.

Не нужно писать сценарий «полный день пользователя», где сразу вход, поиск, профиль и выход.  
Один сценарий — одно правило.

### Шаблон

```gherkin
Feature: Вход в витрину «Северная полка»

  Scenario: Покупатель входит и не видит администраторские пункты
    Given я гость на странице входа
    When я вхожу как "anna" с паролем "anna-pass"
    Then я оказываюсь в каталоге
    And в шапке виден бейдж роли "user"
    And пункта «Товары» нет
    And модалка ошибки скрыта
```

### Пример сценария на неверный пароль

```gherkin
  Scenario: Неверный пароль не пускает в каталог
    Given я гость на странице входа
    When я вхожу как "anna" с неверным паролем
    Then я остаюсь на странице входа
    And появляется модалка ошибки
    And в коде ошибки отображается "UNAUTHORIZED"
```

### Пример сценария на заблокированную учётку

```gherkin
  Scenario: Заблокированный пользователь не входит
    Given я гость на странице входа
    When я вхожу как "boris" с паролем "boris-pass"
    Then я остаюсь на странице входа
    And появляется модалка ошибки
    And в коде ошибки отображается "BLOCKED"
```

### Что считается сделанным

Сделано, если:

- файл существует;
- сценариев 3 или 4;
- ключевые слова английские;
- текст сценариев русский;
- Борис не смешан с неверным паролем;
- в `Then` есть наблюдаемые факты: страница, бейдж, код ошибки;
- нет фразы «система работает корректно»;
- нет шага «подождать 2 секунды»;
- нет лишнего админского CRUD.

### Типичные ошибки студентов

- один сценарий сразу на несколько действий;
- вместо фактов: «всё нормально», «ошибка отображается корректно»;
- описание внешнего вида кнопки;
- использование выдуманных данных вместо `anna`, `boris`, `kira`;
- сценарий на 20 строк про весь сайт.

### Полезные ссылки

- Gherkin reference: [https://cucumber.io/docs/gherkin/reference/](https://cucumber.io/docs/gherkin/reference/)
- Kaner и коллеги — про оракулы и проверяемые факты.

---

# Модуль 2. Первый автотест

Здесь начинается Playwright.  
Но пока без Page Object. Студент должен научиться писать простой, читаемый тест:

```text
открыл → ввёл → нажал → увидел ожидаемый факт
```

Главное правило модуля: ищем элементы по `data-testid`, ждём видимое состояние, не используем `waitForTimeout`.

---

## Задача 4. Форма входа просто на месте

### Зачем эта задача

Перед тем как тестировать вход, нужно убедиться, что форма входа вообще соответствует контракту.  
Контракт здесь — это обещание приложения: у поля логина есть `login-input`, у поля пароля есть `password-input`, у кнопки входа есть `login-submit`.

Если этих элементов нет, то проблема не в тесте, а в приложении или в карте селекторов.

### Немного теории своими словами

Локатор — это способ найти элемент на странице.

Плохой локатор:

```js
.page form input:nth-child(1)
```

Почему плохо:

- опирается на структуру вёрстки;
- легко ломается;
- непонятен по смыслу.

Хороший локатор в нашем учебном приложении:

```js
page.getByTestId('login-input')
```

Почему лучше:

- он основан на специальном атрибуте `data-testid`;
- он создан именно для тестов;
- он не зависит от случайных классов и положения элемента.

Проверки вроде `toBeVisible()` называются **web-first assertions**.  
Они не просто мгновенно читают текущее состояние, а ждут разумное время, пока условие не станет истинным.

### Дано в стиле BDD

```gherkin
Feature: Страница входа

  Scenario: Форма входа содержит ожидаемые тестовые идентификаторы
    Given я гость
    And я открываю страницу "/login"
    When страница входа загрузилась
    Then я вижу форму входа с тестовым идентификатором "login-form"
    And я вижу поле логина с тестовым идентификатором "login-input"
    And я вижу поле пароля с тестовым идентификатором "password-input"
    And я вижу кнопку входа с тестовым идентификатором "login-submit"
```

### Что нужно сделать

Написать автотест, который:

1. открывает `/login`;
2. проверяет видимость `login-form`;
3. проверяет видимость `login-input`;
4. проверяет видимость `password-input`;
5. проверяет видимость `login-submit`.

Пароль вводить не нужно.  
Каталог открывать не нужно.  
Логиниться не нужно.

### Пример решения

```ts
import { test, expect } from '@playwright/test';

test('форма входа видна по тестовым идентификаторам', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByTestId('login-form')).toBeVisible();
  await expect(page.getByTestId('login-input')).toBeVisible();
  await expect(page.getByTestId('password-input')).toBeVisible();
  await expect(page.getByTestId('login-submit')).toBeVisible();
});
```

### Что считается сделанным

Сделано, если:

- тест открывает `/login`;
- все элементы ищутся через `getByTestId`;
- нет поиска по CSS-классу;
- нет поиска по `div > input`;
- нет проверки только `page.title()`;
- нет логина;
- тест зелёный.

### Анти-паттерны

Плохо:

```ts
await expect(page.locator('.form-control')).toBeVisible();
```

Плохо:

```ts
await expect(page.locator('form input')).toHaveCount(2);
```

Плохо:

```ts
await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
```

Последний вариант сам по себе не ужасен, но в этой задаче мы сознательно тренируем контракт `data-testid`.

### Полезные ссылки

- [Playwright Locators](https://playwright.dev/docs/locators)
- [Locate by test id](https://playwright.dev/docs/locators#locate-by-test-id)
- [Playwright Assertions](https://playwright.dev/docs/test-assertions)

---

## Задача 5. Анна входит как обычный пользователь

### Зачем эта задача

Это первый полноценный пользовательский сценарий:

1. открыть страницу входа;
2. ввести данные;
3. нажать кнопку;
4. увидеть, что приложение приняло пользователя и дало ему правильную роль.

Здесь важно проверить не только «куда-то попали», но и что роль видна в интерфейсе, а админские пункты не доступны.

### Немного теории своими словами

Хороший автотест отвечает на вопрос из требований.

Вопрос этой задачи:

> Если обычный пользователь входит с верными данными, видит ли он каталог и не видит ли администраторские функции?

Ожидаемый факт:

- URL содержит `/catalog`;
- в шапке виден бейдж роли `user`;
- пункт `nav-admin-products` отсутствует;
- модалка ошибки не видима.

Важно не использовать `waitForTimeout`.  
Playwright сам умеет ждать, пока элемент появится, исчезнет или станет видимым.

### Дано в стиле BDD

```gherkin
Feature: Вход обычного пользователя

  Scenario: Покупатель входит и не видит администраторские пункты
    Given я гость на странице входа
    When я вхожу как "anna" с паролем "anna-pass"
    Then я оказываюсь в каталоге
    And в шапке виден бейдж роли "user"
    And пункта «Товары» нет
    And модалка ошибки скрыта
```

### Что нужно сделать

Написать тест:

1. открыть `/login`;
2. ввести логин `anna`;
3. ввести пароль `anna-pass`;
4. нажать `login-submit`;
5. проверить, что браузер оказался на каталоге;
6. проверить бейдж роли;
7. проверить, что админ-пункта нет;
8. проверить, что модалка ошибки скрыта.

### Пример решения

```ts
import { test, expect } from '@playwright/test';

test('Анна входит как покупатель и не видит админ-пункт', async ({ page }) => {
  await page.goto('/login');

  await page.getByTestId('login-input').fill('anna');
  await page.getByTestId('password-input').fill('anna-pass');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/catalog/);
  await expect(page.getByTestId('role-badge')).toHaveText(/user/i);
  await expect(page.getByTestId('nav-admin-products')).toHaveCount(0);
  await expect(page.getByTestId('app-error')).toBeHidden();
});
```

### Пояснение к последнему ожиданию

В нашем клиенте модалка ошибки присутствует в DOM, но в обычном состоянии скрыта.  
Поэтому здесь уместно использовать:

```ts
await expect(page.getByTestId('app-error')).toBeHidden();
```

Если бы модалка вообще не рендерилась до ошибки, тогда можно было бы использовать:

```ts
await expect(page.getByTestId('app-error')).toHaveCount(0);
```

В обоих случаях важно не просто проверять, что «страница изменилась», а проверять наблюдаемый факт.

### Что считается сделанным

Сделано, если:

- тест входит как `anna`;
- после входа проверяется каталог;
- проверяется бейдж роли;
- проверяется отсутствие админ-пункта;
- нет `waitForTimeout`;
- тест читается как простой пользовательский сценарий.

### Анти-паттерны

Плохо:

```ts
await page.getByTestId('login-submit').click();
await page.waitForTimeout(2000);
```

Плохо:

```ts
await expect(page).toHaveURL('http://localhost:3000/catalog');
```

Лучше использовать регулярное выражение или путь без жёстко вшитого порта:

```ts
await expect(page).toHaveURL(/\/catalog/);
```

### Полезные ссылки

- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- [Playwright Actionability](https://playwright.dev/docs/actionability)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

---

## Задача 6. Неверный пароль не пускает в каталог

### Зачем эта задача

Негативные сценарии важнее позитивных.  
Позитивный сценарий показывает, что приложение работает в идеальных условиях.  
Негативный сценарий показывает, понимает ли приложение, кому нельзя давать доступ.

Здесь важно проверить не просто «не вошли», а конкретный отказ:

- остались на странице входа;
- модалка ошибки видна;
- код ошибки — `UNAUTHORIZED`;
- бейдж роли не появился.

### Немного теории своими словами

Ошибка ошибке рознь.

Например:

- неверный пароль → пользователь существует, но данные не подошли;
- неизвестный логин → пользователь не найден;
- заблокированная учётка → пользователь существует, но вход запрещён.

В текущем контракте приложения неверный пароль и неизвестный логин дают один бизнес-код `UNAUTHORIZED`, но это разные тестовые данные и разные строки чек-листа.

Для этой задачи важно не смешивать Бориса и неверный пароль.  
Борис — это уже другой отказ: `BLOCKED`.

Из идей Майерса здесь полезно помнить: тест ценен тогда, когда он может найти различие в поведении.  
«Просто не пустило» — слишком размытое ожидание.

### Дано в стиле BDD

```gherkin
Feature: Отказ во входе

  Scenario: Неверный пароль оставляет пользователя на странице входа
    Given я гость на странице входа
    And пользователь с логином "anna" существует
    When я ввожу логин "anna"
    And я ввожу неверный пароль
    Then я остаюсь на странице входа
    And появляется модалка ошибки
    And в коде ошибки отображается "UNAUTHORIZED"
    And бейдж роли не появляется
```

### Что нужно сделать

Написать тест:

1. открыть `/login`;
2. ввести логин `anna`;
3. ввести заведомо неверный пароль, например `anna-pass-nope`;
4. нажать кнопку входа;
5. проверить, что видна модалка ошибки;
6. проверить, что код ошибки — `UNAUTHORIZED`;
7. проверить, что браузер остался на `/login`;
8. проверить, что бейдж роли отсутствует.

Пароль должен быть достаточно длинным, чтобы не попасть в ошибку валидации `VALIDATION`.

### Пример решения

```ts
import { test, expect } from '@playwright/test';

test('неверный пароль оставляет на странице входа с ошибкой UNAUTHORIZED', async ({ page }) => {
  await page.goto('/login');

  await page.getByTestId('login-input').fill('anna');
  await page.getByTestId('password-input').fill('anna-pass-nope');
  await page.getByTestId('login-submit').click();

  await expect(page.getByTestId('app-error')).toBeVisible();
  await expect(page.getByTestId('app-error-code')).toHaveText('UNAUTHORIZED');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId('role-badge')).toHaveCount(0);
});
```

### Что считается сделанным

Сделано, если:

- тест использует существующий логин `anna`;
- пароль заведомо неверный;
- проверяется код ошибки;
- проверяется, что каталог не открылся;
- проверяется отсутствие бейджа роли;
- нет `waitForTimeout`;
- тест не пытается проверить сразу Бориса или пустые поля.

### Анти-паттерны

Плохо:

```ts
await page.getByTestId('login-submit').click();
await page.waitForTimeout(1000);
```

Плохо:

```ts
await expect(page.getByTestId('app-error')).toBeVisible();
```

без проверки кода ошибки.

Плохо:

```ts
await page.getByTestId('login-input').fill('boris');
```

в этой задаче. Борис относится к другому правилу.

### Полезные ссылки и идеи

- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- [Playwright Actionability](https://playwright.dev/docs/actionability)
- Myers — важно различать виды отказов, а не писать «не сработало».
- Copeland — разные входные данные могут относиться к разным классам поведения.

---

Это первые шесть задач: задачи 1–3 из модуля 1 и задачи 4–6 из модуля 2.

### USER
пока кажется что хорошо получается. Уточню - моя задача научить студентов best-practices тестирования и конкретно их применения для тестирования браузерных промышленных приложений. Дальше будут блоки по 3 - 5 задач, выдавай их в том же процессе в котором предыдуще задачи выдавал. Если считаешь, что можно что то добавить, чтобы выработать навыки и мышление тестера лучше - напиши как

### ASSISTANT
Да, тогда курс лучше позиционировать не как «курс Playwright», а как:

> **практикум по инженерному тестированию браузерных приложений, где Playwright — основной инструмент автоматизации.**

Это важная рамка. Иначе студенты быстро уходят в «как написать селектор», но не учатся понимать, **зачем этот тест существует**, **какой риск он закрывает** и **почему он не должен флакать**.

Ниже — что я бы добавил в процесс, чтобы сильнее формировать мышление тестировщика и привычки, близкие к промышленной разработке.

---

## 1. В каждой задаче явно держать цепочку

Я бы в каждой практической задаче повторял одну и ту же связку:

```text
Правило продукта → риск → проверка → наблюдаемый факт → автотест
```

Например для задачи про неверный пароль:

```text
Правило:
Пользователь с неверным паролем не должен получить сессию.

Риск:
Если вход случайно разрешится, чужой человек попадёт в каталог.

Проверка:
Ввести существующий логин и неверный пароль.

Наблюдаемые факты:
Остаёмся на /login, видим модалку, код UNAUTHORIZED, бейдж роли не появился.

Автотест:
Playwright-сценарий через data-testid без sleep.
```

Так студент начинает понимать, что тест — это не «шаги», а инженерное утверждение.

---

## 2. Добавить маленький блок «Какой вопрос задаёт этот тест?»

Перед каждым автотестом можно просить студента одной строкой написать:

```ts
// Вопрос: пустит ли обычного пользователя с верным паролем в каталог без админских прав?
```

Или в Markdown:

```text
Вопрос теста:
Если Анна входит с правильным паролем, получает ли она роль user и не видит ли админ-раздел?
```

Это очень простая привычка, но она отучает писать кликеры.

Плохой тест после такого вопроса сразу видно:

```text
Вопрос: работает ли логин?
```

Слишком мутно.

Хороший:

```text
Вопрос: заблокированная учётная запись не получает доступ даже с верным паролем?
```

---

## 3. Ввести «запрещённые привычки» как постоянный список

Для начинающих это очень полезно. Не просто «лучше так», а прямо:

### В этом курсе запрещено без отдельного разрешения

- `page.waitForTimeout(...)`;
- CSS-селекторы по классам Bootstrap;
- XPath;
- «третий div во второй карточке»;
- один тест на пять правил;
- `test.skip`, если не понял, почему падает;
- зависимость одного теста от результата другого;
- ручное исправление базы между тестами;
- проверка только URL, если есть более точный пользовательский факт;
- проверка `textContent()` без web-first assertion;
- «зелёный тест» без понимания, что он доказывает.

Это не догма навсегда, но хорошая учебная дисциплина.

---

## 4. После каждой задачи давать мини-разбор «что здесь промышленного»

Например задача 5, успешный вход:

```text
Что здесь похоже на промышленный проект:
- используем стабильные test id;
- не спим, а ждём состояние;
- проверяем роль, а не только URL;
- не лезем в базу;
- не проверяем внутренний hash пароля;
- тест можно читать без знания вёрстки.
```

Задача 9, таблица каталога:

```text
Что здесь промышленного:
- проверяем контракт пагинации глазами пользователя;
- seed-данные стабильны;
- не считаем скрытые товары;
- не проверяем каждую строку руками, если правило про количество строк на странице.
```

Так студенты связывают упражнение с реальной работой.

---

## 5. Добавить рубрику «Как этот тест может стать flaky»

Очень полезно для E2E.

Например:

### Для логина

Может флакать, если:

- после клика поставить `waitForTimeout(1000)`;
- проверять URL до завершения навигации неправильным способом;
- использовать селектор `.btn-primary`;
- запускать тесты в одном браузерном контексте и случайно сохранить сессию от прошлого теста.

### Для поиска

Может флакать, если:

- не дождаться обновления таблицы;
- проверять строки до завершения debounce;
- считать все `tr`, включая заголовок;
- не очистить строку поиска перед новым вводом.

Эта рубрика хорошо готовит к промышленным UI-тестам.

---

## 6. Раньше ввести понятие «наблюдаемое поведение vs реализация»

Студенты-разработчики часто хотят лезть внутрь.

Нужно повторять:

```text
E2E-тест не спрашивает:
- какой именно массив лежит в памяти клиента;
- каким алгоритмом сервер отсортировал товары;
- какой hash у пароля;
- какая функция вызвалась.

E2E-тест спрашивает:
- что увидел пользователь;
- какой ответ вернул публичный API;
- изменилась ли доступная пользователю страница;
- появился ли понятный отказ.
```

И отдельно:

```text
В базу лезем только в модуле белого ящика и только когда внешний интерфейс не показывает нужный факт.
```

Это сильная промышленная привычка.

---

## 7. В каждой задаче иметь «не проверяй лишнее»

Начинающие часто пишут слишком широкий тест.

Например задача «неверный пароль» может превратиться в:

- проверить заголовок;
- проверить цвет кнопки;
- проверить placeholder;
- проверить текст всей модалки;
- проверить путь `/catalog`;
- проверить logout.

Нужно прямо писать:

```text
Не проверяй здесь:
- успешный вход;
- Бориса;
- пустые поля;
- каталог;
- профиль;
- внешний вид Bootstrap;
- точный текст всей ошибки, если задача про код.
```

Это учит фокусироваться.

---

## 8. Добавить «маленькие ревью теста»

После блока из 3–5 задач можно давать упражнение не на написание, а на ревью.

Например:

```ts
test('login works', async ({ page }) => {
  await page.goto('/login');
  await page.locator('.form-control').first().fill('anna');
  await page.locator('.form-control').nth(1).fill('anna-pass');
  await page.locator('.btn-primary').click();
  await page.waitForTimeout(2000);
  await expect(page.url()).toContain('/catalog');
});
```

Вопрос студенту:

```text
Найди минимум 5 проблем.
```

Ожидаемые ответы:

- название не говорит о правиле;
- CSS-классы;
- `nth`;
- `waitForTimeout`;
- `page.url()` вместо `toHaveURL`;
- проверяется только URL;
- не проверяется роль;
- не проверяется отсутствие админ-пункта.

Это очень хорошо прокачивает мышление.

---

## 9. Добавить «переделай плохой тест в хороший»

Это лучше, чем просто писать с нуля.

Формат:

```text
Было — тест зелёный, но плохой.
Стало — тот же смысл, но промышленнее.
```

Например:

```ts
// Было
await page.locator('.btn-primary').click();
await page.waitForTimeout(1000);
expect(await page.locator('.badge').textContent()).toBe('user');
```

```ts
// Стало
await page.getByTestId('login-submit').click();
await expect(page.getByTestId('role-badge')).toHaveText(/user/i);
```

Это прямо формирует best-practices через контраст.

---

## 10. Ввести короткую «карту качества» для каждого блока

Например после модуля 2 студент должен уметь:

```text
После модуля 2 я умею:
- найти элемент через data-testid;
- отличить видимый элемент от существующего в DOM;
- написать web-first assertion;
- проверить успешный и негативный логин;
- не использовать sleep;
- объяснить, какой вопрос задаёт мой тест.
```

После модуля 3:

```text
После модуля 3 я умею:
- проверять таблицы;
- отличать пустой результат от ошибки;
- проверять фильтр, поиск и сортировку отдельно;
- не смешивать каталог, профиль и logout в один тест;
- выбирать наблюдаемый факт.
```

Это даёт студенту ощущение прогресса не только по синтаксису.

---

## 11. Добавить «словарик рядом с задачами»

Не отдельная лекция на 40 терминов, а по 2–3 термина в момент применения.

Например:

### В задаче про неверный пароль

```text
Негативный сценарий — проверка, что система правильно отказывает.
Оракул — источник ожидания. Здесь это описание правил входа.
Наблюдаемый факт — то, что можно увидеть через UI или публичный API.
```

### В задаче про пустые поля

```text
Валидация — проверка входных данных.
Класс эквивалентности — группа значений, для которых ожидается одно поведение.
```

### В задаче про пагинацию

```text
Контракт UI — обещание интерфейса: на странице каталога показываем 10 строк.
Граничное значение — значение рядом с переходом поведения, например page=1, page=0.
```

Так терминология не будет абстрактной.

---

## 12. Для браузерных промышленных приложений обязательно добавить темы

В плане они уже частично есть, но я бы сделал акцент сильнее.

### Обязательно

1. **Стабильные локаторы**
   - `data-testid`;
   - role/name;
   - почему CSS-классы опасны;
   - когда text locator нормален, а когда хрупкий.

2. **Web-first assertions**
   - `toBeVisible`;
   - `toHaveText`;
   - `toHaveURL`;
   - `toHaveCount`;
   - почему не `await locator.textContent()` в асинхронном UI.

3. **Изоляция тестов**
   - каждый тест сам готовит состояние;
   - отдельные browser context;
   - storageState позже, не сразу;
   - тесты не зависят от порядка.

4. **Тестовые данные**
   - seed;
   - уникальные имена;
   - фабрики данных;
   - не чистить всю базу ради одного теста.

5. **Роли и доступ**
   - `user` и `admin`;
   - UI-ограничение и API-ограничение;
   - «кнопки нет» не равно «доступ невозможен».

6. **Сеть и ошибки**
   - 500/503;
   - timeout;
   - retry на уровне раннера осторожно;
   - модалка не должна превращать ошибку в «пустую таблицу».

7. **Отладка падений**
   - trace;
   - screenshot;
   - video;
   - как читать report;
   - как отличить баг продукта от бага теста.

8. **Не всё нужно автоматизировать**
   - риск;
   - цена поддержки;
   - смоук;
   - регресс;
   - ручное exploratory.

---

## 13. Я бы добавил одну постоянную форму сдачи для задач

Для задач с автотестом:

```text
Сдать:
1. .feature-сценарий или ссылка на него.
2. Playwright-тест.
3. Короткий ответ: какой вопрос задаёт тест?
4. Короткий ответ: какой observable факт доказывает результат?
5. Если тест падал — что было причиной?
```

Это заставляет думать, а не просто копировать код.

---

## 14. Добавить «красные разборы»

Периодически давать студенту заведомо плохой тест и просить объяснить, почему он плохой.

Например:

```ts
test('catalog', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input', 'anna');
  await page.fill('input[type=password]', 'anna-pass');
  await page.click('button');
  await page.waitForTimeout(3000);
  await page.goto('/catalog');
  await expect(page.locator('tr')).toHaveCount(11);
});
```

Проблемы:

- не `data-testid`;
- `input` неоднозначен;
- `button` неоднозначен;
- sleep;
- после логина вручную делает `goto('/catalog')`, скрывая проблему редиректа;
- считает `tr` вместе с заголовком;
- название теста ничего не говорит;
- нет проверки роли;
- непонятно, какое правило проверяется.

Это очень промышленный навык: уметь ревьюить тесты.

---

## 15. Добавить мини-ритуал перед написанием теста

Перед кодом студент должен ответить:

```text
1. Что я проверяю?
2. Откуда я знаю ожидаемый результат?
3. Какой минимальный сценарий это проверяет?
4. Как я пойму, что тест упал из-за бага продукта, а не из-за плохого ожидания?
5. Какие данные мне нужны?
```

На первых задачах это можно требовать явно. Потом уйдёт в привычку.

---

## 16. По стилю следующих задач

Я бы дальше продолжал в таком формате:

```text
Задача N. Название

Зачем это нужно
Короткий человеческий контекст.

Термины на сегодня
2–3 термина, без энциклопедии.

Дано в стиле BDD
*.feature-фрагмент с Given/When/Then.

Что сделать
Конкретные шаги.

Что увидеть
Наблюдаемые факты.

Пример кода или скелет
Если задача beginner — можно полный пример.
Если дальше — только каркас.

Куда обычно промахиваются
Типичные ошибки.

Что считается хорошим решением
Краткий список.

Полезные ссылки
Playwright / Gherkin / тест-дизайн.
```

И да, блоки по 3–5 задач дальше лучше выдавать именно так.

---

## Главное, что я бы добавил концептуально

Я бы постоянно повторял студентам одну мысль:

> Хороший E2E-тест — это не автоматизированный пользователь.  
> Это проверяемое утверждение о поведении продукта, написанное через браузер.

Если они это усвоят, то Playwright, POM, fixtures, storageState и APIRequestContext лягут нормально.  
Если нет — получится набор длинных сценариев, которые вроде зелёные, но дорогие, хрупкие и непонятно что доказывают.

### USER
Правило продукта → риск → проверка → наблюдаемый факт → автотест - это какой то теоритический принцип?

### ASSISTANT
Нет, это **не один общепризнанный теоретический принцип** с официальным названием.

Это скорее **учебная сборка** из нескольких общепринятых идей тестирования. Я бы назвал это так:

> **Цепочка проектирования теста: от требования к автоматизации.**

Или по-другому:

> **Правило → риск → проверка → факт → автоматизация.**

Это не «закон тестирования», но очень полезная рамка для новичков. Она мешает сразу писать автотест и заставляет сначала понять, что именно проверяется и зачем.

---

## Из каких теоретических идей это собрано

### 1. Тест как вопрос к продукту

Это близко к идеям Канера и книги *Lessons Learned in Software Testing*.

Тест — это не просто набор шагов:

```text
открыл → кликнул → кликнул → кликнул
```

Тест — это вопрос:

```text
Пустит ли система пользователя с неверным паролем?
```

И после прогона должен быть понятный ответ:

```text
Да / Нет / Поведение не соответствует правилам
```

В нашей цепочке это части:

```text
Правило продукта → проверка
```

---

### 2. Оракул: откуда мы знаем ожидаемый результат

Тоже важная тема из тестовой литературы.

**Оракул** — это источник ожидания.

Например:

- описание проекта;
- feature-файл;
- контракт API;
- UI-контракт с `data-testid`;
- фактическое поведение стабильной сборки;
- документированное правило продукта.

В нашей цепочке это части:

```text
Правило продукта → наблюдаемый факт
```

Если ожидаемый факт нельзя вывести из правила, тест начинает проверять фантазию автора.

Пример плохого ожидания:

```text
Товар с нулевым остатком должен исчезать из витрины.
```

Если в требованиях этого нет, это не тест, а выдуманное правило.

---

### 3. Риск-ориентированное тестирование

Это есть и в ISTQB, и в книгах по управлению тестированием, и в здравом смысле промышленной разработки.

Не всё нужно проверять одинаково внимательно.

Например:

- падение входа — высокий риск;
- неправильный цвет кнопки — низкий риск;
- пользователь видит чужие админские разделы — высокий риск;
- неверный текст заглушки — низкий риск.

В нашей цепочке это часть:

```text
Риск
```

Она помогает ответить на вопрос:

```text
Почему этот тест вообще нужен?
```

Если риска нет, возможно, тест лишний.

---

### 4. Наблюдаемый результат вместо реализации

Это важная идея для браузерных и промышленных приложений.

Тест должен проверять не внутренности кода, а наблюдаемое поведение:

```text
Что пользователь видит?
Что вернул публичный API?
Какой URL открылся?
Какая ошибка появилась?
Какой элемент исчез или появился?
```

В нашей цепочке это часть:

```text
Наблюдаемый факт
```

Например:

```text
После неверного пароля пользователь остаётся на /login,
видит модалку ошибки,
в коде ошибки отображается 401 или соответствующий бизнес-код,
бейдж роли не появляется.
```

Это наблюдаемые факты.

А вот это уже не нужно для чёрного ящика:

```text
Сервер вычислил SHA-256 и сравнил хеш.
```

Это реализация.

---

### 5. Автоматизация в конце, а не в начале

Это уже больше инженерная и педагогическая рамка.

Автотест — это не самоцель.

Сначала:

```text
Понять правило.
Понять риск.
Придумать проверку.
Определить наблюдаемый факт.
```

И только потом:

```ts
await page.getByTestId("login-submit").click();
await expect(page.getByTestId("app-error")).toBeVisible();
```

Если начать с автотеста, получится «кликер», который может быть зелёным, но бесполезным.

---

## Как это соотносится с общими терминами

| Наша цепочка     | Близкий тестовый термин                       |
| ---------------- | --------------------------------------------- |
| Правило продукта | требование, спецификация, test basis          |
| Риск             | риск, приоритет, вероятность и влияние отказа |
| Проверка         | тестовое условие, тест-кейс, сценарий         |
| Наблюдаемый факт | ожидаемый результат, оракул                   |
| Автотест         | автоматизированный тест, тестовый скрипт      |

То есть цепочка похожа на упрощённую трассировку:

```text
Требование → тестовое условие → тест-кейс → ожидаемый результат → автотест
```

Только слово «риск» добавлено, чтобы студент понимал, почему проверка вообще важна.

---

## Пример на логине

Возьмём правило:

```text
Если пользователь вводит неверный пароль, система не пускает его в каталог.
```

Цепочка будет такой:

```text
Правило продукта:
Неверный пароль не даёт войти.

Риск:
Если пустить с неверным паролем, чужой человек получит доступ.

Проверка:
Ввести существующий логин и неверный пароль.

Наблюдаемый факт:
Остаёмся на /login.
Модалка ошибки видна.
Код ошибки соответствует контракту.
Бейдж роли не появляется.

Автотест:
Открыть /login,
ввести логин,
ввести неверный пароль,
нажать кнопку входа,
проверить ошибку и отсутствие каталога.
```

Вот по этой цепочке студент сразу видит, что тест — не «кликнуть по кнопке», а проверка конкретного правила.

---

## Почему это полезно именно для студентов

Разработчик обычно думает так:

```text
Как мне написать код, чтобы тест прошёл?
```

Или:

```text
Какой селектор найти?
```

А тестировщику нужно думать так:

```text
Какое поведение продукта я проверяю?
Что может пойти не так?
Как я пойму, что тест прав?
```

Цепочка заставляет переходить от механики к смыслу.

---

## Можно ли это называть принципом?

Если хочешь использовать в курсе, можно назвать это учебным принципом:

```text
Не автоматизируй то, что не можешь объяснить как правило и наблюдаемый факт.
```

Или короче:

```text
Сначала вопрос, потом код.
```

Но формально это не общепринятый стандарт и не цитата из одной книги.

Это методическая упаковка нескольких нормальных вещей:

- требования как источник ожиданий;
- риск как причина приоритизации;
- тест как вопрос;
- ожидаемый результат как оракул;
- автоматизация как последняя стадия оформления проверки.

Для студентов это очень хорошая рамка. Особенно если они впервые сталкиваются с тестированием и сразу хотят писать `page.click()`.

### USER
ок, твои правки имеют смысл. Но сделай правило "Ввести «запрещённые привычки» как постоянный список"  более мягким  и более простым блок про ревью и дальше задачи делай уже с правками. Образец от другой нейронки который переписываем с нашими правилами.

### ASSISTANT
Ок, смягчаем формулировку про «запрещённые привычки» и делаем блок ревью проще. Дальше продолжаю задачи уже с этими правками.

Ниже — обновлённая рамка, а затем блок задач **7–10**: конец модуля 2 и начало модуля 3.

---

# Обновлённая учебная рамка

## 1. Мягкая версия «привычек, за которыми стоит следить»

Вместо жёсткого списка запретов лучше использовать формулировку:

> Это не «смертные грехи», а сигналы. Если ты замечаешь такой сигнал в своём тесте, остановись и спроси: какое правило продукта я сейчас проверяю и какой наблюдаемый факт мне нужен?

### Привычки, которые стоит замечать

| Сигнал                                                                     | Что лучше сделать вместо него                                                                                             |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Хочется поставить `waitForTimeout(2000)`                                   | Назови состояние, которое ждёшь: видимость, текст, URL, количество строк. Обычно это можно проверить через `expect(...)`. |
| Хочется найти элемент по классу `btn-primary` или `form-control`           | Проверь, есть ли `data-testid`. Если нет — подумай про роль и подпись элемента.                                           |
| Один тест хочет проверить вход, поиск, профиль и выход                     | Раздели тест. Разные правила продукта должны падать по отдельности.                                                       |
| Тест знает, что сервер всегда на `http://localhost:3000`                   | Лучше использовать относительные пути и `baseURL` из конфига.                                                             |
| Тест падает, если его запустили после другого теста                        | Проверь изоляцию: каждый тест должен сам приводить себя в нужное состояние.                                               |
| Хочется написать `test.skip`, потому что «иногда падает»                   | Рядом должна быть причина. Не «магия», а описание: что именно нестабильно и почему.                                       |
| Тест проверяет внутренности реализации, хотя есть внешний наблюдаемый факт | Для браузерного теста обычно достаточно экрана, публичного ответа или понятного изменения состояния.                      |

То есть идея такая:

> Не «нельзя никогда», а «если здесь появляется такой приём, значит нужно осознанно объяснить зачем».

Но для первых модулей курсу всё равно нужен простой ориентир:

```text
Пока учимся:
- ищем элементы по data-testid;
- ждём состояние через веб-ассерты;
- не проверяем несколько несвязанных правил в одном тесте.
```

---

## 2. Простой блок ревью

Чтобы ревью не превращалось в тяжёлую процедуру, используем короткий чек-лист.

### Мини-ревью теста

Перед сдачей ответь на пять вопросов:

1. **Какой один вопрос задаёт тест?**
2. **Какое правило продукта он проверяет?**
3. **Какой наблюдаемый факт доказывает результат?**
4. **Есть ли в тесте ожидание времени или хрупкий селектор?**
5. **Если тест упадёт, будет ли понятно, что именно не совпало?**

Если совсем коротко:

```text
Тест читается как сценарий?
Есть понятный ожидаемый факт?
Нет ли сна или случайного селектора?
```

Этого для первых модулей достаточно.

---

## 3. Важное замечание про текущий код

В сервере и клиенте, которые мы собрали ранее, в модалке ошибки отображается бизнес-код ошибки:

- `UNAUTHORIZED` вместо числового `401`;
- `VALIDATION` вместо числового `422`;
- `BLOCKED` вместо числового `403`.

Поэтому в задачах ниже проверяются именно эти коды.

Если позже ты решишь показывать в модалке числовой статус, то в тестах нужно будет заменить:

```ts
await expect(page.getByTestId('app-error-code')).toHaveText('VALIDATION');
```

на:

```ts
await expect(page.getByTestId('app-error-code')).toHaveText('422');
```

Но для текущего кода ожидаем `VALIDATION`, `UNAUTHORIZED`, `BLOCKED`.

---

# Продолжение задач

## Задача 7. Пустые поля: валидация, а не авторизация

### Зачем эта задача

Пустые поля формы входа — это не «неверный пароль» и не «пользователь не найден».  
Это отдельное правило: сервер не принимает невалидные данные и отвечает ошибкой валидации.

Если студент пишет тест, который ожидает `401` на пустую форму, он склеивает две разные проблемы:

- сломалась авторизация;
- сломалась валидация формы.

В промышленном тестировании важно различать эти отказы.

### Цепочка задачи

```text
Правило продукта:
Если отправить форму входа с пустыми полями, сервер должен вернуть ошибку валидации.

Риск:
Если пустые поля будут приняты или будут обработаны как обычная ошибка авторизации,
пользователь не поймёт, что он не заполнил форму, а тесты не отличат валидацию от логина.

Проверка:
Нажать кнопку входа, не заполняя поля.

Наблюдаемый факт:
Остаёмся на /login.
Модалка ошибки видна.
Код ошибки — VALIDATION.
Бейдж роли не появляется.

Автотест:
Открыть /login, нажать login-submit, проверить модалку и код ошибки.
```

### Немного теории

Здесь полезно ввести два термина:

- **валидация** — проверка входных данных;
- **класс эквивалентности** — набор входных данных, для которых ожидается одинаковое поведение.

Например:

```text
Класс «пустые обязательные поля» → ожидаем ошибку валидации.
Класс «существующий пользователь, но неверный пароль» → ожидаем ошибку авторизации.
```

Это разные классы, и один тест не должен заменять оба.

### Дано в стиле BDD

```gherkin
Feature: Валидация формы входа

  Scenario: Пустые поля не создают сессию
    Given я гость на странице входа
    When я нажимаю кнопку входа, не заполняя поля
    Then я остаюсь на странице входа
    And появляется модалка ошибки
    And в коде ошибки отображается "VALIDATION"
    And бейдж роли не появляется
```

### Что нужно сделать

Написать тест, который:

1. открывает `/login`;
2. не заполняет логин и пароль;
3. нажимает кнопку входа;
4. проверяет, что видна модалка ошибки;
5. проверяет, что код ошибки — `VALIDATION`;
6. проверяет, что браузер остался на `/login`;
7. проверяет, что бейдж роли не появился.

Не нужно вводить пробелы, стирать символы или проверять `401`.  
Это отдельное правило.

### Пример решения

```ts
import { test, expect } from '@playwright/test';

test('пустые поля формы входа дают ошибку валидации', async ({ page }) => {
  await page.goto('/login');

  await page.getByTestId('login-submit').click();

  await expect(page.getByTestId('app-error')).toBeVisible();
  await expect(page.getByTestId('app-error-code')).toHaveText('VALIDATION');
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId('role-badge')).toHaveCount(0);
});
```

### Мини-ревью

Проверь:

- тест отвечает на вопрос «что будет, если отправить пустую форму?»;
- тест не проверяет неверный пароль;
- тест проверяет код ошибки;
- тест не использует `waitForTimeout`;
- тест не ожидает каталог.

### Частые ловушки

- Ожидать `401` вместо валидации.
- Писать `fill('')` и думать, что это «очистка обязательных полей».
- Проверять только видимость модалки, но не проверять код.
- Смешивать этот сценарий с неверным паролем.
- Считать, что «кнопка просто не нажалась», если в приложении нет браузерного `required`.

### Полезные ссылки

- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- [Playwright Locators](https://playwright.dev/docs/locators)
- Copeland — идея классов эквивалентности: разные входные данные могут означать разные правила поведения.

---

## Задача 8. Вход без паузы «на всякий случай»

### Зачем эта задача

Эта задача не про новое поведение приложения.  
Она про привычку не подменять ожидание состояния обычным сном.

После входа Анны тест должен убедиться, что:

- браузер оказался в каталоге;
- бейдж роли показывает `user`;
- админ-пункт отсутствует;
- модалка ошибки не видна.

И всё это можно проверить без `waitForTimeout`.

### Цепочка задачи

```text
Правило продукта:
Пользователь с верным паролем попадает в каталог и получает свою роль.

Риск:
Если тест будет ждать фиксированное время, он станет медленным и нестабильным:
на быстрой машине будет спать зря, а на медленной может всё равно кликнуть рано.

Проверка:
Войти как Анна и дождаться состояния интерфейса.

Наблюдаемый факт:
URL содержит /catalog.
Бейдж роли показывает user.
Админ-пункт отсутствует.
Модалка ошибки скрыта.

Автотест:
Использовать действия и веб-ассерты без искусственного сна.
```

### Немного теории

Важно объяснить студентам разницу:

```text
Плохой вопрос тесту:
«Прошло ли две секунды после клика?»

Хороший вопрос тесту:
«Появился ли уже каталог и бейдж роли?»
```

`waitForTimeout` проверяет время.  
Веб-ассерт проверяет состояние.

В большинстве браузерных тестов нам важно состояние, а не время.

### Дано в стиле BDD

```gherkin
Feature: Вход без искусственных пауз

  Scenario: Вход Анны проверяется состоянием интерфейса
    Given я гость на странице входа
    When я вхожу как "anna" с паролем "anna-pass"
    Then я оказываюсь в каталоге
    And в шапке виден бейдж роли "user"
    And пункта «Товары» нет
    And модалка ошибки скрыта
```

Отдельное учебное условие задачи:

```text
В файле теста нет искусственной паузы.
```

### Что нужно сделать

Написать тест входа Анны, в котором:

- есть `page.goto('/login')`;
- есть ввод логина и пароля через `data-testid`;
- есть клик по кнопке входа;
- есть ожидание каталога через `toHaveURL`;
- есть проверка бейджа роли;
- есть проверка отсутствия админ-пункта;
- нет `waitForTimeout`.

### Пример решения

```ts
import { test, expect } from '@playwright/test';

test('Анна входит без искусственных пауз', async ({ page }) => {
  await page.goto('/login');

  await page.getByTestId('login-input').fill('anna');
  await page.getByTestId('password-input').fill('anna-pass');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/catalog/);
  await expect(page.getByTestId('role-badge')).toHaveText(/user/i);
  await expect(page.getByTestId('nav-admin-products')).toHaveCount(0);
  await expect(page.getByTestId('app-error')).toBeHidden();
});
```

### Что здесь заменяет сон

В этом тесте нет явного ожидания времени, но ожидания есть:

```ts
await expect(page).toHaveURL(/\/catalog/);
```

ждёт, пока адрес страницы станет похож на каталог.

```ts
await expect(page.getByTestId('role-badge')).toHaveText(/user/i);
```

ждёт, пока бейдж роли появится и будет содержать нужный текст.

```ts
await expect(page.getByTestId('nav-admin-products')).toHaveCount(0);
```

проверяет, что админ-пункта нет.

### Мини-ревью

Проверь:

- тест спрашивает «мы уже в каталоге?», а не «прошло ли 2 секунды?»;
- в коде нет `waitForTimeout`;
- нет `setTimeout`;
- нет хелпера вида `delay(2000)`;
- нет `slowMo`, который просто прячет ту же проблему.

### Частые ловушки

- Переименовать `waitForTimeout` в `sleep` или `delay`.
- Поставить большой `timeout` на каждый ассерт и считать это решением.
- Убрать сон, но не добавить проверку состояния.
- Проверять только URL и забыть про бейдж роли.

### Полезные ссылки

- [Playwright Actionability](https://playwright.dev/docs/actionability)
- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

---

# Модуль 3. Витрина глазами пользователя

Начинаем уходить от формы входа к самому продукту: каталог, строки таблицы, поиск, пустой результат.

---

## Задача 9. Десять строк на первой странице каталога

### Зачем эта задача

Каталог — это не просто таблица.  
У него есть контракт:

- пользователь видит только активные товары;
- на одной странице показывается 10 строк;
- если товаров больше, появляется пагинация.

В стартовых данных 25 активных товаров.  
Значит, на первой странице пользователь должен увидеть 10 строк, а пагинация должна быть видна.

### Цепочка задачи

```text
Правило продукта:
На странице каталога показывается 10 активных товаров.

Риск:
Если пагинация сломается, пользователь может потерять товары или увидеть лишнее.
Если скрытые товары попадут в витрину, нарушится правило доступа.

Проверка:
Войти как покупатель и открыть каталог.

Наблюдаемый факт:
В таблице 10 строк товаров.
Пагинация видна.
Модалка ошибки скрыта.

Автотест:
Вход Анны, проверка количества catalog-row и видимости пагинации.
```

### Дано в стиле BDD

```gherkin
Feature: Каталог глазами покупателя

  Scenario: Первая страница показывает десять товаров
    Given я вошёл как покупатель "anna"
    When я открываю каталог
    Then в таблице отображается 10 строк товаров
    And пагинация видна
    And модалка ошибки скрыта
```

### Что нужно сделать

Написать тест, который:

1. входит как `anna`;
2. дожидается каталога;
3. считает строки с `data-testid="catalog-row"`;
4. ожидает ровно 10 строк;
5. проверяет, что пагинация видна;
6. проверяет, что модалка ошибки скрыта.

### Пример решения

```ts
import { test, expect } from '@playwright/test';

test('на первой странице каталога видно 10 строк товаров', async ({ page }) => {
  await page.goto('/login');

  await page.getByTestId('login-input').fill('anna');
  await page.getByTestId('password-input').fill('anna-pass');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/catalog/);

  await expect(page.getByTestId('catalog-row')).toHaveCount(10);
  await expect(page.getByTestId('catalog-pagination')).toBeVisible();
  await expect(page.getByTestId('app-error')).toBeHidden();
});
```

### Пояснение

Мы считаем только строки товаров:

```ts
page.getByTestId('catalog-row')
```

Заголовок таблицы не имеет `catalog-row`, поэтому он не попадёт в подсчёт.

Это важный момент для студентов:

```text
Не считай все <tr>, если тебе нужны только товарные строки.
```

### Мини-ревью

Проверь:

- тест считает именно строки товаров, а не заголовок;
- тест не ожидает 25 строк на первой странице;
- тест не проверяет скрытые товары;
- тест не использует `waitForTimeout`;
- тест не проверяет сразу поиск или сортировку.

### Частые ловушки

- Считать все `tr`, включая заголовок.
- Ожидать 25 строк, потому что «в базе 25 активных товаров».
- Не дождаться загрузки таблицы.
- Проверять только количество строк, но не проверить, что страница вообще каталог.
- Пытаться в этой же задаче проверить поиск.

### Полезные ссылки

- [Playwright Locators](https://playwright.dev/docs/locators)
- [Playwright Assertions](https://playwright.dev/docs/test-assertions)

---

## Задача 10. Поиск: найти и не принять пустоту за ошибку

### Зачем эта задача

Поиск в каталоге — это отдельное правило продукта:

- если товары найдены, таблица показывает только подходящие строки;
- если товары не найдены, это не ошибка, а пустой результат;
- ошибка — это модалка, а не пустая таблица.

Студенты часто путают:

```text
Пустой список — это баг?
```

Нет, если запрос корректный, но совпадений нет.

А вот:

```text
Пустой список + модалка ошибки
```

— уже проблема.

### Цепочка задачи

```text
Правило продукта:
Поиск фильтрует товары по подстроке в названии.
Пустой результат поиска не является ошибкой.

Риск:
Если пустой результат показывать как ошибку, пользователь решит, что сервис сломан.
Если поиск не фильтрует, пользователь не найдёт нужный товар.

Проверка:
Ввести существующий поисковый запрос.
Ввести запрос, которого точно нет.

Наблюдаемые факты:
Для существующего запроса видны только подходящие строки.
Для несуществующего запроса видна пустая таблица и нет модалки ошибки.

Автотесты:
Два сценария: успешный поиск и пустой результат.
```

### Дано в стиле BDD

```gherkin
Feature: Поиск по каталогу

  Scenario: Поиск оставляет только подходящие товары
    Given я вошёл как покупатель "anna"
    When я ввожу запрос "тетра" в поле поиска
    Then в таблице остаются только строки, содержащие "тетра"
    And модалка ошибки не появляется

  Scenario: Пустой результат не является ошибкой
    Given я вошёл как покупатель "anna"
    When я ввожу запрос, которого нет в витрине
    Then я вижу пустую таблицу
    And модалка ошибки не появляется
```

### Что нужно сделать

Сделать два теста.

#### Первый тест

1. Войти как `anna`.
2. Ввести в поиск `тетра`.
3. Подтвердить поиск.
4. Проверить, что строки с товарами остались только подходящие.
5. Проверить, что модалка ошибки скрыта.

#### Второй тест

1. Войти как `anna`.
2. Ввести запрос, которого нет в товарах, например `zzz-no-match`.
3. Подтвердить поиск.
4. Проверить, что строк товаров нет.
5. Проверить, что видно сообщение пустого результата.
6. Проверить, что модалка ошибки скрыта.

### Пример решения

Здесь уже можно завести маленькую локальную функцию для входа.  
Это ещё не Page Object и не фикстура, просто способ не повторять один и тот же код дважды.

```ts
import { test, expect } from '@playwright/test';

async function loginAsAnna(page) {
  await page.goto('/login');

  await page.getByTestId('login-input').fill('anna');
  await page.getByTestId('password-input').fill('anna-pass');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/catalog/);
}

test('поиск оставляет только подходящие товары', async ({ page }) => {
  await loginAsAnna(page);

  const search = page.getByTestId('catalog-search');

  await search.fill('тетра');
  await search.press('Enter');

  await expect(page).toHaveURL(/q=/);

  const rows = page.getByTestId('catalog-row');

  await expect(rows).toHaveCount(5);
  await expect(rows.filter({ hasText: /тетра/i })).toHaveCount(5);

  await expect(page.getByTestId('app-error')).toBeHidden();
});

test('пустой результат поиска не является ошибкой', async ({ page }) => {
  await loginAsAnna(page);

  const search = page.getByTestId('catalog-search');

  await search.fill('zzz-no-match');
  await search.press('Enter');

  await expect(page.getByTestId('catalog-row')).toHaveCount(0);
  await expect(page.getByTestId('catalog-empty')).toBeVisible();
  await expect(page.getByTestId('app-error')).toBeHidden();
});
```

### Почему здесь лучше нажимать Enter

В клиенте поиск может реагировать на ввод с небольшой задержкой.  
Нажатие `Enter` делает действие более явным и понятным для теста.

То есть:

```ts
await search.fill('тетра');
await search.press('Enter');
```

читается как:

```text
пользователь ввёл запрос и подтвердил поиск.
```

### Пояснение к проверке

В стартовых данных есть 5 товаров, в названии которых встречается «Тетрадь».

Поэтому для текущего приложения:

```ts
await expect(rows).toHaveCount(5);
```

— нормальная ожидаемая проверка.

Но если состав стартовых данных изменится, более устойчивой будет проверка:

```ts
await expect(rows.filter({ hasText: /тетра/i })).toHaveCount(await rows.count());
```

То есть все найденные строки содержат искомый текст.

В учебном курсе можно оставить точное число, потому что данные фиксированные.  
Но студентам полезно объяснить разницу:

```text
Точное число проверяет текущий контракт данных.
Фильтр по тексту проверяет сам принцип поиска.
```

### Мини-ревью

Проверь:

- тест понимает разницу между «пусто» и «ошибка»;
- тест не ожидает модалку при пустом результате;
- тест проверяет отсутствие ошибок;
- поисковый запрос в тесте читаемый, а не случайный;
- тест не смешивает поиск с категорией и сортировкой.

### Частые ловушки

- Ожидать модалку ошибки, когда товаров просто нет.
- Считать пустую таблицу багом.
- Проверять только `catalog-empty`, но не проверить, что строк стало меньше или они отфильтрованы.
- Ввести текст и не подтвердить поиск.
- Использовать случайную строку в запросе и потом не понять, почему тест упал.

### Полезные ссылки

- [Playwright Locators](https://playwright.dev/docs/locators)
- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- [Playwright Actionability](https://playwright.dev/docs/actionability)
- Kaner и коллеги — идея, что тест должен задавать продукту понятный вопрос и иметь понятный оракул.

---

Это блок задач **7–10**: он закрывает модуль 2 и открывает модуль 3. Дальше по программе идут категория, сортировка, карточка товара и профиль.

### USER
образец от другой нейронки, продолжаем

### ASSISTANT
Продолжаем в той же рамке:

```text
правило продукта → риск → проверка → наблюдаемый факт → автотест
```

и с мягкими сигналами вместо жёстких запретов:

- если хочется спать — спроси, какое состояние ты ждёшь;
- если хочется взять `nth-child` — спроси, какой `data-testid` можно добавить;
- если один тест проверяет и фильтр, и сортировку, и карточку — спроси, какое правило он вообще проверяет.

Ниже — блок задач **11–14** из модуля 3.

---

## Небольшая подготовка перед задачами 11–13

В текущем клиенте таблица каталога пока не имеет отдельных тестовых идентификаторов для ячеек.  
Для задач про категорию, цену и карточку это важно.

Чтобы не учить студентов селекторам вида `td:nth-child(3)`, лучше расширить контракт `data-testid` в таблице.

В `public/app.js`, внутри `renderCatalogRows`, замени обычные ячейки на такие:

```js
<td data-testid="catalog-name">
  ${escapeHtml(product.name)}
</td>

<td
  data-testid="catalog-category-cell"
  data-category="${escapeHtml(product.category)}"
>
  ${escapeHtml(product.category)}
</td>

<td
  data-testid="catalog-price"
  data-price="${product.price}"
>
  ${formatPrice(product.price)}
</td>

<td data-testid="catalog-stock">
  ${product.stock}
</td>
```

Админскую ячейку с кнопкой «Изменить» оставляем как есть.

После этого в таблице появляются стабильные ориентиры:

```text
catalog-name
catalog-category-cell
catalog-price
catalog-stock
```

Если совсем не хочется менять клиент, можно временно читать текст ячеек, но это хуже.  
В промышленном тесте лучше договориться о стабильном атрибуте, чем парсить рубли, пробелы и символ `₽`.

---

# Модуль 3. Витрина глазами покупателя

## Задача 11. Категория — это не поиск

### Зачем эта задача

Поиск и фильтр категории — разные правила продукта.

Поиск отвечает на вопрос:

```text
Есть ли в названии товара подстрока?
```

Категория отвечает на вопрос:

```text
Относится ли товар к выбранному типу?
```

Студенты часто пишут в поиске слово `тетрадь` и называют это проверкой категории `notebooks`.  
Это разные сценарии.

### Цепочка задачи

```text
Правило продукта:
Если выбрать категорию, в каталоге остаются товары только этой категории.

Риск:
Если фильтр работает неправильно, пользователь видит чужие товары
или теряет нужные.

Проверка:
Выбрать категорию "notebooks".

Наблюдаемый факт:
Все видимые строки имеют категорию "notebooks".
Модалка ошибки не появляется.

Автотест:
Выбрать значение в catalog-category и проверить атрибут категории в строках.
```

### Немного теории

Здесь можно ввести идею **классов эквивалентности**.

Есть несколько групп поведения:

```text
Категория "all"      → показываем все активные товары.
Категория "paper"    → показываем только paper.
Категория "notebooks" → показываем только notebooks.
Пустой результат      → пустая таблица, не ошибка.
```

Проверка категории — это не «поиск слова в названии», а проверка принадлежности к классу.

### Дано в стиле BDD

```gherkin
Feature: Фильтр каталога по категории

  Scenario: Выбор категории оставляет только товары этой категории
    Given я вошёл как покупатель "anna"
    And я нахожусь в каталоге
    When я выбираю категорию "notebooks"
    Then все видимые строки имеют категорию "notebooks"
    And модалка ошибки не появляется
```

### Что нужно сделать

Написать тест, который:

1. входит как `anna`;
2. выбирает в `catalog-category` значение `notebooks`;
3. дожидается, что строки появились;
4. проверяет, что у каждой видимой строки категория действительно `notebooks`;
5. проверяет, что модалка ошибки скрыта.

Не нужно в этом же тесте:

- искать слово `тетрадь` через поиск;
- менять сортировку;
- открывать карточку;
- проверять пагинацию.

### Пример кода

```ts
import { test, expect } from '@playwright/test';

async function loginAsAnna(page) {
  await page.goto('/login');

  await page.getByTestId('login-input').fill('anna');
  await page.getByTestId('password-input').fill('anna-pass');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/catalog/);
}

test('фильтр категории показывает только товары выбранной категории', async ({ page }) => {
  await loginAsAnna(page);

  await page.getByTestId('catalog-category').selectOption('notebooks');

  const rows = page.getByTestId('catalog-row');

  await expect(rows).not.toHaveCount(0);

  const count = await rows.count();

  for (let i = 0; i < count; i += 1) {
    await expect(
      rows.nth(i).getByTestId('catalog-category-cell')
    ).toHaveAttribute('data-category', 'notebooks');
  }

  await expect(page.getByTestId('app-error')).toBeHidden();
});
```

### Мини-ревью

Ответь на три вопроса:

1. Тест проверяет фильтр категории или поиск по тексту?
2. Если тест упадёт, будет ли видно, что именно категория не совпала?
3. Есть ли в тесте лишний сон или проверка другого правила?

### Что обычно делают не так

- Вводят `notebooks` в поле поиска.
- Проверяют только название товара, хотя название может не совпадать с категорией.
- В одном тесте выбирают категорию и сразу сортируют.
- Ожидают ошибку, если после фильтра стало меньше товаров.

### Полезные ссылки

- [Playwright Locators](https://playwright.dev/docs/locators)
- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- Copeland — идея классов эквивалентности: фильтр категории проверяет принадлежность к классу, а не текстовое совпадение.

---

## Задача 12. Сортировка по цене — это про числа, а не про строки

### Зачем эта задача

Цена в данных хранится в копейках.  
На экране она показана в рублях, например:

```text
0.00 ₽
7900.00 ₽
15800.00 ₽
```

Если сравнивать цены как строки, можно получить ложные выводы.

Например:

```text
"100.00" и "90.00"
```

как строки сравниваются не так, как числа.

Поэтому тест сортировки должен проверять числовой порядок.

### Цепочка задачи

```text
Правило продукта:
Сортировка "price:asc" упорядочивает товары по возрастанию цены.

Риск:
Если клиент или сервер перепутает числовую сортировку со строковой,
пользователь увидит неправильный порядок товаров.

Проверка:
Включить сортировку по цене по возрастанию.

Наблюдаемый факт:
Каждая следующая цена на первой странице не меньше предыдущей.

Автотест:
Выбрать сортировку, собрать цены из строк и сравнить их как числа.
```

### Немного теории

Это хороший момент, чтобы объяснить студентам разницу между:

```text
представление данных на экране
```

и

```text
реальное значение данных
```

На экране:

```text
7900.00 ₽
```

В данных:

```text
790000 копеек
```

Тест может использовать либо текстовое представление, либо атрибут `data-price`, если мы его добавили.  
Атрибут лучше, потому что он ближе к контракту и не требует парсинга валюты.

### Дано в стиле BDD

```gherkin
Feature: Сортировка каталога по цене

  Scenario: Цены идут по возрастанию
    Given я вошёл как покупатель "anna"
    And я нахожусь в каталоге
    When я включаю сортировку по цене по возрастанию
    Then каждая следующая видимая цена не меньше предыдущей
    And модалка ошибки не появляется
```

### Что нужно сделать

Написать тест, который:

1. входит как `anna`;
2. выбирает сортировку `price:asc`;
3. дожидается таблицы;
4. считывает цены первых строк;
5. сравнивает их как числа;
6. проверяет, что модалка ошибки скрыта.

В нашем клиенте селект сортировки использует значения вида:

```text
price:asc
price:desc
name:asc
name:desc
created_at:asc
created_at:desc
```

Поэтому выбираем:

```ts
await page.getByTestId('catalog-sort').selectOption('price:asc');
```

### Пример кода

```ts
import { test, expect } from '@playwright/test';

async function loginAsAnna(page) {
  await page.goto('/login');

  await page.getByTestId('login-input').fill('anna');
  await page.getByTestId('password-input').fill('anna-pass');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/catalog/);
}

test('сортировка по цене по возрастанию упорядочивает строки по числам', async ({ page }) => {
  await loginAsAnna(page);

  await page.getByTestId('catalog-sort').selectOption('price:asc');

  const rows = page.getByTestId('catalog-row');

  await expect(rows).toHaveCount(10);
  await expect(page.getByTestId('app-error')).toBeHidden();

  const prices = [];

  for (let i = 0; i < 10; i += 1) {
    const priceAttribute = await rows
      .nth(i)
      .getByTestId('catalog-price')
      .getAttribute('data-price');

    expect(priceAttribute).not.toBeNull();

    prices.push(Number(priceAttribute));
  }

  for (let i = 1; i < prices.length; i += 1) {
    expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
  }
});
```

### Пояснение

Сначала мы ждём стабильное состояние таблицы:

```ts
await expect(rows).toHaveCount(10);
```

И только потом снимаем значения.

Это важно, потому что обычные проверки чисел:

```ts
expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
```

не являются web-first assertions.  
Они проверяют уже снятые значения. Поэтому сначала нужно дождаться, чтобы значения были актуальными.

### Если не добавлять `data-price`

Тогда придётся читать текст и парсить рубли:

```ts
const text = await rows.nth(i).getByTestId('catalog-price').innerText();
```

Это возможно, но хуже:

- нужно убирать `₽`;
- нужно учитывать пробелы;
- нужно менять запятую на точку, если локализация изменится;
- тест становится более хрупким.

Поэтому для учебной витрины лучше добавить `data-price`.

### Мини-ревью

Ответь на три вопроса:

1. Тест сравнивает цены как числа или как строки?
2. Тест проверяет сортировку или уже заодно поиск/категорию?
3. Если сортировка сломается, падение теста покажет именно проблему порядка?

### Что обычно делают не так

- Проверяют только первую строку и ожидают там конкретный товар.
- Сравнивают текст `"10.00 ₽"` как строку.
- Смешивают сортировку с фильтром категории.
- Ставят `waitForTimeout` после выбора сортировки вместо ожидания строк.

### Полезные ссылки

- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- [Playwright Actionability](https://playwright.dev/docs/actionability)
- Copeland — сортировка по цене хорошо показывает разницу между видимым представлением и фактическим значением.

---

## Задача 13. Карточка товара — это тот же товар, а не похожая страница

### Зачем эта задача

Клик по строке каталога должен открывать карточку именно этого товара.

Если в каталоге было:

```text
Тетрадь 48 л.
7900.00 ₽
```

а в карточке открылось:

```text
Ручка синяя №6
15800.00 ₽
```

то это баг связи списка и карточки.

Тест должен проверить не просто:

```text
URL стал /catalog/число
```

а:

```text
имя и цена совпадают с выбранной строкой
```

### Цепочка задачи

```text
Правило продукта:
Карточка товара показывает данные того товара, который был открыт из строки каталога.

Риск:
Если карточка откроет другой товар, пользователь может заказать не то,
что видел в списке.

Проверка:
Запомнить имя и цену первой строки, открыть её, сравнить с карточкой.

Наблюдаемый факт:
На карточке совпадают имя и цена выбранной строки.

Автотест:
Клик по строке, затем проверка product-title и product-price.
```

### Дано в стиле BDD

```gherkin
Feature: Карточка товара

  Scenario: Открытая карточка показывает данные выбранной строки
    Given я вошёл как покупатель "anna"
    And я нахожусь в каталоге
    When я открываю первую строку товара
    Then я вижу карточку товара
    And имя товара совпадает с именем выбранной строки
    And цена товара совпадает с ценой выбранной строки
```

### Что нужно сделать

Написать тест, который:

1. входит как `anna`;
2. запоминает имя первой строки;
3. запоминает цену первой строки;
4. кликает по первой строке;
5. проверяет, что открылась карточка;
6. проверяет совпадение имени и цены.

### Пример кода

```ts
import { test, expect } from '@playwright/test';

async function loginAsAnna(page) {
  await page.goto('/login');

  await page.getByTestId('login-input').fill('anna');
  await page.getByTestId('password-input').fill('anna-pass');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/catalog/);
}

test('карточка показывает имя и цену выбранной строки', async ({ page }) => {
  await loginAsAnna(page);

  const firstRow = page.getByTestId('catalog-row').first();

  const name = await firstRow.getByTestId('catalog-name').innerText();
  const price = await firstRow.getByTestId('catalog-price').innerText();

  await firstRow.click();

  await expect(page).toHaveURL(/\/catalog\/\d+/);

  await expect(page.getByTestId('product-title')).toHaveText(name.trim());
  await expect(page.getByTestId('product-price')).toHaveText(price.trim());
});
```

### Почему важно сравнивать два поля

Если проверить только имя, можно пропустить проблему с ценой.  
Если проверить только цену, можно пропустить проблему с названием.

Минимальный полезный контракт здесь:

```text
имя совпадает
цена совпадает
```

Описание товара в этой задаче можно не трогать.  
Оно тоже важно, но это уже отдельный сценарий.

### Мини-ревью

Ответь на три вопроса:

1. Тест проверяет открытие карточки вообще или именно выбранного товара?
2. Если карточка покажет другой товар, тест упадёт?
3. Не сравниваем ли мы цену списка в копейках с ценой карточки в рублях как разные форматы?

### Что обычно делают не так

- Проверяют только, что изменился URL.
- Кликают по строке после сортировки, но запоминают данные другой строки.
- Сравнивают сырые данные в разных форматах.
- Пытаются проверить сразу описание, категорию, остаток и всё остальное.

### Полезные ссылки

- [Playwright Locators](https://playwright.dev/docs/locators)
- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- Kaner и коллеги — ожидаемый результат должен быть конкретным фактом, а не общим ощущением «карточка открылась».

---

## Задача 14. Профиль не пустой

### Зачем эта задача

После входа у Анны уже есть данные профиля:

- имя;
- фамилия;
- email.

Форма профиля — это не регистрация с нуля.  
Если после входа пользователь видит пустые поля, значит загрузка профиля сломана.

### Цепочка задачи

```text
Правило продукта:
После входа пользователь может открыть профиль и увидеть свои данные.

Риск:
Если профиль показывает пустые поля, пользователь может решить,
что аккаунт другой, или случайно перезаписать свои данные.

Проверка:
Войти как Анна, открыть профиль.

Наблюдаемый факт:
Поля имени, фамилии и email не пустые.

Автотест:
Открыть /profile и проверить значения инпутов.
```

### Дано в стиле BDD

```gherkin
Feature: Профиль пользователя

  Scenario: У вошедшего пользователя уже есть данные профиля
    Given я вошёл как покупатель "anna"
    When я открываю профиль
    Then форма профиля видна
    And поле имени не пустое
    And поле фамилии не пустое
    And поле email не пустое
```

### Что нужно сделать

Написать тест, который:

1. входит как `anna`;
2. переходит в профиль через `nav-profile`;
3. проверяет, что форма профиля видна;
4. проверяет, что поле имени не пустое;
5. проверяет, что поле фамилии не пустое;
6. проверяет, что поле email не пустое.

Не нужно здесь:

- сохранять профиль;
- проверять валидацию;
- менять email;
- проверять серверную базу;
- проверять выход.

Это другие правила.

### Пример кода

```ts
import { test, expect } from '@playwright/test';

async function loginAsAnna(page) {
  await page.goto('/login');

  await page.getByTestId('login-input').fill('anna');
  await page.getByTestId('password-input').fill('anna-pass');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/catalog/);
}

test('у Анны в профиле уже есть данные', async ({ page }) => {
  await loginAsAnna(page);

  await page.getByTestId('nav-profile').click();

  await expect(page).toHaveURL(/\/profile/);

  await expect(page.getByTestId('profile-form')).toBeVisible();

  await expect(page.getByTestId('profile-first-name')).not.toHaveValue('');
  await expect(page.getByTestId('profile-last-name')).not.toHaveValue('');
  await expect(page.getByTestId('profile-email')).not.toHaveValue('');
});
```

### Пояснение

Здесь проверяются именно значения инпутов:

```ts
.toHaveValue('')
```

Это отличается от проверки видимого текста.

Для инпута правильно спрашивать:

```text
Какое значение лежит в поле?
```

а не:

```text
Какой текст внутри элемента?
```

### Мини-ревью

Ответь на три вопроса:

1. Тест проверяет загрузку существующих данных или редактирование профиля?
2. Если сервер не вернёт имя, тест упадёт?
3. Не выдумываем ли мы конкретное ФИО, которого нет в требованиях?

### Что обычно делают не так

- Проверяют конкретное имя, например «Анна Петрова», хотя в стартовых данных оно может быть другим.
- Нажимают «Сохранить» и начинают тестировать валидацию.
- Проверяют только видимость полей, но не их значения.
- Идут в профиль без логина и путают этот сценарий с гостевым доступом.

### Полезные ссылки

- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- [Playwright Locators](https://playwright.dev/docs/locators)

---

Это блок задач **11–14**.  
Дальше по модулю 3 остаются выход, поведение «назад» после выхода и гость, открывающий закрытый адрес.

### USER
как-то синхронизируйся с образцами(я прикладываю в файлах) по номерам задач, предыдущие не нужно переписывать. Можешь добавить недостающие задачи, чтобы синхронизироваться. В приложенных образцах задачи 9 - 20

### ASSISTANT
Да, синхронизируюсь по номерам из приложенных образцов.

Задачи **9–14** мы уже выдавали ранее, их не переписываю.  
Ниже — недостающие задачи **15–20**, чтобы закрыться с образцами из `test_part3.md` и `test_part4.md`.

Все задачи ниже идут в нашей рамке:

```text
правило продукта → риск → проверка → наблюдаемый факт → автотест
```

и с мягкой формулировкой: не «запрещено навсегда», а «если здесь появляется такой приём, значит нужно осознанно объяснить зачем».

---

# Модуль 3, завершение

## Задача 15. Выйти — значит сессии нет

### Зачем эта задача

Кнопка «Выйти» — это не просто смена экрана.  
После выхода пользователь снова становится гостем.

Самый коварный случай — браузерная кнопка «назад».  
Если после выхода назад открывает каталог как авторизованную страницу, это не «кэш и ладно», а нарушение правила: гость не должен видеть каталог.

### Цепочка задачи

```text
Правило продукта:
После выхода сессия больше не даёт доступ к каталогу.

Риск:
Если после выхода каталог остаётся доступным через «назад»,
пользователь может подумать, что вход всё ещё активен.

Проверка:
Войти, выйти, попробовать открыть каталог напрямую.
Отдельно проверить поведение «назад».

Наблюдаемый факт:
Прямой заход в /catalog ведёт на страницу входа.
После «назад» пользователь не должен оставаться авторизованным.

Автотест:
Два сценария: прямой заход после выхода и назад после выхода.
```

### Дано в стиле BDD

```gherkin
Feature: Выход завершает сессию

  Scenario: Прямой заход в каталог после выхода требует вход
    Given я вошёл как "anna"
    When я нажимаю «Выйти»
    Then я оказываюсь на странице входа
    When я открываю "/catalog" напрямую
    Then я снова оказываюсь на странице входа

  Scenario: Назад после выхода не оставляет авторизованную витрину
    Given я вошёл как "anna"
    When я нажимаю «Выйти»
    And нажимаю назад в браузере
    Then я не вижу авторизованный каталог
    And я вижу страницу входа
```

### Что нужно сделать

Сделать два теста:

1. Войти как `anna`, выйти, затем открыть `/catalog` через `goto`.  
   Ожидание: снова страница входа.

2. Войти как `anna`, выйти, нажать `goBack()`.  
   Ожидание: пользователь не остаётся в авторизованном каталоге.

Не нужно лечить возможный баг через `reload()` или искусственные паузы.  
Если «назад» показывает каталог, это факт, который нужно зафиксировать.

### Пример кода

```ts
import { test, expect } from '@playwright/test';

async function loginAsAnna(page) {
  await page.goto('/login');

  await page.getByTestId('login-input').fill('anna');
  await page.getByTestId('password-input').fill('anna-pass');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/catalog/);
}

test('после выхода прямой заход в каталог ведёт на страницу входа', async ({ page }) => {
  await loginAsAnna(page);

  await page.getByTestId('nav-logout').click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto('/catalog');

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId('login-form')).toBeVisible();
});

test('назад после выхода не показывает авторизованный каталог', async ({ page }) => {
  await loginAsAnna(page);

  await page.getByTestId('nav-logout').click();
  await expect(page).toHaveURL(/\/login/);

  await page.goBack();

  await expect(page.getByTestId('login-form')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('nav-logout')).toHaveCount(0);
});
```

### Мини-ревью

1. Тест проверяет выход как завершение сессии или только исчезновение кнопки?
2. Если «назад» покажет каталог, тест упадёт?
3. Не маскируем ли мы возможный баг через `reload()`?

### Что обычно делают не так

- Проверяют только, что после выхода открылся `/login`.
- Не проверяют прямой заход в `/catalog`.
- Делают `goBack()` и сразу проверяют `catalog` без ожидания переадресации.
- Прячут нестабильность или баг через `page.reload()`.

### Полезные ссылки

- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- [Playwright Actionability](https://playwright.dev/docs/actionability)

---

## Задача 16. Гость стучится в закрытую дверь

### Зачем эта задача

Если у пользователя нет сессии, закрытые маршруты не должны показывать каталог, профиль или серверную ошибку.  
Ожидаемое поведение — страница входа.

Это задача про доступ, а не про кнопку «Войти».

### Цепочка задачи

```text
Правило продукта:
Гость без сессии не может открыть каталог.

Риск:
Если гость увидит каталог или 500, это либо утечка доступа,
либо непонятная авария вместо нормального входа.

Проверка:
Открыть /catalog без входа.

Наблюдаемый факт:
Браузер оказывается на странице входа.
Форма входа видна.
Модалка ошибки не видна.

Автотест:
Новый контекст, сразу goto('/catalog'), ожидание логина.
```

### Дано в стиле BDD

```gherkin
Feature: Гость открывает закрытый адрес

  Scenario: Каталог без сессии ведёт на страницу входа
    Given я гость без сессии
    When я открываю "/catalog"
    Then я оказываюсь на странице входа
    And форма входа видна
    And модалка ошибки не видна
```

### Что нужно сделать

Написать тест, который:

1. не выполняет вход;
2. открывает `/catalog`;
3. проверяет, что браузер оказался на странице входа;
4. проверяет, что форма входа видна;
5. проверяет, что модалка ошибки не видна.

Не нужно сначала логиниться, а потом чистить cookie.  
Для этой задачи нужен именно свежий гость.

### Пример кода

```ts
import { test, expect } from '@playwright/test';

test('гость с /catalog попадает на вход, а не на ошибку', async ({ page }) => {
  await page.goto('/catalog');

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId('login-form')).toBeVisible();
  await expect(page.getByTestId('app-error')).toBeHidden();
});
```

### Пояснение

Проверка `app-error` здесь нужна не для того, чтобы поймать конкретный код.  
Смысл в том, чтобы нормальный редирект гостя не превращался в аварийное окно ошибки.

Если приложение вдруг покажет модалку, тест должен это заметить.

### Мини-ревью

1. Тест действительно начинается как гость?
2. Если сервер отдаст 500, тест упадёт?
3. Не проверяем ли мы точный `?from=/catalog`, хотя достаточно самого факта редиректа на вход?

### Что обычно делают не так

- Сначала логинятся, а потом пытаются «стать гостем».
- Ждут только `toHaveURL(/\/login/)` и не проверяют форму входа.
- Ждут точный query-параметр `from=/catalog` и падают, если он не появился, хотя основное правило выполнено.
- Путают эту задачу с отказом `403` для админ-страниц.

### Полезные ссылки

- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

---

# Модуль 4. Набор, а не один файл

В этом модуле фокус уже не только на продукте, но и на том, как тесты лежат рядом.  
По-прежнему без Page Object и без `storageState`.

Главные идеи:

- один вопрос — один `test()`;
- шаги нужны человеку, который смотрит отчёт;
- падение должно оставлять след;
- смоук должен быть коротким.

---

## Задача 17. Чтобы в отчёте было что читать

### Зачем эта задача

Когда тест зелёный, его структура кажется очевидной.  
Когда он падает, важно понять:

- где он шёл;
- какое действие выполнял;
- на каком ожидании упал.

`test.step` делает прогон читаемым.  
Он не заменяет хорошую структуру теста, а показывает её в отчёте.

### Цепочка задачи

```text
Правило продукта:
Пользователь с верными данными входит и видит свою роль.

Риск:
Если тест падает без шагов, разработчик видит только строку кода
и не понимает, что именно пошло не так.

Проверка:
Вход Анны, разложенный на понятные шаги.

Наблюдаемый факт:
Тест зелёный, а в отчёте видны именованные шаги.

Автотест:
Тот же вход, но с test.step.
```

### Дано в стиле BDD

```gherkin
Feature: Вход покупателя с читаемыми шагами

  Scenario: Шаги прогона соответствуют сценарию входа
    Given я гость на странице входа
    When я ввожу логин "anna" и пароль "anna-pass"
    And нажимаю «Войти»
    Then я оказываюсь в каталоге
    And в шапке виден бейдж роли "user"
    And пункта «Товары» нет
```

### Что нужно сделать

Взять тест входа Анны и разложить его на шаги:

1. открыть страницу входа;
2. ввести логин и пароль;
3. нажать кнопку входа;
4. проверить каталог и шапку покупателя.

Не нужно добавлять новые проверки.  
Не нужно использовать `waitForTimeout`.

### Пример кода

```ts
import { test, expect } from '@playwright/test';

test('Анна входит как покупатель', async ({ page }) => {
  await test.step('открыть страницу входа', async () => {
    await page.goto('/login');
    await expect(page.getByTestId('login-form')).toBeVisible();
  });

  await test.step('ввести данные Анны', async () => {
    await page.getByTestId('login-input').fill('anna');
    await page.getByTestId('password-input').fill('anna-pass');
  });

  await test.step('нажать кнопку входа', async () => {
    await page.getByTestId('login-submit').click();
  });

  await test.step('проверить каталог и шапку покупателя', async () => {
    await expect(page).toHaveURL(/\/catalog/);
    await expect(page.getByTestId('role-badge')).toHaveText(/user/i);
    await expect(page.getByTestId('nav-admin-products')).toHaveCount(0);
    await expect(page.getByTestId('app-error')).toBeHidden();
  });
});
```

### Мини-ревью

1. Шаги читаются как сценарий или как технический лог?
2. Есть ли шаг без `await` внутри?
3. Не добавились ли новые проверки «заодно»?

### Что обычно делают не так

- Один шаг на весь тест.
- Названия вроде `step 1`, `step 2`, `проверка`.
- Внутри шага нет `await`, и шаг становится мёртвым.
- В шагах появляются новые проверки, которых не было в исходной задаче.

### Полезные ссылки

- [test.step](https://playwright.dev/docs/api/class-test#test-step)
- [Playwright Assertions](https://playwright.dev/docs/test-assertions)

---

## Задача 18. Три вопроса — три входа

### Зачем эта задача

Если один тест делает вход, поиск и профиль, то при падении профиля непонятно, работал ли поиск.  
И наоборот: если поиск упадёт, профиль уже не будет проверен отдельно.

Пока каждый тест входит сам.  
Да, это медленнее. Сейчас это намеренно.

### Цепочка задачи

```text
Правило продукта:
Вход, поиск и профиль — разные правила продукта.

Риск:
Если склеить их в один тест, падение одного правила
замаскирует или испортит проверку другого.

Проверка:
Три отдельных теста: вход, поиск, профиль.

Наблюдаемый факт:
Каждый тест можно запустить отдельно,
и каждый сам приводит себя в нужное состояние.

Автотест:
Три отдельных test() без общего браузера и без общего входа.
```

### Дано в стиле BDD

```gherkin
Feature: Независимые проверки витрины

  Scenario: Покупатель входит
    Given я гость на странице входа
    When я вхожу как "anna" с паролем "anna-pass"
    Then я оказываюсь в каталоге
    And в шапке виден бейдж роли "user"

  Scenario: Поиск по подстроке
    Given я вошёл как "anna"
    When я ищу "тетра"
    Then в таблице есть строки
    And каждая видимая строка содержит "тетра"

  Scenario: Профиль уже заполнен
    Given я вошёл как "anna"
    When я открываю профиль
    Then форма профиля видна
    And имя, фамилия и email не пустые
```

### Что нужно сделать

Сделать три отдельных теста в одном файле:

1. вход Анны;
2. поиск `тетра`;
3. профиль Анны.

Каждый тест сам выполняет вход.  
Нельзя использовать:

- общий `page` на три теста;
- `beforeAll` с одним входом;
- `test.describe.serial` как замену изоляции.

Локальная функция `loginAsAnna` допустима.  
Это не фикстура и не Page Object, просто способ не копировать одни и те же строки.

### Пример кода

```ts
import { test, expect } from '@playwright/test';

async function loginAsAnna(page) {
  await page.goto('/login');

  await page.getByTestId('login-input').fill('anna');
  await page.getByTestId('password-input').fill('anna-pass');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/catalog/);
}

test('Анна входит как покупатель', async ({ page }) => {
  await loginAsAnna(page);

  await expect(page.getByTestId('role-badge')).toHaveText(/user/i);
  await expect(page.getByTestId('nav-admin-products')).toHaveCount(0);
});

test('поиск "тетра" оставляет только подходящие строки', async ({ page }) => {
  await loginAsAnna(page);

  const search = page.getByTestId('catalog-search');

  await search.fill('тетра');
  await search.press('Enter');

  const rows = page.getByTestId('catalog-row');

  await expect(rows).not.toHaveCount(0);

  const count = await rows.count();

  for (let i = 0; i < count; i += 1) {
    await expect(rows.nth(i)).toContainText(/тетра/i);
  }
});

test('профиль Анны не пустой', async ({ page }) => {
  await loginAsAnna(page);

  await page.getByTestId('nav-profile').click();

  await expect(page).toHaveURL(/\/profile/);
  await expect(page.getByTestId('profile-form')).toBeVisible();

  await expect(page.getByTestId('profile-first-name')).not.toHaveValue('');
  await expect(page.getByTestId('profile-last-name')).not.toHaveValue('');
  await expect(page.getByTestId('profile-email')).not.toHaveValue('');
});
```

### Мини-ревью

1. Можно ли запустить только второй тест, и он сам войдёт?
2. Падение профиля не ломает проверку поиска?
3. Нет ли общего состояния, которое делает тесты зависимыми?

### Что обычно делают не так

- Один тест на вход, поиск и профиль.
- `beforeAll`, который логинит один раз на все тесты.
- Третий тест без логина, потому что «второй уже вошёл».
- Общий `page`, который вручную передают между тестами.

### Полезные ссылки

- [Playwright Test Isolation](https://playwright.dev/docs/test-configuration)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

---

## Задача 19. Падение должно оставлять след

### Зачем эта задача

Зелёный тест молчит.  
Красный тест без скриншота, видео или трейса превращается в гадание.

Цель задачи — один раз увидеть артефакт падения и понять, что он экономит время.

### Цепочка задачи

```text
Правило продукта:
Страница входа содержит договорённые элементы.

Риск:
Если тест падает, а артефактов нет, непонятно,
виноват селектор, приложение или ожидание.

Проверка:
Специально сломать локатор, получить красный прогон,
посмотреть артефакт, вернуть локатор.

Наблюдаемый факт:
Красный прогон оставил скриншот, видео или трейс.
После исправления тест снова зелёный.

Автотест:
Временный сломанный селектор ради артефакта.
```

### Дано в стиле BDD

```gherkin
Feature: Форма входа на месте

  Scenario: Страница входа содержит договорённые элементы
    Given я открываю страницу входа
    Then видна форма входа
    And видно поле логина
    And видно поле пароля
    And видна кнопка входа
```

Важно: артефакт падения — это свойство прогона, а не правило витрины.  
Поэтому в `feature` мы не пишем про скриншоты.

### Что нужно сделать

1. Возьми тест формы входа.
2. Намеренно сломай селектор, например:

```ts
await expect(page.getByTestId('login-input-typo')).toBeVisible();
```

3. Прогони тест.
4. Убедись, что прогон красный.
5. Найди артефакт: скриншот, видео или трейс.
6. Открой его и опиши, что видно: форма входа есть, а тест искал не то имя.
7. Верни правильный селектор.
8. Прогони тест снова и убедись, что он зелёный.

### Пример временного сломанного теста

```ts
import { test, expect } from '@playwright/test';

test('форма входа со сломанным селектором', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByTestId('login-input-typo')).toBeVisible();
});
```

### Пример восстановленного теста

```ts
import { test, expect } from '@playwright/test';

test('форма входа видна по тестовым идентификаторам', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByTestId('login-form')).toBeVisible();
  await expect(page.getByTestId('login-input')).toBeVisible();
  await expect(page.getByTestId('password-input')).toBeVisible();
  await expect(page.getByTestId('login-submit')).toBeVisible();
});
```

### Что считается сделанным

Сделано, если:

- тест был красным;
- есть хотя бы один артефакт падения;
- студент может сказать, где лежит артефакт;
- студент может объяснить, что видно на артефакте;
- сломанный селектор не остался в финальной сдаче.

### Мини-ревью

1. Если тест упадёт ночью, где искать след?
2. Видно ли по артефакту, что приложение живо, а селектор неверный?
3. Не остался ли сломанный тест в репозитории?

### Что обычно делают не так

- Ломают селектор и забывают вернуть.
- Ищут артефакт не в той папке и пишут, что его нет.
- Путают трейс с обычным `console.log`.
- Включают скриншоты на каждый зелёный прогон и считают это выполнением задачи.

### Полезные ссылки

- [Trace Viewer](https://playwright.dev/docs/trace-viewer)
- [Screenshots](https://playwright.dev/docs/screenshots)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

---

## Задача 20. Смоук: жива ли витрина

### Зачем эта задача

Смоук отвечает на один вопрос:

```text
Можно ли вообще пользоваться витриной?
```

Он не проверяет все правила каталога.  
Он не проверяет сортировку, пагинацию, профиль и карточку.

Если смоук большой, его начинают пропускать.  
Поэтому смоук должен быть коротким.

### Цепочка задачи

```text
Правило продукта:
После входа пользователь видит витрину и может выйти.

Риск:
Если витрина вообще не открывается, все остальные проверки бессмысленны.

Проверка:
Войти, убедиться, что таблица не пустая, выйти.

Наблюдаемый факт:
Есть хотя бы одна строка товара.
После выхода открывается страница входа.

Автотест:
Один короткий смоук-тест с шагами.
```

### Дано в стиле BDD

```gherkin
Feature: Смоук витрины

  Scenario: Покупатель входит, видит товары и выходит
    Given я гость на странице входа
    When я вхожу как "anna" с паролем "anna-pass"
    Then я оказываюсь в каталоге
    And в таблице видна хотя бы одна строка товара
    When я нажимаю «Выйти»
    Then я оказываюсь на странице входа
```

Здесь два `When` уместны, потому что это один короткий путь:

```text
день магазина открыт → день магазина закрыт
```

Это не замена трём независимым тестам из задачи 18.

### Что нужно сделать

Написать один тест:

1. вход Анны;
2. в таблице видна хотя бы одна строка `catalog-row`;
3. выход и возврат на `/login`.

Не нужно добавлять:

- поиск;
- категорию;
- сортировку;
- карточку;
- профиль;
- админ-функции.

### Пример кода

```ts
import { test, expect } from '@playwright/test';

test('смоук: вход, витрина не пустая, выход', async ({ page }) => {
  await test.step('вход Анны', async () => {
    await page.goto('/login');

    await page.getByTestId('login-input').fill('anna');
    await page.getByTestId('password-input').fill('anna-pass');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/catalog/);
  });

  await test.step('витрина не пустая', async () => {
    await expect(page.getByTestId('catalog-row').first()).toBeVisible();
  });

  await test.step('выход', async () => {
    await page.getByTestId('nav-logout').click();
    await expect(page).toHaveURL(/\/login/);
  });
});
```

### Почему здесь «хотя бы одна строка»

В смоуке мы специально не проверяем ровно 10 строк.

Ровно 10 строк — это регрессионная проверка каталога.  
А смоук должен кричать, если витрина вообще пустая после входа.

### Мини-ревью

1. Тест отвечает на вопрос «витрина жива»?
2. Смоук не превратился в длинный прогон каталога?
3. Если смоук упадёт, будет ли понятно, что приложение нельзя отдавать людям?

### Что обычно делают не так

- Тащат в смоук поиск, фильтры, профиль и админку.
- Проверяют точное количество товаров.
- Забывают выход.
- Путают смоук с задачей 18, где было три независимых теста.

### Полезные ссылки

- [test.step](https://playwright.dev/docs/api/class-test#test-step)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

---

На этом блок **15–20** закрывает синхронизацию с приложенными образцами **9–20**.

### USER
следующие образцы

### ASSISTANT
Продолжаю синхронизацию по образцам.  
Дальше идут **модуль 5** и **модуль 6**.

В этом сообщении — задачи **21–25** из модуля 5.  
Это блок про тест-дизайн, поэтому здесь меньше автотестов и больше таблиц, классов, границ и правил.

---

# Важные поправки для нашего приложения

Перед модулем 5 нужно зафиксировать три вещи.

## 1. Коды ошибок в модалке

В текущем клиенте в модалке ошибки отображается бизнес-код:

```text
422 → VALIDATION
401 → UNAUTHORIZED
403 → BLOCKED / FORBIDDEN
```

Поэтому в таблицах и сценариях я буду писать так:

```text
ожидаем 422, в текущей модалке это код VALIDATION
```

Если позже ты переключишь клиент на числовой статус, то в тестах и текстах нужно будет заменить `VALIDATION` на `422`.

---

## 2. Браузерная валидация не должна мешать серверной

В админ-форме товара сейчас есть `min` и `max` у цены.  
Из-за этого браузер может не дать отправить `-1` или `1000001`, и тест не дойдёт до сервера.

Для задач 21–22 лучше разрешить форме отправлять данные на сервер даже с формально неправильными значениями.

В `public/app.js` найди админ-форму и добавь `novalidate`:

```html
<form
  data-testid="admin-product-form"
  class="row g-3"
  novalidate
>
```

Это нужно не для того, чтобы «сломать форму», а чтобы в учебном тесте видеть именно серверную валидацию.

---

## 3. Пустое пересечение поиска и категории

В образце используется пример:

```text
поиск «тетра» + категория pens → пусто
```

В нашем текущем seed это не всегда пусто, потому что первые товары с «Тетрадь» распределены по разным категориям.

Поэтому для пустого пересечения в нашем приложении лучше использовать, например:

```text
поиск "48" + категория pens
```

Товар с «48» в названии есть только в категории `paper`, поэтому пересечение с `pens` будет пустым.

Если захочешь сохранить пример из образца, можно изменить названия в seed. Но для текущего кода проще использовать `48 + pens`.

---

# Модуль 5. Тест-дизайн на витрине

В модуле 5 главный вопрос уже не:

```text
Как кликнуть?
```

А вопрос:

```text
Какой случай вообще стоит проверять?
```

То есть:

- какие значения образуют один класс;
- где проходит граница;
- какие комбинации условий важны;
- где правило может сломаться;
- что можно не автоматизировать сразу.

---

## Задача 21. Классы эквивалентности для названия товара

### Зачем эта задача

Название товара при создании или редактировании имеет правило:

```text
1–80 символов, пустое название недопустимо
```

Студенты часто пишут десять тестов с разными «нормальными» названиями:

```text
Ручка
Карандаш
Тетрадь
Блокнот
```

Но с точки зрения правила это один и тот же класс:

```text
непустое название допустимой длины
```

Один класс — один представитель.  
Не нужно проверять десять синонимов, если правило не различает их.

### Цепочка задачи

```text
Правило продукта:
Название товара не может быть пустым и не может быть длиннее 80 символов.

Риск:
Безымянный товар сломает витрину и карточку.
Слишком длинное название может не сохраниться, не отобразиться или сломать вёрстку.

Проверка:
Прогнать представителей разных классов: пустое имя, нормальное имя, 80 символов, 81 символ.

Наблюдаемый факт:
Валидные названия сохраняются.
Невалидные дают ошибку валидации.

Автотест:
Не обязательно на все клетки сразу. Сначала таблица, потом один-два представителя.
```

### Термины на сегодня

**Класс эквивалентности** — группа входных значений, для которых система должна вести себя одинаково.

**Представитель класса** — одно конкретное значение из класса, которое мы берём в тест.

Идея из Коупленда своими словами:

> Не нужно проверять все значения подряд. Нужно выбрать по одному представителю из каждого класса, потому что значения внутри класса должны вести себя одинаково.

### Дано в стиле BDD

```gherkin
Feature: Название товара

  Scenario: Обычное название сохраняется
    Given я вошла как администратор "kira"
    When я создаю товар с обычным непустым названием
    Then товар сохраняется

  Scenario: Пустое название не сохраняется
    Given я вошла как администратор "kira"
    When я создаю товар с пустым названием
    Then вижу отказ валидации 422 / VALIDATION

  Scenario: Название длиной 80 символов ещё допустимо
    Given я вошла как администратор "kira"
    When я создаю товар с названием ровно из 80 символов
    Then товар сохраняется

  Scenario: Название длиной 81 символ уже недопустимо
    Given я вошла как администратор "kira"
    When я создаю товар с названием из 81 символа
    Then вижу отказ валидации 422 / VALIDATION
```

### Что нужно сделать

Составить таблицу классов для поля `name`.

Минимальная таблица:

| Класс                        | Пример                | Ожидание                 |
| ---------------------------- | --------------------- | ------------------------ |
| пустое значение              | `""`                  | отказ 422 / `VALIDATION` |
| только пробелы               | `"   "`               | отказ 422 / `VALIDATION` |
| нормальное непустое название | `"Ручка синяя"`       | товар сохраняется        |
| ровно 80 символов            | строка из 80 символов | товар сохраняется        |
| 81 символ                    | строка из 81 символа  | отказ 422 / `VALIDATION` |

По желанию можно добавить:

| Класс          | Пример | Ожидание          |
| -------------- | ------ | ----------------- |
| ровно 1 символ | `"А"`  | товар сохраняется |

Но если добавляешь 1 символ, помни, что это уже близко к нижней границе. Это не ошибка — просто нужно понимать, что задача 21 про классы, а задача 22 будет про границы.

### Что важно не перепутать

Уникальность названия — это другое правило.

Если товар с таким именем уже существует, сервер ответит:

```text
409 CONFLICT
```

Это не класс длины и не класс пустоты.

Поэтому в этой задаче не нужно смешивать:

```text
пустое название → 422
слишком длинное название → 422
дублирующееся название → 409
```

Это разные проверки.

### Что можно автоматизировать

Автотест не обязан покрывать все строки таблицы.  
Сначала сдаём дизайн.

Но если хочется автоматизировать одного представителя, можно взять, например, 81 символ.

Небольшой помощник для админ-формы. Это ещё не Page Object, просто функция, чтобы не копировать одно и то же.

```ts
import { test, expect } from '@playwright/test';

async function loginAsKira(page) {
  await page.goto('/login');

  await page.getByTestId('login-input').fill('kira');
  await page.getByTestId('password-input').fill('kira-admin');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/catalog/);

  await page.getByTestId('nav-admin-products').click();
  await expect(page.getByTestId('admin-product-form')).toBeVisible();
}

async function fillProductForm(page, fields) {
  await page.getByTestId('admin-product-name').fill(fields.name ?? '');
  await page.getByTestId('admin-product-price').fill(String(fields.price ?? 10000));
  await page.getByTestId('admin-product-stock').fill(String(fields.stock ?? 10));
  await page.getByTestId('admin-product-category').selectOption(fields.category ?? 'other');
  await page.getByTestId('admin-product-description').fill(fields.description ?? 'Тестовое описание');

  await page.getByTestId('admin-product-save').click();
}

function fixedLengthName(prefix, length) {
  const base = `${prefix}-${Date.now()}`;

  if (base.length >= length) {
    return base.slice(0, length);
  }

  return base.padEnd(length, 'x');
}
```

Пример теста на 81 символ:

```ts
test('название длиной 81 символ отвергается', async ({ page }) => {
  await loginAsKira(page);

  const name = fixedLengthName('name81', 81);

  await fillProductForm(page, { name });

  await expect(page.getByTestId('app-error')).toBeVisible();
  await expect(page.getByTestId('app-error-code')).toHaveText('VALIDATION');
});
```

Пример теста на 80 символов:

```ts
test('название длиной 80 символов сохраняется', async ({ page }) => {
  await loginAsKira(page);

  const name = fixedLengthName('name80', 80);

  await fillProductForm(page, { name });

  await expect(
    page.getByTestId('admin-product-row').filter({ hasText: name })
  ).toBeVisible();
});
```

### Мини-ревью

1. Тест понимает разницу между пустым названием и слишком длинным?
2. Есть ли десять «нормальных» названий, которые на самом деле принадлежат одному классу?
3. Не смешана ли длина названия с уникальностью названия?

### Что обычно делают не так

- Пишут пять позитивных тестов с разными обычными именами.
- Забывают 80 и 81 символ.
- Проверяют только пустую строку, но не проверяют строку из пробелов.
- Ждут `401` вместо `422`.
- Смешивают валидацию имени и ошибку уникальности.

### Полезные идеи и ссылки

- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- Lee Copeland, *A Practitioner's Guide to Software Test Design* — идея классов эквивалентности.
- Glenford Myers, *The Art of Software Testing* — не нужно пытаться перебрать все входные значения, нужно резать пространство на классы.

---

## Задача 22. Границы цены: ломается на краю, а не в середине

### Зачем эта задача

Цена товара в нашем приложении хранится в копейках.

Правило:

```text
цена — целое число от 0 до 1 000 000 копеек
```

Границы — это места, где правило меняет поведение.

Например:

```text
0 → ещё можно
-1 → уже нельзя
1 000 000 → ещё можно
1 000 001 → уже нельзя
```

А вот значения вроде:

```text
50 000
77 777
199 900
```

обычно относятся к тому же классу «нормальная допустимая цена».  
Проверять их все отдельно чаще всего бесполезно.

### Цепочка задачи

```text
Правило продукта:
Цена товара должна быть целым числом от 0 до 1 000 000 копеек.

Риск:
Отрицательная цена ломает витрину и здравый смысл.
Слишком большая цена может сломать отображение, сортировку или правила поиска.

Проверка:
Проверить минимум, максимум и выход за границы.

Наблюдаемый факт:
Допустимые цены сохраняются.
Недопустимые цены дают отказ валидации.

Автотест:
Минимум, максимум и один-два выхода за границу.
```

### Термины на сегодня

**Граничное значение** — значение на границе допустимого диапазона или рядом с ней.

Идея из Коупленда своими словами:

> Ошибки часто живут на границах диапазонов. Поэтому проверять нужно саму границу и шаг за неё.

### Дано в стиле BDD

```gherkin
Feature: Цена товара в копейках

  Scenario: Ноль копеек допустим
    Given я вошла как администратор "kira"
    When я сохраняю товар с ценой 0
    Then товар сохраняется

  Scenario: Один рубль в копейках допустим
    Given я вошла как администратор "kira"
    When я сохраняю товар с ценой 100
    Then товар сохраняется

  Scenario: Максимальная цена допустима
    Given я вошла как администратор "kira"
    When я сохраняю товар с ценой 1000000
    Then товар сохраняется

  Scenario: Отрицательная цена недопустима
    Given я вошла как администратор "kira"
    When я сохраняю товар с ценой -1
    Then вижу отказ валидации 422 / VALIDATION

  Scenario: Цена выше максимума недопустима
    Given я вошла как администратор "kira"
    When я сохраняю товар с ценой 1000001
    Then вижу отказ валидации 422 / VALIDATION
```

### Что нужно сделать

Составить таблицу границ для поля `price`.

| Значение  | Класс               | Ожидание                 |
| --------- | ------------------- | ------------------------ |
| `-1`      | ниже минимума       | отказ 422 / `VALIDATION` |
| `0`       | минимум             | сохраняется              |
| `1`       | сразу выше минимума | сохраняется              |
| `1000000` | максимум            | сохраняется              |
| `1000001` | выше максимума      | отказ 422 / `VALIDATION` |

По желанию можно добавить:

| Значение | Класс                   | Ожидание    |
| -------- | ----------------------- | ----------- |
| `100`    | обычная допустимая цена | сохраняется |

Но не нужно превращать это в список из двадцати «нормальных» цен.

### Что важно не перепутать

Цена — целое число копеек.

Поэтому в тестах не должно быть:

```text
0.5
10.99
999.99
```

Если студент начинает проверять дробные цены, он уже ушёл от текущего правила.

Дробные значения могут быть интересны как отдельная гипотеза из задачи 27, но не как основная граница цены.

### Что можно автоматизировать

Например, минимум, максимум и один выход за границу.

Пример теста на отрицательную цену:

```ts
test('отрицательная цена отвергается', async ({ page }) => {
  await loginAsKira(page);

  const name = `price-negative-${Date.now()}`;

  await fillProductForm(page, {
    name,
    price: -1,
  });

  await expect(page.getByTestId('app-error')).toBeVisible();
  await expect(page.getByTestId('app-error-code')).toHaveText('VALIDATION');
});
```

Пример теста на максимальную цену:

```ts
test('максимальная цена сохраняется', async ({ page }) => {
  await loginAsKira(page);

  const name = `price-max-${Date.now()}`;

  await fillProductForm(page, {
    name,
    price: 1000000,
  });

  await expect(
    page.getByTestId('admin-product-row').filter({ hasText: name })
  ).toBeVisible();
});
```

### Мини-ревью

1. Таблица проверяет границы, а не десять случайных цен?
2. Есть ли шаг за границей, а не только сама граница?
3. Не путаем ли цену в копейках и отображение в рублях?

### Что обычно делают не так

- Проверяют только «нормальную цену».
- Забывают ноль.
- Забывают максимум.
- Проверяют `-1`, но не проверяют `1000001`.
- Пытаются вводить дробные значения, хотя правило про целые копейки.

### Полезные идеи и ссылки

- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- Lee Copeland — Boundary Value Testing.
- Glenford Myers — чёрный ящик и важность границ.

---

## Задача 23. Поиск и категория вместе: таблица решений

### Зачем эта задача

Поиск и категория уже проверялись отдельно:

- поиск фильтрует название;
- категория фильтрует тип товара.

Но пользователь может использовать их вместе:

```text
поиск + категория
```

И здесь появляется новый вопрос:

```text
Что должно произойти, если поиск и категория не пересекаются?
```

Правильный ответ для нашего приложения:

```text
Пустая таблица — это не ошибка.
```

Ошибка — это модалка `app-error`, а не отсутствие совпадений.

### Цепочка задачи

```text
Правило продукта:
Поиск и категория могут применяться одновременно.
Если совпадений нет, показывается пустая таблица без ошибки.

Риск:
Если пустое пересечение показывать как ошибку, пользователь решит, что сервис сломан.
Если фильтры не совмещаются, пользователь получит лишние товары.

Проверка:
Построить таблицу решений для поиска и категории.

Наблюдаемый факт:
Для разных комбинаций видим либо строки, либо пустую таблицу.
Модалка ошибки не появляется.

Автотест:
Желательно проверить хотя бы одно пересечение, особенно пустое.
```

### Термины на сегодня

**Таблица решений** — способ представить комбинации условий и ожидаемые действия.

Идея из Коупленда и Бейзера своими словами:

> Если поведение зависит от нескольких условий, полезно перечислить комбинации явно. Иначе легко проверить только каждое условие по отдельности, но не их совместность.

### Дано в стиле BDD

```gherkin
Feature: Поиск и категория вместе

  Scenario: Только категория
    Given я вошла как "anna" и открыла каталог
    When я выбираю категорию "notebooks" и не ввожу поиск
    Then в таблице только товары категории "notebooks"
    And модалки ошибки нет

  Scenario: Только поиск
    Given я вошла как "anna" и открыла каталог
    When я ищу "тетра" и оставляю категорию "all"
    Then в каждой видимой строке есть совпадение с поиском
    And модалки ошибки нет

  Scenario: Пустое пересечение не является ошибкой
    Given я вошла как "anna" и открыла каталог
    When я ищу "48" и выбираю категорию "pens"
    Then строк в таблице 0
    And модалки ошибки нет
```

### Что нужно сделать

Построить таблицу решений.

Минимальные условия:

```text
Поиск: пустой / непустой
Категория: all / конкретная
```

Например:

| Поиск   | Категория   | Ожидаемые строки           | Модалка ошибки |
| ------- | ----------- | -------------------------- | -------------- |
| пустой  | `all`       | обычная первая страница    | нет            |
| пустой  | `notebooks` | только товары `notebooks`  | нет            |
| `тетра` | `all`       | строки, содержащие `тетра` | нет            |
| `48`    | `pens`      | строк 0                    | нет            |

Важно:

```text
Пустая таблица при корректном запросе — это успех.
```

### Почему в нашем приложении `тетра + pens` может быть не пустым

В текущем seed первые товары с «Тетрадь» распределены по разным категориям.  
Поэтому `тетра + pens` может дать строку.

Для пустого пересечения лучше использовать:

```text
поиск "48"
категория "pens"
```

Если хочется сохранить пример `тетра + pens`, нужно изменить стартовые данные так, чтобы в категории `pens` не было товаров со словом `тетра`.

### Что можно автоматизировать

Например, пустое пересечение:

```ts
import { test, expect } from '@playwright/test';

async function loginAsAnna(page) {
  await page.goto('/login');

  await page.getByTestId('login-input').fill('anna');
  await page.getByTestId('password-input').fill('anna-pass');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/catalog/);
}

test('пустое пересечение поиска и категории не является ошибкой', async ({ page }) => {
  await loginAsAnna(page);

  await page.getByTestId('catalog-search').fill('48');
  await page.getByTestId('catalog-search').press('Enter');

  await page.getByTestId('catalog-category').selectOption('pens');

  await expect(page.getByTestId('catalog-row')).toHaveCount(0);
  await expect(page.getByTestId('catalog-empty')).toBeVisible();
  await expect(page.getByTestId('app-error')).toBeHidden();
});
```

### Мини-ревью

1. Тест отличает «нет совпадений» от «сервер упал»?
2. Есть ли проверка пустого пересечения?
3. Не смешана ли неизвестная категория с пустым результатом поиска?

### Что обычно делают не так

- Ждут модалку ошибки при пустом результате.
- Проверяют поиск и категорию только по отдельности.
- Пытаются выбрать несуществующую категорию в UI.
- Смешивают пустое пересечение с задачей про неизвестную категорию через API.

### Полезные идеи и ссылки

- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- Lee Copeland — Decision Table Testing.
- Boris Beizer — модели поведения, когда правила зависят от нескольких условий.

---

## Задача 24. Pairwise для каталога: не все 16, а компактный набор

### Зачем эта задача

У каталога несколько ручек:

```text
поиск
категория
сортировка
направление сортировки
```

Если брать по два значения каждого фактора, уже получается:

```text
2 × 2 × 2 × 2 = 16 комбинаций
```

А если значений больше, то комбинаций становится ещё больше.

Прогонять все комбинации в каждом тестовом блоке дорого.  
Но и брать одну случайную комбинацию слабозаметно.

**Pairwise** — это компромисс:

```text
каждая пара значений всех факторов должна встретиться хотя бы один раз
```

Не каждая тройка.  
Не каждая четверка.  
Именно пары.

### Цепочка задачи

```text
Правило продукта:
Каталог должен корректно работать при разных комбинациях поиска, категории и сортировки.

Риск:
Полный перебор слишком дорогой, а случайные примеры могут пропустить неприятную пару значений.

Проверка:
Составить компактный набор комбинаций, где покрыты пары факторов.

Наблюдаемый факт:
Для каждой выбранной комбинации каталог показывает ожидаемый результат без ошибки.

Автотест:
Не обязательно гонять весь набор. Достаточно одного-двух представителей, если таблица уже сдана.
```

### Термины на сегодня

**Фактор** — параметр, который мы меняем.

**Уровень фактора** — конкретное значение параметра.

**Пара** — комбинация значений двух факторов.

Идея из Коупленда своими словами:

> Многие дефекты ловятся на сочетании двух факторов. Поэтому можно специально покрыть пары, а не строить декартово произведение всех значений.

### Дано в стиле BDD

```gherkin
Feature: Комбинации параметров каталога

  Scenario: Пустой поиск, все категории, сортировка имени по возрастанию
    Given я вошла как "anna"
    When я открываю каталог без поиска, с категорией "all" и сортировкой "name asc"
    Then таблица не пустая
    And модалки ошибки нет

  Scenario: Поиск с сортировкой цены
    Given я вошла как "anna"
    When я ищу "тетра", выбираю категорию "all" и сортировку "price asc"
    Then видимые строки содержат совпадение с поиском
    And цены не убывают
```

Это примеры сценариев для представителей.  
Главный артефакт задачи — таблица пар.

### Что нужно сделать

Выбрать факторы и уровни.

Например:

| Фактор     | Уровни             |
| ---------- | ------------------ |
| `q`        | `""`, `"тетра"`    |
| `category` | `all`, `notebooks` |
| `sort`     | `name`, `price`    |
| `dir`      | `asc`, `desc`      |

Составить 6–8 кейсов так, чтобы каждая пара значений встречалась хотя бы один раз.

Пример набора из 6 строк:

| №   | `q`     | `category`  | `sort`  | `dir`  |
| --- | ------- | ----------- | ------- | ------ |
| 1   | `""`    | `all`       | `name`  | `asc`  |
| 2   | `""`    | `notebooks` | `price` | `desc` |
| 3   | `тетра` | `all`       | `price` | `asc`  |
| 4   | `тетра` | `notebooks` | `name`  | `desc` |
| 5   | `""`    | `all`       | `name`  | `desc` |
| 6   | `тетра` | `notebooks` | `price` | `asc`  |

Важно не просто переписать таблицу, а глазами проверить пары.

Например:

```text
Пара (тетра, price) есть в строках 3 и 6.
Пара (notebooks, asc) есть в строке 6.
Пара (пустой поиск, desc) есть в строках 2 и 5.
```

Если какой-то пары нет, нужно добавить строку или честно написать:

```text
Такая-то пара не покрыта.
```

Честная дырка лучше фальшивого «покрыто всё».

### Что не нужно делать

Не нужно автоматизировать все 16 комбинаций.

Не нужно добавлять сюда:

```text
page=2
скрытые товары
админский режим
неизвестные категории
```

Это уже другие правила и другие задачи.

### Что можно автоматизировать

Например, один кейс:

```ts
test('pairwise-представитель: поиск, все категории, цена по возрастанию', async ({ page }) => {
  await loginAsAnna(page);

  await page.getByTestId('catalog-search').fill('тетра');
  await page.getByTestId('catalog-search').press('Enter');

  await page.getByTestId('catalog-category').selectOption('all');
  await page.getByTestId('catalog-sort').selectOption('price:asc');

  const rows = page.getByTestId('catalog-row');

  await expect(rows).not.toHaveCount(0);

  const count = await rows.count();

  for (let i = 0; i < count; i += 1) {
    await expect(rows.nth(i)).toContainText(/тетра/i);
  }
});
```

Но главная цель задачи — таблица, а не код.

### Мини-ревью

1. В таблице видны пары, а не просто случайные строки?
2. Есть ли честное указание, какие тройки не покрыты?
3. Не превратился ли pairwise в попытку прогнать всё?

### Что обычно делают не так

- Пишут 16 кейсов и подписывают, что это pairwise.
- Берут 6 случайных строк без проверки пар.
- Добавляют пятый фактор и тонут в комбинациях.
- Тащат весь набор в смоук.

### Полезные идеи и ссылки

- Lee Copeland — Pairwise Testing.
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

---

## Задача 25. Состояния сессии: гость, вошёл, вышел, протух

### Зачем эта задача

Сессия — это не просто поле «залогинен».  
Это состояния и переходы.

Гость — это одно состояние.  
Авторизованный пользователь — другое.  
После выхода пользователь снова становится гостем.  
Протухшая сессия — это не «вход с плохим паролем», а отдельная история:

```text
сессия была, но больше не действительна
```

### Цепочка задачи

```text
Правило продукта:
Сессия даёт доступ к закрытым страницам, пока она жива.
Выход завершает сессию.
Протухшая сессия больше не даёт доступ.

Риск:
Если после выхода каталог остаётся доступен, пользователь может решить, что всё ещё авторизован.
Если протухшая сессия ведёт себя как живая, это нарушение доступа.

Проверка:
Описать состояния и переходы.
Проверить разрешённые и запрещённые переходы.

Наблюдаемый факт:
После входа пользователь видит каталог.
После выхода каталог требует вход.
Протухшая сессия приводит к 401 и странице входа.

Автотест:
Выход уже частично закрыт задачей 15.
Протухшую сессию можно описать вручную или проверить отдельно, если окружение позволяет.
```

### Термины на сегодня

**Состояние** — значимое положение системы, например гость или авторизованный пользователь.

**Переход** — событие, которое переводит систему из одного состояния в другое.

Идея из Коупленда своими словами:

> Если у объекта есть состояния, полезно нарисовать, куда можно переходить и куда нельзя. Запрещённые переходы — тоже тестовые случаи.

### Дано в стиле BDD

```gherkin
Feature: Жизнь сессии

  Scenario: Вход переводит гостя в покупателя
    Given я гость без сессии
    When я вхожу как "anna" с паролем "anna-pass"
    Then я авторизована и вижу каталог

  Scenario: Выход возвращает в гостя
    Given я вошла как "anna"
    When я нажимаю «Выйти»
    Then я оказываюсь на странице входа
    And прямой заход в каталог снова требует вход

  Scenario: Протухшая сессия не работает как живая
    Given у меня есть сессия, которая уже истекла
    When я открываю каталог
    Then я вижу страницу входа
    И получаю отказ 401 на уровне приложения или модалки
```

### Что нужно сделать

Сдать схему или таблицу состояний.

Например:

| Из состояния          | Событие              | В состояние           | Наблюдаемый факт                               |
| --------------------- | -------------------- | --------------------- | ---------------------------------------------- |
| гость                 | успешный вход `anna` | авторизованный `user` | каталог доступен, бейдж `user`                 |
| гость                 | неверный пароль      | гость                 | остаёмся на `/login`, ошибка                   |
| гость                 | вход `boris`         | гость                 | остаёмся на `/login`, `BLOCKED`                |
| авторизованный `user` | открытие каталога    | авторизованный `user` | каталог виден                                  |
| авторизованный `user` | выход                | гость                 | `/login`, прямой `/catalog` снова требует вход |
| авторизованный `user` | сессия истекла       | гость                 | `/login`, 401                                  |
| гость                 | прямой `/catalog`    | гость                 | редирект на `/login`                           |

### Что важно различать

Есть два разных `401`:

```text
неверный пароль
протухшая сессия
```

Код может совпадать, но исходное состояние разное.

В первом случае:

```text
Given: гость без сессии
```

Во втором:

```text
Given: пользователь был авторизован, но сессия истекла
```

Это важно для тест-дизайна.

### Как можно проверить протухшую сессию в нашем учебном приложении

В текущем сервере сессии живут в файле `data/app.json`.  
Можно сделать ручной сценарий:

1. Войти как Анна.
2. Остановить сервер.
3. В `data/app.json` найти сессию Анны.
4. Поставить `expires_at` в прошлое.
5. Сохранить файл.
6. Запустить сервер.
7. Открыть каталог тем же браузером.

Ожидаемое поведение:

```text
приложение должно вернуть пользователя на страницу входа
```

Если такой сценарий кажется слишком ручным, это нормально.  
В задаче 25 главное — спроектировать состояния. Автотест может быть частичным.

### Мини-ревью

1. Есть ли разница между «неверный пароль» и «протухшая сессия»?
2. Есть ли запрещённые переходы, например гость сразу редактирует профиль?
3. Не сводится ли вся схема к двум состояниям «ок» и «не ок»?

### Что обычно делают не так

- Рисуют только «залогинен» и «не залогинен».
- Путают выход с закрытием вкладки.
- Путают `401` неверного пароля и `401` истёкшей сессии.
- Забывают, что после `403 BLOCKED` пользователь остаётся гостем.
- Проверяют только кнопку «Выйти», но не проверяют прямой заход в каталог после выхода.

### Полезные идеи и ссылки

- Lee Copeland — State-Transition Testing.
- Kaner, Bach, Pettichord — ожидаемое поведение нужно брать из правила, а не из удобства теста.
- [Playwright Assertions](https://playwright.dev/docs/test-assertions)

---

Это блок задач **21–25**.  
Дальше по образцам пойдут задачи **26–28** и затем модуль 6, начиная с задачи 29.

### USER
да, продолжай, держи синхронизацию с образцами

### ASSISTANT
Продолжаю синхронизацию с образцами.  
Ниже — задачи **26–28**. Они закрывают **модуль 5**.

В этом блоке автотестов меньше, чем дизайна.  
Главный вопрос модуля 5:

```text
Какой случай вообще стоит проверять?
```

А уже потом:

```text
Как этот случай автоматизировать?
```

---

# Модуль 5. Тест-дизайн на витрине, завершение

## Задача 26. CRUD не для всех

### Зачем эта задача

Товар — это сущность.  
Над ним можно выполнять операции:

- прочитать список;
- прочитать карточку;
- создать;
- изменить;
- скрыть;
- показать.

Но разные роли имеют разные права.

Администратор Кира может управлять товарами.  
Покупатель Анна может только смотреть витрину и карточки активных товаров.

Важно не останавливаться на формулировке:

```text
Анне нельзя создавать товары
```

Нужно уточнить:

```text
Где именно нельзя?
В интерфейсе нет кнопки?
Или кнопка есть, но сервер всё равно отвечает 403?
Какой код отказа?
Что происходит с гостем?
```

### Цепочка задачи

```text
Правило продукта:
Операции над товарами зависят от роли.

Риск:
Если покупателю случайно разрешат создавать или скрывать товары,
витрина станет управляемой посторонними людьми.

Проверка:
Построить матрицу: операция × роль.

Наблюдаемый факт:
Для каждой операции понятно:
- есть ли действие в UI;
- какой ответ API;
- какой отказ для чужой роли.

Автотест:
Не обязательно автоматизировать всю матрицу сразу.
Сначала таблица, потом один-два представителя.
```

### Термины на сегодня

**Матрица прав** — таблица, где по одной оси операции, а по другой роли.

**Отказ** — не просто «нельзя», а конкретный наблюдаемый ответ: `403`, `401`, отсутствие кнопки, редирект.

Идея из Коупленда своими словами:

> Если у системы есть роли и операции, полезно явно перечислить, кто и что может делать. Иначе легко проверить только один сценарий и не заметить дыру на соседней операции.

---

### Дано в стиле BDD

```gherkin
Feature: Операции над товаром зависят от роли

  Scenario: Администратор создаёт товар
    Given я вошла как "kira"
    When я создаю товар с валидными полями
    Then товар сохраняется

  Scenario: Покупатель не создаёт товар
    Given я вошла как "anna"
    When я пытаюсь создать товар
    Then получаю отказ 403

  Scenario: Скрытие товара не удаляет товар насовсем
    Given я вошла как "kira"
    And товар виден в витрине
    When я скрываю товар
    Then в витрине Анны этот товар больше не виден
    And товар можно вернуть через показ
```

---

### Что нужно сделать

Составить матрицу:

```text
Операции:
- Read список витрины
- Read карточка активного товара
- Read список админки
- Create
- Update
- Hide
- Show

Роли:
- guest
- user
- admin
```

Для каждой клетки нужно указать не просто «да» или «нет», а наблюдаемый факт.

Например:

```text
200
403
401
нет кнопки в UI
редирект на /login
```

---

### Пример матрицы для текущего приложения

Ниже — ориентир. Студент может оформить таблицу по-своему, но смысл должен быть тем же.

| Операция                                     | гость                | Анна `user` | Кира `admin`      |
| -------------------------------------------- | -------------------- | ----------- | ----------------- |
| `GET /api/products`                          | 401                  | 200         | 200               |
| `GET /api/products/:id` для активного товара | 401                  | 200         | 200               |
| `GET /admin/products` как страница           | редирект на `/login` | модалка 403 | страница доступна |
| `GET /api/admin/products`                    | 401                  | 403         | 200               |
| `POST /api/admin/products`                   | 401                  | 403         | 201               |
| `PATCH /api/admin/products/:id`              | 401                  | 403         | 200               |
| `POST /api/admin/products/:id/hide`          | 401                  | 403         | 200               |
| `POST /api/admin/products/:id/show`          | 401                  | 403         | 200               |
| Кнопка «Изменить» в строке каталога          | не видна             | не видна    | видна             |
| Пункт «Товары» в шапке                       | не виден             | не виден    | виден             |

Важные уточнения для нашего приложения:

```text
Нет кнопки в UI — это не доказательство безопасности.
Если убрать кнопку, но не проверить право на сервере,
запрос может пройти.

Поэтому в матрице рядом с «нет кнопки» должен быть серверный отказ:
403 для пользователя,
401 для гостя.
```

---

### Что важно не перепутать

#### 1. `hide` — это не `delete`

В нашем приложении нельзя удалить товар насовсем.

Администратор может только:

```text
hide → is_active = 0
show → is_active = 1
```

Товар остаётся в данных, но исчезает из витрины покупателя.

Поэтому в матрице не должно быть успеха для операции `DELETE`.

---

#### 2. Разные чтения — это разные операции

Есть два разных чтения списка:

```text
GET /api/products        → витрина
GET /api/admin/products  → админский список
```

Для Анны:

```text
GET /api/products       → 200
GET /api/admin/products → 403
```

Это не одно и то же чтение.

---

#### 3. Гость и пользователь — разные состояния

Гость без сессии обычно получает:

```text
401
```

Пользователь с живой сессией, но без прав администратора:

```text
403
```

Если в таблице везде написано «доступ запрещён», это плохо.  
Нужно различать:

```text
кто не вошёл
и кто вошёл, но не имеет права
```

---

### Что можно автоматизировать

Всю матрицу сразу автоматизировать не нужно.

Для начала достаточно одного-двух представителей.

Например, пользователь открывает админскую страницу напрямую:

```ts
import { test, expect } from '@playwright/test';

async function loginAsAnna(page) {
  await page.goto('/login');

  await page.getByTestId('login-input').fill('anna');
  await page.getByTestId('password-input').fill('anna-pass');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/catalog/);
}

test('Анна на админской странице получает отказ 403', async ({ page }) => {
  await loginAsAnna(page);

  await page.goto('/admin/products');

  await expect(page.getByTestId('app-error')).toBeVisible();
  await expect(page.getByTestId('app-error-code')).toHaveText('403');
  await expect(page.getByTestId('admin-product-form')).toHaveCount(0);
});
```

В текущем клиенте при таком отказе в модалке может отображаться `403` как код.  
Если позже вы включите строковые бизнес-коды, это может быть `FORBIDDEN`.

---

### Мини-ревью

1. В матрице есть пустые клетки без ответа?
2. Понятно ли, чем отказ гостя отличается от отказа пользователя?
3. Не превратился ли `hide` в удаление товара?

---

### Что обычно делают не так

- Пишут одну колонку «права админа» и забывают Анну.
- Путают `hide` и `delete`.
- Проверяют только кнопку в интерфейсе, но не проверяют сервер.
- Забывают гостя.
- Везде пишут «нельзя», не указывая код отказа.
- Смешивают `401` и `403` в одну строку.

---

### Полезные идеи и ссылки

- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- Lee Copeland — идея перечисления условий и состояний, когда поведение зависит от нескольких факторов.
- Канер и коллеги — ожидаемый результат должен быть конкретным фактом, а не общим «доступ запрещён».

---

## Задача 27. Что если, хотя в ТЗ молчат

### Зачем эта задача

Таблицы классов, границ и матриц покрывают правила, которые уже сформулированы.

Но рядом с правилами всегда есть зона:

```text
В описании не сказано.
В здравом смысле кажется странным.
В коде может быть случайно реализовано не так.
```

Эта зона называется **угадывание ошибок** или **error guessing**.

Это не замена тест-дизайну.  
Это список гипотез:

```text
А что если?..
```

Хорошая гипотеза должна быть конкретной:

```text
Что делаем.
Что может пойти не так.
Что мы не знаем точно из требований.
```

Плохая гипотеза:

```text
Проверить нестандартные символы.
```

Слишком общо.

---

### Цепочка задачи

```text
Правило продукта:
Явных требований на эти случаи может не быть.

Риск:
Неочевидные входные данные или странные переходы
могут дать пустую таблицу, модалку 500 или молчаливый баг.

Проверка:
Составить список гипотез.

Наблюдаемый факт:
Для каждой гипотезы фиксируем фактическое поведение
и помечаем, есть ли на него оракул.

Автотест:
Не обязательно автоматизировать всё.
Сначала гипотезы, потом 2–3 ручные проверки.
```

---

### Термины на сегодня

**Гипотеза** — предположение о поведении, которое ещё не стало полноценным требованием.

**Оракул** — источник ожидаемого результата.

Если оракула нет, нельзя молча писать в тесте:

```text
должно быть 404
```

Нужно честно сказать:

```text
В описании не сказано.
Проверим факт и зафиксируем решение.
```

Идея из Канера своими словами:

> Часть дефектов живёт там, где документ вежлив, неточен или молчит. Поэтому тестировщик не только проверяет требования, но и задаёт продукту неудобные вопросы.

---

### Дано в стиле BDD

```gherkin
Feature: Гипотезы, для которых пока нет полного оракула

  Scenario: Поиск с пробелом в конце
    Given я вошла как "anna"
    When я ищу "тетра " с пробелом в конце
    Then я фиксирую факт: либо тетради на месте, либо пустая таблица
    And я не ожидаю модалку 500

  Scenario: Прямая карточка скрытого товара
    Given администратор скрыл товар
    When покупатель открывает карточку этого товара по прямому адресу
    Then я фиксирую факт: 404, карточка или известный дефект
    And не выдумываю ожидаемое поведение без договорённости
```

Здесь `Then` намеренно слабый.  
Если оракул не дожат, нельзя делать вид, что он есть.

---

### Что нужно сделать

Составить список из **7–10 гипотез** по витрине.

Для каждой гипотезы указать:

1. как воспроизвести;
2. что ожидаем, если оракул строгий;
3. что не сказано в описании;
4. стоит ли проверять это руками на этой неделе.

Не нужно сразу всё автоматизировать.

---

### Пример гипотез для нашего приложения

Ниже — список, который можно взять как основу.

| №   | Гипотеза                                | Как воспроизвести                                                        | Что фиксируем                                                                                                                          |
| --- | --------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Поиск с пробелом в конце                | Ввести `тетра ` и нажать Enter                                           | В текущей реализации сервер делает `trim`, поэтому результат должен совпадать с `тетра`. Если поведение изменится, это важно заметить. |
| 2   | `page=0` в URL каталога                 | Открыть `/catalog?page=0`                                                | Ожидаем отказ валидации `422 / VALIDATION`, не пустую таблицу без объяснения.                                                          |
| 3   | `page=-1` в URL каталога                | Открыть `/catalog?page=-1`                                               | То же семейство, что и `page=0`: некорректная страница — валидация.                                                                    |
| 4   | После фильтра осталась высокая страница | Выбрать категорию, дойти до последней страницы, затем сбросить категорию | Проверяем, не осталась ли страница, на которой теперь нет товаров.                                                                     |
| 5   | Прямая ссылка на скрытый товар          | Админ скрывает товар, Анна открывает `/catalog/:id`                      | В текущей реализации ожидается 404 / отсутствие карточки. Если карточка открывается, это расхождение списка и карточки.                |
| 6   | Двойной клик по кнопке «Войти»          | Быстро нажать кнопку входа два раза                                      | Фиксируем, создаётся ли одна сессия или несколько. В текущем учебном приложении повторный логин может не гасить старую сессию.         |
| 7   | Чужой email в профиле                   | Анна меняет email на `kira@example.com`                                  | Ожидаем конфликт `409`, не молчаливое сохранение и не `500`.                                                                           |
| 8   | `stock = 0` в витрине                   | Открыть каталог и найти товар с нулевым остатком                         | Это разрешено описанием. Студенты часто хотят объявить это багом, но правило разрешает показывать такой товар.                         |
| 9   | Подмена роли в DOM                      | В браузере вручную поменять текст бейджа роли                            | Проверяем, что серверные права от этого не меняются. Админский API для Анны всё равно должен давать `403`.                             |
| 10  | Пустое имя товара с пробелами           | В админке ввести `"   "` в название                                      | Ожидаем валидацию `422 / VALIDATION`, потому что после `trim` название пустое.                                                         |

Из этого списка на этой неделе стоит проверить руками, например:

```text
1. Поиск с пробелом в конце.
2. Прямая ссылка на скрытый товар.
3. Чужой email в профиле.
```

---

### Что важно не перепутать

#### 1. Угадывание не заменяет классы и границы

В задаче 21 мы проверяли название товара по явному правилу:

```text
1–80 символов
```

Это не угадывание.

А вот вопрос:

```text
А что будет, если название состоит только из пробелов?
```

уже ближе к гипотезе, если про `trim` явно не договорились.

---

#### 2. Нельзя притворяться, что оракул есть

Если в описании не сказано:

```text
должен ли поиск обрезать пробелы
```

нельзя писать в тесте:

```ts
await expect(rows).toHaveCount(0);
```

и считать это единственно правильным ответом.

Сначала фиксируем факт, потом принимаем решение.

---

#### 3. Не все гипотезы нужно автоматизировать

Некоторые гипотезы нужны, чтобы один раз проверить руками и принять решение:

```text
это баг
это норма
это требование нужно уточнить
```

После этого можно автоматизировать только то, что стало правилом.

---

### Мини-ревью

1. У каждой гипотезы есть конкретный способ воспроизведения?
2. Понятно ли, где оракул есть, а где его пока нет?
3. Не превратился ли список в «проверить вообще всё»?

---

### Что обычно делают не так

- Пишут 50 абстрактных пунктов без способа воспроизведения.
- Сразу пишут автотесты на поведение, которое ещё не договорились считать правильным.
- Путают гипотезу и требование.
- Забывают пометить, где документ молчит.
- Смешивают эту задачу с классами эквивалентности.

---

### Полезные идеи и ссылки

- [Kaner.com](https://kaner.com/) — материалы про исследовательское тестирование и работу с неопределённостью.
- Канер, Бах, Петтичорд — идея, что тестирование не только исполняет правила, но и задаёт продукту вопросы.
- [Playwright Trace Viewer](https://playwright.dev/docs/trace-viewer) — пригодится, если гипотеза начнёт воспроизводиться нестабильно.

---

## Задача 28. Один путь покупателя и где его рвать

### Зачем эта задача

До этого мы проверяли витрину по частям:

- вход;
- каталог;
- поиск;
- карточка;
- профиль;
- выход.

Теперь полезно посмотреть на продукт глазами пользователя:

```text
Анна вошла.
Анна нашла тетрадь.
Анна открыла карточку.
Анна заглянула в профиль.
Анна вышла.
```

Это называется **путь пользователя** или **user journey**.

Но здесь есть ловушка.

Если автоматизировать весь путь одним тестом, получится:

```text
упало на профиле → непонятно, жив ли поиск
```

Поэтому путь нужен не для того, чтобы заменить атомарные тесты.  
Путь нужен, чтобы не потерять смысл магазина.

---

### Цепочка задачи

```text
Правило продукта:
Пользователь может пройти основной путь по витрине.

Риск:
Если каждый шаг существует отдельно, но вместе не складывается,
продукт формально зелёный, но пользоваться им нельзя.

Проверка:
Описать путь покупателя и понять,
какими атомарными задачами он уже покрыт.

Наблюдаемый факт:
Путь существует как документация.
Атомарные проверки остаются отдельными.

Автотест:
По желанию один сквозной тест с шагами.
Он иллюстрация, а не замена атомарных проверок.
```

---

### Термины на сегодня

**Путь пользователя** — последовательность действий, которую реальный человек делает в продукте.

**Атомарная проверка** — тест на одно правило.

Идея своими словами:

> Сначала смотрим на путь как человек.
> Потом режем его на проверяемые куски как тестировщик.

---

### Дано в стиле BDD

```gherkin
Feature: Покупательский путь

  Scenario: Анна находит тетрадь и заглядывает в профиль
    Given я гость на странице входа
    When я вхожу как "anna" с паролем "anna-pass"
    Then я вижу каталог
    When я ищу "тетра"
    Then в таблице есть подходящие строки
    When я открываю первую строку
    Then вижу карточку с тем же именем и ценой
    When я открываю профиль
    Then имя, фамилия и почта не пустые
    When я нажимаю «Выйти»
    Then я оказываюсь на странице входа
```

Этот сценарий можно прогнать руками.  
Он читается как короткий день пользователя.

---

### Что нужно сделать

#### 1. Описать путь

Например, в 5–8 шагов:

```text
1. Вход как Анна.
2. Каталог показывает строки.
3. Поиск «тетра».
4. Открытие карточки первой строки.
5. Проверка имени и цены.
6. Открытие профиля.
7. Проверка непустых полей.
8. Выход.
```

Не нужно тащить сюда:

- сортировку;
- админку;
- скрытие товара;
- 422;
- 503;
- пагинацию на третью страницу;
- изменение профиля.

Это уже другие правила и другие задачи.

---

#### 2. Сделать таблицу нарезки

Каждый шаг пути должен быть связан с уже существующими атомарными задачами.

| Шаг пути                         | Какой атомарной задачей покрыт |
| -------------------------------- | ------------------------------ |
| Вход Анны                        | задача 5                       |
| В каталоге 10 строк              | задача 9                       |
| Поиск `тетра`                    | задача 10                      |
| Карточка показывает тот же товар | задача 13                      |
| Профиль не пустой                | задача 14                      |
| Выход                            | задача 15                      |

Если шаг не покрыт — это дырка.

Например, если бы не было проверки карточки, путь мог бы сказать:

```text
пользователь что-то кликнул
```

но не доказал бы:

```text
открылся именно тот товар
```

---

#### 3. Написать, что не кладём в сквозной автотест

Например:

```text
Не кладём в сквозной тест:
- проверку 422;
- проверку 403;
- сортировку по цене;
- пустое пересечение поиска и категории;
- админский CRUD;
- сетевые ошибки 503.
```

Сквозной тест должен быть иллюстрацией пути, а не вторым смоуком, регрессом и негативным набором одновременно.

---

### Что можно автоматизировать

По желанию можно сделать один сквозной тест с `test.step`.

Важно:

- без `waitForTimeout`;
- с читаемыми шагами;
- без лишних проверок;
- понимая, что это не замена атомарным тестам.

Пример:

```ts
import { test, expect } from '@playwright/test';

test('путь Анны: вход, поиск, карточка, профиль, выход', async ({ page }) => {
  await test.step('вход Анны', async () => {
    await page.goto('/login');

    await page.getByTestId('login-input').fill('anna');
    await page.getByTestId('password-input').fill('anna-pass');
    await page.getByTestId('login-submit').click();

    await expect(page).toHaveURL(/\/catalog/);
  });

  await test.step('каталог не пустой', async () => {
    await expect(page.getByTestId('catalog-row')).toHaveCount(10);
  });

  await test.step('поиск тетра', async () => {
    await page.getByTestId('catalog-search').fill('тетра');
    await page.getByTestId('catalog-search').press('Enter');

    await expect(page.getByTestId('catalog-row')).not.toHaveCount(0);
  });

  await test.step('карточка первой строки', async () => {
    const firstRow = page.getByTestId('catalog-row').first();

    const name = await firstRow.getByTestId('catalog-name').innerText();
    const price = await firstRow.getByTestId('catalog-price').innerText();

    await firstRow.click();

    await expect(page).toHaveURL(/\/catalog\/\d+/);
    await expect(page.getByTestId('product-title')).toHaveText(name.trim());
    await expect(page.getByTestId('product-price')).toHaveText(price.trim());
  });

  await test.step('профиль не пустой', async () => {
    await page.getByTestId('nav-profile').click();

    await expect(page).toHaveURL(/\/profile/);

    await expect(page.getByTestId('profile-first-name')).not.toHaveValue('');
    await expect(page.getByTestId('profile-last-name')).not.toHaveValue('');
    await expect(page.getByTestId('profile-email')).not.toHaveValue('');
  });

  await test.step('выход', async () => {
    await page.getByTestId('nav-logout').click();
    await expect(page).toHaveURL(/\/login/);
  });
});
```

Если в твоём клиенте ещё нет `catalog-name` и `catalog-price`, можно временно читать первую ячейку строки и ячейку цены.  
Но для устойчивости лучше добавить отдельные `data-testid` на ячейки таблицы.

---

### Почему сквозной тест не должен быть главным

Сквозной путь красив, но у него есть минусы:

- он длиннее;
- он чаще падает из-за данных;
- при падении сложнее понять, какой шаг виноват;
- он дублирует атомарные проверки.

Поэтому в регрессе обычно важнее атомарные тесты:

```text
вход
каталог
поиск
карточка
профиль
выход
```

А сквозной путь можно использовать как:

```text
демо-сценарий
обзор продукта для новичков
документация поведения
```

---

### Мини-ревью

1. Путь читается как история пользователя?
2. Есть ли таблица, где каждый шаг связан с атомарной задачей?
3. Не превратился ли сквозной тест в попытку проверить вообще всё?

---

### Что обычно делают не так

- Пишут один тест на 40 шагов.
- Тащат в путь админку, скрытие товара и 503.
- Делают путь без нарезки на атомарные проверки.
- Делают нарезку без пути и теряют смысл продукта.
- Пытаются заменить сквозным тестом смоук, регресс и негативы.

---

### Полезные идеи и ссылки

- [test.step](https://playwright.dev/docs/api/class-test#test-step)
- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- Канер и коллеги — идея, что не каждый полезный сценарий нужно автоматизировать одинаково.

---

## Что запомнить в модуле 5

Модуль 5 меняет главный вопрос.

Раньше было:

```text
Как кликнуть?
```

Теперь:

```text
Какой класс?
Какая граница?
Какая пара?
Какой переход?
Какая роль?
Какая гипотеза?
Какой путь?
```

И самое важное:

```text
Автотест должен проверять правило продукта,
а не просто повторять движения пользователя.
```

Если после модуля остались только тесты без таблиц и гипотез — это снова кликер.  
Если остались только таблицы, но непонятно, какой представитель пойдёт в код — дизайн не доведён до автоматизации.

---

Дальше по синхронизации идёт **модуль 6**, задачи **29–34**:

- `LoginPage`;
- модалка как компонент;
- `CatalogPage`;
- фикстура залогиненного пользователя;
- `storageState` для Анны и Киры;
- роли на общих страницах.

### USER
дальше, еще раз приложу образец для контекста

### ASSISTANT
Продолжаю синхронизацию с образцом.  
Сейчас — **модуль 6: страницы и фикстуры**.

В этом сообщении выдаю задачи **29–33**.  
Задачу **34** оставлю на следующий блок, чтобы не выходить за рамки 3–5 задач.

---

# Перед модулем 6: три договорённости

## 1. ООП здесь минимальное

Студенты могут не любить классы. В модуле 6 они нужны, но очень ограниченно.

Объясняй так:

```text
Класс страницы здесь — это не «объектная модель бизнеса».
Это коробка для локаторов и действий.
```

Хороший класс страницы:

```ts
class LoginPage {
  // где элементы
  // как открыть
  // как ввести логин и пароль
}
```

Плохой класс страницы:

```ts
class LoginPage {
  loginAsAnna() {
    // и клики
    // и ожидания
    // и проверка роли
    // и знание, что Анна должна попасть в каталог
  }
}
```

То есть:

```text
Страница умеет нажимать.
Тест решает, что должно быть правдой.
```

---

## 2. Код ошибки в модалке

В образце задачи ждут:

```ts
await expect(page.getByTestId("app-error-code")).toHaveText("401");
await expect(page.getByTestId("app-error-code")).toHaveText("422");
await expect(page.getByTestId("app-error-code")).toHaveText("403");
```

В прошлом клиенте по умолчанию в модалку выводился бизнес-код:

```text
401 → UNAUTHORIZED
422 → VALIDATION
403 → FORBIDDEN / BLOCKED
```

Чтобы дальше синхронизироваться с образцом, лучше показать в модалке HTTP-статус.

В `public/app.js` найди блок в `showError`:

```js
if (codeElement) {
  codeElement.textContent = error.code ?? "UNKNOWN";
}
```

И замени на:

```js
if (codeElement) {
  const codeText =
    error.http && error.http !== 0
      ? String(error.http)
      : error.code ?? "UNKNOWN";

  codeElement.textContent = codeText;
}
```

Тогда:

```text
401 → 401
422 → 422
403 → 403
503 → 503
NETWORK → NETWORK
```

Если не хочешь менять клиент, то в примерах ниже нужно будет заменить:

```text
401 → UNAUTHORIZED
422 → VALIDATION
403 → FORBIDDEN или 403 в зависимости от места
```

Но для синхронизации с образцом удобнее использовать HTTP-статус.

---

## 3. Отличия нашего клиента от образца

Наше учебное приложение не на Vue, а на чистом JS + Bootstrap.  
Поэтому есть несколько отличий.

### Сортировка

В образце селект сортировки может быть отдельным:

```text
sort = price
dir = asc
```

В нашем клиенте селект `catalog-sort` хранит пару:

```text
price:asc
price:desc
name:asc
name:desc
created_at:asc
created_at:desc
```

Поэтому в Page Object мы будем передавать:

```ts
await catalog.sortBy("price:asc");
```

### Цена в таблице

В таблице каталога мы ранее добавили ячейку цены:

```html
<td
  data-testid="catalog-price"
  data-price="79000"
>
  790.00 ₽
</td>
```

Поэтому в тестах каталога используем:

```ts
row.getByTestId("catalog-price")
```

и атрибут:

```ts
data-price
```

Это устойчивее, чем парсить рубли, пробелы и `₽`.

---

# Модуль 6. Страницы и фикстуры

До сих пор локаторы жили прямо в тестах, а логин копировался из файла в файл.  
Пока файлов мало — это терпимо.

Но когда один и тот же вход появляется в задачах про каталог, профиль, поиск и роли, копипаста начинает врать:

```text
поменяли логин-форму — нужно править шесть тестов;
переименовали поле — падают несколько спеков;
правила продукта прячутся в повторяющемся коде.
```

Модуль 6 не добавляет новых правил витрины.  
Он меняет упаковку тестов.

Правила остаются те же:

```text
Анна входит как пользователь.
Неверный пароль даёт 401.
Пустые поля дают 422.
Пустой поиск не ошибка.
Кира видит админские контролы.
Анна не видит админские контролы.
```

Меняется только то, где живут локаторы и повторяющиеся действия.

---

## Задача 29. LoginPage: тесты становятся тоньше

### Зачем эта задача

Раньше тест входа выглядел так:

```ts
await page.getByTestId("login-input").fill("anna");
await page.getByTestId("password-input").fill("anna-pass");
await page.getByTestId("login-submit").click();
```

И это повторялось в нескольких задачах.

Сам по себе код не плохой.  
Он плохой тем, что не даёт понять, какое правило проверяется.

После вынесения формы входа в объект тест должен читаться ближе к сценарию:

```text
Открыть страницу входа.
Войти как Анна.
Проверить каталог и бейдж роли.
```

### Цепочка задачи

```text
Правило продукта:
Логин позволяет Анне войти как покупателю.
Неверный пароль не пускает.
Пустые поля дают валидацию.

Риск:
Если локаторы формы размазаны по тестам,
изменение одного поля ломает много файлов.

Проверка:
Вынести локаторы и действия страницы входа в LoginPage.

Наблюдаемый факт:
Тесты остались тонкими:
- вход Анны;
- неверный пароль;
- пустые поля.

Автотест:
Три теста используют LoginPage, но ожидания остаются в тестах.
```

### Термины на сегодня

**Page Object** — объект, который знает, где лежат элементы страницы и как с ними взаимодействовать.

**Тонкий тест** — тест, в котором видно сценарий и ожидаемый факт, а повторяющиеся клики спрятаны в страницу.

Идея из документации Playwright своими словами:

> Страница абстрагирует вёрстку и действия с ней.  
> Тест остаётся спецификацией поведения.

### Дано в стиле BDD

```gherkin
Feature: Вход через страницу логина

  Scenario: Покупатель входит и не видит админку
    Given я гость на странице входа
    When я вхожу как "anna" с паролем "anna-pass"
    Then я оказываюсь в каталоге
    And в шапке виден бейдж роли "user"
    And пункта «Товары» нет

  Scenario: Неверный пароль не пускает в каталог
    Given я гость на странице входа
    When я вхожу как "anna" с неверным паролем
    Then я остаюсь на странице входа
    And вижу модалку ошибки с кодом 401

  Scenario: Пустые поля дают валидацию
    Given я гость на странице входа
    When я нажимаю «Войти», ничего не вводя
    Then я остаюсь на странице входа
    And вижу модалку ошибки с кодом 422
```

### Что нужно сделать

Создать файл:

```text
pages/login-page.ts
```

Минимально:

- открыть `/login`;
- ввести логин и пароль;
- нажать кнопку входа;
- отправить пустую форму.

Важно:

```text
signIn() не должен ожидать каталог.
```

Потому что `signIn()` используется и для успешного входа, и для входа с ошибкой.

Если внутри `signIn()` написать:

```ts
await expect(page).toHaveURL(/\/catalog/);
```

то тесты на 401 и 422 сломают этот метод.

### Пример `pages/login-page.ts`

```ts
import { type Page, type Locator } from "@playwright/test";

export class LoginPage {
  page: Page;

  form: Locator;
  loginInput: Locator;
  passwordInput: Locator;
  submitButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.form = page.getByTestId("login-form");
    this.loginInput = page.getByTestId("login-input");
    this.passwordInput = page.getByTestId("password-input");
    this.submitButton = page.getByTestId("login-submit");
  }

  async open() {
    await this.page.goto("/login");
  }

  async signIn(login: string, password: string) {
    await this.loginInput.fill(login);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async submitEmpty() {
    await this.submitButton.click();
  }
}
```

### Пример тестов

```ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";

test("Анна входит как покупатель", async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);
  await expect(page.getByTestId("role-badge")).toHaveText(/user/i);
  await expect(page.getByTestId("nav-admin-products")).toHaveCount(0);
  await expect(page.getByTestId("app-error")).toBeHidden();
});

test("неверный пароль оставляет на странице входа", async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass-nope");

  await expect(page.getByTestId("app-error")).toBeVisible();
  await expect(page.getByTestId("app-error-code")).toHaveText("401");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId("role-badge")).toHaveCount(0);
});

test("пустые поля дают валидацию, а не 401", async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.open();
  await loginPage.submitEmpty();

  await expect(page.getByTestId("app-error")).toBeVisible();
  await expect(page.getByTestId("app-error-code")).toHaveText("422");
  await expect(page).toHaveURL(/\/login/);
});
```

### Мини-ревью

1. Тест читается как сценарий входа?
2. Есть ли ожидания в `LoginPage`, которых там быть не должно?
3. Можно ли использовать `signIn()` и для успеха, и для ошибки?

### Сигналы, что страница поехала не туда

- Внутри `signIn()` появился `expect`.
- `LoginPage` знает, что Анна должна попасть в каталог.
- Тест стал одной строкой, но перестал показывать, какой факт проверяется.
- Появился метод `loginSuccessfullyAsAnna()`, рядом `loginUnsuccessfullyWithWrongPassword()`, и дальше методы начинают размножаться.

### Полезные ссылки

- [Page Object Model](https://playwright.dev/docs/pom)
- [Locators](https://playwright.dev/docs/locators)
- [Assertions](https://playwright.dev/docs/test-assertions)

---

## Задача 30. Модалка ошибки — один компонент на все отказы

### Зачем эта задача

В приложении одна модалка на все отказы:

```text
401 на логине
422 на пустых полях
403 на админской странице
503 из-за учебного сбоя
```

Если каждый тест будет сам писать:

```ts
page.getByTestId("app-error")
page.getByTestId("app-error-code")
page.getByTestId("app-error-message")
page.getByTestId("app-error-close")
```

то при изменении модалки придётся править много файлов.

Но и создавать два класса:

```text
LoginErrorModal
AdminErrorModal
```

нельзя.

Потому что в продукте модалка одна.  
Разные коды — это разные правила, но окно одно.

### Цепочка задачи

```text
Правило продукта:
Все отказы показываются в одной модалке.

Риск:
Если разнести модалку по тестам или по классам,
потеряется факт, что это один и тот же компонент.

Проверка:
Сделать один component object для модалки.

Наблюдаемый факт:
Тесты 401 и 403 используют один объект,
но проверяют разные коды.

Автотест:
Неверный пароль показывает 401 и закрывается.
Анна на /admin/products видит 403.
```

### Дано в стиле BDD

```gherkin
Feature: Одна модалка на отказы

  Scenario: Неверный пароль показывает 401
    Given я гость на странице входа
    When я вхожу как "anna" с неверным паролем
    Then вижу модалку ошибки с кодом 401
    When я закрываю модалку
    Then модалка исчезает
    And я остаюсь на странице входа

  Scenario: Покупатель на админской странице видит 403
    Given я вошла как "anna"
    When я открываю "/admin/products"
    Then вижу модалку ошибки с кодом 403
```

### Что нужно сделать

Создать файл:

```text
components/app-error-modal.ts
```

Он должен давать доступ к:

- корню модалки;
- коду ошибки;
- тексту ошибки;
- кнопке закрытия;
- действию `close()`.

Он не должен решать:

```text
401 это хорошо или плохо;
403 должен быть для Анны или нет;
какой пароль ввела Анна.
```

Это знает тест.

### Пример `components/app-error-modal.ts`

```ts
import { type Page, type Locator } from "@playwright/test";

export class AppErrorModal {
  page: Page;

  root: Locator;
  code: Locator;
  message: Locator;
  closeButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.root = page.getByTestId("app-error");
    this.code = page.getByTestId("app-error-code");
    this.message = page.getByTestId("app-error-message");
    this.closeButton = page.getByTestId("app-error-close");
  }

  async close() {
    await this.closeButton.click();
  }
}
```

### Пример тестов

```ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";
import { AppErrorModal } from "../components/app-error-modal";

test("401 на логине показывается общей модалкой и закрывается", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const errorModal = new AppErrorModal(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass-nope");

  await expect(errorModal.root).toBeVisible();
  await expect(errorModal.code).toHaveText("401");

  await errorModal.close();

  await expect(errorModal.root).toBeHidden();
  await expect(page).toHaveURL(/\/login/);
});

test("Анна на админской странице видит 403 в той же модалке", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const errorModal = new AppErrorModal(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);

  await page.goto("/admin/products");

  await expect(errorModal.root).toBeVisible();
  await expect(errorModal.code).toHaveText("403");
});
```

### Пояснение

Второй тест проверяет не гостя.  
Гость на `/admin/products` должен попасть на логин — это другое правило.

Здесь `Given` другой:

```text
Сессия Анны жива, но прав администратора нет.
```

Поэтому ожидаем:

```text
403
```

а не редирект на `/login`.

### Мини-ревью

1. Модалка одна, даже если коды разные?
2. Компонент знает, как закрыть окно, но не знает, почему оно появилось?
3. Не появился ли метод вида `expectLoginError()` или `expectAdminForbidden()`?

### Сигналы, что компонент начал прятать оракул

- Внутри `AppErrorModal` появился `expect`.
- Появились два класса: `LoginErrorModal` и `AdminErrorModal`.
- Тест вызывает `modal.assert401()` и по падению непонятно, что именно не совпало.
- Закрытие проверяется через `Escape`, хотя в приложении есть явная кнопка.

### Полезные ссылки

- [Page Object Model](https://playwright.dev/docs/pom)
- [Assertions](https://playwright.dev/docs/test-assertions)

---

## Задача 31. CatalogPage: витрина без портянки

### Зачем эта задача

В модуле 3 тесты каталога делали примерно одно и то же:

```ts
await page.getByTestId("catalog-search").fill("тетра");
await page.getByTestId("catalog-search").press("Enter");
await page.getByTestId("catalog-category").selectOption("notebooks");
await page.getByTestId("catalog-sort").selectOption("price:asc");
```

Это можно собрать в `CatalogPage`.

Но важно не переусердствовать.

Плохо:

```ts
catalog.expectSortedByPriceAsc();
```

Хорошо:

```ts
await catalog.sortBy("price:asc");

const prices = await readPricesFromVisibleRows();

expect(prices[1]).toBeGreaterThanOrEqual(prices[0]);
```

Потому что:

```text
Страница умеет управлять каталогом.
Тест решает, что считать правильной сортировкой.
```

### Цепочка задачи

```text
Правило продукта:
Каталог поддерживает поиск, категорию и сортировку.
Пустой поиск не ошибка.
Сортировка цены проверяется по числам.

Риск:
Если локаторы каталога размазаны по тестам,
правка таблицы или фильтров ломает много файлов.

Проверка:
Вынести локаторы и действия каталога в CatalogPage.

Наблюдаемый факт:
Тесты поиска, пустого поиска и сортировки остались понятными
и не потеряли оракулы.

Автотест:
Три теста на основе задач 10 и 12.
```

### Дано в стиле BDD

```gherkin
Feature: Каталог через page object

  Scenario: Поиск по подстроке
    Given я вошла как "anna" и открыла каталог
    When я ищу "тетра"
    Then в таблице есть строки
    And каждая видимая строка содержит "тетра"

  Scenario: Поиск без совпадений не ошибка
    Given я вошла как "anna" и открыла каталог
    When я ищу запрос, которого нет в витрине
    Then строк в таблице нет
    And модалка ошибки скрыта

  Scenario: Сортировка по цене смотрит на числа
    Given я вошла как "anna" и открыла каталог
    When я включаю сортировку по цене по возрастанию
    Then каждая следующая видимая цена не меньше предыдущей
```

### Что нужно сделать

Создать файл:

```text
pages/catalog-page.ts
```

Добавить:

- поле поиска;
- селект категории;
- селект сортировки;
- строки таблицы;
- пагинацию;
- методы действий: `search()`, `selectCategory()`, `sortBy()`;
- доступ к цене строки.

Не нужно класть в `CatalogPage`:

- логин;
- проверку роли;
- ожидания успеха;
- `expect` внутри страницы.

### Пример `pages/catalog-page.ts`

```ts
import { type Page, type Locator } from "@playwright/test";

export class CatalogPage {
  page: Page;

  searchInput: Locator;
  categorySelect: Locator;
  sortSelect: Locator;
  rows: Locator;
  pagination: Locator;

  constructor(page: Page) {
    this.page = page;

    this.searchInput = page.getByTestId("catalog-search");
    this.categorySelect = page.getByTestId("catalog-category");
    this.sortSelect = page.getByTestId("catalog-sort");
    this.rows = page.getByTestId("catalog-row");
    this.pagination = page.getByTestId("catalog-pagination");
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press("Enter");
  }

  async selectCategory(value: string) {
    await this.categorySelect.selectOption(value);
  }

  async sortBy(value: string) {
    await this.sortSelect.selectOption(value);
  }

  rowPrice(row: Locator): Locator {
    return row.getByTestId("catalog-price");
  }
}
```

### Вспомогательный вход в каталог

Это ещё не фикстура.  
Просто функция, чтобы не повторять логин в трёх тестах одного файла.

```ts
import { type Page } from "@playwright/test";
import { LoginPage } from "./login-page";

export async function openCatalogAsAnna(page: Page) {
  const loginPage = new LoginPage(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);
}
```

### Пример тестов

```ts
import { test, expect } from "@playwright/test";
import { CatalogPage } from "../pages/catalog-page";
import { AppErrorModal } from "../components/app-error-modal";
import { openCatalogAsAnna } from "../helpers/open-catalog-as-anna";

test("поиск тетра оставляет только подходящие строки", async ({ page }) => {
  await openCatalogAsAnna(page);

  const catalog = new CatalogPage(page);

  await catalog.search("тетра");

  await expect(catalog.rows).not.toHaveCount(0);

  const count = await catalog.rows.count();

  for (let i = 0; i < count; i += 1) {
    await expect(catalog.rows.nth(i)).toContainText(/тетра/i);
  }
});

test("поиск без совпадений — пустая таблица, не модалка", async ({ page }) => {
  await openCatalogAsAnna(page);

  const catalog = new CatalogPage(page);
  const errorModal = new AppErrorModal(page);

  await catalog.search("zzzz-no-such");

  await expect(catalog.rows).toHaveCount(0);
  await expect(errorModal.root).toBeHidden();
});

test("сортировка по цене по возрастанию проверяется по числам", async ({ page }) => {
  await openCatalogAsAnna(page);

  const catalog = new CatalogPage(page);

  await catalog.sortBy("price:asc");

  await expect(catalog.rows).toHaveCount(10);

  const prices: number[] = [];

  for (let i = 0; i < 10; i += 1) {
    const priceAttribute = await catalog
      .rowPrice(catalog.rows.nth(i))
      .getAttribute("data-price");

    expect(priceAttribute).not.toBeNull();

    prices.push(Number(priceAttribute));
  }

  for (let i = 1; i < prices.length; i += 1) {
    expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
  }
});
```

### Пояснение про сортировку

В нашем клиенте селект сортировки хранит значение:

```text
price:asc
```

Поэтому:

```ts
await catalog.sortBy("price:asc");
```

Если в твоём приложении направление отдельное, то можно сделать метод:

```ts
async sortByPrice(direction: "asc" | "desc")
```

Но пока лучше не усложнять.

### Мини-ревью

1. Тест спрашивает «цены идут по возрастанию?» или просит страницу «проверить сортировку»?
2. Можно ли поменять поиск или селект категории в одном месте?
3. Не появился ли в `CatalogPage` логин?

### Сигналы, что слой начал мешать

- Внутри `CatalogPage` появился `expect`.
- Появился метод `checkSorted()`.
- Тест не может объяснить, какой именно факт проверяет.
- `CatalogPage` наследуется от `LoginPage`.

### Полезные ссылки

- [Page Object Model](https://playwright.dev/docs/pom)
- [Locators](https://playwright.dev/docs/locators)
- [Assertions](https://playwright.dev/docs/test-assertions)

---

## Задача 32. Фикстура: Анна уже внутри

### Зачем эта задача

После задачи 31 стало лучше:

```text
локаторы каталога в одном месте;
тесты читаются как сценарии.
```

Но каждый тест всё равно делает вход:

```ts
await openCatalogAsAnna(page);
```

Это было полезно в модуле 3, чтобы почувствовать:

```text
каждый тест сам приводит себя в нужное состояние
```

Теперь хочется убрать повторяющийся логин, но не потерять изоляцию.

Для этого нужна фикстура.

### Цепочка задачи

```text
Правило продукта:
Тесты каталога работают от имени Анны.

Риск:
Если вход спрятать в общий файл через beforeAll,
тесты могут начать делиться состоянием.

Проверка:
Сделать фикстуру, которая логинит Анну для каждого теста.

Наблюдаемый факт:
Тест каталога не пишет вход явно.
Соседний тест не наследует поиск или фильтр.

Автотест:
Два теста: один с поиском, другой без поиска.
```

### Термины на сегодня

**Фикстура** — способ подготовить состояние для теста, не превращая подготовку в общий `beforeAll` на весь файл.

**Изоляция** — каждый тест начинает с чистого контекста и не видит следы соседнего теста.

Идея своими словами:

> Фикстура должна уважать независимость тестов.  
> Она прячет повторяющийся вход, но не делает тесты зависимыми друг от друга.

### Дано в стиле BDD

```gherkin
Feature: Фикстура покупателя

  Scenario: Каталог без фильтра показывает первую страницу
    Given я вошла как "anna" в чистом контексте
    When я открываю каталог без поиска
    Then в таблице 10 строк

  Scenario: Поиск живёт только в своём тесте
    Given я вошла как "anna" в чистом контексте
    When я ищу "тетра"
    Then в таблице есть строки с "тетра"
    And это не влияет на другие тесты
```

### Что нужно сделать

Создать файл:

```text
fixtures/as-anna.ts
```

Фикстура должна:

1. получить `page`;
2. открыть логин;
3. войти как Анна;
4. передать залогиненный `page` в тест;
5. ничего не шарить между тестами.

Не нужно использовать:

```ts
beforeAll
```

Не нужно делать:

```ts
test.describe.serial
```

Не нужно использовать:

```ts
storageState
```

`storageState` будет позже, в задаче 33.

### Пример `fixtures/as-anna.ts`

```ts
import { test as base, expect, type Page } from "@playwright/test";
import { LoginPage } from "../pages/login-page";

export const test = base.extend<{ asAnna: Page }>({
  asAnna: async ({ page }, use) => {
    const loginPage = new LoginPage(page);

    await loginPage.open();
    await loginPage.signIn("anna", "anna-pass");

    await expect(page).toHaveURL(/\/catalog/);

    await use(page);
  },
});

export { expect };
```

### Пример тестов

```ts
import { test, expect } from "../fixtures/as-anna";
import { CatalogPage } from "../pages/catalog-page";

test("без фильтра каталог показывает первую страницу", async ({ asAnna }) => {
  const catalog = new CatalogPage(asAnna);

  await expect(catalog.rows).toHaveCount(10);
});

test("поиск тетра работает в своём контексте", async ({ asAnna }) => {
  const catalog = new CatalogPage(asAnna);

  await catalog.search("тетра");

  await expect(catalog.rows).not.toHaveCount(0);

  const count = await catalog.rows.count();

  for (let i = 0; i < count; i += 1) {
    await expect(catalog.rows.nth(i)).toContainText(/тетра/i);
  }
});
```

### Как проверить изоляцию

Эти два теста должны быть зелёными в любом порядке.

Если первый тест ищет `тетра`, а второй без фильтра вдруг видит только тетради — изоляция сломана.

Правильное поведение:

```text
Тест с поиском ищет в своём контексте.
Тест без фильтра видит обычную первую страницу.
```

### Мини-ревью

1. Тест каталога больше не пишет вход явно?
2. Можно ли запустить только один тест, и он всё равно войдёт?
3. Нет ли общего состояния между тестами?

### Сигналы, что фикстура стала общим состоянием

- Использован `beforeAll`.
- Один `page` живёт на несколько тестов.
- Фикстура возвращает не `page`, а Page Object.
- Тесты очищают поиск в `afterEach`, вместо того чтобы получить чистый контекст.
- Появился `serial`, чтобы тесты «правильно шли по порядку».

### Полезные ссылки

- [Test Fixtures](https://playwright.dev/docs/test-fixtures)
- [Best Practices](https://playwright.dev/docs/best-practices)

---

## Задача 33. Два `storageState`: две личности

### Зачем эта задача

Фикстура из задачи 32 уже убирает копипасту входа, но всё равно каждый раз кликает форму.

Для каталожных тестов это медленно.

Playwright умеет сохранить состояние после одного входа:

```text
куки;
локальные данные, если они есть;
сессию.
```

Это называется:

```text
storageState
```

Для нашего приложения важно:

```text
Анна и Кира — два разных файла.
```

Нельзя:

```text
войти Кирой;
потом в том же состоянии сказать «теперь будь Анной».
```

Роль нельзя «донастроить» через интерфейс.  
Роль подтверждается сессией и сервером.

### Цепочка задачи

```text
Правило продукта:
Анна и Кира имеют разные роли и разные видимые контролы.

Риск:
Если использовать один файл состояния на двоих,
тесты начнут врать про роли.

Проверка:
Сохранить два файла:
- anna.json;
- kira.json.

Наблюдаемый факт:
Анна из сохранённого состояния видит каталог как пользователь.
Кира из сохранённого состояния видит каталог как администратор.

Автотест:
Тесты без кликов по форме входа.
```

### Дано в стиле BDD

```gherkin
Feature: Две сохранённые сессии

  Scenario: Сессия Анны не даёт админку
    Given сохранён storageState пользователя "anna"
    When я открываю каталог без формы входа
    Then в шапке виден бейдж роли "user"
    And пункта «Товары» нет

  Scenario: Сессия Киры не превращается в Анну
    Given сохранён storageState администратора "kira"
    When я открываю каталог без формы входа
    Then в шапке виден бейдж роли "admin"
    And пункт «Товары» виден
```

### Что нужно сделать

Создать подготовку:

```text
tests/auth.setup.ts
```

В ней:

1. войти как Анна;
2. сохранить состояние в `playwright/.auth/anna.json`;
3. войти как Кира;
4. сохранить состояние в `playwright/.auth/kira.json`.

Дальше в конфиге или в фикстурах использовать эти файлы.

### Пример `tests/auth.setup.ts`

```ts
import { test as setup, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";

setup("сохранить состояние Анны", async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);

  await page.context().storageState({
    path: "playwright/.auth/anna.json",
  });
});

setup("сохранить состояние Киры", async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.open();
  await loginPage.signIn("kira", "kira-admin");

  await expect(page).toHaveURL(/\/catalog/);

  await page.context().storageState({
    path: "playwright/.auth/kira.json",
  });
});
```

### Пример фрагмента конфига

```ts
projects: [
  {
    name: "setup",
    testMatch: /auth\.setup\.ts/,
  },
  {
    name: "as-anna",
    dependencies: ["setup"],
    use: {
      storageState: "playwright/.auth/anna.json",
    },
  },
  {
    name: "as-kira",
    dependencies: ["setup"],
    use: {
      storageState: "playwright/.auth/kira.json",
    },
  },
];
```

Если в учебном шаблоне нельзя трогать конфиг, можно читать `storageState` через фикстуры или `browser.newContext()`.  
Но смысл должен остаться:

```text
Анна — свой файл.
Кира — свой файл.
```

### Пример теста для Анны

```ts
import { test, expect } from "@playwright/test";

test("Анна из сохранённого состояния видит каталог как покупатель", async ({ page }) => {
  await page.goto("/catalog");

  await expect(page.getByTestId("role-badge")).toHaveText(/user/i);
  await expect(page.getByTestId("nav-admin-products")).toHaveCount(0);
  await expect(page.getByTestId("login-form")).toHaveCount(0);
});
```

### Пример теста для Киры

```ts
import { test, expect } from "@playwright/test";

test("Кира из сохранённого состояния видит каталог как администратор", async ({ page }) => {
  await page.goto("/catalog");

  await expect(page.getByTestId("role-badge")).toHaveText(/admin/i);
  await expect(page.getByTestId("nav-admin-products")).toBeVisible();
  await expect(page.getByTestId("login-form")).toHaveCount(0);
});
```

### Важно про безопасность

Файлы:

```text
playwright/.auth/anna.json
playwright/.auth/kira.json
```

не нужно коммитить в репозиторий.

Добавь в `.gitignore`:

```text
playwright/.auth/
```

### Мини-ревью

1. У Анны и Киры разные файлы состояния?
2. Тесты запускаются без кликов по форме входа?
3. Не пытаемся ли мы «переключить роль» внутри одного контекста?

### Сигналы, что `storageState` используется неправильно

- Один файл состояния на двоих.
- Сначала вошли Кирой, потом перезаписали файл Анной.
- Роль меняется через `page.evaluate()` в бейдже.
- Тесты Анны и Киры запускаются в одном проекте с одним `storageState`.
- Файл состояния попал в репозиторий.

### Полезные ссылки

- [Authentication](https://playwright.dev/docs/auth)
- [Test Fixtures](https://playwright.dev/docs/test-fixtures)
- [Best Practices](https://playwright.dev/docs/best-practices)

---

Дальше по синхронизации идёт задача **34**: роли на общих страницах, а затем можно переходить к модулю 7 и внешнему API.

### USER
давай 34

### ASSISTANT
## Задача 34. Одни страницы, разная шапка

### Зачем эта задача

Роль в нашем приложении — это не отдельное приложение для Киры.  
Каталог тот же, шапка та же, таблица та же.

Меняется набор контролов:

```text
Анна:
- нет пункта «Товары»;
- нет кнопки «Изменить» в строке каталога;
- прямой /admin/products даёт 403.

Кира:
- есть пункт «Товары»;
- есть кнопка «Изменить» в строке каталога;
- /admin/products открывает админскую форму.
```

Это не «ещё раз задача 5».  
Это сверка двух сохранённых личностей из задачи 33 на общих страницах.

---

### Цепочка задачи

```text
Правило продукта:
На общих страницах пользователь видит только те контролы,
которые разрешены его ролью.
Прямой доступ к админской странице для пользователя без роли admin запрещён.

Риск:
Если Анне случайно показать админскую кнопку, это не делает её админом,
если сервер всё равно отвечает 403.
Но если сервер не проверяет право, а проверяет только кнопка в интерфейсе —
это настоящая дыра.

Проверка:
Сравнить Анну и Киру на /catalog и /admin/products.

Наблюдаемые факты:
У Анны нет пункта «Товары».
У Анны нет кнопки изменения в строке.
У Анны прямой /admin/products показывает модалку 403.
У Киры пункт «Товары» виден.
У Киры кнопка изменения в строке видна.
У Киры /admin/products показывает админскую форму без ошибки.

Автотест:
Два файла или два проекта: один под Анной, другой под Кирой.
```

---

### Термины на сегодня

**Общая страница** — страница, которая существует для нескольких ролей, но показывает разный набор элементов.

**Прямой доступ** — пользователь открывает закрытый адрес руками или через `goto`, а не через меню.

Идея своими словами:

> Кнопки может не быть в меню, но правило доступа всё равно проверяется прямым адресом.  
> И наоборот: кнопка в интерфейсе не доказывает, что сервер разрешает действие.

---

### Дано в стиле BDD

```gherkin
Feature: Роли на общих страницах

  Scenario: Покупатель не видит админские контролы в каталоге
    Given я вошла как "anna"
    When я открываю каталог
    Then пункта «Товары» нет
    And в строках каталога нет действия «Изменить»

  Scenario: Покупатель по прямому адресу админки получает 403
    Given я вошла как "anna"
    When я открываю "/admin/products"
    Then вижу модалку ошибки с кодом 403
    And формы товара нет

  Scenario: Админ видит те же страницы с дополнительными контролами
    Given я вошла как "kira"
    When я открываю каталог
    Then пункт «Товары» виден
    And в строке каталога видна кнопка «Изменить»
    When я открываю "/admin/products"
    Then видна форма товара
    And модалки ошибки нет
```

---

## Важная правка для нашего клиента

В текущем клиенте кнопка редактирования в строке каталога называлась:

```text
catalog-edit
```

В образце используется:

```text
catalog-row-edit
```

Чтобы синхронизироваться с образцом, лучше переименовать селектор в `public/app.js`.

Найди в `renderCatalogRows` админскую кнопку:

```js
<button
  class="btn btn-sm btn-outline-primary"
  data-testid="catalog-edit"
>
  Изменить
</button>
```

И замени на:

```js
<button
  class="btn btn-sm btn-outline-primary"
  data-testid="catalog-row-edit"
>
  Изменить
</button>
```

Если не хочешь менять клиент, тогда в примерах ниже замени:

```ts
page.getByTestId("catalog-row-edit")
```

на:

```ts
page.getByTestId("catalog-edit")
```

---

## Что нужно сделать

Нужно проверить две роли на двух общих маршрутах.

### Под Анной

Используем проект или фикстуру с состоянием Анны:

```text
playwright/.auth/anna.json
```

Проверить:

1. На `/catalog`:
   - нет `nav-admin-products`;
   - строки каталога есть;
   - нет `catalog-row-edit`.

2. На `/admin/products`:
   - видна модалка ошибки;
   - код ошибки `403`;
   - нет `admin-product-form`.

### Под Кирой

Используем проект или фикстуру с состоянием Киры:

```text
playwright/.auth/kira.json
```

Проверить:

1. На `/catalog`:
   - виден `nav-admin-products`;
   - строки каталога есть;
   - виден первый `catalog-row-edit`.

2. На `/admin/products`:
   - виден `admin-product-form`;
   - модалка ошибки скрыта.

---

## Пример теста для Анны

Файл, например:

```text
tests/roles.anna.spec.ts
```

Запускать его нужно в проекте Анны, где подключён `anna.json`.

```ts
import { test, expect } from "@playwright/test";
import { CatalogPage } from "../pages/catalog-page";
import { AppErrorModal } from "../components/app-error-modal";

test("Анна не видит админские контролы в каталоге", async ({ page }) => {
  await page.goto("/catalog");

  const catalog = new CatalogPage(page);

  await expect(page.getByTestId("nav-admin-products")).toHaveCount(0);

  await expect(catalog.rows.first()).toBeVisible();

  await expect(page.getByTestId("catalog-row-edit")).toHaveCount(0);
});

test("Прямой адрес админки даёт Анне 403", async ({ page }) => {
  const errorModal = new AppErrorModal(page);

  await page.goto("/admin/products");

  await expect(errorModal.root).toBeVisible();
  await expect(errorModal.code).toHaveText("403");

  await expect(page.getByTestId("admin-product-form")).toHaveCount(0);
});
```

---

## Пример теста для Киры

Файл, например:

```text
tests/roles.kira.spec.ts
```

Запускать его нужно в проекте Киры, где подключён `kira.json`.

```ts
import { test, expect } from "@playwright/test";
import { CatalogPage } from "../pages/catalog-page";

test("Кира видит админские контролы в каталоге", async ({ page }) => {
  await page.goto("/catalog");

  const catalog = new CatalogPage(page);

  await expect(page.getByTestId("nav-admin-products")).toBeVisible();

  await expect(catalog.rows.first()).toBeVisible();

  await expect(page.getByTestId("catalog-row-edit").first()).toBeVisible();
});

test("Кира открывает админку без 403", async ({ page }) => {
  await page.goto("/admin/products");

  await expect(page.getByTestId("admin-product-form")).toBeVisible();

  await expect(page.getByTestId("app-error")).toBeHidden();
});
```

---

## Почему важно проверять оба маршрута

Проверить только пункт меню — слабо.

Если у Анны нет пункта «Товары», это только первый уровень.  
Но она может открыть:

```text
/admin/products
```

напрямую.

Поэтому нужны три факта:

```text
1. Пункта меню нет.
2. Кнопки в строке нет.
3. Прямой адрес закрыт кодом 403.
```

И для Киры зеркально:

```text
1. Пункт меню есть.
2. Кнопка в строке есть.
3. Прямой адрес открывает форму.
```

---

## Почему нельзя делать один тест с `if`

Плохо:

```ts
if (role === "admin") {
  // проверяем Киру
} else {
  // проверяем Анну
}
```

Потому что тогда легко прогнать только одну ветку.  
Легко перепутать файл состояния.  
Легко потерять зеркальность проверок.

Лучше:

```text
один файл или проект для Анны;
один файл или проект для Киры.
```

---

## Про `toHaveCount(0)` и `toBeHidden`

В нашем клиенте для Анны админская кнопка в строке каталога не рендерится.  
Поэтому подходит:

```ts
await expect(page.getByTestId("catalog-row-edit")).toHaveCount(0);
```

Если бы кнопка присутствовала в DOM, но пряталась через `display: none`, тогда честнее было бы использовать:

```ts
await expect(page.getByTestId("catalog-row-edit")).toBeHidden();
```

Выбор зависит от реальной разметки.  
В нашей текущей разметке узел для Анны отсутствует.

---

## Мини-ревью

1. Есть ли зеркальные проверки для Анны и Киры?
2. Проверяется ли прямой адрес `/admin/products`, а не только меню?
3. Не используется ли один и тот же `storageState` для двух ролей?
4. Если кнопка отсутствует, тест проверяет именно отсутствие, а не видимость?
5. Если тест упадёт, будет ли понятно, что именно не совпало: меню, строка, прямой адрес?

---

## Сигналы, что задача поехала не туда

- Один тест называется «Кира видит больше», а про Анну проверки нет.
- Гость проверяется в этой же задаче.
- Проверяется только `nav-admin-products`, но не проверяется прямой `/admin/products`.
- В одном тесте смешаны Анна и Кира через `if`.
- Тест пытается подделать роль через `evaluate` в `role-badge`.
- Админская кнопка ищется через `td:last-child button`.
- Для Анны проверяется `admin-product-form`, но не проверяется код ошибки.

---

## Что можно улучшить по желанию

Можно вынести шапку в отдельный компонент:

```text
components/app-header.ts
```

Например:

```ts
export class AppHeader {
  navCatalog;
  navProfile;
  navAdminProducts;
  logout;
  roleBadge;
}
```

Но для этой задачи это не обязательно.  
Три локатора шапки в тесте терпимы.

Главное — не прятать внутрь компонента ожидания.

Плохо:

```ts
await header.expectAdminOnly();
```

Хорошо:

```ts
await expect(page.getByTestId("nav-admin-products")).toBeVisible();
```

---

## Полезные ссылки

- [Playwright Authentication](https://playwright.dev/docs/auth)
- [Page Object Model](https://playwright.dev/docs/pom)
- [Test Fixtures](https://playwright.dev/docs/test-fixtures)
- [Assertions](https://playwright.dev/docs/test-assertions)

---

Дальше по программе идёт модуль 7 и задача 35: логин через `APIRequestContext`, статус `200`, `Set-Cookie` и тело ответа без пароля.

### USER


### ASSISTANT
Продолжаю синхронизацию с образцом.  
Дальше идёт **модуль 7: внешнее API**.

В этом сообщении — задачи **35–39**.  
Задачу **40** оставлю на следующий блок, чтобы сохранить ритм 3–5 задач.

---

# Модуль 7. Внешнее API

До сих пор тесты спрашивали продукт через браузер:

```text
Анна видит каталог?
Появилась ли модалка?
Исчезла ли админская кнопка?
```

Теперь тот же сервер начинаем спрашивать напрямую:

```text
Какой статус?
Какое тело?
Есть ли cookie?
Какой код ошибки?
```

Это не юнит-тесты сервера.  
Это контракт `/api/*`, который видит фронт.

---

## Важные особенности нашего сервера

В нашем учебном приложении:

```text
POST /api/login
GET /api/profile
PATCH /api/profile
GET /api/products
```

Ответы имеют такой вид:

```json
{
  "user": {
    "id": 1,
    "login": "anna",
    "email": "anna@example.com",
    "first_name": "Анна",
    "last_name": "Покупателева",
    "role": "user"
  }
}
```

Ошибка всегда одной формы:

```json
{
  "error": {
    "code": "VALIDATION",
    "http": 422,
    "message": "Сообщение ошибки"
  }
}
```

Важно:

- профиль использует `first_name`, а не `firstName`;
- список товаров использует `items`, `page`, `pageSize`, `total`;
- цена — число в копейках;
- в витринном списке не должно быть `is_active`;
- `APIRequestContext` не делит cookie с браузерной страницей автоматически.

---

## Задача 35. Логин без браузера

### Зачем эта задача

Форма входа и серверный логин проверяют одно и то же правило, но через разные входы.

Если форма зелёная, а API красный — проблема в контракте.  
Если API зелёный, а форма красная — проблема во фронте.

Поэтому логин нужно уметь проверять не только кликами.

### Цепочка задачи

```text
Правило продукта:
Правильный логин и пароль создают сессию.
Неправильный пароль не создаёт сессию.

Риск:
Если логин через API отдаёт пароль, ломает форму ошибки
или ставит сессию даже при отказе, это дыра в контракте.

Проверка:
Отправить POST /api/login с данными Анны.
Отправить тот же запрос с неверным паролем.

Наблюдаемый факт:
Для успеха: 200, Set-Cookie с sid, в теле нет пароля.
Для отказа: 401, тело ошибки, живой сессии нет.

Автотест:
Два теста через APIRequestContext.
```

### Дано в стиле BDD

```gherkin
Feature: Вход через API

  Scenario: Покупатель получает сессию
    Given я гость
    When я отправляю POST /api/login как "anna" с паролем "anna-pass"
    Then статус 200
    And в ответе есть cookie "sid"
    And в теле нет пароля

  Scenario: Неверный пароль не ставит сессию
    Given я гость
    When я отправляю POST /api/login как "anna" с паролем "anna-pass-nope"
    Then статус 401
    And тело ошибки имеет форму с полем "error"
    And живая сессия не появляется
```

### Что нужно сделать

Написать два теста:

1. успешный вход Анны через `request.post`;
2. вход с неверным паролем.

Не использовать `page`.  
Не открывать `/login`.  
Не проверять модалку.

### Пример кода

```ts
import { test, expect } from "@playwright/test";

test("api: Анна входит, получает sid, пароль не возвращается", async ({ request }) => {
  const response = await request.post("/api/login", {
    data: {
      login: "anna",
      password: "anna-pass",
    },
  });

  expect(response.status()).toBe(200);

  const setCookie = response.headers()["set-cookie"] ?? "";
  expect(setCookie).toMatch(/sid=/);

  const body = await response.json();

  expect(body).toHaveProperty("user");
  expect(body.user.login).toBe("anna");

  expect(body.user).not.toHaveProperty("password");
  expect(body.user).not.toHaveProperty("password_hash");

  expect(JSON.stringify(body)).not.toContain("anna-pass");
});

test("api: неверный пароль даёт 401 и не ставит сессию", async ({ request }) => {
  const response = await request.post("/api/login", {
    data: {
      login: "anna",
      password: "anna-pass-nope",
    },
  });

  expect(response.status()).toBe(401);

  const body = await response.json();
  expect(body).toHaveProperty("error");

  const setCookie = response.headers()["set-cookie"] ?? "";
  expect(setCookie).not.toMatch(/sid=/);
});
```

### Мини-ревью

1. Тест проверяет только статус или ещё форму ответа?
2. Есть ли проверка, что пароль не вернулся в теле?
3. Не смешан ли неверный пароль с Борисом?

### Сигналы, что задача поехала не туда

- Проверили только `response.ok()`.
- Открыли браузер и называют это API-тестом.
- Ждут текст модалки в теле ответа.
- Смешали Бориса, неверный пароль и пустые поля в один тест.

### Полезные ссылки

- [API testing](https://playwright.dev/docs/api-testing)
- [APIRequestContext](https://playwright.dev/docs/api/class-apirequestcontext)

---

## Задача 36. Контракт списка витрины

### Зачем эта задача

Тест из задачи 9 проверял:

```text
В таблице видно 10 строк.
```

Это пользовательский факт.

Теперь проверяем контракт:

```text
Есть ли поле items?
Есть ли page?
Равен ли pageSize 10?
Есть ли total?
Какие поля есть у товара?
Нет ли is_active в витрине?
Цена — число или строка?
```

Это уже не таблица.  
Это данные, которыми таблица питается.

### Цепочка задачи

```text
Правило продукта:
Витринный список товаров отдаёт страницу из 10 активных товаров.

Риск:
Если в витрину попадёт is_active, цена станет строкой
или pageSize поедет, фронт может отрисовать товар неправильно.

Проверка:
Залогиниться Анной через API и запросить первый список.

Наблюдаемый факт:
Статус 200.
pageSize = 10.
items.length = 10 на первой странице.
У товара есть нужные поля.
Нет is_active.
Цена — число.

Автотест:
Один тест под Анной и один гостевой отказ.
```

### Дано в стиле BDD

```gherkin
Feature: Контракт списка витрины

  Scenario: Первая страница для покупателя
    Given я вошла как "anna" через API
    When я запрашиваю GET /api/products
    Then статус 200
    And поле "pageSize" равно 10
    And в "items" не больше 10 элементов
    And у элемента есть основные поля товара
    And у элемента нет поля "is_active"
    And цена является числом

  Scenario: Без сессии список закрыт
    Given я гость
    When я запрашиваю GET /api/products
    Then статус 401
```

### Что нужно сделать

1. Залогиниться Анной через `request.post`.
2. Выполнить `request.get('/api/products')`.
3. Проверить поля ответа.
4. Проверить, что у элементов нет `is_active`.
5. Проверить, что без сессии список не отдаётся.

### Пример кода

```ts
import { test, expect } from "@playwright/test";

async function loginAsAnna(request) {
  const login = await request.post("/api/login", {
    data: {
      login: "anna",
      password: "anna-pass",
    },
  });

  expect(login.status()).toBe(200);
}

test("api: список витрины имеет страницу 10 и не светит is_active", async ({ request }) => {
  await loginAsAnna(request);

  const response = await request.get("/api/products");

  expect(response.status()).toBe(200);

  const body = await response.json();

  expect(body).toHaveProperty("items");
  expect(body).toHaveProperty("page");
  expect(body).toHaveProperty("pageSize");
  expect(body).toHaveProperty("total");

  expect(body.pageSize).toBe(10);
  expect(body.items.length).toBe(10);
  expect(body.total).toBeGreaterThanOrEqual(10);

  for (const item of body.items) {
    expect(item).toHaveProperty("id");
    expect(item).toHaveProperty("name");
    expect(item).toHaveProperty("price");
    expect(item).toHaveProperty("category");
    expect(item).toHaveProperty("stock");

    expect(typeof item.price).toBe("number");

    expect(item).not.toHaveProperty("is_active");
  }
});

test("api: без сессии список не публичный", async ({ request }) => {
  const response = await request.get("/api/products");

  expect(response.status()).toBe(401);
});
```

### Пояснение

Здесь `request` в гостевом тесте чистый, если это отдельный `test()`.  
Playwright по умолчанию изолирует контекст запросов между тестами.

Если ты пишешь оба теста в одном файле, не логируйся во втором тесте.  
Он должен остаться гостем.

### Мини-ревью

1. Тест проверяет форму ответа, а не только статус?
2. Есть ли проверка отсутствия `is_active`?
3. Не путается ли `items.length` с `total`?

### Сигналы, что задача поехала не туда

- `items.length` приняли за общее число товаров.
- `is_active` начали проверять как обязательное поле витрины.
- Гостю решили отдать список «для удобства».
- Весь JSON сравнивают со снимком файла.

### Полезные ссылки

- [API testing](https://playwright.dev/docs/api-testing)
- [Assertions](https://playwright.dev/docs/test-assertions)

---

## Задача 37. Негативы каталога, которых нет в селекте

### Зачем эта задача

В браузере нельзя выбрать неизвестную категорию.  
Селект просто не даёт это сделать.

Но сервер может получить такой запрос напрямую:

```text
GET /api/products?category=food
```

И это уже не «пустой фильтр».  
Это мусорный параметр.

То же самое с:

```text
GET /api/products?page=0
```

В UI кнопку «страница 0» нажать нельзя.  
Через запрос — можно.

### Цепочка задачи

```text
Правило продукта:
Некорректные параметры каталога отвергаются валидацией.

Риск:
Если сервер вернёт 200 и пустой список на неизвестную категорию,
тест не отличит «товаров нет» от «параметр сломан».

Проверка:
Отправить неизвестную категорию.
Отправить нулевую страницу.

Наблюдаемый факт:
Статус 422.
В теле есть ошибка.
Нет успешного массива items.

Автотест:
Два теста под Анной.
```

### Дано в стиле BDD

```gherkin
Feature: Мусорные параметры каталога

  Scenario: Неизвестная категория не маскируется под пустой фильтр
    Given я вошла как "anna" через API
    When я запрашиваю список с "category=food"
    Then статус 422
    And в теле есть поле "error"
    And тело не выглядит как успешный список

  Scenario: Нулевая страница не существует
    Given я вошла как "anna" через API
    When я запрашиваю список с "page=0"
    Then статус 422
```

### Что нужно сделать

Под сессией Анны:

1. запросить список с неизвестной категорией;
2. запросить список с `page=0`;
3. убедиться, что оба случая дают `422`.

Не нужно проверять:

- поиск `тетра`;
- пустой поиск `zzzz`;
- сортировку;
- пагинацию на странице 2.

### Пример кода

```ts
import { test, expect } from "@playwright/test";

async function loginAsAnna(request) {
  const login = await request.post("/api/login", {
    data: {
      login: "anna",
      password: "anna-pass",
    },
  });

  expect(login.status()).toBe(200);
}

test("api: неизвестная категория — 422, не пустой список", async ({ request }) => {
  await loginAsAnna(request);

  const response = await request.get("/api/products", {
    params: {
      category: "food",
    },
  });

  expect(response.status()).toBe(422);

  const body = await response.json();

  expect(body).toHaveProperty("error");
  expect(body.items).toBeUndefined();
});

test("api: page=0 — 422", async ({ request }) => {
  await loginAsAnna(request);

  const response = await request.get("/api/products", {
    params: {
      page: "0",
    },
  });

  expect(response.status()).toBe(422);

  const body = await response.json();
  expect(body).toHaveProperty("error");
});
```

### Важное различие

Есть два разных случая:

```text
Поиск без совпадений:
GET /api/products?q=zzzz-no-such
→ 200, пустой items

Неизвестная категория:
GET /api/products?category=food
→ 422, ошибка
```

Это разные правила.  
Их нельзя склеивать в один негатив.

### Мини-ревью

1. Тест отличает мусорный параметр от пустого результата?
2. Есть ли тело ошибки, а не только статус?
3. Не проверяется ли здесь позитивный поиск?

### Сигналы, что задача поехала не туда

- `200` и пустой `items` приняты за успех неизвестной категории.
- `404` считается правильным ответом для `category=food`.
- В одном тесте смешаны пустой поиск и неизвестная категория.
- Проверяется только UI-селект, хотя задача про API.

### Полезные ссылки

- [API testing](https://playwright.dev/docs/api-testing)
- [Assertions](https://playwright.dev/docs/test-assertions)

---

## Задача 38. Борис — не опечатка в пароле

### Зачем эта задача

Борис входит с верным паролем, но он заблокирован.

Это не:

```text
401 неверный пароль
```

Это:

```text
403 учётная запись заблокирована
```

Если перепутать коды, пользователь получит сообщение вида:

```text
Проверьте пароль
```

хотя на самом деле:

```text
Доступ закрыт
```

### Цепочка задачи

```text
Правило продукта:
Заблокированный пользователь не входит, даже с верным паролем.

Риск:
Если Борис получит 401, интерфейс будет советовать повторить пароль,
хотя проблема не в пароле.

Проверка:
Отправить логин Бориса через API.

Наблюдаемый факт:
Статус 403.
В теле есть код BLOCKED.
Это не 401.

Автотест:
Один тест через API.
```

### Дано в стиле BDD

```gherkin
Feature: Заблокированная учётка через API

  Scenario: Boris не входит
    Given я гость
    When я отправляю POST /api/login как "boris" с паролем "boris-pass"
    Then статус 403
    And в теле ошибки есть код "BLOCKED"
    And это не 401
```

### Что нужно сделать

Написать тест:

1. отправить логин `boris`;
2. проверить статус `403`;
3. проверить код `BLOCKED`;
4. явно убедиться, что это не `401`.

Не нужно в этом же тесте:

- открывать браузер;
- проверять модалку;
- проверять неизвестный логин;
- проверять неверный пароль Анны.

### Пример кода

```ts
import { test, expect } from "@playwright/test";

test("api: boris получает 403 BLOCKED, а не 401", async ({ request }) => {
  const response = await request.post("/api/login", {
    data: {
      login: "boris",
      password: "boris-pass",
    },
  });

  expect(response.status()).toBe(403);
  expect(response.status()).not.toBe(401);

  const body = await response.json();

  expect(body).toHaveProperty("error");
  expect(body.error.code).toBe("BLOCKED");

  const setCookie = response.headers()["set-cookie"] ?? "";
  expect(setCookie).not.toMatch(/sid=/);
});
```

### Мини-ревью

1. Тест отличает Бориса от неверного пароля?
2. Есть ли проверка бизнес-кода, а не только статуса?
3. Не смешан ли Борис с пустыми полями?

### Сигналы, что задача поехала не туда

- Написали `expect([401, 403]).toContain(status)`.
- Проверяют только текст сообщения.
- Логинят Бориса в UI внутри этого же теста.
- Забывают, что сессия не должна появляться.

### Полезные ссылки

- [API testing](https://playwright.dev/docs/api-testing)
- [Assertions](https://playwright.dev/docs/test-assertions)

---

## Задача 39. Сначала API, потом экран

### Зачем эта задача

Профиль можно проверить двумя способами:

1. только через форму;
2. только через API.

Но по отдельности они ловят не всё.

Если проверить только:

```text
PATCH /api/profile
```

то можно не заметить, что форма профиля не перечитывает данные.

Если проверить только форму:

```text
ввёл → сохранил → вижу
```

то можно не заметить, что сервер реально не сохранил значение, а интерфейс показал кэш.

Полезная связка:

```text
Поменял через API → увидел через API → увидел на экране
```

### Цепочка задачи

```text
Правило продукта:
Изменение профиля сохраняется на сервере и видно на странице профиля.

Риск:
Если проверить только один вход, можно пропустить рассинхрон
между сервером и интерфейсом.

Проверка:
Войти через API.
Запомнить текущее имя.
Изменить имя через PATCH.
Проверить новое имя через GET.
Открыть /profile с той же сессией и проверить поле.
Вернуть старое имя.

Автотест:
Один тест, где один факт проверяется через два транспорта.
```

### Дано в стиле BDD

```gherkin
Feature: Профиль с двух входов

  Scenario: Новое имя видно в API и на форме
    Given я вошла как "anna"
    When я меняю имя через PATCH /api/profile
    Then GET /api/profile возвращает новое имя
    And страница /profile показывает то же имя в поле
```

### Что нужно сделать

1. Войти как Анна через `request`.
2. Запросить текущий профиль.
3. Запомнить `first_name`.
4. Сделать `PATCH` с новым именем.
5. Проверить новое имя через `GET`.
6. Подставить сессию в браузер.
7. Открыть `/profile`.
8. Проверить, что поле `profile-first-name` показывает новое имя.
9. Вернуть старое имя.

### Важные детали нашего приложения

Профиль использует поля:

```ts
first_name
last_name
email
```

Поэтому тело запроса:

```ts
{
  first_name: next,
}
```

А не:

```ts
{
  firstName: next,
}
```

### Пример кода

```ts
import { test, expect } from "@playwright/test";

test("профиль: новое имя видно через API и на странице", async ({ request, page }) => {
  const login = await request.post("/api/login", {
    data: {
      login: "anna",
      password: "anna-pass",
    },
  });

  expect(login.status()).toBe(200);

  let previous: string | null = null;

  try {
    const beforeResponse = await request.get("/api/profile");
    expect(beforeResponse.status()).toBe(200);

    const beforeBody = await beforeResponse.json();
    previous = beforeBody.user.first_name;

    const next = `Анна-${Date.now()}`;

    const patchResponse = await request.patch("/api/profile", {
      data: {
        first_name: next,
      },
    });

    expect(patchResponse.status()).toBe(200);

    const afterResponse = await request.get("/api/profile");
    expect(afterResponse.status()).toBe(200);

    const afterBody = await afterResponse.json();
    expect(afterBody.user.first_name).toBe(next);

    const state = await request.storageState();
    await page.context().clearCookies();
    await page.context().addCookies(state.cookies);

    await page.goto("/profile");

    await expect(page.getByTestId("profile-first-name")).toHaveValue(next);
  } finally {
    if (previous !== null) {
      await request.patch("/api/profile", {
        data: {
          first_name: previous,
        },
      });
    }
  }
});
```

### Почему здесь нужен `finally`

Мы меняем данные Анны.  
Если тест упадёт и не вернёт старое имя, соседние тесты могут увидеть другое имя.

Поэтому возврат старого значения лучше делать в:

```ts
finally
```

а не только в конце счастливого пути.

### Альтернатива через `page.request`

Если в твоём шаблоне удобнее использовать уже залогиненную страницу, можно сделать так:

```ts
await page.request.patch("/api/profile", {
  data: {
    first_name: next,
  },
});
```

Тогда `page.request` использует cookie браузера.  
Но смысл задачи должен остаться:

```text
изменение через HTTP
и проверка на экране
```

### Мини-ревью

1. Тест проверяет один факт через два входа?
2. Есть ли возврат старого имени?
3. Не проверяется ли здесь уникальность email или смена пароля?

### Сигналы, что задача поехала не туда

- Проверили только форму.
- Проверили только `PATCH`.
- Полезли в базу.
- Поменяли сразу имя, фамилию и email.
- Пытаются проверить `409` на занятый email в этой же задаче.
- Забыли вернуть профиль Анны в исходное состояние.

### Полезные ссылки

- [API testing](https://playwright.dev/docs/api-testing)
- [Authentication](https://playwright.dev/docs/auth)
- [Assertions](https://playwright.dev/docs/test-assertions)

---

Дальше по синхронизации идёт задача **40**: Кира создаёт товар через API, Анна видит его в витрине.

### USER
можно и 6 задача в блоке - 3 -5 не строгое правило. дальше

### ASSISTANT
Продолжаю синхронизацию.

В этом блоке будет **6 задач**:  
**40** — завершает модуль 7, дальше **41–45** — уже территория данных, фабрик и учебной сети.

---

# Модуль 7, завершение

## Задача 40. Кира создаёт, Анна видит

### Зачем эта задача

Это связка двух ролей:

```text
админ создаёт товар через API;
покупатель видит этот товар в витрине.
```

Здесь важно не заменять всё браузером.  
Создание товара через админскую форму — медленнее и хрупче.  
А вот проверка «товар появился у Анны в таблице» обязательно должна быть пользовательской.

### Цепочка задачи

```text
Правило продукта:
Товар, созданный администратором, попадает в витрину покупателя.

Риск:
Если товар создаётся через API, но не появляется в каталоге,
фронт и сервер живут разной жизнью.

Проверка:
Создать товар под Кирой через POST /api/admin/products.
Найти его под Анной в каталоге через поиск.

Наблюдаемый факт:
Создание успешно.
В таблице Анны есть ровно одна строка с этим именем.

Автотест:
Два транспорта: API для Киры, браузер для Анны.
```

### Дано в стиле BDD

```gherkin
Feature: Админ создаёт, покупатель видит

  Scenario: Новый товар появляется в витрине Анны
    Given я авторизована как "kira" через API
    And я авторизована как "anna" в браузере
    When я создаю товар с уникальным именем через POST /api/admin/products
    Then ответ успешный
    When anna ищет это имя в каталоге
    Then в таблице ровно одна строка с этим именем
```

### Что нужно сделать

1. Создать уникальный имя товара.
2. Залогиниться Кирой через `request`.
3. Отправить `POST /api/admin/products`.
4. Проверить успешный статус.
5. Открыть браузер под Анной.
6. Найти созданный товар поиском.
7. Проверить, что строка одна и она содержит нужное имя.

Не нужно:

- чистить базу;
- использовать одно и то же имя каждый раз;
- создавать товар через админскую форму;
- проверять весь каталог.

### Пример кода

```ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";
import { CatalogPage } from "../pages/catalog-page";

test("Кира создаёт товар через API, Анна видит его в витрине", async ({ request, page }) => {
  const name = `marker-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const kiraLogin = await request.post("/api/login", {
    data: {
      login: "kira",
      password: "kira-admin",
    },
  });

  expect(kiraLogin.status()).toBe(200);

  const created = await request.post("/api/admin/products", {
    data: {
      name,
      description: "Учебный товар",
      price: 15000,
      category: "pens",
      stock: 3,
    },
  });

  expect(created.status()).toBe(201);

  const body = await created.json();
  expect(body.id).toBeTruthy();
  expect(body.name).toBe(name);

  const loginPage = new LoginPage(page);
  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);

  const catalog = new CatalogPage(page);

  await catalog.search(name);

  await expect(catalog.rows).toHaveCount(1);
  await expect(catalog.rows.first()).toContainText(name);
});
```

### Мини-ревью

1. Создание и чтение проверяются под разными ролями?
2. Имя уникальное?
3. Есть ли проверка в браузере, а не только в JSON?

### Сигналы, что задача поехала не туда

- Один и тот же `request` для Киры и Анны.
- Фиксированное имя товара.
- Проверка только через `GET /api/products`, без таблицы.
- Попытка удалить товар в конце через базу.
- Создание товара через UI «раз уже есть CatalogPage».

### Полезные ссылки

- [API testing](https://playwright.dev/docs/api-testing)
- [Page Object Model](https://playwright.dev/docs/pom)

---

# Модуль 8. Данные и сеть

Дальше продукт начинает ломаться специально:

- дубликаты данных;
- учебные 503;
- таймауты;
- подмена ответа.

Но правило остаётся прежним:

```text
Сначала вопрос.
Потом наблюдаемый факт.
Потом код.
```

---

## Задача 41. Фабрика товара

### Зачем эта задача

К задаче 40 уже видно, что каждый раз собирать руками один и тот же товар — плохо.

```ts
{
  name: "marker-...",
  description: "Учебный товар",
  price: 15000,
  category: "pens",
  stock: 3,
}
```

Такой JSON начинает копипаститься.  
А копипаста данных — это будущие конфликты, опечатки и тесты, которые падают по непонятной причине.

Нужна фабрика.

### Цепочка задачи

```text
Правило продукта:
Админ может создавать товары.

Риск:
Если тесты собирают тело товара руками, они начинают плодить дубликаты
и ошибаться в обязательных полях.

Проверка:
Сделать функцию, которая возвращает валидное тело товара
и позволяет переопределить нужные поля.

Наблюдаемый факт:
Товар, собранный фабрикой, успешно создаётся через API.

Автотест:
Создать товар через фабрику и проверить 201.
```

### Дано в стиле BDD

```gherkin
Feature: Фабрика товара

  Scenario: Тест не собирает товар руками
    Given мне нужно создать товар через API
    When я использую фабрику валидного товара
    Then получаю тело с уникальным именем
    And товар успешно создаётся
```

### Что нужно сделать

Создать файл:

```text
builders/product.ts
```

Минимум:

- генератор уникального имени;
- функция `validProduct`;
- возможность переопределить поля: `name`, `price`, `category`, `stock`, `description`.

Не нужно:

- делать огромный универсальный билдер на все сущности;
- сразу тащить сюда Анну, Киру и каталог;
- чистить базу.

### Пример `builders/product.ts`

```ts
export function uniqueProductName(prefix = "product") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function validProduct(overrides = {}) {
  return {
    name: overrides.name ?? uniqueProductName(),
    description: overrides.description ?? "Учебный товар",
    price: overrides.price ?? 10000,
    category: overrides.category ?? "other",
    stock: overrides.stock ?? 5,
  };
}
```

Если используешь TypeScript, можно добавить типы:

```ts
type ProductPayload = {
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
};

export function validProduct(overrides: Partial<ProductPayload> = {}): ProductPayload {
  return {
    name: overrides.name ?? uniqueProductName(),
    description: overrides.description ?? "Учебный товар",
    price: overrides.price ?? 10000,
    category: overrides.category ?? "other",
    stock: overrides.stock ?? 5,
  };
}
```

### Пример теста

```ts
import { test, expect } from "@playwright/test";
import { validProduct } from "../builders/product";

async function loginAsKira(request) {
  const login = await request.post("/api/login", {
    data: {
      login: "kira",
      password: "kira-admin",
    },
  });

  expect(login.status()).toBe(200);
}

test("фабрика товара создаёт валидный товар", async ({ request }) => {
  await loginAsKira(request);

  const payload = validProduct({
    price: 0,
  });

  const response = await request.post("/api/admin/products", {
    data: payload,
  });

  expect(response.status()).toBe(201);

  const body = await response.json();

  expect(body.name).toBe(payload.name);
  expect(body.price).toBe(0);
});
```

### Мини-ревью

1. Фабрика возвращает валидное тело?
2. Можно ли переопределить только одно поле?
3. Есть ли уникальное имя по умолчанию?

### Сигналы, что задача поехала не туда

- Фабрика сама отправляет запрос.
- Фабрика знает про Анну или Киру.
- Имя товара фиксированное.
- Внутри фабрики есть `expect`.
- Появился `ProductBuilder` на 200 методов, хотя хватает одной функции.

### Полезные ссылки

- [API testing](https://playwright.dev/docs/api-testing)
- [Best practices](https://playwright.dev/docs/best-practices)

---

## Задача 42. Изоляция данных

### Зачем эта задача

Если два теста используют одно и второе имя:

```text
Ручка теста
Ручка теста
```

то первый тест может создать товар, а второй упасть с `409`, потому что имя уже занято.

Или наоборот: тесты проходят по одному, но валятся в параллели.

Это задача не про «удалим базу».  
Это задача про уникальные данные.

### Цепочка задачи

```text
Правило продукта:
Имя товара должно быть уникальным.

Риск:
Если тесты используют фиксированные имена,
они начинают мешать друг другу.

Проверка:
Создать два товара с одинаковым именем и увидеть 409.
Затем создать два товара с уникальными именами и увидеть успех.

Наблюдаемый факт:
Дубликат даёт 409.
Уникальные имена не конфликтуют.

Автотест:
Два теста: конфликт и изоляция.
```

### Дано в стиле BDD

```gherkin
Feature: Изоляция данных

  Scenario: Одно имя дважды даёт конфликт
    Given я авторизована как "kira" через API
    When я создаю товар с одним и тем же именем дважды
    Then первый запрос успешен
    And второй запрос получает 409

  Scenario: Уникальные имена не конфликтуют
    Given я авторизована как "kira" через API
    When я создаю два товара через фабрику
    Then оба запроса успешны
```

### Что нужно сделать

1. Показать конфликт: один и тот же `name` дважды.
2. Показать решение: фабрика или уникальный суффикс.
3. Не чистить базу.
4. Не использовать фиксированное имя вида `ручка-теста`, если только не хочешь специально воспроизвести конфликт.

### Пример кода

```ts
import { test, expect } from "@playwright/test";
import { validProduct } from "../builders/product";

async function loginAsKira(request) {
  const login = await request.post("/api/login", {
    data: {
      login: "kira",
      password: "kira-admin",
    },
  });

  expect(login.status()).toBe(200);
}

test("одно и то же имя дважды даёт 409", async ({ request }) => {
  await loginAsKira(request);

  const payload = validProduct();

  const first = await request.post("/api/admin/products", {
    data: payload,
  });

  expect(first.status()).toBe(201);

  const second = await request.post("/api/admin/products", {
    data: payload,
  });

  expect(second.status()).toBe(409);

  const body = await second.json();
  expect(body).toHaveProperty("error");
});

test("уникальные имена из фабрики не конфликтуют", async ({ request }) => {
  await loginAsKira(request);

  const firstPayload = validProduct();
  const secondPayload = validProduct();

  const first = await request.post("/api/admin/products", {
    data: firstPayload,
  });

  const second = await request.post("/api/admin/products", {
    data: secondPayload,
  });

  expect(first.status()).toBe(201);
  expect(second.status()).toBe(201);
});
```

### Мини-ревью

1. Тесты могут работать параллельно?
2. Есть ли фиксированные имена, которые могут конфликтовать?
3. Не появляется ли очистка всей базы?

### Сигналы, что задача поехала не туда

- `DELETE FROM products` в `afterEach`.
- Фиксированное имя товара.
- Один тест создаёт товар, а второй молча рассчитывает, что база «как новая».
- Конфликт `409` считается ошибкой теста, хотя это правило продукта.

### Полезные ссылки

- [Best practices](https://playwright.dev/docs/best-practices)
- [API testing](https://playwright.dev/docs/api-testing)

---

## Задача 43. Учебный 503

### Зачем эта задача

Сервер может упасть.  
Фронт не должен делать вид, что всё нормально.

В нашем приложении есть учебный заголовок:

```text
X-Debug-Error: 503
```

Он заставляет сервер ответить `503` на любой `/api/*`.

Правильный факт:

```text
модалка ошибки видна;
код ошибки 503;
таблица не притворяется пустой витриной без объяснения.
```

### Цепочка задачи

```text
Правило продукта:
Серверный отказ 503 показывается пользователю как ошибка приложения.

Риск:
Если 503 превращается в тихую пустую таблицу,
пользователь думает, что товаров нет, хотя сервис недоступен.

Проверка:
Поднять учебный 503 на запрос каталога.

Наблюдаемый факт:
Модалка ошибки видна.
Код ошибки 503.
Строки каталога не показаны как обычный список.

Автотест:
Логин Анны, затем запрос каталога с учебным заголовком.
```

### Дано в стиле BDD

```gherkin
Feature: Серверный сбой каталога

  Scenario: 503 не маскируется под пустую витрину
    Given я вошла как "anna"
    When запрос каталога возвращает учебный 503
    Then я вижу модалку ошибки
    And в коде ошибки отображается 503
    And таблица не показывает обычный список товаров
```

### Что нужно сделать

1. Войти как Анна.
2. Включить учебный заголовок `X-Debug-Error: 503`.
3. Спровоцировать новый запрос каталога.
4. Проверить модалку ошибки.
5. Проверить код ошибки.

Не нужно ставить заголовок до входа.  
Иначе можно получить 503 уже на логине.

### Пример кода

```ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";
import { CatalogPage } from "../pages/catalog-page";
import { AppErrorModal } from "../components/app-error-modal";

test("503 на каталоге показывает модалку ошибки", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const catalog = new CatalogPage(page);
  const errorModal = new AppErrorModal(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);

  await page.setExtraHTTPHeaders({
    "X-Debug-Error": "503",
  });

  await catalog.searchInput.press("Enter");

  await expect(errorModal.root).toBeVisible();
  await expect(errorModal.code).toHaveText("503");

  await expect(catalog.rows).toHaveCount(0);
});
```

### Почему здесь нужен новый запрос

Если просто войти и ничего не трогать, каталог уже загружен.  
Чтобы заголовок сработал, нужен новый запрос к `/api/products`.

Нажатие `Enter` в поиске как раз провоцирует запрос каталога.

### Мини-ревью

1. Тест отличает 503 от пустого поиска?
2. Заголовок включён после логина?
3. Проверяется ли код ошибки, а не только видимость модалки?

### Сигналы, что задача поехала не туда

- Заголовок ставится до входа.
- Тест ждёт пустую таблицу и считает это успехом.
- Нет проверки кода ошибки.
- 503 проверяется на логине, хотя задача про каталог.

### Полезные ссылки

- [Network](https://playwright.dev/docs/network)
- [Assertions](https://playwright.dev/docs/test-assertions)

---

## Задача 44. Таймаут

### Зачем эта задача

Сервер может не падать с ошибкой, а просто молчать слишком долго.

В нашем приложении есть учебный заголовок:

```text
X-Debug-Delay-Ms: 15000
```

Сервер будет спать 15 секунд.  
У клиента есть таймаут около 5 секунд.

Правильный факт:

```text
пользователь видит ошибку сети;
код ошибки — NETWORK;
приложение не висит бесконечно.
```

### Цепочка задачи

```text
Правило продукта:
Если сервер не отвечает вовремя, пользователь видит сетевую ошибку.

Риск:
Если клиент будет ждать вечно, интерфейс зависнет.
Если он молча покажет пустую таблицу, пользователь не поймёт, что сеть виновата.

Проверка:
Включить учебную задержку больше клиентского таймаута.

Наблюдаемый факт:
Модалка ошибки видна.
Код ошибки — NETWORK.

Автотест:
Логин Анны, затем запрос каталога с задержкой.
```

### Дано в стиле BDD

```gherkin
Feature: Таймаут каталога

  Scenario: Долгий сервер превращается в сетевую ошибку
    Given я вошла как "anna"
    When запрос каталога искусственно задерживается на 15000 мс
    Then клиент прерывает ожидание
    And я вижу модалку ошибки с кодом NETWORK
```

### Что нужно сделать

1. Войти как Анна.
2. Включить заголовок `X-Debug-Delay-Ms: 15000`.
3. Спровоцировать новый запрос каталога.
4. Дождаться модалки ошибки.
5. Проверить код `NETWORK`.

Не нужно использовать:

```ts
await page.waitForTimeout(5000);
```

Клиент сам прервёт запрос по своему таймауту.

### Пример кода

```ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";
import { CatalogPage } from "../pages/catalog-page";
import { AppErrorModal } from "../components/app-error-modal";

test("долгий запрос каталога даёт сетевую ошибку", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const catalog = new CatalogPage(page);
  const errorModal = new AppErrorModal(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);

  await page.setExtraHTTPHeaders({
    "X-Debug-Delay-Ms": "15000",
  });

  await catalog.searchInput.press("Enter");

  await expect(errorModal.root).toBeVisible({ timeout: 15000 });
  await expect(errorModal.code).toHaveText("NETWORK");
});
```

### Мини-ревью

1. Тест ждёт состояние, а не спит 5 секунд?
2. Проверен именно `NETWORK`, а не `500`?
3. Задержка включена после логина?

### Сигналы, что задача поехала не туда

- `waitForTimeout(5000)` вместо ожидания модалки.
- Заголовок задержки ставится до входа.
- Тест ожидает 503 вместо таймаута.
- Модалка есть, но код ошибки не проверен.

### Полезные ссылки

- [Network](https://playwright.dev/docs/network)
- [Trace viewer](https://playwright.dev/docs/trace-viewer)

---

## Задача 45. Подмена ответа: пустой список без ошибки

### Зачем эта задача

Иногда нужно проверить не настоящий сервер, а поведение фронта на конкретный ответ.

Например:

```json
{
  "items": [],
  "page": 1,
  "pageSize": 10,
  "total": 0
}
```

Если сервер честно сказал:

```text
товаров нет
```

то фронт должен показать пустую таблицу.  
Не модалку.  
Не 500.  
Не бесконечную загрузку.

Это задача про `page.route`.

### Цепочка задачи

```text
Правило продукта:
Пустой список товаров — нормальное состояние витрины.

Риск:
Если пустой ответ сервера превращается в ошибку,
пользователь будет видеть аварийное окно там, где товаров просто нет.

Проверка:
Подменить ответ каталога на пустой список.

Наблюдаемый факт:
Строк нет.
Сообщение пустого результата видно.
Модалка ошибки не появляется.

Автотест:
Логин Анны, затем подмена ответа /api/products через page.route.
```

### Дано в стиле BDD

```gherkin
Feature: Пустой ответ каталога

  Scenario: Сервер вернул пустой список
    Given я вошла как "anna"
    When ответ каталога подменён на пустой список
    Then я вижу пустую таблицу
    And модалка ошибки не появляется
```

### Что нужно сделать

1. Войти как Анна.
2. Включить `page.route` на `/api/products`.
3. Вернуть пустой `items`.
4. Спровоцировать запрос каталога.
5. Проверить пустую таблицу.
6. Проверить, что модалка ошибки скрыта.

Не нужно подменять логин.  
Не нужно подменять профиль.  
Только каталог.

### Пример кода

```ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";
import { CatalogPage } from "../pages/catalog-page";
import { AppErrorModal } from "../components/app-error-modal";

test("пустой список товаров показывает пустую таблицу без ошибки", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const catalog = new CatalogPage(page);
  const errorModal = new AppErrorModal(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);

  await page.route("**/api/products*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        items: [],
        page: 1,
        pageSize: 10,
        total: 0,
      }),
    });
  });

  await catalog.searchInput.press("Enter");

  await expect(catalog.rows).toHaveCount(0);
  await expect(page.getByTestId("catalog-empty")).toBeVisible();

  await expect(errorModal.root).toBeHidden();
});
```

### Мини-ревью

1. Подменяется только каталог, а не весь сайт?
2. Тест отличает пустой список от серверной ошибки?
3. Есть ли проверка `catalog-empty` или хотя бы отсутствия строк?

### Сигналы, что задача поехала не туда

- Мок ставится до входа и ломает логин.
- Подменяется весь `/api/*`.
- Пустая таблица проверяется, но модалка ошибки не проверяется.
- Мок не снимается, хотя контекст и так изолирован — само по себе не страшно, но нужно понимать, почему это ок.

### Полезные ссылки

- [Network](https://playwright.dev/docs/network)
- [Trace viewer](https://playwright.dev/docs/trace-viewer)
- [Assertions](https://playwright.dev/docs/test-assertions)

---

Дальше по программе идут задачи **46–50**: скрытый товар, уместный SQL, флаки, риск и регресс, ревизия архитектуры.

### USER
убери про sql и дальше

### ASSISTANT
Продолжаю синхронизацию с образцом.

В этом блоке — **задачи 46–50**, финальные.  
В соответствии с договорённостью **убираю SQL**: вместо белого ящика через базу используем прямой доступ к `data/app.json` и `audit_log` там же.

---

# Модуль 9. Белый ящик и расхождения

Белый ящик — это не «тестировать только через API и DOM».  
Это вопрос:

```text
Когда уместно заглянуть в состояние сервера напрямую?
```

Ответ короткий:

```text
Когда снаружи факта нет.
```

В нашем приложении `data/app.json` содержит:

- `users`
- `sessions`
- `products`
- `audit_log`

Это достаточный оракул белого ящика без SQL.

---

## Задача 46. Скрытый товар: расхождение списка и карточки

### Зачем эта задача

Администратор может скрыть товар:

```text
POST /api/admin/products/:id/hide
```

После этого товар исчезает из витрины Анны.  
Но в нашем учебном приложении есть известное расхождение:

```text
в списке скрытого товара нет;
по прямой ссылке /catalog/:id карточка может открыться.
```

Это задача про то, как фиксировать фактический контракт, а не придумывать желаемый.

### Цепочка задачи

```text
Правило продукта:
Скрытый товар не показывается в витрине.

Риск:
Если прямая карточка всё равно открывается,
ссылки из писем, избранного или истории могут вести на «призрак».

Проверка:
Кира скрывает товар.
Анна ищет его в каталоге.
Анна открывает карточку по прямому адресу.

Наблюдаемый факт:
В списке товара нет.
На карточке фиксируем фактический контракт:
- 404, если сервер закрыл прямой доступ;
- открытая карточка, если это известное расхождение.

Автотест:
Один тест под Кирой, один под Анной.
```

### Дано в стиле BDD

```gherkin
Feature: Скрытый товар

  Scenario: Скрытый товар не попадает в витрину
    Given Кира создала товар с уникальным именем
    And Кира скрыла этот товар
    When Анна ищет это имя в каталоге
    Then в таблице строк с этим именем нет

  Scenario: Прямая карточка скрытого товара
    Given Кира скрыла товар с id N
    When Анна открывает "/catalog/N"
    Then я фиксирую фактический контракт сервера
```

### Что нужно сделать

1. Под Кирой через API создать товар.
2. Под Кирой через API скрыть товар.
3. Под Анной в браузере найти товар поиском — строк нет.
4. Под Анной открыть карточку напрямую — зафиксировать, что сервер реально делает.

Не нужно «чинить» поведение в тесте.  
Если сервер отдаёт карточку — это факт, его нужно записать.  
Если сервер отдаёт 404 — тоже факт.

### Пример кода

```ts
import { test, expect } from "@playwright/test";
import { validProduct } from "../builders/product";
import { LoginPage } from "../pages/login-page";
import { CatalogPage } from "../pages/catalog-page";

async function loginAsKira(request) {
  const login = await request.post("/api/login", {
    data: {
      login: "kira",
      password: "kira-admin",
    },
  });
  expect(login.status()).toBe(200);
}

test("скрытый товар не попадает в витрину Анны", async ({ request, page }) => {
  await loginAsKira(request);

  const payload = validProduct();

  const created = await request.post("/api/admin/products", {
    data: payload,
  });
  expect(created.status()).toBe(201);

  const createdBody = await created.json();
  const id = createdBody.id;

  const hide = await request.post(`/api/admin/products/${id}/hide`);
  expect(hide.status()).toBe(200);

  const loginPage = new LoginPage(page);
  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);

  const catalog = new CatalogPage(page);
  await catalog.search(payload.name);

  await expect(catalog.rows).toHaveCount(0);
});

test("прямая карточка скрытого товара: фактический контракт", async ({ request, page }) => {
  await loginAsKira(request);

  const payload = validProduct();

  const created = await request.post("/api/admin/products", {
    data: payload,
  });
  const createdBody = await created.json();
  const id = createdBody.id;

  await request.post(`/api/admin/products/${id}/hide`);

  const loginPage = new LoginPage(page);
  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);

  const response = await page.goto(`/catalog/${id}`);
  const status = response?.status() ?? 0;

  // В текущем учебном приложении сервер отдаёт 404 на скрытый товар.
  // Если контракт изменится, этот тест нужно переписать, а не "подгонять".
  expect([200, 404]).toContain(status);

  if (status === 404) {
    await expect(page.getByTestId("app-error")).toBeVisible();
  }

  if (status === 200) {
    // Известное расхождение: прямая карточка открывается,
    // хотя в списке товара нет.
    await expect(page.getByTestId("product-title")).toBeVisible();
  }
});
```

### Мини-ревью

1. Тест фиксирует фактический контракт, а не придумывает желаемый?
2. Скрытие проверено через API, а не через UI-клик?
3. В витрине Анны товара действительно нет?

### Сигналы, что задача поехала не туда

- Тест «исправляет» сервер через `page.route`.
- Прямой адрес не проверяется вообще.
- Ожидание `404` без проверки, что сервер именно так отвечает.
- Один тест сразу на `hide`, `show`, `delete`.

### Полезные ссылки

- [API testing](https://playwright.dev/docs/api-testing)
- [Assertions](https://playwright.dev/docs/test-assertions)

---

## Задача 47. Когда белый ящик уместен

### Зачем эта задача

Не каждый серверный факт виден через API.

В нашем приложении есть `audit_log` в `data/app.json`:

```text
user_id
action
payload
created_at
```

Это внутренний журнал.  
Его нет в публичных эндпоинтах.

Поэтому:

```text
проверить запись в audit_log можно только чтением файла.
```

Это и есть уместный белый ящик.

Правило простое:

```text
если факт торчит из API или UI — читаем там;
если факт живёт только внутри — читаем напрямую.
```

### Цепочка задачи

```text
Правило продукта:
Создание товара администратором пишет событие в audit_log.

Риск:
Если запись не создаётся, невозможно расследовать инциденты.

Проверка:
Кира создаёт товар через API.
Тест читает data/app.json.
Тест находит событие product_create с нужным product_id.

Наблюдаемый факт:
В audit_log есть запись о создании этого товара.

Автотест:
POST под Кирой + чтение файла.
```

### Дано в стиле BDD

```gherkin
Feature: Audit log

  Scenario: Создание товара пишется в журнал
    Given я авторизована как "kira" через API
    When я создаю товар с уникальным именем
    Then в "data/app.json" в "audit_log" есть запись "product_create"
    And в payload этой записи есть id созданного товара
```

### Что нужно сделать

1. Залогиниться Кирой через `request`.
2. Создать товар через `POST /api/admin/products`.
3. Запомнить `id` из ответа.
4. Прочитать `data/app.json`.
5. Найти запись `action === "product_create"` с `product_id === id`.

Не нужно:

- чистить журнал;
- менять структуру файла;
- проверять все события.

### Пример кода

```ts
import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validProduct } from "../builders/product";

async function loginAsKira(request) {
  const login = await request.post("/api/login", {
    data: {
      login: "kira",
      password: "kira-admin",
    },
  });
  expect(login.status()).toBe(200);
}

function readDb() {
  const raw = readFileSync(join("data", "app.json"), "utf8");
  return JSON.parse(raw);
}

test("создание товара пишет событие product_create в audit_log", async ({ request }) => {
  await loginAsKira(request);

  const payload = validProduct();

  const response = await request.post("/api/admin/products", {
    data: payload,
  });

  expect(response.status()).toBe(201);

  const body = await response.json();
  const id = body.id;

  const db = readDb();

  const entry = db.audit_log.find(
    (row) =>
      row.action === "product_create" &&
      JSON.parse(row.payload).product_id === id,
  );

  expect(entry).toBeDefined();
  expect(entry.user_id).toBeGreaterThan(0);
});
```

### Почему здесь уместен белый ящик

У сервера нет эндпоинта:

```text
GET /api/admin/audit
```

Значит, единственный оракул — файл.

Если завтра появится эндпоинт, чтение файла нужно заменить на `request.get('/api/admin/audit')`.

### Когда белый ящик не уместен

Если тот же факт уже виден через API или UI, прямое чтение файла — лишний слой.

Например:

```text
Плохо: проверять через data/app.json, что Анна вошла.
Хорошо: проверить через cookie sid и тело /api/me.
```

```text
Плохо: проверять через data/app.json, что товар появился в витрине.
Хорошо: проверить через GET /api/products или через каталог Анны.
```

### Мини-ревью

1. Факт реально живёт только внутри сервера?
2. Тест не подменяет собой проверку через API или UI?
3. Путь к файлу стабильный, а не `/home/student/projects/...`?

### Сигналы, что задача поехала не туда

- Чтение файла там, где факт уже отдаёт API.
- Тест меняет `data/app.json` руками.
- Проверка хеша пароля вместо поведения.
- Парсинг SHA-256 соли.

### Полезные ссылки

- [Node.js fs](https://nodejs.org/api/fs.html)
- [API testing](https://playwright.dev/docs/api-testing)

---

# Модуль 10. Сопровождение

Последний модуль — про то, как жить с тестами дальше.

- Что делать с флаками.
- Какие тесты входят в регресс.
- Какие можно выкинуть.
- Как пересобрать архитектуру, когда задач стало 50.

---

## Задача 48. Флаки: не «поставь retry и забудь»

### Зачем эта задача

Флакающий тест — это не «зелёный со второго раза».  
Это тест, у которого есть две правды:

```text
иногда проходит;
иногда падает.
```

Если закрыть глаза и включить `retries: 2`, проблема не исчезает.  
Она просто прячется в отчёте.

### Цепочка задачи

```text
Правило продукта:
Тест должен падать по понятной причине.

Риск:
Если флаки замаскированы ретраями, команда перестаёт доверять отчёту.

Проверка:
Взять три своих теста.
Запустить каждый 10 раз.
Посмотреть, падают ли они без причины.

Наблюдаемый факт:
Стабильные тесты дают 10 из 10.
Флаки дают разброс.

Артeфакт:
Короткий отчёт: какие тесты стабильны, какие подозрительны.
```

### Дано в стиле BDD

```gherkin
Feature: Стабильность тестов

  Scenario: Повторный прогон выявляет флаки
    Given у меня есть набор из 3–5 тестов
    When я запускаю каждый тест 10 раз подряд
    Then я фиксирую число падений
    And я объясняю причину каждого нестабильного теста
```

### Что нужно сделать

1. Выбрать 3–5 тестов из предыдущих модулей.
2. Запустить каждый тест 10 раз:

```bash
npx playwright test tests/login.spec.ts --repeat-each=10
```

3. Посчитать:

```text
10 из 10 зелёных → стабильный;
1–2 падения → подозрительный;
больше 2 падений → флак.
```

4. Для каждого подозрительного теста написать одну строку:

```text
Имя теста — причина нестабильности.
```

Не нужно чинить все флаки.  
Нужно научиться их замечать.

### Типичные причины флаков

- `waitForTimeout` вместо ожидания состояния.
- Общее состояние между тестами.
- Зависимость от текущего времени.
- Сетевые гонки без явных ожиданий.
- Нестабильные данные (фиксированное имя без суффикса).
- Проверка «первой строки», которая зависит от сортировки.

### Что не нужно делать

- Включать `retries: 3` и считать задачу сделанной.
- Помечать флаки как `test.skip`.
- Переписывать тест на `waitForTimeout(5000)`.

### Мини-ревью

1. У каждого подозрительного теста есть объяснение?
2. Не появилось ли желание «включить ретраи и закрыть глаза»?
3. Отличаются ли причины флаков от «упал случайно»?

### Полезные ссылки

- [Flaky tests](https://playwright.dev/docs/test-retries)
- [Trace viewer](https://playwright.dev/docs/trace-viewer)

---

## Задача 49. Риск и регресс

### Зачем эта задача

После 48 задач у студента уже есть набор тестов.  
Не все из них должны идти в ежедневный регресс.

Регресс — это не «всё, что мы написали».  
Регресс — это ответ на вопрос:

```text
Что нельзя ломать завтра?
```

### Цепочка задачи

```text
Правило продукта:
Регресс защищает самые дорогие правила.

Риск:
Если тащить в регресс всё, он становится медленным и его начинают пропускать.
Если тащить только смоук, можно пропустить регрессию правил.

Проверка:
Разметить задачи на три слоя:
- смоук;
- регресс;
- исследовательские и разовые.

Артефакт:
Таблица с разметкой.
```

### Дано в стиле BDD

```gherkin
Feature: Регрессионный набор

  Scenario: Каждый тест имеет слой
    Given у меня есть 20+ автотестов
    When я размечаю их по слоям
    Then смоук содержит 3–7 быстрых тестов
    And регресс содержит основные правила продукта
    And исследовательские тесты не блокируют релиз
```

### Что нужно сделать

Составить таблицу:

| Задача             | Слой              | Почему именно этот слой              |
| ------------------ | ----------------- | ------------------------------------ |
| 5. Вход Анны       | регресс           | критичное правило доступа            |
| 20. Смоук          | смоук             | быстрая проверка живости             |
| 24. Pairwise-набор | исследовательский | дорогая сетка, не для каждого релиза |
| 27. Error guessing | исследовательский | гипотезы без оракула                 |
| 35. API-логин      | регресс           | контракт сервера                     |
| 44. Таймаут        | регресс           | критичный отказ сети                 |
| 47. Audit log      | регресс           | следствие, которое нельзя терять     |

### Три слоя своими словами

**Смоук** — «магазин вообще открыт?»  
3–7 тестов, идут быстро, падают громко.

**Регресс** — «основные правила работают».  
Вход, роли, каталог, профиль, админ-CRUD, отказы.

**Исследовательский слой** — «проверяем гипотезы и комбинации».  
Pairwise, error guessing, редкие сценарии.

### Что не нужно делать

- Класть все 50 тестов в смоук.
- Оставлять только смоук и называть это регрессом.
- Включать в регресс тесты без оракула.

### Мини-ревью

1. Есть ли три слоя, а не один?
2. У каждого теста есть причина слоя?
3. Смоук реально короткий?

### Полезные ссылки

- [Playwright projects](https://playwright.dev/docs/test-projects)
- [Best practices](https://playwright.dev/docs/best-practices)

---

## Задача 50. Ревизия архитектуры тестов

### Зачем эта задача

После 49 задач пора посмотреть, как тесты лежат рядом.

Архитектура тестов — это не диаграмма в PowerPoint.  
Это ответ на вопросы:

```text
где живут локаторы;
где живут данные;
где живут входы;
где живут проверки;
что из этого дублируется;
что из этого мешает.
```

### Цепочка задачи

```text
Правило продукта:
Архитектура тестов должна помогать читать и поддерживать тесты.

Риск:
Если всё лежит в одном файле или в десяти копиях LoginPage,
добавить новый тест становится дороже, чем написать.

Проверка:
Пройтись по всему набору тестов и выписать:
- что уже вынесено;
- что осталось в тестах;
- что хочется удалить;
- что хочется объединить.

Артефакт:
Короткая карта архитектуры + список решений.
```

### Дано в стиле BDD

```gherkin
Feature: Архитектура тестов

  Scenario: Ревизия показывает, где лежит каждый слой
    Given у меня есть набор тестов после 9 модулей
    When я выписываю слои
    Then я вижу страницы, компоненты, фикстуры, фабрики, тесты
    And я вижу, что дублируется
    And я вижу, что можно удалить
```

### Что нужно сделать

Составить карту в виде списка:

```text
pages/
  login-page.ts
  catalog-page.ts
  profile-page.ts
  admin-products-page.ts

components/
  app-error-modal.ts
  app-header.ts

fixtures/
  as-anna.ts
  as-kira.ts

builders/
  product.ts
  profile.ts

helpers/
  login.ts
  read-db.ts

tests/
  auth.setup.ts
  login.spec.ts
  catalog.spec.ts
  roles.anna.spec.ts
  roles.kira.spec.ts
  api.login.spec.ts
  api.products.spec.ts
  api.profile.spec.ts
  smoke.spec.ts
```

Рядом с картой — список решений:

```text
Удалить: старые функции loginAsAnna из отдельных тестов.
Объединить: три копии openCatalogAsAnna в один helper.
Оставить: test.step в смоуке, он читаемый.
Не трогать: локальные локаторы в разовых тестах.
```

### Что важно различать

**Хорошая архитектура** — когда новый тест пишется быстрее, чем копируется старый.

**Плохая архитектура** — когда ради нового теста нужно править пять файлов.

### Мини-ревью

1. Карта отражает реальное состояние репозитория?
2. Есть ли список решений, а не только перечисление файлов?
3. Не появилось ли желание переписать всё заново?

### Что не нужно делать

- Переписывать всё под новую «идеальную» архитектуру.
- Создавать `BasePage` на 400 методов.
- Превращать каждый тест в одну строку через POM.
- Удалять смоук, потому что «он повторяет регресс».

### Полезные ссылки

- [Page Object Model](https://playwright.dev/docs/pom)
- [Test Fixtures](https://playwright.dev/docs/test-fixtures)
- [Best practices](https://playwright.dev/docs/best-practices)

---

## Финальная рамка всего курса

После 50 задач студент должен уметь отвечать на вопросы:

```text
1. Какое правило продукта я проверяю?
2. Какой наблюдаемый факт доказывает, что правило работает?
3. Какой транспорт уместен: браузер, API, чтение данных?
4. Какой слой у теста: смоук, регресс, исследовательский?
5. Что в этом тесте хрупкое и может стать флаком?
```

Если студент умеет отвечать на эти вопросы — Playwright, POM, фикстуры и `page.route` дальше ложатся нормально.

Если не умеет — любой инструмент превращается в дорогой набор кликеров.

---

Это закрывает весь план: задачи **1–50**, синхронизированные с образцами, без SQL, с чтением `data/app.json` как белым ящиком.

Если нужно — могу следующим шагом собрать:

1. готовый `playwright.config.ts` под эту программу;
2. список всех `data-testid`, которые должны быть в клиенте;
3. карту «задача → feature-файл → тест» одним документом.

### USER
так, я сейчас уйду спать, поэтому ставлю тебе задачи на 3 следующих ответа. 1 - нужно научить делать и использовать POM, в начале теория, текст про то зачем нужен этот паттерн,  5 - 7 задач, в задаче в начале решение без POM потом с POM,  и нужно показать явно в чем преимущество. 2 - про важность репортов, зачем нужны, 2 - 3 примера с allure, описать работу с стандартным. 3 - подробно про виды тестов - smoke и тп., ссылки на статьи, пересказ инфы из книг своими словами. Перед тем как начать, ответь - тебе все понятно, можешь что-то дополнить в постановки задач? 

### ASSISTANT
Да, мне всё понятно. Я не начинаю сами блоки в этом ответе — только подтверждаю и предлагаю дополнения к постановкам. Если не ответишь, в следующих ответах пойду по этому плану.

---

## Ответ 1. Помочь научиться делать и использовать POM

Понял так:

- сначала теория: зачем нужен Page Object Model, когда он нужен, а когда вреден;
- потом 5–7 практических задач;
- в каждой задаче сначала решение без POM;
- затем то же решение с POM;
- явно показать преимущество: что стало короче, где правим меньше файлов, что стало читаемее.

Что я хочу дополнить:

1. **Показывать преимущество не словами, а изменением**.  
   Например:
   - без POM: переименовали `login-input` — правим 5 файлов;
   - с POM: переименовали `login-input` — правим один файл `pages/login-page.ts`.

2. **Явно зафиксировать правила хорошего POM**.  
   Например:
   - хранит локаторы и действия;
   - не хранит ожидания и бизнес-правила;
   - не делает `expect` внутри;
   - не знает, кто такая Анна и что она должна видеть;
   - один метод может использоваться и для успеха, и для ошибки.

3. **Дать антипример**, чтобы студенты видели, как не надо:
   - `loginAndExpectCatalog()`;
   - `checkAdminForbidden()` внутри страницы;
   - `BasePage` на 40 методов;
   - класс страницы, который используется в одном тесте и полностью дублирует тест.

4. **Сделать 6 задач**, привязанных к нашему приложению:
   - форма входа;
   - успешный вход Анны;
   - неверный пароль;
   - поиск в каталоге;
   - модалка ошибки как отдельный компонент;
   - роли Анны и Киры на общих страницах.

То есть не просто «вот класс», а постепенное движение:

```text
форма входа → логин → негативный логин → каталог → модалка → роли
```

---

## Ответ 2. Репорты

Понял так:

- объяснить, зачем нужны отчёты;
- показать стандартный отчёт Playwright;
- показать 2–3 примера с Allure.

Что я хочу дополнить:

1. **Сначала дать идею отчёта как оракула прогона**.  
   Отчёт должен отвечать на вопросы:
   - что именно упало;
   - на каком шаге;
   - какой ассерт не совпал;
   - есть ли скриншот, видео или trace;
   - это похоже на баг продукта или баг теста.

2. **Показать стандартный HTML-отчёт Playwright**:
   - `npx playwright test`;
   - `npx playwright show-report`;
   - вложенные шаги `test.step`;
   - артефакты падений;
   - отличие зелёного прогона от красного.

3. **Показать 2–3 практических примера с Allure**:
   - установка `allure-playwright`;
   - запуск с генерацией результатов;
   - `allure serve`;
   - как выглядит упавший тест с шагами;
   - как выглядят категории/ретраи/артефакты.

4. **Важно не создавать иллюзию, что Allure обязателен**.  
   Для обучения сначала лучше стандартный отчёт, а Allure — как расширение, когда команда уже понимает, зачем ей категории, история, тренды и красивые срезы.

---

## Ответ 3. Виды тестов

Понял так:

- подробно рассказать про виды тестов: смоук, регресс и другие;
- дать ссылки на статьи;
- пересказать идеи из книг своими словами;
- связать с нашим курсом и витриной.

Что я хочу дополнить:

1. **Разделить два разных среза**, потому что новички часто их путают:
   - уровни тестирования: юнит, интеграционный, E2E;
   - цели тестирования: смоук, регресс, функциональное, приёмочное, исследовательское.

2. **Дать таблицу соответствия задачам курса**.  
   Например:
   - задача 20 — смоук;
   - задача 18 — три независимых теста, изоляция;
   - задача 24 — не смоук, а более дорогой набор;
   - задача 27 — исследовательские гипотезы;
   - задача 39 — связка API и UI;
   - задача 49 — разметка смоук / регресс / редкий набор.

3. **Пересказать своими словами идеи из книг и стандартов**:
   - Myers: тест ищет расхождение с ожиданием;
   - Kaner, Bach, Pettichord: тест — вопрос к продукту, покрытие нужно расшифровывать;
   - Copeland: техники тест-дизайна нужны, чтобы не забыть классы и границы;
   - идея риск-ориентированного тестирования: не всё нужно гонять всегда.

4. **Добавить практический критерий**, как студенту выбирать тип теста:
   - этот тест должен падать первым? — смоук;
   - этот тест защищает важное правило? — регресс;
   - этот тест проверяет гипотезу? — исследовательский;
   - этот тест требует дорогих комбинаций? — отдельный набор, не каждый коммит.

---

## Мои допущения, если ты не успеешь ответить

Если не будет правок, я сделаю так:

1. **Ответ про POM**:
   - теория;
   - критерии хорошего и плохого POM;
   - 6 задач;
   - каждая задача в формате: без POM → с POM → в чём выгода;
   - без ухода в большой рефакторинг и без лишнего ООП.

2. **Ответ про репорты**:
   - зачем нужны;
   - стандартный Playwright-отчёт;
   - 2–3 примера с Allure;
   - минимальные команды;
   - акцент на читаемость падения, а не на красоту.

3. **Ответ про виды тестов**:
   - классификация;
   - объяснение человеческим языком;
   - ссылки;
   - пересказ книжных идей своими словами;
   - привязка к витрине «Северная полка» и задачам курса.

Если коротко: да, всё понятно. Я бы только добавил в каждую из трёх тем больше практики и меньше абстрактных определений, чтобы студенты сразу видели, зачем это в их тестах.

### USER
дополнения принимаются, делаем

### ASSISTANT
Это **ответ 1 из 3**.  
Тема: **как научить делать и использовать Page Object Model**.

Дальше будут ещё два ответа:

1. **отчёты и Allure**;
2. **виды тестов: smoke, регресс и т.д.**

В этом ответе я даю теорию и **6 учебных задач**.  
В каждой задаче сначала показываю решение **без POM**, затем **с POM**, а потом явно фиксирую, в чём преимущество.

---

# Блок: учим POM на живой витрине

## 1. Теория: зачем нужен Page Object Model

### Короткое определение

**Page Object** — это объект, который знает:

```text
где находятся элементы страницы;
как с ними взаимодействовать.
```

Но он **не знает**:

```text
что должно быть правдой;
какой код ошибки ожидается;
какая роль у пользователя;
какое бизнес-правило проверяется.
```

То есть:

```text
Page Object отвечает на вопрос «как кликнуть».
Тест отвечает на вопрос «что должно произойти».
```

---

## 2. Зачем это нужно студентам

Разработчик, который впервые пишет тесты, обычно копирует действия прямо в тест:

```ts
await page.getByTestId("login-input").fill("anna");
await page.getByTestId("password-input").fill("anna-pass");
await page.getByTestId("login-submit").click();
```

Пока тест один — это терпимо.

Но когда вход появляется в пяти тестах:

- успешный вход Анны;
- неверный пароль;
- пустые поля;
- выход;
- каталог;
- профиль;

возникают три проблемы.

### Проблема 1. Дублирование

Один и тот же код повторяется в нескольких файлах.

Если завтра `login-input` переименуют в `login-username`, придётся править все тесты.

---

### Проблема 2. Тест становится длиннее, чем правило

Правило простое:

```text
Анна входит и видит каталог как пользователь.
```

А тест выглядит как простыня кликов.

В итоге за кликами не видно вопроса:

```text
Что мы вообще проверяем?
```

---

### Проблема 3. Ломается сопровождаемость

Когда локаторы размазаны по тестам, любое изменение вёрстки превращается в болезненный поиск по всем файлам.

Page Object собирает локаторы и действия в одном месте.

---

## 3. Когда POM нужен, а когда рано

### Рано

Если у тебя один простой тест:

```ts
await page.goto("/login");
await expect(page.getByTestId("login-form")).toBeVisible();
```

и больше ничего не планируется, то заводоить класс только ради этого — избыточно.

---

### Пора

Если:

- один и тот же экран используется в нескольких тестах;
- логин повторяется в трёх и более местах;
- одна и та же модалка появляется в разных сценариях;
- тесты начинают копировать локаторы;
- изменение одного `data-testid` ломает сразу несколько файлов.

---

## 4. Хороший Page Object

Хороший Page Object:

```text
хранит локаторы;
делает действия: открыть, ввести, нажать, выбрать;
не делает проверок;
не хранит ожидания вида «Анна должна попасть в каталог»;
не знает про роли и бизнес-правила;
не использует waitForTimeout.
```

Пример хорошего метода:

```ts
async signIn(login: string, password: string) {
  await this.loginInput.fill(login);
  await this.passwordInput.fill(password);
  await this.submitButton.click();
}
```

Этот метод можно использовать и для успешного входа, и для неверного пароля.

---

## 5. Плохой Page Object

Плохой Page Object начинает прятать оракул.

Например:

```ts
async loginAsAnnaAndExpectCatalog() {
  await this.signIn("anna", "anna-pass");
  await expect(this.page).toHaveURL(/\/catalog/);
}
```

Чем это плохо:

```text
Метод знает, что успех — это каталог.
Тогда для неверного пароля нужен второй метод.
Потом появляется третий метод для 422.
Потом четвёртый для Бориса.
В итоге класс страницы превращается в свалку готовых проверок.
```

Плохой признак:

```text
Тест вызвал метод страницы, упал,
и непонятно, какое именно правило продукта не выполнилось.
```

---

## 6. Главное правило, которое нужно дать студентам

```text
Если меняется вёрстка — правим страницу.
Если меняется правило продукта — правим тест.
```

Это самая полезная рамка для понимания POM.

---

# Учебные задачи по POM

Ниже — 6 задач.

Они идут по нарастающей:

```text
1. Форма входа.
2. Успешный вход Анны.
3. Неверный пароль.
4. Пустые поля.
5. Каталог и поиск.
6. Модалка ошибки как общий компонент.
```

---

# Задача 1. Форма входа: локаторы перестают быть размазанными

## Зачем

Пока тест один, можно искать элементы прямо в нём.  
Но как только экран входа появляется в нескольких тестах, хочется, чтобы у страницы входа было одно понятное место.

---

## Правило продукта

```text
На странице входа есть форма, поле логина, поле пароля и кнопка входа.
```

---

## Дано в стиле BDD

```gherkin
Feature: Страница входа

  Scenario: Форма входа содержит договорённые элементы
    Given я гость
    When я открываю страницу входа
    Then я вижу форму входа
    And я вижу поле логина
    And я вижу поле пароля
    And я вижу кнопку входа
```

---

## Решение без POM

```ts
import { test, expect } from "@playwright/test";

test("форма входа видна по тестовым идентификаторам", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByTestId("login-form")).toBeVisible();
  await expect(page.getByTestId("login-input")).toBeVisible();
  await expect(page.getByTestId("password-input")).toBeVisible();
  await expect(page.getByTestId("login-submit")).toBeVisible();
});
```

Это нормальный тест.  
Он пока короткий.

---

## Решение с POM

Создаём файл:

```text
pages/login-page.ts
```

```ts
import { type Page, type Locator } from "@playwright/test";

export class LoginPage {
  page: Page;

  form: Locator;
  loginInput: Locator;
  passwordInput: Locator;
  submitButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.form = page.getByTestId("login-form");
    this.loginInput = page.getByTestId("login-input");
    this.passwordInput = page.getByTestId("password-input");
    this.submitButton = page.getByTestId("login-submit");
  }

  async open() {
    await this.page.goto("/login");
  }
}
```

Тест:

```ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";

test("форма входа видна по тестовым идентификаторам", async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.open();

  await expect(loginPage.form).toBeVisible();
  await expect(loginPage.loginInput).toBeVisible();
  await expect(loginPage.passwordInput).toBeVisible();
  await expect(loginPage.submitButton).toBeVisible();
});
```

---

## В чём преимущество

На этом примере преимущество ещё небольшое.  
Но оно уже видно.

### Если поменяется имя поля

Было:

```ts
page.getByTestId("login-input")
```

Стало:

```ts
page.getByTestId("login-username")
```

Без POM придётся искать это во всех тестах, где используется вход.

С POM правим только:

```ts
pages/login-page.ts
```

---

### Если поменяется способ открытия страницы

Например, вход станет не `/login`, а `/signin`.

Без POM:

```ts
await page.goto("/login");
```

придётся менять во всех тестах.

С POM:

```ts
async open() {
  await this.page.goto("/signin");
}
```

правим один метод.

---

## Мини-ревью

1. Тест всё ещё проверяет видимость элементов?
2. Страница не начала проверять что-то за тест?
3. Локаторы теперь в одном месте?

---

# Задача 2. Анна входит: действие становится методом

## Зачем

Теперь нужно не просто открыть страницу, а выполнить вход.

Если в каждом тесте писать:

```ts
fill
fill
click
```

это быстро превращается в копипасту.

---

## Правило продукта

```text
Анна входит с верным паролем и видит каталог как пользователь.
```

---

## Дано в стиле BDD

```gherkin
Feature: Вход покупателя

  Scenario: Анна входит и не видит администраторские пункты
    Given я гость на странице входа
    When я вхожу как "anna" с паролем "anna-pass"
    Then я оказываюсь в каталоге
    And в шапке виден бейдж роли "user"
    And пункта «Товары» нет
```

---

## Решение без POM

```ts
import { test, expect } from "@playwright/test";

test("Анна входит как пользователь", async ({ page }) => {
  await page.goto("/login");

  await page.getByTestId("login-input").fill("anna");
  await page.getByTestId("password-input").fill("anna-pass");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/catalog/);
  await expect(page.getByTestId("role-badge")).toHaveText(/user/i);
  await expect(page.getByTestId("nav-admin-products")).toHaveCount(0);
});
```

Это рабочий тест.  
Но он уже содержит механику входа, хотя вопрос теста — про права Анны.

---

## Добавляем метод `signIn` в `LoginPage`

```ts
async signIn(login: string, password: string) {
  await this.loginInput.fill(login);
  await this.passwordInput.fill(password);
  await this.submitButton.click();
}
```

Важно:

```text
Внутри signIn нет expect.
```

Потому что `signIn` может использоваться и для успеха, и для ошибки.

---

## Решение с POM

```ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";

test("Анна входит как пользователь", async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);
  await expect(page.getByTestId("role-badge")).toHaveText(/user/i);
  await expect(page.getByTestId("nav-admin-products")).toHaveCount(0);
});
```

---

## В чём преимущество

### 1. Тест стал ближе к сценарию

Было:

```text
найти поле
заполнить поле
найти кнопку
нажать
```

Стало:

```text
открыть страницу входа
войти как Анна
проверить каталог и роль
```

---

### 2. Механика входа больше не дублируется

Если вход понадобится в каталоге, профиле или админке, мы не будем снова писать три строки `fill / fill / click`.

---

### 3. Изменение формы входа меняем в одном месте

Например, если появится капча или второе поле, правим `LoginPage`, а не пять тестов.

---

## Мини-ревью

1. Метод `signIn` содержит проверки?
2. Можно ли использовать его для успешного и неуспешного входа?
3. Оракул остался в тесте?

---

# Задача 3. Неверный пароль: один метод — разные правила

## Зачем

Это очень важный момент для студентов.

Если `signIn` написан правильно, его можно использовать и для успешного входа, и для отказа.

Если внутри `signIn` уже стоит проверка каталога, метод придётся дублировать.

---

## Правило продукта

```text
Неверный пароль не пускает пользователя в каталог.
```

---

## Дано в стиле BDD

```gherkin
Feature: Отказ во входе

  Scenario: Неверный пароль оставляет пользователя на странице входа
    Given я гость на странице входа
    When я вхожу как "anna" с неверным паролем
    Then я остаюсь на странице входа
    And появляется модалка ошибки
    And в коде ошибки отображается 401
```

---

## Решение без POM

```ts
import { test, expect } from "@playwright/test";

test("неверный пароль оставляет на странице входа", async ({ page }) => {
  await page.goto("/login");

  await page.getByTestId("login-input").fill("anna");
  await page.getByTestId("password-input").fill("anna-pass-nope");
  await page.getByTestId("login-submit").click();

  await expect(page.getByTestId("app-error")).toBeVisible();
  await expect(page.getByTestId("app-error-code")).toHaveText("401");
  await expect(page).toHaveURL(/\/login/);
});
```

Снова те же три действия руками.

---

## Решение с POM

```ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";

test("неверный пароль оставляет на странице входа", async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass-nope");

  await expect(page.getByTestId("app-error")).toBeVisible();
  await expect(page.getByTestId("app-error-code")).toHaveText("401");
  await expect(page).toHaveURL(/\/login/);
});
```

---

## В чём преимущество

### 1. Один метод обслуживает разные правила

`signIn` не знает, чем закончится вход.

Он просто выполняет действие:

```text
ввести данные и нажать кнопку
```

А вопрос теста меняется:

```text
успешный вход?
неверный пароль?
пустые поля?
```

---

### 2. Правило осталось в тесте

Ожидание:

```ts
await expect(page.getByTestId("app-error-code")).toHaveText("401");
```

живёт в тесте, а не в странице.

Если завтра код ошибки изменится, правим тест, а не `LoginPage`.

---

### 3. Страница не превращается в бизнес-логику

Если бы внутри `signIn` было:

```ts
await expect(page).toHaveURL(/\/catalog/);
```

то для неверного пароля пришлось бы делать отдельный метод:

```ts
signInWithError
```

А это уже путь к плохому POM.

---

## Мини-ревью

1. `signIn` остался без ожиданий?
2. Тест проверяет именно отказ, а не «что-то пошло не так»?
3. Можно ли тем же методом проверить другой сценарий входа?

---

# Задача 4. Пустые поля: действие без данных тоже можно выразить методом

## Зачем

Пустые поля — это не «ещё один неверный пароль».  
Это отдельное правило валидации.

Но действие снова простое:

```text
нажать кнопку входа без заполнения
```

Если такое действие встречается в тестах, его можно выразить методом.

---

## Правило продукта

```text
Если отправить пустую форму входа, система возвращает ошибку валидации.
```

---

## Дано в стиле BDD

```gherkin
Feature: Валидация формы входа

  Scenario: Пустые поля дают ошибку валидации
    Given я гость на странице входа
    When я нажимаю «Войти», ничего не вводя
    Then я остаюсь на странице входа
    And появляется модалка ошибки
    And в коде ошибки отображается 422
```

---

## Решение без POM

```ts
import { test, expect } from "@playwright/test";

test("пустые поля дают ошибку валидации", async ({ page }) => {
  await page.goto("/login");

  await page.getByTestId("login-submit").click();

  await expect(page.getByTestId("app-error")).toBeVisible();
  await expect(page.getByTestId("app-error-code")).toHaveText("422");
  await expect(page).toHaveURL(/\/login/);
});
```

---

## Добавляем метод в `LoginPage`

```ts
async submitEmpty() {
  await this.submitButton.click();
}
```

Полный `LoginPage` теперь выглядит так:

```ts
import { type Page, type Locator } from "@playwright/test";

export class LoginPage {
  page: Page;

  form: Locator;
  loginInput: Locator;
  passwordInput: Locator;
  submitButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.form = page.getByTestId("login-form");
    this.loginInput = page.getByTestId("login-input");
    this.passwordInput = page.getByTestId("password-input");
    this.submitButton = page.getByTestId("login-submit");
  }

  async open() {
    await this.page.goto("/login");
  }

  async signIn(login: string, password: string) {
    await this.loginInput.fill(login);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }

  async submitEmpty() {
    await this.submitButton.click();
  }
}
```

---

## Решение с POM

```ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";

test("пустые поля дают ошибку валидации", async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.open();
  await loginPage.submitEmpty();

  await expect(page.getByTestId("app-error")).toBeVisible();
  await expect(page.getByTestId("app-error-code")).toHaveText("422");
  await expect(page).toHaveURL(/\/login/);
});
```

---

## В чём преимущество

### 1. Появилось понятное имя действия

Было:

```ts
await page.getByTestId("login-submit").click();
```

Стало:

```ts
await loginPage.submitEmpty();
```

Это читается как:

```text
отправить пустую форму
```

---

### 2. Тест не знает, как именно найдена кнопка

Если кнопка переедет, тест не меняется.

---

### 3. Легко видеть разницу между правилами

Рядом лежат три теста:

```text
успешный вход;
неверный пароль;
пустые поля.
```

Все используют одну страницу, но проверяют разные правила.

Это и есть хороший смысл POM:

```text
упростить действия,
но не спрятать ожидания.
```

---

## Мини-ревью

1. `submitEmpty` содержит проверку?
2. Тест отличает 422 от 401?
3. Если кнопка входа изменит `data-testid`, сколько файлов правим?

---

# Задача 5. Каталог: страница как набор действий и локаторов

## Зачем

Каталог появляется во многих задачах:

- поиск;
- пустой поиск;
- категория;
- сортировка;
- карточка товара;
- роли.

Если каждый раз писать:

```ts
page.getByTestId("catalog-search")
```

и потом еще `fill` + `press("Enter")`, это быстро станет шумом.

---

## Правило продукта

```text
Поиск в каталоге фильтрует товары по подстроке.
Пустой результат поиска не является ошибкой.
```

---

## Дано в стиле BDD

```gherkin
Feature: Поиск в каталоге

  Scenario: Поиск оставляет только подходящие товары
    Given я вошла как "anna"
    When я ищу "тетра"
    Then в таблице появляются строки
    And каждая видимая строка содержит "тетра"

  Scenario: Пустой результат не является ошибкою
    Given я вошла как "anna"
    When я ищу запрос, которого нет в витрине
    Then таблица пустая
    And модалка ошибки не появляется
```

---

## Решение без POM

```ts
import { test, expect } from "@playwright/test";

test("поиск тетра оставляет только подходящие строки", async ({ page }) => {
  await page.goto("/login");

  await page.getByTestId("login-input").fill("anna");
  await page.getByTestId("password-input").fill("anna-pass");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/catalog/);

  await page.getByTestId("catalog-search").fill("тетра");
  await page.getByTestId("catalog-search").press("Enter");

  const rows = page.getByTestId("catalog-row");

  await expect(rows).not.toHaveCount(0);

  const count = await rows.count();

  for (let i = 0; i < count; i += 1) {
    await expect(rows.nth(i)).toContainText(/тетра/i);
  }
});
```

Здесь уже заметно:

```text
логин — механика;
поиск — механика;
проверка строк — оракул.
```

---

## Создаём `CatalogPage`

Файл:

```text
pages/catalog-page.ts
```

```ts
import { type Page, type Locator } from "@playwright/test";

export class CatalogPage {
  page: Page;

  searchInput: Locator;
  rows: Locator;

  constructor(page: Page) {
    this.page = page;

    this.searchInput = page.getByTestId("catalog-search");
    this.rows = page.getByTestId("catalog-row");
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press("Enter");
  }
}
```

Пока минимально.  
Позже сюда можно добавить категорию, сортировку и пагинацию.

---

## Решение с POM

```ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";
import { CatalogPage } from "../pages/catalog-page";

test("поиск тетра оставляет только подходящие строки", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const catalog = new CatalogPage(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);

  await catalog.search("тетра");

  await expect(catalog.rows).not.toHaveCount(0);

  const count = await catalog.rows.count();

  for (let i = 0; i < count; i += 1) {
    await expect(catalog.rows.nth(i)).toContainText(/тетра/i);
  }
});
```

---

## В чём преимущество

### 1. Поиск стал действием страницы

Было:

```ts
await page.getByTestId("catalog-search").fill("тетра");
await page.getByTestId("catalog-search").press("Enter");
```

Стало:

```ts
await catalog.search("тетра");
```

Тест читается ближе к пользовательскому сценарию.

---

### 2. Локаторы каталога живут в одном месте

Если изменится `catalog-search`, правим:

```text
pages/catalog-page.ts
```

а не все тесты каталога.

---

### 3. Оракул остался в тесте

Страница не говорит:

```text
поиск работает правильно
```

Тест сам проверяет:

```text
строки есть;
каждая строка содержит искомый текст.
```

Это важно.

---

## Частая ошибка

Плохо:

```ts
async expectSearchWorks(query: string) {
  await this.search(query);
  await expect(this.rows).not.toHaveCount(0);
}
```

Почему плохо:

```text
Страница начала проверять.
Для пустого поиска этот метод уже не подойдёт.
Оракул спрятался.
```

Хорошо:

```ts
await catalog.search(query);
await expect(catalog.rows).toHaveCount(0);
```

Страница делает действие.  
Тест решает, какой факт ожидается.

---

## Мини-ревью

1. `CatalogPage` знает, что поиск «тетра» должен вернуть строки?
2. Можно ли использовать `search` для пустого результата?
3. Локаторы строк остались доступны тесту?

---

# Задача 6. Модалка ошибки: не страница, а общий компонент

## Зачем

Модалка ошибки появляется в разных местах:

- неверный пароль;
- пустые поля;
- 403 на админской странице;
- 503 из-за учебного сбоя;
- сетевая ошибка.

Это не отдельная страница.  
Это общий компонент приложения.

Если в каждом тесте писать:

```ts
page.getByTestId("app-error")
page.getByTestId("app-error-code")
page.getByTestId("app-error-close")
```

мы снова получаем копипасту.

Но если создать два класса:

```text
LoginErrorModal
AdminErrorModal
```

мы выдумаем две модалки, которых нет в продукте.

Правильный вариант:

```text
один компонент AppErrorModal
```

---

## Правило продукта

```text
Все отказы показываются в одной модалке ошибки.
```

---

## Дано в стиле BDD

```gherkin
Feature: Одна модалка ошибок

  Scenario: Неверный пароль показывает ошибку 401
    Given я гость на странице входа
    When я вхожу как "anna" с неверным паролем
    Then я вижу модалку ошибки
    And в коде ошибки отображается 401

  Scenario: Покупатель на админской странице видит 403
    Given я вошла как "anna"
    When я открываю "/admin/products"
    Then я вижу модалку ошибки
    And в коде ошибки отображается 403
```

---

## Решение без POM

Неверный пароль:

```ts
import { test, expect } from "@playwright/test";

test("неверный пароль показывает модалку 401", async ({ page }) => {
  await page.goto("/login");

  await page.getByTestId("login-input").fill("anna");
  await page.getByTestId("password-input").fill("anna-pass-nope");
  await page.getByTestId("login-submit").click();

  await expect(page.getByTestId("app-error")).toBeVisible();
  await expect(page.getByTestId("app-error-code")).toHaveText("401");
});
```

Админская страница:

```ts
import { test, expect } from "@playwright/test";

test("Анна на админской странице видит 403", async ({ page }) => {
  await page.goto("/login");

  await page.getByTestId("login-input").fill("anna");
  await page.getByTestId("password-input").fill("anna-pass");
  await page.getByTestId("login-submit").click();

  await expect(page).toHaveURL(/\/catalog/);

  await page.goto("/admin/products");

  await expect(page.getByTestId("app-error")).toBeVisible();
  await expect(page.getByTestId("app-error-code")).toHaveText("403");
});
```

В обоих тестах повторяются:

```ts
page.getByTestId("app-error")
page.getByTestId("app-error-code")
```

---

## Создаём компонент

Файл:

```text
components/app-error-modal.ts
```

```ts
import { type Page, type Locator } from "@playwright/test";

export class AppErrorModal {
  page: Page;

  root: Locator;
  code: Locator;
  message: Locator;
  closeButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.root = page.getByTestId("app-error");
    this.code = page.getByTestId("app-error-code");
    this.message = page.getByTestId("app-error-message");
    this.closeButton = page.getByTestId("app-error-close");
  }

  async close() {
    await this.closeButton.click();
  }
}
```

---

## Решение с POM

Неверный пароль:

```ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";
import { AppErrorModal } from "../components/app-error-modal";

test("неверный пароль показывает модалку 401", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const errorModal = new AppErrorModal(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass-nope");

  await expect(errorModal.root).toBeVisible();
  await expect(errorModal.code).toHaveText("401");
});
```

Админская страница:

```ts
import { test, expect } from "@playwright/test";
import { LoginPage } from "../pages/login-page";
import { AppErrorModal } from "../components/app-error-modal";

test("Анна на админской странице видит 403", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const errorModal = new AppErrorModal(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);

  await page.goto("/admin/products");

  await expect(errorModal.root).toBeVisible();
  await expect(errorModal.code).toHaveText("403");
});
```

---

## В чём преимущество

### 1. Одна сущность — один объект

Модалка в приложении одна.  
И компонент один.

Не нужно создавать:

```text
LoginErrorModal
CatalogErrorModal
AdminErrorModal
```

Это выдумало бы структуру, которой нет в продукте.

---

### 2. Закрытие модалки стало действием

Если нужно закрыть ошибку:

```ts
await errorModal.close();
```

Тест не обязан помнить, какой `data-testid` у кнопки закрытия.

---

### 3. Если модалка изменится, правим один файл

Например, если код ошибки переедет из `app-error-code` в `error-modal-code`, правим:

```text
components/app-error-modal.ts
```

а не каждый тест, где встречается ошибка.

---

## Антипример

Плохо:

```ts
async expectLoginError401() {
  await expect(this.page.getByTestId("app-error-code")).toHaveText("401");
}
```

Почему плохо:

```text
Компонент знает правило «401 на логине».
А что делать с 403?
А что делать с 503?
Снова появятся методы-близнецы.
```

Хорошо:

```ts
await expect(errorModal.code).toHaveText("401");
```

Компонент даёт доступ к коду.  
Тест решает, что там ожидается.

---

## Мини-ревью

1. Компонент знает, что такое Борис?
2. Компонент решает, какой код ошибки правильный?
3. Можно ли использовать один и тот же компонент для логина, админки и сетевого сбоя?

---

# Сводная таблица преимуществ

| Изменение                                                  | Без POM                          | С POM                           |
| ---------------------------------------------------------- | -------------------------------- | ------------------------------- |
| `login-input` переименовали                                | правим во всех тестах входа      | правим в `LoginPage`            |
| кнопка входа получила новый `data-testid`                  | правим во всех тестах            | правим в `LoginPage`            |
| поиск каталога стал запускаться по кнопке, а не по `Enter` | правим в каждом тесте каталога   | правим в `CatalogPage.search()` |
| модалка ошибки изменила `data-testid`                      | правим во всех тестах с ошибками | правим в `AppErrorModal`        |
| правило «после входа Анна видит каталог» изменилось        | правим тест                      | правим тест, не страницу        |

Последняя строка особенно важна:

```text
Если меняется правило продукта — правим тест.
Если меняется вёрстка или механизм взаимодействия — правим страницу или компонент.
```

---

# Хорошие и плохие признаки после внедрения POM

## Хорошие признаки

Тесты стали короче и читаются как сценарии:

```ts
await loginPage.open();
await loginPage.signIn("anna", "anna-pass");

await expect(page).toHaveURL(/\/catalog/);
```

Страницы не содержат ожиданий:

```ts
// внутри страницы нет таких вещей
await expect(...)
```

Один компонент используется в разных тестах:

```ts
AppErrorModal
```

Если меняется локатор, правка одна.

---

## Плохие признаки

Появляются методы вроде:

```ts
loginSuccessfully()
loginWithWrongPasswordAndExpect401()
checkAdminForbidden()
```

Внутри страницы появились `expect`.

Тест упал, и в отчёте видно:

```text
LoginPage.login failed
```

но непонятно:

```text
не открылся каталог?
не появился бейдж?
не показалась модалка?
```

Значит страница съела оракул.

---

# Что запомнить студенту

1. **Тест задаёт вопрос продукту.**
2. **Страница помогает этот вопрос задать.**
3. **Ожидаемый факт остаётся в тесте.**
4. **Страница не знает бизнес-правил.**
5. **Один компонент — один объект, даже если он появляется в разных сценариях.**
6. **Методы страницы должны быть пригодны и для успеха, и для отказа.**
7. **Если меняется правило — правим тест. Если меняется вёрстка — правим страницу.**

---

Дальше пойдёт **ответ 2 из 3: отчёты, зачем они нужны, стандартный отчёт Playwright и примеры с Allure**.

### USER
дальше, не жди моей отмашки - выдавай по мере готовности

### ASSISTANT
Продолжаю без паузы. Ниже сразу **ответ 2 из 3** и **ответ 3 из 3**, чтобы закрыть поставленные три блока:

1. POM — уже был.
2. Отчёты: зачем нужны, стандартный отчёт Playwright, примеры с Allure.
3. Виды тестов: smoke, регресс и другие, с ссылками и пересказом идей из книг своими словами.

---

# Ответ 2 из 3. Отчёты: зачем они нужны и как с ними работать

## 1. Зачем вообще нужен отчёт

Отчёт — это не «красивая страница после прогона».  
Отчёт — это инструмент принятия решения после того, как тесты уже упали или прошли.

Хороший отчёт отвечает на четыре вопроса:

```text
1. Что упало?
2. Где именно упало?
3. Почему это похоже на баг продукта или на баг теста?
4. Что делать дальше?
```

Если отчёт показывает только:

```text
12 failed
```

он бесполезен.

Если отчёт показывает:

```text
Тест: неверный пароль даёт 401
Шаг: проверить код ошибки
Ожидали: 401
Получили: 403
Скриншот: страница входа с модалкой
```

то уже можно разбираться.

---

## 2. Отчёт — это оракул прогона

Внутри курса мы постоянно говорим:

```text
Тест задаёт вопрос продукту.
```

Но отчёт задаёт вопрос уже самому прогону:

```text
Что мы узнали после запуска тестов?
```

Например:

- упал вход Анны;
- упал поиск;
- упал тест на 503;
- десять тестов упали из-за одного и того же локатора;
- один тест падает только при параллельном запуске.

Это разные диагнозы.

Если отчёт плохой, команда начинает гадать:

```text
Наверное, приложение сломалось.
Наверное, тесты флакают.
Наверное, селекторы поехали.
Наверное, окружение не то.
```

Хороший отчёт уменьшает гадание.

---

## 3. Что должно быть в хорошем отчёте

Минимально полезный отчёт содержит:

```text
1. Имя теста.
2. Статус: прошёл / упал / пропущен / повторён.
3. Длительность.
4. Шаги теста.
5. Текст упавшего ожидания.
6. Скриншот, видео или trace, если падение важно.
7. Ошибку и стек.
8. Понятное место, где упало.
```

Для учебного курса особенно важны шаги.

В задаче 17 мы вводили `test.step`:

```ts
await test.step("открыть форму входа", async () => {
  // ...
});
```

Шаги нужны не для красоты.  
Они нужны, чтобы в отчёте было видно:

```text
Упало не «всё»,
а конкретно на шаге «проверить шапку покупателя».
```

---

# Стандартный отчёт Playwright

## 4. Что даёт стандартный HTML-отчёт

У Playwright есть встроенный HTML-отчёт.  
Для учебного курса его часто достаточно.

Он умеет показывать:

- список тестов;
- статусы;
- шаги;
- ошибки;
- скриншоты;
- видео;
- trace;
- ретраи;
- длительность;
- разбивку по файлам и проектам.

Главное преимущество стандартного отчёта:

```text
Он уже умеет открывать trace.
```

Для диагностики падений это очень важно.

---

## 5. Как запускать стандартный отчёт

Самый простой вариант:

```bash
npx playwright test --reporter=html
```

После прогона открыть отчёт:

```bash
npx playwright show-report
```

Если хочешь видеть прогресс в консоли и одновременно сохранить HTML:

```bash
npx playwright test --reporter=list,html
```

Или настроить в `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [
    ["list"],
    ["html", { open: "never" }],
  ],
});
```

`open: "never"` удобен в курсе и на сервере:  
отчёт не пытается сам открыть браузер в неподходящий момент.

---

## 6. Пример 1. Зелёный прогон

Допустим, мы запускаем смоук:

```ts
test("смоук: вход, витрина не пустая, выход", async ({ page }) => {
  await test.step("вход", async () => {
    await page.goto("/login");
    await page.getByTestId("login-input").fill("anna");
    await page.getByTestId("password-input").fill("anna-pass");
    await page.getByTestId("login-submit").click();
    await expect(page).toHaveURL(/\/catalog/);
  });

  await test.step("таблица не пустая", async () => {
    await expect(page.getByTestId("catalog-row").first()).toBeVisible();
  });

  await test.step("выход", async () => {
    await page.getByTestId("nav-logout").click();
    await expect(page).toHaveURL(/\/login/);
  });
});
```

В стандартном отчёте видно:

```text
Тест прошёл.
Шаги: вход → таблица не пустая → выход.
Ошибок нет.
```

Это уже полезно.

Но настоящая ценность отчёта появляется, когда тест красный.

---

## 7. Пример 2. Красный тест с понятным падением

Возьмём тест неверного пароля:

```ts
test("неверный пароль оставляет на входе с 401", async ({ page }) => {
  await page.goto("/login");

  await page.getByTestId("login-input").fill("anna");
  await page.getByTestId("password-input").fill("anna-pass-nope");
  await page.getByTestId("login-submit").click();

  await expect(page.getByTestId("app-error")).toBeVisible();
  await expect(page.getByTestId("app-error-code")).toHaveText("401");
  await expect(page).toHaveURL(/\/login/);
});
```

Если сервер внезапно вернул не `401`, а `403`, в отчёте должно быть видно примерно такое:

```text
expect(locator).toHaveText("401")

Expected: "401"
Received: "403"
```

И если включён скриншот при падении:

```ts
use: {
  screenshot: "only-on-failure",
}
```

то в отчёте будет страница входа с модалкой.

Теперь по отчёту видно:

```text
Не приложение полностью лежит.
Не локатор исчез.
Код ошибки другой.
```

Это уже диагноз.

---

## 8. Пример 3. Падение с артефактами: скриншот, видео, trace

Для задач 19, 43, 44, 48 артефакты критичны.

Настройка в конфиге:

```ts
use: {
  screenshot: "only-on-failure",
  video: "retain-on-failure",
  trace: "retain-on-failure",
}
```

Что это даёт:

### Скриншот

Показывает картинку страницы в момент падения.

Хорош для вопросов:

```text
Что пользователь видел в этот момент?
Была ли форма?
Была ли модалка?
Открылся ли каталог?
```

### Видео

Показывает, как тест шёл к падению.

Хорош для вопросов:

```text
Клик случился слишком рано?
Поиск открылся не после того действия?
Страница мигнула?
```

### Trace

Самый мощный артефакт.

Он показывает:

- действия;
- снимки сети;
- снимки консоли;
- состояние страницы;
- шаги;
- временную шкалу.

Открывается:

```bash
npx playwright show-trace trace.zip
```

Или прямо из HTML-отчёта, если отчёт стандартный.

Для учебного курса я бы сказал так:

```text
Скриншот — быстрый взгляд.
Видео — короткий повтор.
Trace — полноценное расследование.
```

---

## 9. Что смотреть в отчёте студенту

После красного прогона студент должен не просто сказать:

```text
Тест упал.
```

А ответить:

```text
1. Какой тест упал?
2. На каком шаге?
3. Какой ассерт не совпал?
4. Что показывает скриншот или trace?
5. Это похоже на баг продукта или на баг теста?
```

Например:

```text
Тест: поиск тетра оставляет только подходящие строки.
Шаг: проверить, что строки содержат «тетра».
Ошибка: одна строка не содержит «тетра».
Скриншот: в таблице есть лишний товар.
Похоже на баг фильтрации, а не на баг теста.
```

Или:

```text
Тест: форма входа видна.
Ошибка: не найден login-input.
Скриншот: форма входа есть.
Похоже на баг теста: селектор неверный, приложение живо.
```

---

# Allure

## 10. Когда нужен Allure

Allure — это отдельный отчётный инструмент.

Он полезен, когда хочется:

```text
- красивую историю;
- категории падений;
- тренды;
- группировки по фичам;
- отчёты для менеджмента;
- единый вид отчётов для разных проектов.
```

Но для обучения сначала лучше понять стандартный отчёт.  
Если студент не умеет читать падение в стандартном отчёте, Allure ему не поможет.

---

## 11. Установка и базовый запуск

Обычно ставят так:

```bash
npm install -D allure-playwright allure-commandline
```

В конфиг добавляют репортёр:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    [
      "allure-playwright",
      {
        outputFolder: "allure-results",
      },
    ],
  ],

  use: {
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },
});
```

Прогон:

```bash
npx playwright test
```

Потом открыть Allure:

```bash
npx allure serve allure-results
```

Важно:

```text
Папка allure-results — это сырые данные.
Отчёт собирается и открывается отдельно.
```

---

## 12. Пример с Allure №1. Упавший тест со шагами

Тот же тест неверного пароля:

```ts
test("неверный пароль показывает 401", async ({ page }) => {
  await test.step("открыть страницу входа", async () => {
    await page.goto("/login");
  });

  await test.step("ввести неверный пароль", async () => {
    await page.getByTestId("login-input").fill("anna");
    await page.getByTestId("password-input").fill("anna-pass-nope");
  });

  await test.step("нажать Войти", async () => {
    await page.getByTestId("login-submit").click();
  });

  await test.step("проверить код ошибки", async () => {
    await expect(page.getByTestId("app-error")).toBeVisible();
    await expect(page.getByTestId("app-error-code")).toHaveText("401");
  });
});
```

В Allure будет видно:

```text
Тест упал.
Шаги:
  открыть страницу входа — ок
  ввести неверный пароль — ок
  нажать Войти — ок
  проверить код ошибки — упал
```

И это уже сильно лучше, чем просто красный тест.

---

## 13. Пример с Allure №2. Группировка по смыслу

Если тесты лежат по смыслу:

```text
tests/
  login.spec.ts
  catalog.spec.ts
  profile.spec.ts
  api-login.spec.ts
  roles.anna.spec.ts
  roles.kira.spec.ts
```

то в Allure удобно видеть группы:

```text
login
catalog
profile
api
roles
```

Это помогает отвечать на вопрос:

```text
Что именно краснеет: вход, каталог, роли или сеть?
```

Если у вас в проекте есть папки:

```text
tests/smoke/
tests/catalog/
tests/admin/
tests/api/
```

то отчёт начинает читаться как карта курса.

---

## 14. Пример с Allure №3. Категории и повторные падения

Представим, что у нас есть два вида проблем:

```text
1. Баг продукта.
2. Баг теста.
```

Например:

```text
Тест входа упал, потому что сервер вернул 500.
Это похоже на баг продукта.
```

И:

```text
Тест входа упал, потому что селектор назвали login-input, а тест ищет login-field.
Это похоже на баг теста.
```

В Allure можно настраивать категории, чтобы различать такие падения.  
Но для учебного курса важнее сама привычка:

```text
Не все красные тесты — это баги приложения.
И не все красные тесты — это плохие тесты.
Нужно смотреть факты.
```

---

## 15. Стандартный отчёт или Allure

Короткая рамка:

### Стандартного отчёта достаточно, если:

```text
- команда небольшая;
- тестов не тысячи;
- нужен быстрый разбор падений;
- важны trace, скриншоты, видео;
- не нужны исторические тренды и менеджмент-дашборды.
```

### Allure полезен, если:

```text
- отчёты смотрят не только инженеры;
- нужны категории и тренды;
- есть несколько прогонов и история;
- хочется единый вид отчётов между проектами;
- уже есть инфраструктура под Allure.
```

Для учебного курса я бы сказал так:

```text
Сначала учимся читать стандартный отчёт.
Потом добавляем Allure как расширение.
Не наоборот.
```

---

## 16. Частые ошибки с отчётами

### Ошибка 1. Отчёт не смотрят

Тесты запустили, увидели красную цифру, пошли дальше.

Плохо.

Отчёт нужен именно для чтения падений.

---

### Ошибка 2. Нет артефактов

Падение без скриншота, видео или trace превращается в гадание.

Особенно это важно для задач:

```text
19 — артефакт падения;
43 — 503;
44 — таймаут;
48 — флаки.
```

---

### Ошибка 3. Скриншоты на каждый зелёный шаг

```ts
screenshot: "on"
```

на каждый прогон может заспамить отчёт.

Для учебного курса обычно лучше:

```ts
screenshot: "only-on-failure"
```

---

### Ошибка 4. Ретраи прячут флаки

Ретрай полезен, но он не должен быть главным лечением.

Плохо:

```text
Тест иногда падает.
Поставим retries: 3.
Задача закрыта.
```

Хорошо:

```text
Тест иногда падает.
Нужно открыть отчёт и понять, где гонка.
```

Это напрямую связано с задачей 48.

---

### Ошибка 5. Отчёт считают доказательством качества

Если все тесты зелёные, это не значит, что продукт хороший.  
Это значит, что написанные тесты прошли.

Отчёт показывает результат прогона, а не абсолютное качество продукта.

---

## 17. Как связать отчёты с задачами курса

| Задача | Что там появляется в отчёте                                          |
| ------ | -------------------------------------------------------------------- |
| 17     | Шаги `test.step` делают падение читаемым                             |
| 19     | Скриншот или trace после специально сломанного локатора              |
| 20     | Смоук: короткий прогон, падение означает «витрина не жива»           |
| 43     | Учебный 503: отчёт показывает модалку и код ошибки                   |
| 44     | Таймаут: отчёт показывает сетевую ошибку                             |
| 48     | Флаки: отчёт и trace помогают найти гонку                            |
| 49     | Регресс: отчёт помогает понять, что именно сломалось после изменений |

---

## 18. Практическое упражнение по отчётам

Хорошее мини-задание для студентов:

```text
1. Возьми тест входа Анны.
2. Добавь в него 3–4 шага через test.step.
3. Специально сломай одно ожидание.
4. Запусти тесты.
5. Открой стандартный отчёт.
6. Найди:
   - упавший тест;
   - упавший шаг;
   - текст ошибки;
   - скриншот, если включён.
7. Напиши одну фразу:
   это баг продукта или баг теста?
```

Это простое упражнение даёт больше, чем лекция про репортеры.

---

## 19. Что запомнить про отчёты

```text
Отчёт нужен не для галочки.
Отчёт нужен для решения.

Хороший отчёт показывает:
- что упало;
- где упало;
- какой факт не совпал;
- есть ли артефакты;
- куда смотреть дальше.

Стандартный отчёт Playwright уже хорош.
Он особенно силён вместе с trace.

Allure нужен тогда, когда нужны категории, история, тренды и управленческий срез.
Но он не заменяет умение читать падение.
```

---
---

# Ответ 3 из 3. Виды тестов: smoke, регресс и другие

## 1. Главная путаница новичков

Студенты часто смешивают два разных вопроса:

```text
1. На каком уровне мы тестируем?
2. С какой целью мы тестируем?
```

Это разные оси.

### Уровни тестирования

Например:

```text
юнит-тесты;
интеграционные тесты;
E2E-тесты.
```

### Цели тестирования

Например:

```text
смоук;
регресс;
функциональное тестирование;
приёмочное тестирование;
исследовательское тестирование.
```

Поэтому фраза:

```text
Это смоук-тест
```

не отвечает полностью на вопрос:

```text
Он юнитовый, интеграционный или E2E?
```

Например, смоук может быть:

```text
E2E-смоук через браузер;
или смоук через API.
```

---

# Уровни тестирования

## 2. Юнит-тесты

Юнит-тест проверяет маленький кусок кода.

Например:

```text
Функция перевода копеек в рубли.
Функция валидации названия товара.
Функция расчёта пагинации.
```

Плюсы:

```text
быстрые;
дёшевые;
легко запускать много раз.
```

Минусы:

```text
не доказывают, что пользователь сможет пройти сценарий;
не видят браузер;
не видят сеть;
не видят интерфейс.
```

В нашем курсе юнит-тесты сервера не являются главной темой.  
Мы тестируем поведение снаружи: браузер и `/api/*`.

---

## 3. Интеграционные тесты

Интеграционные тесты проверяют, что части системы работают вместе.

В нашем курсе это часто:

```text
клиент отправил запрос;
сервер ответил;
правила применились;
формат ответа правильный.
```

Примеры:

```text
POST /api/login возвращает 200 и cookie sid.
GET /api/products возвращает pageSize: 10.
PATCH /api/profile сохраняет новое имя.
```

Задачи 35–40 — это как раз внешнее API.

---

## 4. E2E-тесты

E2E — end-to-end.

Проверяют путь пользователя через систему.

Например:

```text
Анна вошла.
Нашла товар.
Открыла карточку.
Проверила профиль.
Вышла.
```

Плюсы:

```text
близки к пользователю;
ловят проблемы между фронтом и бэком;
показывают реальные пользовательские сценарии.
```

Минусы:

```text
медленные;
более хрупкие;
дороже в поддержке;
при падении сложнее понять причину.
```

Поэтому в хорошем курсе и в хорошем проекте не нужно всё проверять только через E2E.

---

# Тестовая пирамида своими словами

Классическая идея тестовой пирамиды:

```text
много быстрых юнит-тестов;
меньше интеграционных;
немного медленных дорогих E2E.
```

Смысл не в красивой картинке.  
Смысл в том, что разные вопросы лучше задавать на разном уровне.

Например:

```text
Правильно ли считается цена?
Можно юнитом или интеграцией.
```

```text
Может ли пользователь найти товар?
Хорошо проверять ближе к E2E.
```

```text
Виден ли товар в таблице после создания админом?
Хорошо проверять связкой API и UI.
```

Если всё гнать через E2E, получится медленно и дорого.  
Если всё гнать через юниты, можно не заметить, что браузер вообще не открывает каталог.

---

# Виды тестов по цели

## 5. Смоук-тесты

**Смоук-тест** отвечает на вопрос:

```text
Можно ли вообще пользоваться сборкой?
```

Это не полное покрытие.  
Это короткий жизненно важный путь.

Для нашей витрины смоук:

```text
1. Войти как Анна.
2. Убедиться, что таблица каталога не пустая.
3. Выйти.
```

Это задача 20.

Хороший смоук:

```text
короткий;
быстрый;
понятный;
падает громко;
не пытается покрыть всё.
```

Плохой смоук:

```text
вход,
поиск,
сортировка,
карточка,
профиль,
админка,
503,
пагинация,
ретраи,
и ещё 40 проверок.
```

Такой «смоук» начнут пропускать.

---

## 6. Регрессионные тесты

**Регрессионные тесты** отвечают на вопрос:

```text
Не сломали ли мы то, что раньше работало?
```

Например:

```text
Вход Анны.
Неверный пароль.
Пустые поля.
Борис.
Каталог 10 строк.
Поиск тетра.
Карточка товара.
Профиль.
Выход.
```

В курсе это много задач:

```text
5, 6, 7, 9, 10, 13, 14, 15, 16, 35, 36, 38, 39, 40
```

Регрессия — это не «все тесты подряд».  
Это набор правил, которые нельзя незаметно сломать.

---

## 7. Смоук и регресс: разница

Это часто путают.

Можно объяснить так:

### Смоук

```text
Приложение живое?
Можно ли вообще начать проверку?
```

### Регресс

```text
Основные правила всё ещё работают?
```

Смоук — это узкий входной контроль.  
Регресс — более широкая защита уже известных правил.

Например:

```text
Смоук: вошли, таблица есть, вышли.
Регресс: вошли, неверный пароль, пустые поля, Борис, поиск, карточка, профиль, выход.
```

---

## 8. Функциональное тестирование

**Функциональное тестирование** проверяет функции продукта против требований.

Примеры:

```text
Можно ли войти с правильным паролем?
Запрещён ли вход Борису?
Работает ли поиск?
Фильтрует ли категория?
Правильно ли сортируется цена?
Может ли админ создать товар?
```

Большая часть нашего курса — это функциональные проверки через браузер и API.

---

## 9. Приёмочное тестирование

**Приёмочное тестирование** отвечает на вопрос:

```text
Готов ли продукт для пользователя или бизнеса?
```

Оно ближе к сценариям реальных людей:

```text
Покупатель хочет найти тетрадь.
Администратор хочет завести товар.
Пользователь хочет поправить имя в профиле.
```

В учебном проекте мы не принимаем продукт заказчиком, но элементы приёмки видны в задачах про пользовательский путь:

```text
Задача 28. Один путь покупателя.
```

---

## 10. Исследовательское тестирование

**Исследовательское тестирование** — это не «просто потыкать».

Это одновременное:

```text
изучение продукта;
проектирование проверок;
выполнение проверок;
фиксация фактов.
```

Канер и коллеги хорошо объясняют идею, что тестирование — это не только выполнение заранее написанных шагов.  
Тестировщик постоянно учится и уточняет вопросы.

В нашем курсе это отражено в задаче 27:

```text
Error guessing.
Что если поиск с пробелом?
Что если страница 0?
Что если открыть скрытый товар напрямую?
```

Там не всегда есть готовый оракул.  
Иногда задача — зафиксировать факт и понять, какое правило нужно уточнить.

---

## 11. Нефункциональные тесты

Это тесты не про функции, а про свойства системы.

Например:

```text
производительность;
нагрузку;
безопасность;
доступность;
удобство использования;
совместимость;
надёжность.
```

В нашем курсе они не являются главными, но примеры можно показать:

```text
Клиентский таймаут 5 секунд.
Учебный заголовок X-Debug-Delay-Ms: 15000.
Пользователь должен увидеть ошибку сети, а не вечную загрузку.
```

Это задачи:

```text
43, 44
```

Там проверяется не бизнес-правило «цена», а устойчивость к сбою.

---

# Важные идеи из книг своими словами

## 12. Майерс: тестирование ищет расхождения

У Майерса в *The Art of Software Testing* есть очень простая и сильная мысль:

```text
Тестирование нужно, чтобы находить расхождения между ожидаемым и фактическим поведением.
Оно не должно доказывать, что программа работает.
```

Своими словами:

> Если тест написан так, будто его цель — порадовать автора кода, он плохой.  
> Хороший тест ищет место, где продукт может не выполнить обещание.

Для видов тестов это значит:

```text
Смоук не должен рапортовать «всё хорошо».
Он должен быстро находить критичные поломки.

Регресс не должен быть витриной зелёных галочек.
Он должен ловить сломанные правила.
```

---

## 13. Канер: тест — это вопрос

У Канера, Баха и Петтичорда в *Lessons Learned in Software Testing* важна идея:

```text
Тест — это вопрос к продукту.
```

Своими словами:

> Пока непонятно, какой вопрос задаёт тест, непонятно, что значит его результат.

Пример плохого вопроса:

```text
Работает ли каталог?
```

Слишком размыто.

Примеры хороших вопросов:

```text
Показывает ли каталог 10 строк на первой странице?
Отличает ли система пустой поиск от ошибки сервера?
Запрещён ли Анне прямой доступ к /admin/products?
Показывает ли клиент ошибку сети при таймауте?
```

Для видов тестов это значит:

```text
Тип теста должен соответствовать вопросу.
```

Если вопрос:

```text
Можно ли пользоваться приложением?
```

это смоук.

Если вопрос:

```text
Не сломался ли вход после изменений?
```

это регресс.

Если вопрос:

```text
Что будет, если поиск содержит пробел в конце?
```

это исследовательская проверка или гипотеза.

---

## 14. Коупленд: техника не самоцель

У Коупленда в *A Practitioner's Guide to Software Test Design* важна мысль:

```text
Техники тест-дизайна нужны, чтобы не забыть важное, а не чтобы создать бесконечный список кейсов.
```

Своими словами:

> Таблицы, границы и классы нужны не для красоты.  
> Они помогают выбрать разумные проверки и не тонуть в лишних.

Для видов тестов это значит:

```text
Не нужно тащить все техники в смоук.
Не нужно автоматизировать каждую гипотезу.
Не нужно гонять 16 комбинаций каталога на каждый коммит.
```

Например:

```text
Классы эквивалентности и границы — задача 21–22.
Таблица решений — задача 23.
Pairwise — задача 24.
Состояния — задача 25.
```

Но смоук из этого делать не нужно.

---

## 15. Риск-ориентированное тестирование

Ещё одна важная мысль:

```text
Не все проверки одинаково важны.
```

Если ломается вход — это плохо.  
Если ломается сортировка по цене — тоже плохо.  
Но если вход не работает, продукт практически недоступен.

Поэтому тесты выбирают по риску:

```text
Вероятность проблемы × влияние проблемы.
```

Например:

```text
Вход — высокий риск.
Пустые поля — средний риск.
Текст заглушки — низкий риск.
Потеря прав Анны — высокий риск.
Некрасивый отступ — низкий риск.
```

Это связано с задачей 49:

```text
Разметить задачи: смоук / регресс / редкий набор.
```

---

# Таблица видов тестов для курса

| Вид теста                    | Главный вопрос                      | Пример на витрине                           | Связь с задачами   |
| ---------------------------- | ----------------------------------- | ------------------------------------------- | ------------------ |
| Смоук                        | Можно ли пользоваться сборкой?      | Войти, увидеть товары, выйти                | 20                 |
| Регресс                      | Не сломалось ли старое?             | Вход, поиск, профиль, роли                  | 5–16, 29–34, 35–40 |
| Функциональный               | Работает ли правило продукта?       | Борис не входит, цена сортируется по числам | 6, 12, 38          |
| Интеграционный / контрактный | Правильно ли части общаются?        | API логина отдаёт `Set-Cookie`              | 35–40              |
| E2E                          | Проходит ли пользователь путь?      | Анна нашла тетрадь и открыла карточку       | 13, 28             |
| Исследовательский            | Что будет, если сделать неожиданно? | Пробел в поиске, `page=0`, скрытый товар    | 27, 46             |
| Нефункциональный             | Как система ведёт себя при сбоях?   | Таймаут, 503                                | 43, 44             |
| Приёмочный                   | Подходит ли продукт пользователю?   | Покупательский путь как рассказ             | 28                 |

---

# Как студенту выбирать тип теста

Можно дать простую схему.

## Если нужно быстро проверить «живо ли приложение»

```text
Смоук.
```

Пример:

```text
Вход → таблица не пустая → выход.
```

---

## Если нужно защитить важное правило после изменений

```text
Регресс.
```

Пример:

```text
Неверный пароль даёт 401.
Борис даёт 403.
Поиск не открывает модалку при пустом результате.
```

---

## Если нужно проверить контракт между фронтом и сервером

```text
API/интеграционный тест.
```

Пример:

```text
GET /api/products возвращает pageSize: 10.
В ответе нет is_active у витринных товаров.
```

---

## Если нужно проверить пользовательский путь

```text
E2E.
```

Пример:

```text
Анна вошла, нашла товар, открыла карточку, проверила профиль.
```

Но один большой путь лучше держать как иллюстрацию.  
Регресс лучше нарезать на атомарные тесты.

---

## Если правило ещё не договорено

```text
Исследовательская проверка.
```

Пример:

```text
Что делает поиск с пробелом в конце?
Что будет, если открыть скрытый товар напрямую?
```

Сначала фиксируем факт, потом решаем, превращать ли его в постоянный тест.

---

# Что не нужно тащить в каждый прогон

Очень важная мысль для студентов:

```text
Не все хорошие проверки должны запускаться всегда.
```

Например:

```text
Все 16 комбинаций каталога.
Все гипотезы из задачи 27.
Длинные пользовательские пути.
Тяжёлые сетевые сценарии.
Проверки стабильности через 20 повторов.
```

Они полезны, но не обязательно на каждый коммит.

Иначе получается:

```text
Прогон долгий.
Падения непонятные.
Команда перестаёт ждать результатов.
```

---

# Практическое упражнение по видам тестов

Хорошее задание для студентов:

```text
Возьми список задач курса:
5, 6, 7, 20, 24, 27, 35, 38, 43, 44, 49.

Разметь их:
- смоук;
- регресс;
- редкий набор;
- исследовательская проверка;
- устойчивость к сбоям.

Для каждой задачи напиши одну фразу:
почему она попадает именно в этот слой.
```

Например:

```text
Задача 5 — регресс.
Вход Анны — базовое правило, его нельзя ломать.

Задача 20 — смоук.
Это короткий ответ на вопрос «витрина жива?».

Задача 24 — редкий набор.
Это дорого гонять каждый раз, но полезно для комбинаций.

Задача 27 — исследовательская.
Там есть гипотезы без полного оракула.

Задача 44 — устойчивость к сбоям.
Проверяет таймаут и сетевую ошибку.
```

---

# Что запомнить про виды тестов

```text
Виды тестов — это не ярлыки ради ярлыков.
Они помогают ответить, зачем мы запускаем конкретную проверку.
```

Главные различия:

```text
Смоук — жив ли продукт.
Регресс — не сломалось ли старое.
Функциональный — работает ли правило.
Интеграционный — договорились ли части системы.
E2E — проходит ли пользователь путь.
Исследовательский — что мы узнаём о продукте.
Приёмочный — подходит ли продукт пользователю.
```

И самое важное для студентов:

```text
Сначала вопрос.
Потом уровень.
Потом тип.
Потом автоматизация.
```

Если тест отвечает на понятный вопрос, у него есть шанс быть полезным.  
Если тест просто кликает — он будет зелёным до первого неприятного сюрприза.

---

На этом три запланированных блока закрыты:

```text
1. POM.
2. Отчёты.
3. Виды тестов.
```

### USER
еще ответ про data-testid. Когда заводим, где должно хранится, альтернативы. Тоже поробненько

### ASSISTANT
Ниже — отдельный подробный ответ про `data-testid`: когда их заводить, где хранить, какие есть альтернативы и как не превратить их в мусор.

---

# `data-testid` в автотестах: контракт между приложением и тестами

## 1. Что такое `data-testid` в контексте курса

`data-testid` — это специальный HTML-атрибут, который добавляется в разметку не для пользователя и не для стилей, а для тестов.

Пример:

```html
<input data-testid="login-input" />
```

В тесте:

```ts
await page.getByTestId("login-input").fill("anna");
```

В нашем курсе `data-testid` — это часть контракта приложения с автотестами.

То есть это не «внутренний класс вёрстки», а обещание:

```text
Этот элемент можно искать по имени login-input.
Если имя изменится, это осознанное изменение контракта.
```

Это похоже на поле в API.  
Если API обещал вернуть `user.email`, а завтра вернул `mail`, тесты упадут не потому, что тесты капризные, а потому что контракт изменился.

То же самое с `data-testid`.

---

## 2. Зачем вообще нужны `data-testid`

В браузерных приложениях у теста есть несколько способов найти элемент:

```text
по тексту;
по роли;
по подписи;
по CSS-классу;
по структуре;
по специальному атрибуту.
```

Часть из этих способов хрупкая.

Например:

```ts
page.locator(".btn-primary")
```

Плохо, потому что:

- класс может измениться;
- класс может быть дизайн-токеном;
- классов может стать несколько;
- кнопка может поменять стиль, но остаться той же кнопкой;
- в разных местах может быть много `.btn-primary`.

Или:

```ts
page.locator("div > div > button:nth-child(2)")
```

Это почти никогда не нужно в тестах.  
Такой локатор ломается от малейшего изменения структуры.

`data-testid` решает другую задачу:

```text
Дать тесту стабильный, осознанный, не визуальный способ найти элемент.
```

---

## 3. Когда нужно заводить `data-testid`

Заводить `data-testid` стоит, если выполняется хотя бы одно условие.

---

### 3.1. Элемент важен для теста, но не имеет хорошего семантического локатора

Например:

```text
строка таблицы каталога;
ячейка цены;
карточка товара;
корень модалки ошибки;
пагинация;
контейнер шапки.
```

Для строки таблицы роль и текст часто недостаточны.

Хорошо:

```html
<tr data-testid="catalog-row">
```

Плохо:

```ts
page.locator("tbody tr")
```

или:

```ts
page.locator("tr").nth(4)
```

---

### 3.2. Элемент имеет динамические или сгенерированные классы

Особенно актуально для фреймворков и сборщиков, где классы могут содержать хеши.

Например, плохо:

```ts
page.locator(".login_btn_a1b2c3")
```

Хорошо:

```html
<button data-testid="login-submit">Войти</button>
```

Если классы генерируются сборкой или меняются при рефакторинге стилей, тесты не должны от этого падать.

---

### 3.3. Элемент повторяется в списке

Например, строки каталога:

```html
<tr data-testid="catalog-row">...</tr>
<tr data-testid="catalog-row">...</tr>
<tr data-testid="catalog-row">...</tr>
```

В тесте:

```ts
const rows = page.getByTestId("catalog-row");

await expect(rows).toHaveCount(10);
```

Здесь один и тот же `data-testid` повторяется — это нормально.

Для идентификации конкретной строки лучше использовать не уникальный `data-testid`, а отдельный data-атрибут:

```html
<tr data-testid="catalog-row" data-id="42">
```

Плохо:

```html
<tr data-testid="catalog-row-42">
<tr data-testid="catalog-row-43">
```

Хорошо:

```html
<tr data-testid="catalog-row" data-id="42">
<tr data-testid="catalog-row" data-id="43">
```

Потому что:

```text
data-testid отвечает на вопрос «что это за тип элемента»;
data-id отвечает на вопрос «какой именно это объект».
```

---

### 3.4. Элемент — часть сложного компонента

Например, модалка ошибки:

```text
корень модалки;
код ошибки;
сообщение;
кнопка закрытия.
```

Хорошо:

```html
<div data-testid="app-error">
  <span data-testid="app-error-code"></span>
  <p data-testid="app-error-message"></p>
  <button data-testid="app-error-close">Закрыть</button>
</div>
```

В тесте:

```ts
await expect(page.getByTestId("app-error")).toBeVisible();
await expect(page.getByTestId("app-error-code")).toHaveText("401");
```

Плохо:

```ts
page.locator(".modal .modal-body div:first-child")
```

---

### 3.5. Элемент является договорённостью между продуктом и тестами

В нашем учебном приложении есть стабильные селекторы:

```text
login-form
login-input
password-input
login-submit
app-error
app-error-code
catalog-row
catalog-search
catalog-category
catalog-sort
product-title
product-price
profile-form
profile-save
admin-product-form
admin-product-save
```

Это не просто атрибуты.  
Это контракт.

Если тест использует:

```ts
page.getByTestId("catalog-row")
```

он ожидает, что приложение договорилось:

```text
строка витрины находится именно так.
```

---

## 4. Когда не нужно заводить `data-testid`

`data-testid` — хороший инструмент, но не нужно покрывать ими весь DOM.

Не нужно заводить `data-testid`, если:

---

### 4.1. Элемент отлично находится по роли и доступному имени

Например:

```html
<button>Войти</button>
```

Можно найти так:

```ts
page.getByRole("button", { name: "Войти" });
```

Если подпись стабильна и является частью продукта, это хороший локатор.

Но в учебном курсе мы всё равно часто выбираем `data-testid`, потому что отрабатываем контракт.

---

### 4.2. Элемент нужен один раз и является простым статичным текстом

Например:

```html
<h1>Северная полка</h1>
```

Можно использовать:

```ts
page.getByRole("heading", { name: "Северная полка" });
```

или:

```ts
page.getByText("Северная полка");
```

Если это просто статичный текст и он не является сложным контрактом, отдельный `data-testid` может быть избыточен.

---

### 4.3. Элемент нужен только для стилей

Не нужно писать:

```html
<div data-testid="header-wrapper" class="...">
```

если тесту не нужно с ним работать.

`data-testid` нужен тестам, а не вёрстке.

---

### 4.4. Хочется протестировать внутреннюю структуру вёрстки

Плохая цель:

```text
Проверить, что третий блок внутри второго контейнера существует.
```

Хорошая цель:

```text
Проверить, что пользователь видит карточку товара с нужным именем и ценой.
```

Если тест хочет проверять вёрстку ради вёрстки, обычно это запах.

---

## 5. Где должны храниться `data-testid`

Здесь важно разделить три слоя.

---

## 5.1. Источник истины — разметка приложения

Сами атрибуты живут в приложении.

Для нашего клиента это:

- `public/index.html`;
- шаблоны в `public/app.js`;
- динамически создаваемые элементы в рендере таблицы, шапки, модалки, админки.

Пример:

```html
<button data-testid="profile-save">Сохранить</button>
```

Или в шаблоне:

```js
`
<tr data-testid="catalog-row" data-id="${product.id}">
  <td data-testid="catalog-name">${escapeHtml(product.name)}</td>
  <td data-testid="catalog-price" data-price="${product.price}">
    ${formatPrice(product.price)}
  </td>
</tr>
`
```

Главная мысль:

```text
Приложение владеет своими data-testid.
```

Тесты не должны придумывать их отдельно от реальности.

---

## 5.2. Использование — в page objects и компонентах

В тестах не стоит размазывать `getByTestId` по всем файлам.

Плохо:

```ts
await page.getByTestId("login-input").fill("anna");
await page.getByTestId("password-input").fill("anna-pass");
await page.getByTestId("login-submit").click();
```

в десяти тестах.

Хорошо:

```ts
export class LoginPage {
  page: Page;

  loginInput: Locator;
  passwordInput: Locator;
  submitButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.loginInput = page.getByTestId("login-input");
    this.passwordInput = page.getByTestId("password-input");
    this.submitButton = page.getByTestId("login-submit");
  }
}
```

Тогда тест использует:

```ts
await loginPage.signIn("anna", "anna-pass");
```

То есть:

```text
data-testid живёт в приложении.
Использование живёт в page object.
Ожидание живёт в тесте.
```

---

## 5.3. Документация — опционально, но полезно

Если тестов много, удобно иметь карту селекторов.

Например, файл:

```text
docs/test-ids.md
```

Пример таблицы:

| `data-testid`        | Где находится      | Что означает          |
| -------------------- | ------------------ | --------------------- |
| `login-form`         | страница входа     | форма входа           |
| `login-input`        | страница входа     | поле логина           |
| `password-input`     | страница входа     | поле пароля           |
| `login-submit`       | страница входа     | кнопка входа          |
| `app-error`          | глобальная модалка | корень модалки ошибки |
| `app-error-code`     | глобальная модалка | код ошибки            |
| `catalog-row`        | таблица каталога   | строка товара         |
| `catalog-search`     | каталог            | поле поиска           |
| `catalog-category`   | каталог            | селект категории      |
| `catalog-sort`       | каталог            | селект сортировки     |
| `product-title`      | карточка товара    | название товара       |
| `product-price`      | карточка товара    | цена товара           |
| `profile-form`       | профиль            | форма профиля         |
| `admin-product-form` | админка            | форма товара          |

Но важно:

```text
Документация не заменяет атрибуты в разметке.
```

Если `docs/test-ids.md` говорит одно, а в приложении другое, источник истины — приложение, а документ нужно чинить.

---

## 6. Нужно ли хранить список `data-testid` в коде тестов?

Иногда делают файл вида:

```ts
export const SELECTORS = {
  loginInput: "[data-testid='login-input']",
  passwordInput: "[data-testid='password-input']",
};
```

Это лучше, чем размазывать селекторы по тестам, но обычно не лучший вариант для Playwright.

Причина:

```text
Селекторы — это не просто строки.
Важно, как они используются: локаторы, фильтры, ожидания.
```

Лучше:

```ts
class LoginPage {
  loginInput = this.page.getByTestId("login-input");
}
```

чем:

```ts
page.locator(SELECTORS.loginInput)
```

То есть для курса предпочтительная цепочка такая:

```text
Приложение:
  <input data-testid="login-input">

Page object:
  this.loginInput = page.getByTestId("login-input")

Тест:
  await loginPage.loginInput.fill("anna")
```

---

## 7. Альтернативы `data-testid`

Теперь подробнее про другие способы находить элементы.

---

## 7.1. `getByRole`

Пример:

```ts
await page.getByRole("button", { name: "Войти" }).click();
```

### Плюсы

- опирается на семантику;
- поддерживает доступность;
- хорош для кнопок, ссылок, заголовков, чекбоксов, полей;
- заставляет думать о роли элемента.

### Минусы

- может ломаться при изменении текста;
- зависит от локали;
- зависит от доступного имени;
- не всегда подходит для сложных блоков;
- не всегда различает похожие элементы без дополнительных фильтров.

Пример проблемы:

```html
<button>Войти</button>
<button>Войти через SSO</button>
```

Тогда нужно уточнять:

```ts
getByRole("button", { name: "Войти", exact: true })
```

Но это уже чувствительно к тексту.

---

## 7.2. `getByLabel`

Пример:

```ts
await page.getByLabel("Логин").fill("anna");
```

### Плюсы

- хорошо для форм;
- связан с доступностью;
- пользователь видит подпись, тест использует ту же подпись.

### Минусы

- подпись может измениться;
- локализация может изменить текст;
- не у всех элементов есть label;
- в динамических таблицах и сложных виджетах не всегда применимо.

Хорошо использовать, если форма действительно имеет нормальный `<label>`.

---

## 7.3. `getByText`

Пример:

```ts
await page.getByText("Войти").click();
```

### Плюсы

- просто;
- читаемо;
- подходит для статичных элементов.

### Минусы

- хрупок к формулировкам;
- ломается при изменении текста;
- ломается при локализации;
- может найти не тот элемент, если текст встречается несколько раз;
- плох для динамических данных.

Например, для товара:

```ts
page.getByText("Тетрадь 48 л.")
```

может быть полезно как проверка пользовательского факта, но не всегда хорошо как основной локатор действия.

---

## 7.4. `getByPlaceholder`

Пример:

```ts
await page.getByPlaceholder("Поиск").fill("тетра");
```

### Плюсы

- удобно для инпутов с placeholder.

### Минусы

- placeholder часто меняется;
- не является полноценной подписью;
- может быть пустым;
- хуже для доступности, чем настоящий `label`.

Использовать можно, но это не самый сильный локатор.

---

## 7.5. CSS-селекторы

Пример:

```ts
page.locator(".catalog-table tbody tr")
```

### Когда допустимо

Если селектор:

- стабильный;
- семантический;
- не завязан на визуальный класс;
- не ломается от изменения стилей.

### Когда плохо

```ts
page.locator(".btn.btn-primary.mt-2")
```

или:

```ts
page.locator("div > div > span:nth-child(3)")
```

В нашем курсе мы не хотим опираться на классы Bootstrap или внутренние классы вёрстки.

---

## 7.6. XPath

Пример:

```ts
page.locator("//div[2]/button[1]")
```

В большинстве автотестов этого лучше избегать.

Причины:

- хрупок;
- плохо читается;
- привязан к структуре;
- легко ломается при изменении разметки;
- обычно не несёт продуктового смысла.

Если хочется использовать XPath, почти всегда стоит сначала спросить:

```text
Может быть, сюда нужен data-testid?
```

---

## 8. Сравнение альтернатив

| Способ             | Когда хорош                                                     | Когда плох                                                |
| ------------------ | --------------------------------------------------------------- | --------------------------------------------------------- |
| `getByTestId`      | контрактные элементы, списки, сложные компоненты, строки таблиц | если хочется просто покрыть весь DOM тестовыми атрибутами |
| `getByRole`        | кнопки, ссылки, заголовки, поля с хорошей ролью                 | если текст/подпись нестабильны                            |
| `getByLabel`       | формы с нормальными подписями                                   | если подписи нет или она меняется                         |
| `getByText`        | статичный текст, пользовательские факты                         | динамические данные, локализация, повторяющийся текст     |
| `getByPlaceholder` | инпуты с понятным placeholder                                   | если есть label или test id                               |
| CSS                | стабильные семантические классы                                 | визуальные классы, сгенерированные классы                 |
| XPath              | редко, когда действительно нужен сложный путь                   | почти всегда в простых тестах                             |

---

## 9. Что использовать в нашем курсе

Для учебного проекта «Северная полка» основная стратегия:

```text
Сначала договорённость через data-testid.
Потом, где уместно, можно использовать роль и подпись.
Не использовать сгенерированные классы, случайные классы и структуру вёрстки.
```

Почему так:

- студенты учатся видеть контракт;
- элементы списка и таблицы сложно стабильно искать по роли;
- текст может быть не единственным и не стабильным;
- `data-testid` явно говорит: «этот элемент можно проверять».

Но это не значит, что `getByRole` запрещён навсегда.

Например, для кнопки «Войти» можно было бы использовать:

```ts
page.getByRole("button", { name: "Войти" });
```

Но если кнопка завтра станет «Продолжить», роль по имени сломается.  
Если же продукт считает текст кнопки важным правилом, тогда такой тест может быть полезен.

То есть выбор локатора зависит от вопроса:

```text
Мы проверяем договорённость элемента?
Или проверяем пользовательскую подпись?
```

---

## 10. Именование `data-testid`

Имена должны быть понятными, стабильными и не привязанными к вёрстке.

Хорошо:

```text
login-form
login-input
password-input
login-submit
catalog-row
catalog-search
catalog-pagination
product-title
product-price
profile-save
admin-product-form
app-error-code
```

Плохо:

```text
input1
button2
test-element
block
wrapper
div-for-test
catalog-row-new
catalog-row-2
```

---

## 11. Принципы именования

### 11.1. Использовать назначение, а не внешний вид

Хорошо:

```text
catalog-search
```

Плохо:

```text
left-panel-input
```

---

### 11.2. Использовать сущность и часть элемента

Например:

```text
product-title
product-price
profile-first-name
admin-product-save
app-error-code
```

Это читается как:

```text
что это за объект;
какая часть объекта.
```

---

### 11.3. Не включать состояние в имя

Плохо:

```text
login-submit-disabled
catalog-row-selected
profile-save-active
```

Хорошо:

```text
login-submit
catalog-row
profile-save
```

А состояние проверять ассертом:

```ts
await expect(page.getByTestId("login-submit")).toBeDisabled();
```

или:

```ts
await expect(row).toHaveClass(/selected/);
```

если класс состояния действительно стабилен.

---

### 11.4. Не включать динамические идентификаторы в сам `data-testid`

Плохо:

```html
<tr data-testid="product-42">
<tr data-testid="product-43">
```

Хорошо:

```html
<tr data-testid="catalog-row" data-id="42">
<tr data-testid="catalog-row" data-id="43">
```

В тесте:

```ts
const row = page.getByTestId("catalog-row").filter({
  has: page.locator("[data-id='42']"),
});
```

Или, если `data-id` на самой строке:

```html
<tr data-testid="catalog-row" data-id="42">
```

```ts
const row = page.locator("[data-testid='catalog-row'][data-id='42']");
```

Но в большинстве учебных задач достаточно:

```ts
page.getByTestId("catalog-row").first()
```

или:

```ts
page.getByTestId("catalog-row").filter({ hasText: "тетра" })
```

---

## 12. Куда вешать `data-testid`

Общее правило:

```text
Вешай на тот элемент, с которым тест будет реально взаимодействовать или который будет проверять.
```

---

### 12.1. Для кнопки — на кнопку

Хорошо:

```html
<button data-testid="profile-save">Сохранить</button>
```

Плохо:

```html
<div data-testid="profile-save">
  <button>Сохранить</button>
</div>
```

Если тест будет кликать, лучше дать идентификатор кликабельному элементу.

---

### 12.2. Для поля — на поле

Хорошо:

```html
<input data-testid="login-input" />
```

Плохо:

```html
<div data-testid="login-input">
  <input />
</div>
```

Если тест хочет вводить текст, идентификатор должен быть на `input`, `textarea` или `select`.

---

### 12.3. Для строки таблицы — на строку

Хорошо:

```html
<tr data-testid="catalog-row">
```

Если нужны ячейки, можно добавить отдельные:

```html
<td data-testid="catalog-name">...</td>
<td data-testid="catalog-price">...</td>
```

Или использовать data-атрибуты для данных:

```html
<td data-testid="catalog-price" data-price="79000">
  790.00 ₽
</td>
```

---

### 12.4. Для модалки — на корень и важные части

Хорошо:

```html
<div data-testid="app-error">
  <span data-testid="app-error-code"></span>
  <p data-testid="app-error-message"></p>
  <button data-testid="app-error-close">Закрыть</button>
</div>
```

Плохо давать один `data-testid` только на текст ошибки, если тесту нужно проверять видимость модалки, код и закрытие.

---

## 13. `data-testid` и повторяющиеся элементы

Очень важный момент для таблиц и списков.

Один и тот же `data-testid` может повторяться.

Например:

```html
<tr data-testid="catalog-row">...</tr>
<tr data-testid="catalog-row">...</tr>
<tr data-testid="catalog-row">...</tr>
```

В Playwright:

```ts
const rows = page.getByTestId("catalog-row");

await expect(rows).toHaveCount(10);
await expect(rows.first()).toBeVisible();
```

Это нормально.

Если нужно отличать строки, используем не разные `data-testid`, а фильтры или data-атрибуты.

Например:

```ts
const row = page.getByTestId("catalog-row").filter({
  hasText: "Тетрадь 48 л.",
});
```

Или:

```ts
const row = page.locator("[data-testid='catalog-row'][data-id='42']");
```

---

## 14. `data-testid` и состояния отсутствия

Есть два разных случая.

---

### 14.1. Элемент вообще не рендерится

Например, у Анны нет админской кнопки.

Тогда в тесте можно использовать:

```ts
await expect(page.getByTestId("catalog-row-edit")).toHaveCount(0);
```

---

### 14.2. Элемент есть в DOM, но скрыт

Тогда лучше:

```ts
await expect(page.getByTestId("app-error")).toBeHidden();
```

Важно смотреть реальную разметку.

Если элемент исчезает из DOM — `toHaveCount(0)`.  
Если остаётся, но скрыт — `toBeHidden()`.

Не нужно выбирать между ними случайно.  
Оракул — фактическая разметка приложения.

---

## 15. `data-testid` и локализация

Если приложение может менять язык, текстовые локаторы становятся опасными.

Например:

```ts
page.getByRole("button", { name: "Войти" });
```

сломается, если интерфейс станет английским:

```text
Sign in
```

А:

```ts
page.getByTestId("login-submit");
```

не сломается.

Поэтому для мультиязычных интерфейсов `data-testid` часто более стабилен.

Но если требование продукта звучит как:

```text
Кнопка должна называться именно «Войти»
```

тогда проверка текста может быть не багом теста, а проверкой требования.

---

## 16. `data-testid` и доступность

`data-testid` не заменяет доступность.

Скринридер не ищет элементы по `data-testid`.  
Пользователь видит текст, подписи, роли, фокус.

Поэтому:

```text
Если элемент должен быть доступен пользователю,
у него должна быть нормальная семантика и доступное имя.
```

`data-testid` добавляется сверху, а не вместо этого.

Плохо:

```html
<div data-testid="login-submit">Войти</div>
```

Хорошо:

```html
<button data-testid="login-submit">Войти</button>
```

Плохо:

```html
<input data-testid="login-input" />
```

без подписи, если пользователю нужна подпись.

Лучше:

```html
<label for="login-input">Логин</label>
<input id="login-input" data-testid="login-input" />
```

---

## 17. Когда `getByRole` может быть лучше `data-testid`

Если элемент имеет стабильную семантику и стабильное имя.

Например:

```html
<button>Выйти</button>
```

Можно:

```ts
page.getByRole("button", { name: "Выйти" });
```

Это хорошо, если:

- текст стабилен;
- текст важен для продукта;
- локализация не меняется в рамках тестов;
- доступность важна.

Но для учебного контракта мы всё равно часто оставляем:

```ts
page.getByTestId("nav-logout");
```

потому что хотим проверять именно контрактную кнопку выхода, даже если подпись временно поменяется.

---

## 18. Когда `data-testid` лучше текста

Когда:

- текст может измениться;
- текст не является главным правилом;
- элементов с похожим текстом много;
- нужна стабильность;
- элемент не имеет уникального текста;
- элемент находится в списке;
- мы проверяем поведение, а не надпись.

Пример:

```ts
page.getByTestId("catalog-row")
```

лучше, чем:

```ts
page.locator("tr:has-text('Тетрадь')")
```

если задача — получить строки таблицы как контрактный список.

---

## 19. Когда текст всё-таки нужен

Текст нужен, если проверяется пользовательский факт.

Например:

```ts
await expect(page.getByTestId("product-title")).toHaveText(name);
```

Здесь `data-testid` помогает найти элемент, а текст является ожидаемым фактом.

Или:

```ts
await expect(rows.nth(i)).toContainText(/тетра/i);
```

Здесь мы проверяем не локатор, а правило поиска:

```text
все видимые строки должны содержать искомую подстроку.
```

---

## 20. Типичные ошибки с `data-testid`

---

### 20.1. Использовать `data-testid` для всего подряд

Не нужно помечать каждый `div`.

Плохо:

```html
<div data-testid="wrapper">
  <div data-testid="inner-wrapper">
    <div data-testid="content-wrapper">
```

Хорошо давать идентификаторы тем элементам, которые имеют смысл для теста:

```text
форма;
поле;
кнопка;
строка таблицы;
карточка;
модалка;
код ошибки.
```

---

### 20.2. Дублировать логику в имени

Плохо:

```text
login-form-wrapper-container
```

Хорошо:

```text
login-form
```

---

### 20.3. Использовать номер или позицию

Плохо:

```text
row-1
row-2
row-3
```

Хорошо:

```text
catalog-row
```

А позицию проверять локатором:

```ts
rows.first()
rows.nth(2)
```

или фильтром.

---

### 20.4. Включать состояние в имя

Плохо:

```text
submit-button-disabled
```

Хорошо:

```text
submit-button
```

и:

```ts
await expect(submitButton).toBeDisabled();
```

---

### 20.5. Менять `data-testid` без обновления тестов

Если `data-testid` — контракт, то его изменение должно быть осознанным.

Нельзя просто переименовать:

```text
login-input
```

в:

```text
username-field
```

и ждать, что тесты сами поймут.

Нужно обновить:

- приложение;
- тесты;
- page objects;
- документацию, если она есть.

---

### 20.6. Хранить селекторы только в тестах

Если приложение не содержит атрибут, тест не может его выдумать.

Плохо:

```ts
page.getByTestId("catalog-name")
```

а в приложении нет:

```html
data-testid="catalog-name"
```

Тогда тест будет падать не потому, что продукт сломан, а потому что контракт не добавлен.

В учебном проекте правильное действие:

```text
добавить атрибут в приложение.
```

В рабочем проекте:

```text
договориться с разработкой и добавить атрибут осознанно.
```

---

## 21. Что делать, если `data-testid` нет

Хороший порядок действий:

```text
1. Проверить, есть ли хороший роль/подпись/текст.
2. Если нет — добавить data-testid в приложение.
3. Обновить page object.
4. Использовать в тесте.
5. При необходимости отметить в документации.
```

Плохой порядок:

```text
1. Найти ближайший класс.
2. Написать сложный CSS.
3. Добавить :nth-child.
4. Назвать это устойчивым тестом.
```

---

## 22. Пример для страницы входа

Разметка:

```html
<form data-testid="login-form">
  <label for="login-input">Логин</label>
  <input id="login-input" data-testid="login-input" />

  <label for="password-input">Пароль</label>
  <input id="password-input" type="password" data-testid="password-input" />

  <button data-testid="login-submit">Войти</button>
</form>
```

Page object:

```ts
import { type Page, type Locator } from "@playwright/test";

export class LoginPage {
  page: Page;

  form: Locator;
  loginInput: Locator;
  passwordInput: Locator;
  submitButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.form = page.getByTestId("login-form");
    this.loginInput = page.getByTestId("login-input");
    this.passwordInput = page.getByTestId("password-input");
    this.submitButton = page.getByTestId("login-submit");
  }

  async open() {
    await this.page.goto("/login");
  }

  async signIn(login: string, password: string) {
    await this.loginInput.fill(login);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

Тест:

```ts
test("Анна входит как покупатель", async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.open();
  await loginPage.signIn("anna", "anna-pass");

  await expect(page).toHaveURL(/\/catalog/);
});
```

Хорошо видно:

```text
Разметка хранит атрибуты.
Page object хранит использование.
Тест хранит правило.
```

---

## 23. Пример для таблицы каталога

Разметка строки:

```html
<tr data-testid="catalog-row" data-id="42">
  <td data-testid="catalog-name">Тетрадь 48 л.</td>
  <td data-testid="catalog-category-cell" data-category="notebooks">
    notebooks
  </td>
  <td data-testid="catalog-price" data-price="79000">
    790.00 ₽
  </td>
</tr>
```

В тесте:

```ts
const rows = page.getByTestId("catalog-row");

await expect(rows).toHaveCount(10);
```

Проверка цены как числа:

```ts
const priceAttribute = await rows
  .first()
  .getByTestId("catalog-price")
  .getAttribute("data-price");

expect(Number(priceAttribute)).toBeGreaterThanOrEqual(0);
```

Здесь важно:

```text
data-testid находит элемент.
data-price даёт стабильные данные.
Текст в рублях остаётся пользовательским представлением.
```

---

## 24. Пример для модалки ошибки

Разметка:

```html
<div data-testid="app-error">
  <span data-testid="app-error-code">401</span>
  <p data-testid="app-error-message">Неверный логин или пароль</p>
  <button data-testid="app-error-close">Закрыть</button>
</div>
```

Компонент в тестах:

```ts
import { type Page, type Locator } from "@playwright/test";

export class AppErrorModal {
  page: Page;

  root: Locator;
  code: Locator;
  message: Locator;
  closeButton: Locator;

  constructor(page: Page) {
    this.page = page;

    this.root = page.getByTestId("app-error");
    this.code = page.getByTestId("app-error-code");
    this.message = page.getByTestId("app-error-message");
    this.closeButton = page.getByTestId("app-error-close");
  }

  async close() {
    await this.closeButton.click();
  }
}
```

Тест:

```ts
const errorModal = new AppErrorModal(page);

await expect(errorModal.root).toBeVisible();
await expect(errorModal.code).toHaveText("401");

await errorModal.close();

await expect(errorModal.root).toBeHidden();
```

---

## 25. Политика курса по `data-testid`

Для курса можно сформулировать так:

```text
1. Тесты не ищут элементы по визуальным классам.
2. Тесты не ищут элементы по хрупкой структуре вёрстки.
3. Если нужен стабильный контрактный элемент — используем data-testid.
4. Если data-testid нет, но элемент нужен тесту — добавляем его в приложение.
5. Не добавляем тестовые атрибуты на каждый узел.
6. Ожидания остаются в тесте, а не в локаторе.
7. Смена data-testid — это изменение контракта.
```

---

## 26. Короткая памятка

### Заводить `data-testid`, если:

```text
элемент нужен тестам;
нет хорошего стабильного локатора;
элемент повторяется в списке;
элемент является частью контракта;
классы нестабильны;
структура хрупкая;
элемент сложный: строка таблицы, модалка, карточка.
```

### Не заводить, если:

```text
элемент не нужен тестам;
есть хороший роль/подпись/текст;
это временный визуальный контейнер;
хочется покрыть весь DOM атрибутами;
тест проверяет вёрстку ради вёрстки.
```

### Хранить:

```text
Атрибуты — в приложении.
Использование — в page objects.
Документация — опционально рядом с проектом.
```

### Альтернативы:

```text
getByRole — для семантики и доступности.
getByLabel — для форм с подписями.
getByText — для стабильного текста.
CSS — осторожно и только если класс стабильный.
XPath — почти всегда не нужно.
```

---

## 27. Итоговая мысль

`data-testid` — это не «костыль для тестов».  
Это способ честно договориться:

```text
Вот элементы, которые приложение обещает тестам.
Вот имена, которые можно использовать.
Вот контракт, который можно проверять.
```

Но они полезны только тогда, когда используются с умом:

```text
не вместо доступности;
не вместо продуктового смысла;
не на каждый элемент;
не для хранения состояния;
не для динамических идентификаторов;
не вместо ожиданий в тестах.
```

В нашем курсе правило простое:

```text
data-testid — контракт.
Тест — вопрос к продукту.
Ожидание — наблюдаемый факт.
```