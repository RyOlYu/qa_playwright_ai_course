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

