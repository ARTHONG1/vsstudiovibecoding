'use strict';

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 256) x ^= 0x11d;
}
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];

function gfMul(x, y) {
  if (x === 0 || y === 0) return 0;
  return EXP[LOG[x] + LOG[y]];
}

function rsGeneratorPoly(numEC) {
  let poly = [1];
  for (let i = 0; i < numEC; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gfMul(poly[j], EXP[i]);
      next[j + 1] ^= poly[j];
    }
    poly = next;
  }
  return poly;
}

function rsCompute(data, numEC) {
  const gen = rsGeneratorPoly(numEC);
  const remainder = new Array(numEC).fill(0);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    if (factor !== 0) {
      for (let j = 0; j < numEC; j++) {
        remainder[j] ^= gfMul(gen[j], factor);
      }
    }
  }
  return remainder;
}

const QR_SPECS = [
  null,
  { version: 1, total: 26, ec: 7, data: 19, size: 21, align: [] },
  { version: 2, total: 44, ec: 10, data: 34, size: 25, align: [6, 18] },
  { version: 3, total: 70, ec: 15, data: 55, size: 29, align: [6, 22] },
  { version: 4, total: 100, ec: 20, data: 80, size: 33, align: [6, 26] },
  { version: 5, total: 134, ec: 26, data: 108, size: 37, align: [6, 30] }
];

function chooseVersion(dataLen) {
  for (let v = 1; v <= 5; v++) {
    if (dataLen <= QR_SPECS[v].data - 2) {
      return QR_SPECS[v];
    }
  }
  throw new Error('Data too long for compact QR generator (max 106 bytes)');
}

function encodeData(text, spec) {
  const bytes = Buffer.from(text, 'utf8');
  const bits = [];
  function pushBits(val, count) {
    for (let i = count - 1; i >= 0; i--) bits.push((val >> i) & 1);
  }
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  for (let i = 0; i < bytes.length; i++) {
    pushBits(bytes[i], 8);
  }
  const maxBits = spec.data * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < termLen; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  const pad = [0xEC, 0x11];
  let padIdx = 0;
  while (bits.length < maxBits) {
    pushBits(pad[padIdx % 2], 8);
    padIdx++;
  }
  const codewords = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let b = 0; b < 8; b++) byte = (byte << 1) | bits[i + b];
    codewords.push(byte);
  }
  const ecCodewords = rsCompute(codewords, spec.ec);
  return codewords.concat(ecCodewords);
}

function createMatrix(spec, allCodewords) {
  const n = spec.size;
  const matrix = Array.from({ length: n }, () => Array(n).fill(null));
  const reserved = Array.from({ length: n }, () => Array(n).fill(false));

  function setFinder(r, c) {
    for (let i = -1; i <= 7; i++) {
      for (let j = -1; j <= 7; j++) {
        const row = r + i, col = c + j;
        if (row >= 0 && row < n && col >= 0 && col < n) {
          reserved[row][col] = true;
          if (i >= 0 && i <= 6 && j >= 0 && j <= 6) {
            matrix[row][col] = (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4));
          } else {
            matrix[row][col] = false;
          }
        }
      }
    }
  }

  setFinder(0, 0);
  setFinder(0, n - 7);
  setFinder(n - 7, 0);

  for (let i = 8; i < n - 8; i++) {
    if (!reserved[6][i]) { matrix[6][i] = (i % 2 === 0); reserved[6][i] = true; }
    if (!reserved[i][6]) { matrix[i][6] = (i % 2 === 0); reserved[i][6] = true; }
  }

  matrix[4 * spec.version + 9][8] = true;
  reserved[4 * spec.version + 9][8] = true;

  if (spec.align.length > 0) {
    const coords = spec.align;
    for (const r of coords) {
      for (const c of coords) {
        if ((r === 6 && c === 6) || (r === 6 && c === n - 7) || (r === n - 7 && c === 6)) continue;
        for (let i = -2; i <= 2; i++) {
          for (let j = -2; j <= 2; j++) {
            matrix[r + i][c + j] = (Math.abs(i) === 2 || Math.abs(j) === 2 || (i === 0 && j === 0));
            reserved[r + i][c + j] = true;
          }
        }
      }
    }
  }

  for (let i = 0; i < 9; i++) {
    if (i < n) { reserved[8][i] = true; reserved[i][8] = true; }
    if (n - 1 - i >= 0) { reserved[8][n - 1 - i] = true; reserved[n - 1 - i][8] = true; }
  }

  const bits = [];
  for (const byte of allCodewords) {
    for (let b = 7; b >= 0; b--) bits.push((byte >> b) & 1);
  }

  let bitIdx = 0;
  let dir = -1;
  for (let c = n - 1; c > 0; c -= 2) {
    if (c === 6) c--;
    const rows = dir === -1
      ? Array.from({ length: n }, (_, i) => n - 1 - i)
      : Array.from({ length: n }, (_, i) => i);
    for (const r of rows) {
      for (const colOffset of [0, -1]) {
        const col = c + colOffset;
        if (!reserved[r][col]) {
          const bit = bitIdx < bits.length ? bits[bitIdx++] : 0;
          const mask = (r + col) % 2 === 0;
          matrix[r][col] = mask ? !bit : !!bit;
        }
      }
    }
    dir = -dir;
  }

  const formatBits = [0, 1, 0, 0, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 0];
  matrix[8][0] = !!formatBits[0];
  matrix[8][1] = !!formatBits[1];
  matrix[8][2] = !!formatBits[2];
  matrix[8][3] = !!formatBits[3];
  matrix[8][4] = !!formatBits[4];
  matrix[8][5] = !!formatBits[5];
  matrix[8][7] = !!formatBits[6];
  matrix[8][8] = !!formatBits[7];
  matrix[7][8] = !!formatBits[8];
  matrix[5][8] = !!formatBits[9];
  matrix[4][8] = !!formatBits[10];
  matrix[3][8] = !!formatBits[11];
  matrix[2][8] = !!formatBits[12];
  matrix[1][8] = !!formatBits[13];
  matrix[0][8] = !!formatBits[14];

  for (let i = 0; i < 7; i++) {
    matrix[n - 1 - i][8] = !!formatBits[i];
  }
  for (let i = 0; i < 8; i++) {
    matrix[8][n - 8 + i] = !!formatBits[7 + i];
  }

  return matrix;
}

function generateQRCodeSVG(text, options = {}) {
  const size = options.size || 256;
  const margin = options.margin !== undefined ? options.margin : 4;
  const fgColor = options.fgColor || '#000000';
  const bgColor = options.bgColor || '#ffffff';

  const spec = chooseVersion(Buffer.byteLength(text, 'utf8'));
  const codewords = encodeData(text, spec);
  const matrix = createMatrix(spec, codewords);
  const n = matrix.length;
  const totalSize = n + margin * 2;

  let path = '';
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (matrix[r][c]) {
        const x = c + margin;
        const y = r + margin;
        path += `M${x},${y}h1v1h-1z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${size}" height="${size}" shape-rendering="crispEdges">
  <rect width="100%" height="100%" fill="${bgColor}"/>
  <path d="${path.trim()}" fill="${fgColor}"/>
</svg>`;
}

module.exports = { generateQRCodeSVG, chooseVersion, encodeData, createMatrix };
