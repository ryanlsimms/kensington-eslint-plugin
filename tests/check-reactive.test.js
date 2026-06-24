import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { analyzeProject } from '../bin/check-reactive.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = join(here, 'fixtures', 'check-reactive');

function findingsAt(findings, fileSuffix) {
  return findings.filter(f => f.file.endsWith(fileSuffix));
}

test('single-file helper trap is reported', () => {
  const { findings } = analyzeProject([join(fixtures, 'single-file')]);
  // signal() inside row(), reachable via mapWithKey mapFn in the same file.
  const hits = findingsAt(findings, 'single-file/main.ts');
  assert.equal(hits.length, 1, JSON.stringify(findings, null, 2));
  assert.equal(hits[0].fnName, 'row');
  assert.equal(hits[0].primitive, 'signal');
});

test('cross-file helper trap is reported', () => {
  const { findings } = analyzeProject([join(fixtures, 'cross-file')]);
  // computed() inside cell() in cell.ts; cell is reached via grid.ts.
  const hits = findingsAt(findings, 'cross-file/cell.ts');
  assert.equal(hits.length, 1, JSON.stringify(findings, null, 2));
  assert.equal(hits[0].fnName, 'cell');
  assert.equal(hits[0].primitive, 'computed');
  // Reason should mention grid.ts since that's where cell is called from.
  assert.ok(hits[0].reason.includes('grid'), `reason was: ${hits[0].reason}`);
});

test('cross-file: grid.ts itself has no findings (outer computed is keyed)', () => {
  const { findings } = analyzeProject([join(fixtures, 'cross-file')]);
  const hits = findingsAt(findings, 'cross-file/grid.ts');
  assert.equal(hits.length, 0, JSON.stringify(findings, null, 2));
});

test('suppression comment silences a lazy-registry signal', () => {
  const { findings } = analyzeProject([join(fixtures, 'suppression')]);
  // state.ts uses // kensington-check-reactive-ignore on both signal() lines.
  const stateHits = findingsAt(findings, 'suppression/state.ts');
  assert.equal(stateHits.length, 0, JSON.stringify(findings, null, 2));
});

test('re-export chain is followed (helper trap reported through index re-export)', () => {
  const { findings } = analyzeProject([join(fixtures, 're-export')]);
  // consumer.ts imports rowHelper from index.ts which re-exports from helper.ts.
  // The signal() in helper.ts should be flagged.
  const hits = findingsAt(findings, 're-export/helper.ts');
  assert.equal(hits.length, 1, JSON.stringify(findings, null, 2));
  assert.equal(hits[0].fnName, 'rowHelper');
});

test('helper called only from non-reactive code is NOT reported', () => {
  const { findings } = analyzeProject([join(fixtures, 'non-reactive')]);
  assert.equal(findings.length, 0, JSON.stringify(findings, null, 2));
});

test('fully-keyed file has zero findings', () => {
  const { findings, fileCount } = analyzeProject([join(fixtures, 'clean')]);
  assert.equal(findings.length, 0, JSON.stringify(findings, null, 2));
  assert.equal(fileCount, 1);
});

test('namespace import indirection is a known false negative', () => {
  // helpers.row(item) — analyzer cannot trace through `import * as helpers`.
  // The unkeyed signal in helper.ts SHOULD be missed; this test documents the
  // known limit and pins the behaviour so future improvements are noticed.
  const { findings } = analyzeProject([join(fixtures, 'namespace-import')]);
  const helperHits = findingsAt(findings, 'namespace-import/helper.ts');
  assert.equal(helperHits.length, 0, `if this fails, the analyzer now follows namespace imports. Update the test and the README's coverage section.`);
});

test('analyzeProject returns expected shape', () => {
  const result = analyzeProject([join(fixtures, 'clean')]);
  assert.ok(Array.isArray(result.findings));
  assert.equal(typeof result.fileCount, 'number');
  // Per-finding shape.
  const { findings } = analyzeProject([join(fixtures, 'cross-file')]);
  const f = findings[0];
  assert.equal(typeof f.file, 'string');
  assert.equal(typeof f.line, 'number');
  assert.equal(typeof f.column, 'number');
  assert.ok(['signal', 'computed', '.transform'].includes(f.primitive));
  assert.equal(typeof f.fnName, 'string');
  assert.equal(typeof f.reason, 'string');
});

test('plain .js cross-file trap is reported', () => {
  const { findings } = analyzeProject([join(fixtures, 'js-cross-file')]);
  const hits = findingsAt(findings, 'js-cross-file/cell.js');
  assert.equal(hits.length, 1, JSON.stringify(findings, null, 2));
  assert.equal(hits[0].fnName, 'cell');
  assert.equal(hits[0].primitive, 'computed');
  assert.ok(hits[0].reason.includes('grid'), `reason was: ${hits[0].reason}`);
});

test('.mjs cross-file trap is reported', () => {
  const { findings } = analyzeProject([join(fixtures, 'mjs-cross-file')]);
  const hits = findingsAt(findings, 'mjs-cross-file/helper.mjs');
  assert.equal(hits.length, 1, JSON.stringify(findings, null, 2));
  assert.equal(hits[0].fnName, 'rowHelper');
  assert.equal(hits[0].primitive, 'signal');
});

test('mixed JS consumer + TS helper resolves through .js -> .ts swap', () => {
  // grid.js writes `import { cell } from './cell.js'` but cell lives in cell.ts.
  // The analyzer's import resolver swaps .js for .ts to find it. This matches
  // the typical TypeScript module-resolution behavior under node16/bundler.
  const { findings } = analyzeProject([join(fixtures, 'mixed-js-ts')]);
  const hits = findingsAt(findings, 'mixed-js-ts/cell.ts');
  assert.equal(hits.length, 1, JSON.stringify(findings, null, 2));
  assert.equal(hits[0].fnName, 'cell');
  assert.equal(hits[0].primitive, 'computed');
});

test('multiple roots are scanned together', () => {
  const { findings, fileCount } = analyzeProject([
    join(fixtures, 'single-file'),
    join(fixtures, 'cross-file'),
  ]);
  assert.equal(fileCount, 3); // 1 + 2
  // Should find both the single-file row() and the cross-file cell().
  assert.ok(findings.length >= 2, JSON.stringify(findings, null, 2));
  assert.ok(findings.some(f => f.fnName === 'row'));
  assert.ok(findings.some(f => f.fnName === 'cell'));
});
