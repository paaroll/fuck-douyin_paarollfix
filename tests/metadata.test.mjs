import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../dist/douyin-paarollfix.user.js', import.meta.url), 'utf8');
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const header = source.match(/\/\/ ==UserScript==([\s\S]*?)\/\/ ==\/UserScript==/)[1];
const values = key => [...header.matchAll(new RegExp(`^// @${key}\\s+(.+)$`, 'gm'))].map(match => match[1].trim());

test('published identity belongs to the fork and upstream updates are disabled', () => {
  assert.deepEqual(values('name'), ['抖音净化 paaroll 修复版']);
  assert.deepEqual(values('namespace'), [pkg.homepage]);
  assert.deepEqual(values('homepageURL'), [pkg.homepage]);
  assert.deepEqual(values('supportURL'), [pkg.bugs.url]);
  assert.deepEqual(values('downloadURL'), ['none']);
  assert.deepEqual(values('updateURL'), ['none']);
});

test('version and complete MIT notice are included in the standalone script', () => {
  assert.deepEqual(values('version'), [pkg.version]);
  assert.deepEqual(values('license'), ['MIT']);
  assert.ok(source.includes('Copyright (c) wan-kong and contributors'));
  assert.ok(source.includes('Copyright (c) 2026 paaroll (fork modifications)'));
  assert.ok(source.includes('Permission is hereby granted, free of charge'));
  assert.ok(source.includes('THE SOFTWARE IS PROVIDED "AS IS"'));
  assert.equal(source.includes('v0.1.0'), false);
});

test('build retains only the original userscript permissions and Vue requirement', () => {
  assert.deepEqual(values('grant').sort(), ['GM_addStyle', 'GM_getValue', 'GM_setValue']);
  assert.equal(values('require').length, 1);
  assert.match(values('require')[0], /^https:\/\/cdn\.jsdelivr\.net\/npm\/vue@/);
  assert.deepEqual(values('match').sort(), [
    'https://*.douyin.com/*', 'https://douyin.com/*',
    'https://live.douyin.com/*', 'https://www.douyin.com/*',
  ]);
});

test('release script contains no workstation paths or test instrumentation', () => {
  assert.doesNotMatch(source, /[A-Z]:[\\/](?:Users|chromescripts)[\\/]/i);
  assert.doesNotMatch(source, /__fdTestFocused|window\.testFocus|DEBUG-/);
});
