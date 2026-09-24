const crypto = require("node:crypto");
const { nextId, nowIso } = require("./db");
const { sendError } = require("./http");

export function parseCookies(req) {
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

export function parseSid(req) {
    return parseCookies(req).sid ?? null;
}

export function createSession(db, userId) {
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

export function findUserBySid(db, req) {
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

export function requireUser(db, req, res) {
    const user = findUserBySid(db, req);

    if (!user) {
        sendError(res, 401, "UNAUTHORIZED", "Требуется вход");
        return null;
    }

    return user;
}

export function requireAdmin(db, req, res) {
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

export function publicUser(user) {
    return {
        id: user.id,
        login: user.login,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
    };
}