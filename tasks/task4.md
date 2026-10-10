## Задача 4. Форма входа просто на месте

### Зачем эта задача

Перед тем как тестировать вход, нужно убедиться, что форма входа вообще соответствует контракту.  
Контракт здесь — это обещание приложения: у поля логина есть `login-input`, у поля пароля есть `password-input`, у кнопки входа есть `login-submit`.

Если этих элементов нет, то проблема не в тесте, а в приложении или в карте селекторов.

### Немного теории своими словами

Локатор — это способ найти элемент на странице.

Плохой локатор:

```js
.page form input:nth-child(1)
```

Почему плохо:

- опирается на структуру вёрстки;
- легко ломается;
- непонятен по смыслу.

Хороший локатор в нашем учебном приложении:

```js
page.getByTestId('login-input')
```

Почему лучше:

- он основан на специальном атрибуте `data-testid`;
- он создан именно для тестов;
- он не зависит от случайных классов и положения элемента.

Проверки вроде `toBeVisible()` называются **web-first assertions**.  
Они не просто мгновенно читают текущее состояние, а ждут разумное время, пока условие не станет истинным.

### Дано в стиле BDD

```gherkin
Feature: Страница входа

  Scenario: Форма входа содержит ожидаемые тестовые идентификаторы
    Given я гость
    And я открываю страницу "/login"
    When страница входа загрузилась
    Then я вижу форму входа с тестовым идентификатором "login-form"
    And я вижу поле логина с тестовым идентификатором "login-input"
    And я вижу поле пароля с тестовым идентификатором "password-input"
    And я вижу кнопку входа с тестовым идентификатором "login-submit"
```

### Что нужно сделать

Написать автотест, который:

1. открывает `/login`;
2. проверяет видимость `login-form`;
3. проверяет видимость `login-input`;
4. проверяет видимость `password-input`;
5. проверяет видимость `login-submit`.

Пароль вводить не нужно.  
Каталог открывать не нужно.  
Логиниться не нужно.

### Пример решения

```ts
import { test, expect } from '@playwright/test';

test('форма входа видна по тестовым идентификаторам', async ({ page }) => {
  await page.goto('/login');

  await expect(page.getByTestId('login-form')).toBeVisible();
  await expect(page.getByTestId('login-input')).toBeVisible();
  await expect(page.getByTestId('password-input')).toBeVisible();
  await expect(page.getByTestId('login-submit')).toBeVisible();
});
```

### Что считается сделанным

Сделано, если:

- тест открывает `/login`;
- все элементы ищутся через `getByTestId`;
- нет поиска по CSS-классу;
- нет поиска по `div > input`;
- нет проверки только `page.title()`;
- нет логина;
- тест зелёный.

### Анти-паттерны

Плохо:

```ts
await expect(page.locator('.form-control')).toBeVisible();
```

Плохо:

```ts
await expect(page.locator('form input')).toHaveCount(2);
```

Плохо:

```ts
await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();
```

Последний вариант сам по себе не ужасен, но в этой задаче мы сознательно тренируем контракт `data-testid`.

### Полезные ссылки

- [Playwright Locators](https://playwright.dev/docs/locators)
- [Locate by test id](https://playwright.dev/docs/locators#locate-by-test-id)
- [Playwright Assertions](https://playwright.dev/docs/test-assertions)

