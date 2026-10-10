## Задача 17. Чтобы в отчёте было что читать

### Зачем эта задача

Когда тест зелёный, его структура кажется очевидной.  
Когда он падает, важно понять:

- где он шёл;
- какое действие выполнял;
- на каком ожидании упал.

`test.step` делает прогон читаемым.  
Он не заменяет хорошую структуру теста, а показывает её в отчёте.

### Цепочка задачи

```text
Правило продукта:
Пользователь с верными данными входит и видит свою роль.

Риск:
Если тест падает без шагов, разработчик видит только строку кода
и не понимает, что именно пошло не так.

Проверка:
Вход Анны, разложенный на понятные шаги.

Наблюдаемый факт:
Тест зелёный, а в отчёте видны именованные шаги.

Автотест:
Тот же вход, но с test.step.
```

### Дано в стиле BDD

```gherkin
Feature: Вход покупателя с читаемыми шагами

  Scenario: Шаги прогона соответствуют сценарию входа
    Given я гость на странице входа
    When я ввожу логин "anna" и пароль "anna-pass"
    And нажимаю «Войти»
    Then я оказываюсь в каталоге
    And в шапке виден бейдж роли "user"
    And пункта «Товары» нет
```

### Что нужно сделать

Взять тест входа Анны и разложить его на шаги:

1. открыть страницу входа;
2. ввести логин и пароль;
3. нажать кнопку входа;
4. проверить каталог и шапку покупателя.

Не нужно добавлять новые проверки.  
Не нужно использовать `waitForTimeout`.

### Пример кода

```ts
import { test, expect } from '@playwright/test';

test('Анна входит как покупатель', async ({ page }) => {
  await test.step('открыть страницу входа', async () => {
    await page.goto('/login');
    await expect(page.getByTestId('login-form')).toBeVisible();
  });

  await test.step('ввести данные Анны', async () => {
    await page.getByTestId('login-input').fill('anna');
    await page.getByTestId('password-input').fill('anna-pass');
  });

  await test.step('нажать кнопку входа', async () => {
    await page.getByTestId('login-submit').click();
  });

  await test.step('проверить каталог и шапку покупателя', async () => {
    await expect(page).toHaveURL(/\/catalog/);
    await expect(page.getByTestId('role-badge')).toHaveText(/user/i);
    await expect(page.getByTestId('nav-admin-products')).toHaveCount(0);
    await expect(page.getByTestId('app-error')).toBeHidden();
  });
});
```

### Мини-ревью

1. Шаги читаются как сценарий или как технический лог?
2. Есть ли шаг без `await` внутри?
3. Не добавились ли новые проверки «заодно»?

### Что обычно делают не так

- Один шаг на весь тест.
- Названия вроде `step 1`, `step 2`, `проверка`.
- Внутри шага нет `await`, и шаг становится мёртвым.
- В шагах появляются новые проверки, которых не было в исходной задаче.

### Полезные ссылки

- [test.step](https://playwright.dev/docs/api/class-test#test-step)
- [Playwright Assertions](https://playwright.dev/docs/test-assertions)

