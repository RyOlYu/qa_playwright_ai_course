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

