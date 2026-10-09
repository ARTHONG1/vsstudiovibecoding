'use strict';

const fs = require('node:fs');
const { isDeepStrictEqual } = require('node:util');
// Microsoft jsonc-parser 3.3.1, vendored with its MIT license.
const jsonc = require('./vendor/jsonc-parser/lib/umd/main.js');

function isObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseObject(text, source) {
    const errors = [];
    const value = jsonc.parse(text, errors, { allowTrailingComma: true });
    if (errors.length) {
        const first = errors[0];
        throw new SyntaxError(`Invalid JSONC in ${source}: ${jsonc.printParseErrorCode(first.error)} at offset ${first.offset}`);
    }
    if (!isObject(value)) throw new SyntaxError(`Expected a JSON object in ${source}`);
    return value;
}

function readObject(file) {
    let text;
    try {
        text = fs.readFileSync(file, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') return {};
        throw error;
    }
    return parseObject(text.replace(/^\uFEFF/, ''), String(file));
}

function formattingOptions(text) {
    const indentation = text.match(/(?:^|\r?\n)([\t ]+)"/);
    const indent = indentation ? indentation[1] : '    ';
    return {
        insertSpaces: !indent.includes('\t'),
        tabSize: indent.includes('\t') ? 4 : indent.length,
        eol: (text.match(/\r\n|\n|\r/) || ['\n'])[0]
    };
}

function preserveDeletionTrivia(text, edit, path) {
    const parent = jsonc.findNodeAtLocation(jsonc.parseTree(text), path.slice(0, -1));
    if (parent.children.length === 1) {
        // modify() stops at the last value and can leave its trailing comma.
        const scanner = jsonc.createScanner(text, true);
        scanner.setPosition(edit.offset + edit.length);
        if (scanner.scan() === jsonc.SyntaxKind.CommaToken) {
            edit.length = scanner.getTokenOffset() + scanner.getTokenLength() - edit.offset;
        }
    }
    // Property deletion also spans surrounding trivia. Keep those comments and
    // whitespace instead of erasing notes that may describe a retained sibling.
    const removed = text.slice(edit.offset, edit.offset + edit.length);
    const scanner = jsonc.createScanner(removed);
    let content = '';
    for (let token = scanner.scan(); token !== jsonc.SyntaxKind.EOF; token = scanner.scan()) {
        if (token === jsonc.SyntaxKind.LineCommentTrivia || token === jsonc.SyntaxKind.BlockCommentTrivia ||
            token === jsonc.SyntaxKind.LineBreakTrivia || token === jsonc.SyntaxKind.Trivia) {
            content += removed.slice(scanner.getTokenOffset(), scanner.getTokenOffset() + scanner.getTokenLength());
        }
    }
    return { ...edit, content };
}

function updateObjectText(text, value) {
    if (typeof text !== 'string') throw new TypeError('Expected JSONC text');
    if (!isObject(value)) throw new TypeError('Expected an object value');
    const bom = text.startsWith('\uFEFF') ? '\uFEFF' : '';
    let result = text.slice(bom.length);
    const options = formattingOptions(result);
    if (!result.trim()) {
        return bom + JSON.stringify(value, null, 4).replace(/\n/g, options.eol) + options.eol;
    }
    const original = parseObject(result, 'input text');

    function edit(path, next, insert) {
        // Existing values need only a token replacement; formatting them would
        // also normalize surrounding spacing that belongs to the user.
        let edits = jsonc.modify(result, path, next, insert ? { formattingOptions: options } : {});
        if (next === undefined) edits = edits.map(change => preserveDeletionTrivia(result, change, path));
        result = jsonc.applyEdits(result, edits);
    }

    function diff(previous, next, path) {
        for (const key of Object.keys(previous)) {
            if (!Object.hasOwn(next, key)) edit([...path, key], undefined, false);
        }
        for (const key of Object.keys(next)) {
            const childPath = [...path, key];
            if (!Object.hasOwn(previous, key)) {
                edit(childPath, next[key], true);
            } else if (isObject(previous[key]) && isObject(next[key])) {
                diff(previous[key], next[key], childPath);
            } else if (!isDeepStrictEqual(previous[key], next[key])) {
                // Arrays are atomic, but equivalent arrays keep all their text.
                edit(childPath, next[key], false);
            }
        }
    }

    diff(original, value, []);
    return bom + result;
}

module.exports = { readObject, updateObjectText };
