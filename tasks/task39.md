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

