## Задача 15. Выйти — значит сессии нет

### Зачем эта задача

Кнопка «Выйти» — это не просто смена экрана.  
После выхода пользователь снова становится гостем.

Самый коварный случай — браузерная кнопка «назад».  
Если после выхода назад открывает каталог как авторизованную страницу, это не «кэш и ладно», а нарушение правила: гость не должен видеть каталог.

### Цепочка задачи

```text
Правило продукта:
После выхода сессия больше не даёт доступ к каталогу.

Риск:
Если после выхода каталог остаётся доступным через «назад»,
пользователь может подумать, что вход всё ещё активен.

Проверка:
Войти, выйти, попробовать открыть каталог напрямую.
Отдельно проверить поведение «назад».

Наблюдаемый факт:
Прямой заход в /catalog ведёт на страницу входа.
После «назад» пользователь не должен оставаться авторизованным.

Автотест:
Два сценария: прямой заход после выхода и назад после выхода.
```

### Дано в стиле BDD

```gherkin
Feature: Выход завершает сессию

  Scenario: Прямой заход в каталог после выхода требует вход
    Given я вошёл как "anna"
    When я нажимаю «Выйти»
    Then я оказываюсь на странице входа
    When я открываю "/catalog" напрямую
    Then я снова оказываюсь на странице входа

  Scenario: Назад после выхода не оставляет авторизованную витрину
    Given я вошёл как "anna"
    When я нажимаю «Выйти»
    And нажимаю назад в браузере
    Then я не вижу авторизованный каталог
    And я вижу страницу входа
```

### Что нужно сделать

Сделать два теста:

1. Войти как `anna`, выйти, затем открыть `/catalog` через `goto`.  
   Ожидание: снова страница входа.

2. Войти как `anna`, выйти, нажать `goBack()`.  
   Ожидание: пользователь не остаётся в авторизованном каталоге.

Не нужно лечить возможный баг через `reload()` или искусственные паузы.  
Если «назад» показывает каталог, это факт, который нужно зафиксировать.

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

test('после выхода прямой заход в каталог ведёт на страницу входа', async ({ page }) => {
  await loginAsAnna(page);

  await page.getByTestId('nav-logout').click();
  await expect(page).toHaveURL(/\/login/);

  await page.goto('/catalog');

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByTestId('login-form')).toBeVisible();
});

test('назад после выхода не показывает авторизованный каталог', async ({ page }) => {
  await loginAsAnna(page);

  await page.getByTestId('nav-logout').click();
  await expect(page).toHaveURL(/\/login/);

  await page.goBack();

  await expect(page.getByTestId('login-form')).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('nav-logout')).toHaveCount(0);
});
```

### Мини-ревью

1. Тест проверяет выход как завершение сессии или только исчезновение кнопки?
2. Если «назад» покажет каталог, тест упадёт?
3. Не маскируем ли мы возможный баг через `reload()`?

### Что обычно делают не так

- Проверяют только, что после выхода открылся `/login`.
- Не проверяют прямой заход в `/catalog`.
- Делают `goBack()` и сразу проверяют `catalog` без ожидания переадресации.
- Прячут нестабильность или баг через `page.reload()`.

### Полезные ссылки

- [Playwright Assertions](https://playwright.dev/docs/test-assertions)
- [Playwright Actionability](https://playwright.dev/docs/actionability)

