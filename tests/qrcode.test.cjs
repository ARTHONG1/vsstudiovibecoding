'use strict';
// Checks generated symbols against ISO/IEC 18004 facts. A decoder check
// (zxing-cpp) is described in TESTING.md.
const test = require('node:test');
const assert = require('node:assert/strict');
const { QRCode } = require('../vibe-coding/assets/workspace-extension/extension/qrcode');

function make(text) {
  const qr = new QRCode(0, 1);
  qr.addData(text);
  qr.make();
  return qr;
}

function formatData(qr) {
  const n = qr.getModuleCount();
  let value = 0;
  for (let i = 0; i < 15; i++) {
    const dark = i < 6 ? qr.isDark(i, 8) : i < 8 ? qr.isDark(i + 1, 8) : qr.isDark(n - 15 + i, 8);
    if (dark) value |= 1 << i;
  }
  return (value ^ 0x5412) >> 10;
}

test('format information declares level L, the level used to encode the data', () => {
  for (const length of [60, 126, 140]) assert.equal(formatData(make('a'.repeat(length))) >> 3, 0b01);
});

test('byte capacity follows the level L table', () => {
  assert.equal(make('a'.repeat(106)).typeNumber, 5);
  assert.equal(make('a'.repeat(134)).typeNumber, 6);
  assert.equal(make('a'.repeat(135)).typeNumber, 7);
  assert.equal(make('a'.repeat(154)).typeNumber, 7);
  assert.equal(make('a'.repeat(155)).typeNumber, 8);
});

test('version 7 and above carry both standard version information blocks', () => {
  const qr = make('a'.repeat(140));
  const n = qr.getModuleCount();
  let upperRight = 0;
  let lowerLeft = 0;
  for (let i = 0; i < 18; i++) {
    if (qr.isDark(Math.floor(i / 3), i % 3 + n - 11)) upperRight |= 1 << i;
    if (qr.isDark(i % 3 + n - 11, Math.floor(i / 3))) lowerLeft |= 1 << i;
  }
  assert.equal(qr.typeNumber, 7);
  assert.equal(upperRight, 0x07C94);
  assert.equal(lowerLeft, 0x07C94);
});
