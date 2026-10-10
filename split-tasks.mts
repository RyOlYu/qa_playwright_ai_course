import { readFileSync, writeFileSync } from "node:fs";

const startLine = '## Задача ';
const endTask = '---';

const endLine = '## Финальная рамка всего курса';

const lines = readFileSync('./ai-creating-course-dialog.md').toString().split('\n');

let currentTaskIdx = 2;
lines.forEach((l, idx, arr) => {
    if (l.includes(startLine + currentTaskIdx)) {
        let currentLineIdx = idx;
        let task = '';
        while (!arr[currentLineIdx].startsWith(endTask) && (currentLineIdx < idx + 5000) ) {
            console.log('------', arr[currentLineIdx]);
            task += arr[currentLineIdx] + '\n';
            currentLineIdx = currentLineIdx + 1;
        }

        writeFileSync('./task' + (currentTaskIdx) + '.md', task);
        currentTaskIdx++;
    }
});