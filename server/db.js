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