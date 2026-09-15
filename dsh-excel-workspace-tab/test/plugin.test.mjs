import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8');
let record;
const styles = [];
vm.runInNewContext(source, {
  window: { __ModuleLoader__: { load(value) { record = value; } } },
  DOMException,
  document: {
    head: { appendChild(style) { styles.push(style); } },
    createElement() { return { dataset: {}, remove() { styles.pop(); } }; },
  },
});
const plugin = record.factory((name) => {
  assert.equal(name, 'react');
  return {};
});

test('client bundle registers the sidebar entry and matching main panel', () => {
  assert.equal(record.id, 'dsh-excel-workspace-tab');
  const registrations = [];
  const disposers = [];
  const context = {
    effect(callback) { disposers.push(callback()); },
    slots: {
      inject(_slot, callback) { return callback(); },
      register(options) { registrations.push(options); return () => {}; },
    },
    remote: { workspaceFiles: { list: async () => ({ ok: true, value: { entries: [], truncated: false } }) } },
  };
  plugin.apply(context);
  assert.deepEqual(Array.from(registrations, ({ name, id, key }) => ({ name, id, key })), [
    { name: 'sidebar.panellist', id: 'excel-workspace', key: undefined },
    { name: 'main', id: undefined, key: 'excel-workspace' },
  ]);
  assert.equal(styles.length, 1);
  disposers.forEach((dispose) => dispose?.());
  assert.equal(styles.length, 0);
});

test('recursively lists supported Excel files and skips temporary locks', async () => {
  const tree = {
    '/work': [{ name: 'a.xlsx', type: 'file', size: 12 }, { name: 'data', type: 'directory' }, { name: '~$draft.xls', type: 'file' }],
    '/work/data': [{ name: 'B.XLSM', type: 'file', size: 50 }, { name: 'notes.csv', type: 'file' }, { name: 'c.xlsb', type: 'file' }, { name: 'linked.xls', type: 'symlink' }],
  };
  const paths = [];
  const result = await plugin.scanExcelFiles(async (id, path) => {
    assert.equal(id, 'session-1');
    paths.push(path);
    return { ok: true, value: { entries: tree[path], truncated: false } };
  }, 'session-1', '/work', new AbortController().signal);
  assert.deepEqual(paths, ['/work', '/work/data']);
  assert.deepEqual(Array.from(result.files, (file) => file.relative), ['a.xlsx', 'data/B.XLSM', 'data/c.xlsb']);
  assert.equal(result.directories, 2);
  assert.equal(result.truncated, false);
});

test('reports truncated and unreadable directories without hiding successful files', async () => {
  const result = await plugin.scanExcelFiles(async (_id, path) =>
    path === '/work'
      ? { ok: true, value: { entries: [{ name: 'ok.xls', type: 'file' }, { name: 'private', type: 'directory' }], truncated: true } }
      : { ok: false, error: { code: 'workspace-file/not-directory' } },
  'session-1', '/work', new AbortController().signal);
  assert.equal(result.files.length, 1);
  assert.equal(result.truncated, true);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].path, 'private');
});
