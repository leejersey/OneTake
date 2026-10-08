import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

async function helpers() {
  return import('../src/utils/editor.js').catch(() => assert.fail('Editor helpers are missing'));
}
const words = JSON.parse(readFileSync(new URL('../../tests/fixtures/caption_words.json', import.meta.url)));

test('sentence grouping matches backend captions and includes deleted boundary tokens', async () => {
  const { groupSentences, captionTextAt } = await helpers();
  const groups = groupSentences(words);
  assert.deepEqual(groups.map(group => group.map(item => item.word.word)), [
    ['大家', '好。'], ['删', '第一', '句'], ['下一', '句！'], ['尾巴']]);
  assert.equal(captionTextAt(groups, 0.2), '大家好。');
  assert.equal(captionTextAt(groups, 0.95), '第一句');
  assert.equal(captionTextAt(groups, 1.5), '');
  assert.equal(captionTextAt(groups, 2.3), '下一句！');
  assert.deepEqual(groupSentences(Array.from({ length: 19 }, (_, i) => ({
    word: 'a', start: i / 10, end: (i + 1) / 10,
  }))).map(group => group.length), [18, 1]);
});

test('input, textarea, select and contenteditable retain native keyboard behavior', async () => {
  const { isEditingTarget } = await helpers();
  for (const tag of ['INPUT', 'TEXTAREA', 'SELECT']) {
    assert.equal(isEditingTarget({ tagName: tag }), true);
  }
  assert.equal(isEditingTarget({ tagName: 'SPAN', isContentEditable: true }), true);
  assert.equal(isEditingTarget({ tagName: 'SPAN' }), false);
});

test('audio export is blocked in handler and button', () => {
  const editor = readFileSync(new URL('../src/pages/Editor.jsx', import.meta.url), 'utf8');
  assert.match(editor, /if \(!isVideoFile\) return;/);
  assert.match(editor, /disabled=\{exporting \|\| saving \|\| !isVideoFile\}/);
});

test('space on a button retains native activation', async () => {
  const { isEditingTarget } = await helpers();
  const editor = readFileSync(new URL('../src/pages/Editor.jsx', import.meta.url), 'utf8');
  const handler = editor.match(/const handleKeyDown = \(e\) => \{[\s\S]*?\n {4}\};/)[0];
  let prevented = false;
  let played = false;
  const context = {
    isEditingTarget, videoRef: { current: { getIsPlaying: () => false, play: () => { played = true; } } },
    waveformRef: { current: null },
  };
  vm.runInNewContext(`${handler}\nglobalThis.keydown = handleKeyDown;`, context);
  context.keydown({ key: ' ', target: { tagName: 'BUTTON', closest: () => ({}) },
                    preventDefault: () => { prevented = true; } });
  assert.equal(prevented, false);
  assert.equal(played, false);
});

test('sentence audition starts a bounded range and ignores zero-duration blocks', async () => {
  const editor = readFileSync(new URL('../src/pages/Editor.jsx', import.meta.url), 'utf8');
  const handler = editor.match(/const handleSentencePlay = async \(block\) => \{[\s\S]*?\n {2}\};/)[0];
  const calls = [];
  const context = {
    videoRef: { current: { playRange: async (...args) => calls.push(args) } },
    waveformRef: { current: null }, setSelectedWordIndex: () => {},
    alert: () => assert.fail('audition should not throw'),
  };
  vm.runInNewContext(`${handler}\nglobalThis.audition = handleSentencePlay;`, context);
  await context.audition([{ index: 0, word: { start: 1, end: 2 } }]);
  assert.deepEqual(calls, [[1, 2]]);
  await context.audition([{ index: 0, word: { start: 0, end: 0 } }]);
  assert.equal(calls.length, 1);
});

test('narrow workspace overrides fixed desktop dimensions', () => {
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  assert.match(css, /@media\s*\(max-width:\s*900px\)/);
  assert.match(css, /\.editor-workspace[^}]*flex-direction:\s*column/);
  assert.match(css, /\.editor-sidebar[^}]*min-width:\s*0/);
});

test('waveform catches cancelled loads without hiding real errors', () => {
  const source = readFileSync(new URL('../src/components/WaveformPlayer.jsx', import.meta.url), 'utf8');
  assert.match(source, /load\(audioUrl\)\.catch\(/);
  assert.match(source, /AbortError/);
  assert.match(source, /setLoadError/);
});
