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

function loadApi(configuredBase, origin, client = null) {
  const source = readFileSync(new URL('../src/api/client.js', import.meta.url), 'utf8')
    .replace("import axios from 'axios';", '')
    .replace('import.meta.env.VITE_API_BASE', 'configuredBase')
    .replace('export const api =', 'const api =')
    .replace('export default api;', 'globalThis.api = api;');
  const context = {
    configuredBase,
    window: { location: { origin } },
    URL,
    axios: { create: options => client || ({ options }) },
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

test('EDL save and task retry use the existing API client', async () => {
  const calls = [];
  const client = {
    put: (...args) => { calls.push(args); },
    post: (...args) => { calls.push(args); },
  };
  const api = loadApi('', 'https://editor.example', client);
  const data = { words: [] };
  await api.saveEDL('task', data);
  await api.retryTask('task');
  assert.equal(calls[0][0], '/api/v1/tasks/task/edl');
  assert.equal(calls[0][1], data);
  assert.equal(calls[1][0], '/api/v1/tasks/task/retry');
});

function saveHandler(context) {
  const handler = editor.match(/const handleSave = async \(\) => \{[\s\S]*?\n {2}\};/)[0];
  vm.runInNewContext(`${handler}\nglobalThis.save = handleSave;`, context);
  return context.save;
}

test('save persists a snapshot without marking newer edits as saved', async () => {
  const words = [{ word: 'old' }];
  let finish;
  let saved;
  const states = [];
  const context = {
    modifiedWords: words, taskId: 'task',
    api: { saveEDL: async (id, data) => {
      assert.equal(id, 'task');
      assert.equal(data.words, words);
      await new Promise(resolve => { finish = resolve; });
      return { data: { words: data.words, duration: 5 } };
    } },
    setSaving: value => states.push(value), setEdl: () => {},
    setSavedWords: value => { saved = value; }, alert: () => {}, console,
  };
  const pending = saveHandler(context)();
  context.modifiedWords = [{ word: 'new' }];
  finish();
  assert.equal((await pending).duration, 5);
  assert.equal(saved, words);
  assert.notEqual(saved, context.modifiedWords);
  assert.deepEqual(states, [true, false]);
});

test('failed save leaves edits dirty and resets saving state', async () => {
  let saved = false;
  const states = [];
  const context = {
    modifiedWords: [], taskId: 'task',
    api: { saveEDL: async () => { throw new Error('offline'); } },
    setSaving: value => states.push(value), setEdl: () => {},
    setSavedWords: () => { saved = true; }, alert: () => {},
    console: { error: () => {} },
  };
  assert.equal(await saveHandler(context)(), null);
  assert.equal(saved, false);
  assert.deepEqual(states, [true, false]);
});

test('export stops when saving fails and uses the saved EDL when successful', async () => {
  const handler = editor.match(/const handleExport = async \(\) => \{[\s\S]*?\n {2}\};/)[0];
  for (const succeeds of [false, true]) {
    const calls = [];
    const saved = { words: [{ word: 'saved' }] };
    const context = {
      edl: {}, modifiedWords: [], taskId: 'task', subtitleEnabled: false,
      exportQuality: 'low', setExporting: value => calls.push(value),
      handleSave: async () => { calls.push('save'); return succeeds ? saved : null; },
      api: {
        exportVideo: async (id, data) => {
          calls.push('export'); assert.equal(data.edl, saved);
          return { data: { export_id: 'export' } };
        },
        getExportStatus: async () => ({ data: { status: 'completed' } }),
        getDownloadUrl: () => 'download',
      },
      alert: () => {}, console, window: { open: () => {} }, setTimeout,
    };
    vm.runInNewContext(`${handler}\nglobalThis.exportNow = handleExport;`, context);
    await context.exportNow();
    assert.equal(calls.includes('export'), succeeds);
    if (succeeds) assert.ok(calls.indexOf('save') < calls.indexOf('export'));
    assert.equal(calls.at(-1), false);
  }
});

test('retry starts the existing polling flow and clears submission state', async () => {
  const home = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
  const handler = home.match(/const handleRetry = async \(taskId\) => \{[\s\S]*?\n {2}\};/)[0];
  const calls = [];
  const context = {
    api: { retryTask: async id => { calls.push(`retry:${id}`); } },
    loadHistoryTasks: async () => { calls.push('history'); },
    setRetryingTask: value => { calls.push(value); },
    setUploading: value => { assert.equal(value, true); },
    setProgressPercent: value => { assert.equal(value, 0); },
    setProgress: () => {}, pollTaskFallback: id => { calls.push(`poll:${id}`); },
    alert: () => { assert.fail('retry must not throw'); },
  };
  vm.runInNewContext(`${handler}\nglobalThis.retry = handleRetry;`, context);
  await context.retry('task');
  assert.deepEqual(calls, ['task', 'retry:task', 'history', 'poll:task', null]);
});

test('Home uses the shared WebSocket URL', () => {
  const home = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
  assert.match(home, /new WebSocket\(api\.getTaskWebSocketUrl\(taskId\)\)/);
  assert.doesNotMatch(home, /hostname \+ ':8000'/);
});
