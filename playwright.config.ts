import { defineConfig } from '@playwright/test';
import { join } from 'node:path';

export default defineConfig({
    // testDir: join(__dirname, 'tests'),
    testDir: join(__dirname),
    reporter: [
        ['line'], // в консоль во время прогона
        ['html', {
            outputFolder: 'playwright-report', // папка (по умолчанию)
            open: 'never', // 'always' | 'never' | 'on-failure'
        }],
        ['allure-playwright', {
            detail: true, // шаги внутри теста
            outputFolder: 'allure-results', // сырые JSON файлы
            suiteTitle: false, // не дублировать describe в заголовке
        }],
    ],
    timeout: 600_000,
    globalTimeout: 600_000,
    webServer: {
        command: 'npm run start:server'
    },
    use: {
        screenshot: 'on',
        trace: 'on',
        // testIdAttribute: TEST_ID_ATTR,
        defaultBrowserType: 'chromium',
        browserName: 'chromium',
        // показывать браузер визуально или нет
        headless: true,
        launchOptions: {
            args: [
                '--no-sandbox',
                /** window width / height */
                '--window-size=1920,1080',
                /** open devtools by default */
                // '--auto-open-devtools-for-tabs'
            ],
            executablePath: join('C:', 'chrome', 'chrome.exe'),
            timeout: 600_000,
            // slowMo: 1000
        },
        // contextOptions: {
        //     viewport: null,
        //     baseURL: TEST_BASE_URL
        // }
    },
});
