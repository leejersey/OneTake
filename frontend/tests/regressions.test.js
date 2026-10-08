import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const editor = readFileSync(new URL('../src/pages/Editor.jsx', import.meta.url), 'utf8');

// Run the existing handlers without introducing a JSX test framework.
function runHandler(name, words, argument) {
  const handler = editor.match(new RegExp(`const ${name} = \\([^)]*\\) => \\{[\\s\\S]*?\\n  \\};`))[0];
  let result;
  let saved;
  const context = {
    modifiedWords: words,
    setModifiedWords: value => { result = value; },
    saveToHistory: value => { saved = value; },
    argument,
  };
  vm.runInNewContext(`${handler}\n${name}(argument);`, context);
  assert.equal(result, saved);
  return result;
}

test('single-word restore clears automatic deletion and can be toggled again', () => {
  const original = [{ word: 'um', auto_delete: true, user_delete: false }];
  const restored = runHandler('toggleWordDelete', original, 0);
  assert.equal(restored[0].auto_delete, false);
  assert.equal(restored[0].user_delete, false);
  assert.equal(original[0].auto_delete, true);
  assert.equal(runHandler('toggleWordDelete', restored, 0)[0].user_delete, true);
});

test('batch filler restore clears automatic deletion without changing normal words', () => {
  const normal = { type: 'normal', user_delete: true };
  const result = runHandler('toggleAllFillers', [
    { type: 'filler', auto_delete: true }, normal,
  ], false);
  assert.equal(result[0].auto_delete, false);
  assert.equal(result[0].user_delete, false);
  assert.equal(result[1], normal);
  assert.equal(runHandler('toggleAllFillers', result, true)[0].user_delete, true);
});

function loadApi(configuredBase, origin) {
  const source = readFileSync(new URL('../src/api/client.js', import.meta.url), 'utf8')
    .replace("import axios from 'axios';", '')
    .replace('import.meta.env.VITE_API_BASE', 'configuredBase')
    .replace('export const api =', 'const api =')
    .replace('export default api;', 'globalThis.api = api;');
  const context = {
    configuredBase,
    window: { location: { origin } },
    URL,
    axios: { create: options => ({ options }) },
  };
  vm.runInNewContext(source, context);
  return context.api;
}

for (const [base, origin, expected] of [
  ['', 'http://localhost:5173', 'ws://localhost:5173/ws/tasks/task-id'],
  ['', 'https://editor.example:8443', 'wss://editor.example:8443/ws/tasks/task-id'],
  ['https://api.example:9443/', 'https://editor.example', 'wss://api.example:9443/ws/tasks/task-id'],
  ['http://localhost:9000', 'http://localhost:5173', 'ws://localhost:9000/ws/tasks/task-id'],
  ['/backend/', 'https://editor.example', 'wss://editor.example/backend/ws/tasks/task-id'],
]) {
  test(`WebSocket uses API base ${base || '(same origin)'} at ${origin}`, () => {
    const api = loadApi(base, origin);
    assert.equal(api.getTaskWebSocketUrl('task-id'), expected);
    assert.equal(api.getDownloadUrl('export-id'),
      `${base.replace(/\/$/, '')}/api/v1/exports/export-id/download`);
  });
}

test('same-origin Nginx proxy allows the existing 500 MiB upload limit', () => {
  const nginx = readFileSync(new URL('../nginx.conf', import.meta.url), 'utf8');
  assert.match(nginx, /client_max_body_size 501m;/);
});

test('Home uses the shared WebSocket URL', () => {
  const home = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
  assert.match(home, /new WebSocket\(api\.getTaskWebSocketUrl\(taskId\)\)/);
  assert.doesNotMatch(home, /hostname \+ ':8000'/);
});
