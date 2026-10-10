## Задача 42. Изоляция данных

### Зачем эта задача

Если два теста используют одно и второе имя:

```text
Ручка теста
Ручка теста
```

то первый тест может создать товар, а второй упасть с `409`, потому что имя уже занято.

Или наоборот: тесты проходят по одному, но валятся в параллели.

Это задача не про «удалим базу».  
Это задача про уникальные данные.

### Цепочка задачи

```text
Правило продукта:
Имя товара должно быть уникальным.

Риск:
Если тесты используют фиксированные имена,
они начинают мешать друг другу.

Проверка:
Создать два товара с одинаковым именем и увидеть 409.
Затем создать два товара с уникальными именами и увидеть успех.

Наблюдаемый факт:
Дубликат даёт 409.
Уникальные имена не конфликтуют.

Автотест:
Два теста: конфликт и изоляция.
```

### Дано в стиле BDD

```gherkin
Feature: Изоляция данных

  Scenario: Одно имя дважды даёт конфликт
    Given я авторизована как "kira" через API
    When я создаю товар с одним и тем же именем дважды
    Then первый запрос успешен
    And второй запрос получает 409

  Scenario: Уникальные имена не конфликтуют
    Given я авторизована как "kira" через API
    When я создаю два товара через фабрику
    Then оба запроса успешны
```

### Что нужно сделать

1. Показать конфликт: один и тот же `name` дважды.
2. Показать решение: фабрика или уникальный суффикс.
3. Не чистить базу.
4. Не использовать фиксированное имя вида `ручка-теста`, если только не хочешь специально воспроизвести конфликт.

### Пример кода

```ts
import { test, expect } from "@playwright/test";
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

test("одно и то же имя дважды даёт 409", async ({ request }) => {
  await loginAsKira(request);

  const payload = validProduct();

  const first = await request.post("/api/admin/products", {
    data: payload,
  });

  expect(first.status()).toBe(201);

  const second = await request.post("/api/admin/products", {
    data: payload,
  });

  expect(second.status()).toBe(409);

  const body = await second.json();
  expect(body).toHaveProperty("error");
});

test("уникальные имена из фабрики не конфликтуют", async ({ request }) => {
  await loginAsKira(request);

  const firstPayload = validProduct();
  const secondPayload = validProduct();

  const first = await request.post("/api/admin/products", {
    data: firstPayload,
  });

  const second = await request.post("/api/admin/products", {
    data: secondPayload,
  });

  expect(first.status()).toBe(201);
  expect(second.status()).toBe(201);
});
```

### Мини-ревью

1. Тесты могут работать параллельно?
2. Есть ли фиксированные имена, которые могут конфликтовать?
3. Не появляется ли очистка всей базы?

### Сигналы, что задача поехала не туда

- `DELETE FROM products` в `afterEach`.
- Фиксированное имя товара.
- Один тест создаёт товар, а второй молча рассчитывает, что база «как новая».
- Конфликт `409` считается ошибкой теста, хотя это правило продукта.

### Полезные ссылки

- [Best practices](https://playwright.dev/docs/best-practices)
- [API testing](https://playwright.dev/docs/api-testing)

