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

