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

