'use strict';

const fs = require('node:fs');
// Microsoft jsonc-parser 3.3.1, vendored with its MIT license.
const jsonc = require('./vendor/jsonc-parser/lib/umd/main.js');

function parseObject(text, source) {
    const errors = [];
    const value = jsonc.parse(text, errors, { allowTrailingComma: true });
    if (errors.length) {
        const first = errors[0];
        throw new SyntaxError(`Invalid JSONC in ${source}: ${jsonc.printParseErrorCode(first.error)} at offset ${first.offset}`);
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new SyntaxError(`Expected a JSON object in ${source}`);
    }
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

// The setup editor shares strict parsing with the packaged runtime reader.
module.exports = { readObject, parseObject };
