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

