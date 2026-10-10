## Задача 41. Фабрика товара

### Зачем эта задача

К задаче 40 уже видно, что каждый раз собирать руками один и тот же товар — плохо.

```ts
{
  name: "marker-...",
  description: "Учебный товар",
  price: 15000,
  category: "pens",
  stock: 3,
}
```

Такой JSON начинает копипаститься.  
А копипаста данных — это будущие конфликты, опечатки и тесты, которые падают по непонятной причине.

Нужна фабрика.

### Цепочка задачи

```text
Правило продукта:
Админ может создавать товары.

Риск:
Если тесты собирают тело товара руками, они начинают плодить дубликаты
и ошибаться в обязательных полях.

Проверка:
Сделать функцию, которая возвращает валидное тело товара
и позволяет переопределить нужные поля.

Наблюдаемый факт:
Товар, собранный фабрикой, успешно создаётся через API.

Автотест:
Создать товар через фабрику и проверить 201.
```

### Дано в стиле BDD

```gherkin
Feature: Фабрика товара

  Scenario: Тест не собирает товар руками
    Given мне нужно создать товар через API
    When я использую фабрику валидного товара
    Then получаю тело с уникальным именем
    And товар успешно создаётся
```

### Что нужно сделать

Создать файл:

```text
builders/product.ts
```

Минимум:

- генератор уникального имени;
- функция `validProduct`;
- возможность переопределить поля: `name`, `price`, `category`, `stock`, `description`.

Не нужно:

- делать огромный универсальный билдер на все сущности;
- сразу тащить сюда Анну, Киру и каталог;
- чистить базу.

### Пример `builders/product.ts`

```ts
export function uniqueProductName(prefix = "product") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function validProduct(overrides = {}) {
  return {
    name: overrides.name ?? uniqueProductName(),
    description: overrides.description ?? "Учебный товар",
    price: overrides.price ?? 10000,
    category: overrides.category ?? "other",
    stock: overrides.stock ?? 5,
  };
}
```

Если используешь TypeScript, можно добавить типы:

```ts
type ProductPayload = {
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
};

export function validProduct(overrides: Partial<ProductPayload> = {}): ProductPayload {
  return {
    name: overrides.name ?? uniqueProductName(),
    description: overrides.description ?? "Учебный товар",
    price: overrides.price ?? 10000,
    category: overrides.category ?? "other",
    stock: overrides.stock ?? 5,
  };
}
```

### Пример теста

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

test("фабрика товара создаёт валидный товар", async ({ request }) => {
  await loginAsKira(request);

  const payload = validProduct({
    price: 0,
  });

  const response = await request.post("/api/admin/products", {
    data: payload,
  });

  expect(response.status()).toBe(201);

  const body = await response.json();

  expect(body.name).toBe(payload.name);
  expect(body.price).toBe(0);
});
```

### Мини-ревью

1. Фабрика возвращает валидное тело?
2. Можно ли переопределить только одно поле?
3. Есть ли уникальное имя по умолчанию?

### Сигналы, что задача поехала не туда

- Фабрика сама отправляет запрос.
- Фабрика знает про Анну или Киру.
- Имя товара фиксированное.
- Внутри фабрики есть `expect`.
- Появился `ProductBuilder` на 200 методов, хотя хватает одной функции.

### Полезные ссылки

- [API testing](https://playwright.dev/docs/api-testing)
- [Best practices](https://playwright.dev/docs/best-practices)

