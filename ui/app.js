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