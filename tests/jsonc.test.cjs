'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { readObject, updateObjectText } = require('../vibe-coding/scripts/jsonc.cjs');

function fixture(t, text) {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-jsonc-'));
    t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
    const file = path.join(directory, 'settings.json');
    if (text !== undefined) fs.writeFileSync(file, text, 'utf8');
    return file;
}

test('readObject returns an empty object only for an absent file', t => {
    assert.deepEqual(readObject(fixture(t)), {});
});

test('readObject parses comments and trailing commas without altering quoted punctuation', t => {
    const text = `{
    // These strings are not comments or trailing commas.
    "url": "https://example.test/a//b",
    "punctuation": ",} ,] /* literal */",
    "escaped": "quote: \\" // literal",
    "items": [1, 2,],
    "nested": {"enabled": true,},
}`;
    assert.deepEqual(readObject(fixture(t, text)), {
        url: 'https://example.test/a//b',
        punctuation: ',} ,] /* literal */',
        escaped: 'quote: " // literal',
        items: [1, 2],
        nested: { enabled: true }
    });
});

test('readObject accepts a UTF-8 BOM and CRLF', t => {
    assert.deepEqual(readObject(fixture(t, '\uFEFF{\r\n    "enabled": true,\r\n}\r\n')), { enabled: true });
});

test('readObject rejects malformed JSONC instead of accepting recovered values', t => {
    for (const text of ['{"a": }', '{"a": 1 "b": 2}', '{"a": 1,,}', '{"a": 1', '{} garbage', '{/* unfinished', '{"a": "unterminated}', '{"a": 01}']) {
        const file = fixture(t, text);
        assert.throws(() => readObject(file), SyntaxError);
        assert.equal(fs.readFileSync(file, 'utf8'), text);
    }
});

test('readObject rejects non-object and empty existing files', t => {
    for (const text of ['[]', '[{}]', 'null', 'true', '42', '"string"', '', ' \r\n', '// comment only\n']) {
        assert.throws(() => readObject(fixture(t, text)), SyntaxError);
    }
});

test('readObject propagates filesystem errors other than missing files', t => {
    const file = fixture(t);
    fs.mkdirSync(file);
    assert.throws(() => readObject(file), error => error.code !== 'ENOENT');
});

test('updateObjectText initializes empty text with four spaces and a final newline', () => {
    const expected = '{\n    "nested": {\n        "enabled": true\n    }\n}\n';
    assert.equal(updateObjectText('', { nested: { enabled: true } }), expected);
    assert.equal(updateObjectText('   \n', { nested: { enabled: true } }), expected);
});

test('updateObjectText preserves BOM and CRLF when initializing blank text', () => {
    assert.equal(updateObjectText('\uFEFF \r\n', { enabled: true }), '\uFEFF{\r\n    "enabled": true\r\n}\r\n');
});

test('updateObjectText changes a scalar without touching unrelated comments or spacing', () => {
    const text = '// Header\n{\n  "enabled" : false, // Keep inline\n  /* Keep unrelated */ "url"  : "https://example.test//a,}",\n}\n// Footer\n';
    assert.equal(updateObjectText(text, { enabled: true, url: 'https://example.test//a,}' }), text.replace('false', 'true'));
});

test('updateObjectText recursively updates fields while preserving nested comments', () => {
    const text = '{\n    "settings": {\n        // Keep nested heading\n        "enabled": /* Keep value note */ false,\n        "detail": { "count" : 1 /* Keep nested tail */ },\n        "custom": "keep" // Keep sibling note\n    }\n}\n';
    const value = { settings: { enabled: true, detail: { count: 2 }, custom: 'keep' } };
    assert.equal(updateObjectText(text, value), text.replace('false', 'true').replace('"count" : 1', '"count" : 2'));
});

test('updateObjectText leaves semantically unchanged arrays and object ordering untouched', () => {
    const text = '{\n  "items": [\n    /* Keep array comment */ {"b":2,"a":1},\n    [true, null,],\n  ],\n  "enabled": false\n}\n';
    const value = { enabled: true, items: [{ a: 1, b: 2 }, [true, null]] };
    assert.equal(updateObjectText(text, value), text.replace('false', 'true'));
    assert.equal(updateObjectText(text, { items: [{ a: 1, b: 2 }, [true, null]], enabled: false }), text);
});

test('updateObjectText replaces changed arrays while preserving surrounding comments', t => {
    const text = '{\n    // Keep property heading\n    "items": [1, /* Old element */ 2], // Keep property tail\n    "custom" : 7 // Keep sibling\n}\n';
    const updated = updateObjectText(text, { items: [1, 3], custom: 7 });
    assert.deepEqual(readObject(fixture(t, updated)), { items: [1, 3], custom: 7 });
    assert.ok(updated.includes('// Keep property heading'));
    assert.ok(updated.includes('// Keep property tail'));
    assert.ok(updated.includes('"custom" : 7 // Keep sibling'));
});

test('updateObjectText recursively inserts and removes keys and replaces changed value types', t => {
    const text = '{\n  // Keep nested section\n  "settings": {\n    "obsolete": 1,\n    // Keep retained field\n    "retained": true,\n    "type": {"old": true}\n  },\n  "removed": false,\n  "custom": "keep"\n}\n';
    const value = { settings: { retained: true, type: [1, 2], added: { enabled: true } }, custom: 'keep', newKey: null };
    const updated = updateObjectText(text, value);
    assert.deepEqual(readObject(fixture(t, updated)), value);
    assert.ok(updated.includes('// Keep nested section'));
    assert.ok(updated.includes('// Keep retained field'));
    assert.equal(updateObjectText(updated, value), updated);
});

test('updateObjectText treats dotted and slash-containing property names as literal keys', t => {
    const text = '{"editor.fontSize": 12, "a/b": {"c.d": false}, "": 1}';
    const value = { 'editor.fontSize': 18, 'a/b': { 'c.d': true }, '': 2 };
    assert.deepEqual(readObject(fixture(t, updateObjectText(text, value))), value);
});

test('updateObjectText preserves BOM and CRLF for replacements and inserted content', t => {
    const text = '\uFEFF{\r\n\t// Keep tabbed comment\r\n\t"settings": {\r\n\t\t"enabled": false\r\n\t}\r\n}\r\n';
    const value = { settings: { enabled: true, added: { count: 1 } } };
    const updated = updateObjectText(text, value);
    assert.ok(updated.startsWith('\uFEFF'));
    assert.ok(updated.endsWith('\r\n'));
    assert.ok(updated.includes('\t// Keep tabbed comment\r\n'));
    assert.equal(/(?<!\r)\n/.test(updated), false);
    assert.deepEqual(readObject(fixture(t, updated)), value);
});

test('updateObjectText rejects malformed and non-object source text', () => {
    for (const text of ['{"a": }', '{} extra', '[]', 'null', '1', '// comment only\n']) {
        assert.throws(() => updateObjectText(text, {}), SyntaxError);
    }
});

test('updateObjectText rejects non-object replacement values', () => {
    for (const value of [null, [], 1, 'string', true, undefined]) {
        assert.throws(() => updateObjectText('{}', value), TypeError);
    }
});

test('updateObjectText removes the final property and trailing comma without losing comments', t => {
    const text = '{\n  // Keep section note\n  "obsolete": 1, /* Keep tail note */\n}\n';
    const updated = updateObjectText(text, {});
    assert.deepEqual(readObject(fixture(t, updated)), {});
    assert.ok(updated.includes('// Keep section note'));
    assert.ok(updated.includes('/* Keep tail note */'));
});

test('updateObjectText preserves comment text when removing multiple adjacent fields', t => {
    const text = '{\n  "a": 1, // Keep inline\n  /* Keep middle */ "b": 2,\n  // Keep last\n  "c": 3,\n}\n';
    const updated = updateObjectText(text, {});
    assert.deepEqual(readObject(fixture(t, updated)), {});
    for (const comment of ['// Keep inline', '/* Keep middle */', '// Keep last']) {
        assert.ok(updated.includes(comment));
    }
});

test('extension reader works with only its packaged helper and vendor files', t => {
    const directory = path.dirname(fixture(t));
    const extension = path.resolve(__dirname, '../vibe-coding/assets/workspace-extension/extension');
    const helper = path.join(extension, 'jsonc.js');
    assert.ok(fs.existsSync(helper), 'extension must include its JSONC reader');
    fs.copyFileSync(helper, path.join(directory, 'jsonc.js'));
    fs.cpSync(path.join(extension, 'vendor/jsonc-parser'), path.join(directory, 'vendor/jsonc-parser'), { recursive: true });
    const packaged = require(path.join(directory, 'jsonc.js'));
    const file = path.join(directory, 'remote-config.json');
    assert.deepEqual(packaged.readObject(file), {});
    const text = '\uFEFF{\r\n  // Keep runtime settings\r\n  "url": "https://example.test//a,}",\r\n  "ports": [3000,],\r\n}\r\n';
    fs.writeFileSync(file, text);
    assert.deepEqual(packaged.readObject(file), { url: 'https://example.test//a,}', ports: [3000] });
    assert.equal(fs.readFileSync(file, 'utf8'), text);
});

test('extension reader rejects malformed or non-object JSONC and propagates filesystem errors', t => {
    const helper = path.resolve(__dirname, '../vibe-coding/assets/workspace-extension/extension/jsonc.js');
    assert.ok(fs.existsSync(helper), 'extension must include its JSONC reader');
    const runtime = require(helper);
    for (const text of ['{"a": }', '{} extra', '[1,]', 'null', '', '// comment only\n']) {
        assert.throws(() => runtime.readObject(fixture(t, text)), SyntaxError);
    }
    const directory = fixture(t);
    fs.mkdirSync(directory);
    assert.throws(() => runtime.readObject(directory), error => error.code !== 'ENOENT');
});
