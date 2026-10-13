import { execSync, spawn } from 'node:child_process';
import { exit } from 'node:process';
//@ts-ignore
import waitOn from 'wait-on';

async function run() {
    const port = 3005;
    try {
        await fetch('http://localhost:' + port +'/api/_stop_server', { method: 'POST', body: '' });
    } catch (error) {
    }
    const process = spawn(`npm`, [
        'run',
        'start:server',
        '--',
        '--port=' + port
    ], { stdio: 'inherit' });
    await waitOn({ resources: ['http://localhost:' + port], timeout: 10_000 },);
    execSync(
        'npm run playwright -- test --ui --config=./playwright.config.ts',
        { stdio: 'inherit' }
    );
    process.kill();
    exit();
}

run();