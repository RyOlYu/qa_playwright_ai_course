## Задача 18. Три вопроса — три входа

### Зачем эта задача

Если один тест делает вход, поиск и профиль, то при падении профиля непонятно, работал ли поиск.  
И наоборот: если поиск упадёт, профиль уже не будет проверен отдельно.

Пока каждый тест входит сам.  
Да, это медленнее. Сейчас это намеренно.

### Цепочка задачи

```text
Правило продукта:
Вход, поиск и профиль — разные правила продукта.

Риск:
Если склеить их в один тест, падение одного правила
замаскирует или испортит проверку другого.

Проверка:
Три отдельных теста: вход, поиск, профиль.

Наблюдаемый факт:
Каждый тест можно запустить отдельно,
и каждый сам приводит себя в нужное состояние.

Автотест:
Три отдельных test() без общего браузера и без общего входа.
```

### Дано в стиле BDD

```gherkin
Feature: Независимые проверки витрины

  Scenario: Покупатель входит
    Given я гость на странице входа
    When я вхожу как "anna" с паролем "anna-pass"
    Then я оказываюсь в каталоге
    And в шапке виден бейдж роли "user"

  Scenario: Поиск по подстроке
    Given я вошёл как "anna"
    When я ищу "тетра"
    Then в таблице есть строки
    And каждая видимая строка содержит "тетра"

  Scenario: Профиль уже заполнен
    Given я вошёл как "anna"
    When я открываю профиль
    Then форма профиля видна
    And имя, фамилия и email не пустые
```

### Что нужно сделать

Сделать три отдельных теста в одном файле:

1. вход Анны;
2. поиск `тетра`;
3. профиль Анны.

Каждый тест сам выполняет вход.  
Нельзя использовать:

- общий `page` на три теста;
- `beforeAll` с одним входом;
- `test.describe.serial` как замену изоляции.

Локальная функция `loginAsAnna` допустима.  
Это не фикстура и не Page Object, просто способ не копировать одни и те же строки.

### Пример кода

```ts
import { test, expect } from '@playwright/test';

async function loginAsAnna(page) {
  await page.goto('/login');

  await page.getByTestId('login-input').fill('anna');
  await page.getByTestId('password-input').fill('anna-pass');
  await page.getByTestId('login-submit').click();

  await expect(page).toHaveURL(/\/catalog/);
}

test('Анна входит как покупатель', async ({ page }) => {
  await loginAsAnna(page);

  await expect(page.getByTestId('role-badge')).toHaveText(/user/i);
  await expect(page.getByTestId('nav-admin-products')).toHaveCount(0);
});

test('поиск "тетра" оставляет только подходящие строки', async ({ page }) => {
  await loginAsAnna(page);

  const search = page.getByTestId('catalog-search');

  await search.fill('тетра');
  await search.press('Enter');

  const rows = page.getByTestId('catalog-row');

  await expect(rows).not.toHaveCount(0);

  const count = await rows.count();

  for (let i = 0; i < count; i += 1) {
    await expect(rows.nth(i)).toContainText(/тетра/i);
  }
});

test('профиль Анны не пустой', async ({ page }) => {
  await loginAsAnna(page);

  await page.getByTestId('nav-profile').click();

  await expect(page).toHaveURL(/\/profile/);
  await expect(page.getByTestId('profile-form')).toBeVisible();

  await expect(page.getByTestId('profile-first-name')).not.toHaveValue('');
  await expect(page.getByTestId('profile-last-name')).not.toHaveValue('');
  await expect(page.getByTestId('profile-email')).not.toHaveValue('');
});
```

### Мини-ревью

1. Можно ли запустить только второй тест, и он сам войдёт?
2. Падение профиля не ломает проверку поиска?
3. Нет ли общего состояния, которое делает тесты зависимыми?

### Что обычно делают не так

- Один тест на вход, поиск и профиль.
- `beforeAll`, который логинит один раз на все тесты.
- Третий тест без логина, потому что «второй уже вошёл».
- Общий `page`, который вручную передают между тестами.

### Полезные ссылки

- [Playwright Test Isolation](https://playwright.dev/docs/test-configuration)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)

