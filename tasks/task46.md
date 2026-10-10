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

