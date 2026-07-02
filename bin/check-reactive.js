#!/usr/bin/env node
// kensington-check-reactive
// ===========================================================================
//
// EXPERIMENTAL. NOT YET RELEASED.
// This binary ships in the published package but is intentionally not
// documented in README.md or CHANGELOG.md. The CLI flags, output format,
// detection rules, suppression-comment syntax, presence in the package, and
// even its name may change or be removed in any future release without
// notice. Do not build tooling on top of it yet. The first release that
// documents this tool in README.md is the release that commits to its
// contract. Until then THIS COMMENT BLOCK is the canonical description of
// what the command does.
//
// ---------------------------------------------------------------------------
// What it does
// ---------------------------------------------------------------------------
//
// Cross-file static analyzer for two classes of kensington reactive bugs that
// in-file ESLint rules cannot catch on their own. Parses every .ts/.tsx/.js/
// .jsx/.mjs/.cjs file under the given roots, builds a project-wide call
// graph across imports (named imports, default imports, re-exports, and
// re-export-all), and reports two kinds of findings:
//
//   1. Unkeyed reactive primitive inside a reachable helper.
//      Any signal(), computed(), or .transform() call site (no key argument)
//      inside a NAMED function that is reachable from a reactive callback
//      (computed(fn), effect(fn), signal.transform(fn), signal.mapWithKey(key,
//      mapFn)) anywhere in the project. The kensington-eslint-plugin rule
//      `no-helper-function-trap` catches this for helpers defined in the same
//      file as the reactive callback. This script catches the cross-file case
//      where the helper is imported.
//
//      Reported with kind: 'unkeyed-in-reactive-callback'.
//
//   2. Duplicate keyed-primitive call with mismatched primitive initial.
//      Two or more call sites that pass the same literal string key to
//      signal(initial, 'key') (or the same literal string name to
//      liveSignal(initial, 'name') from kensington/live) but with different
//      primitive literal initial values. The second caller's initial is
//      silently ignored at runtime — the registry returns the existing
//      signal with its current value — so without this static check the bug
//      surfaces later as a wrong-value UI surprise. Object and array
//      initials are skipped (false-positive risk on
//      structurally-equal-but-reference-different cases). signal and
//      liveSignal are grouped separately because their collision namespaces
//      differ.
//
//      Reported with kind: 'duplicate-key-initial-mismatch'.
//
// Static analysis only. Both detectors require literal-string keys and
// (for #2) primitive literal initials to fire. Dynamic keys built at runtime
// (`cell:${addr}`) and dynamic initials (getCurrentUser()) are uncatchable
// statically; the kensington runtime emits paired throttled warnings for
// those cases at call time.
//
// ---------------------------------------------------------------------------
// Suppression
// ---------------------------------------------------------------------------
//
// Per-call-site escape hatch. Add either form on the offending line or on
// the line above it:
//
//   // kensington-check-reactive-ignore
//   // check-reactive-ignore
//
// The line-above form also suppresses the next code line, which covers tight
// declaration groups. Intended for the lazy-registry pattern (the script
// can't tell whether the lazy creation has been pre-seeded by the consumer)
// and the rare legitimate cross-file initial mismatch.
//
// ---------------------------------------------------------------------------
// Usage (subject to change)
// ---------------------------------------------------------------------------
//
//   kensington-check-reactive [paths...]
//       Scan and print human-readable findings to stdout.
//
//   kensington-check-reactive [paths...] --json
//       Print findings as { findings: [...] } JSON. Each finding has a
//       `kind` field distinguishing the two detection types.
//
//   kensington-check-reactive [paths...] --quiet
//       Exit-code only. No stdout.
//
//   kensington-check-reactive --help
//       Brief help.
//
// Paths default to `.` (the current working directory). Skipped directory
// names: node_modules, .git, dist, build, cjs, .next, .wrangler, public,
// coverage.
//
// Exit codes: 0 on no findings, 1 on findings, 2 on script error
// (e.g. no source files found, fatal parse error in the analyzer).
//
// ---------------------------------------------------------------------------
// Recommended invocation
// ---------------------------------------------------------------------------
//
// Chain into the project's lint script so every `npm run lint` runs the
// check alongside ESLint:
//
//   "lint": "eslint . && kensington-check-reactive src --quiet"
//
// --quiet keeps the script exit-code-only; ESLint's own output stays
// visible, and a non-zero exit fails the script. Drop --quiet to print
// findings inline above the lint output.
//
// Programmatic entry point: `analyzeProject(roots, opts)` is exported at the
// bottom of this file. Returns `{ findings, fileCount }` without writing to
// stdout or calling process.exit. Suitable for editor integrations and tests.

/* global process */
import { readFileSync, statSync, readdirSync } from 'node:fs';
import { resolve, dirname, join, extname, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parse } from '@typescript-eslint/typescript-estree';

const SOURCE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'cjs', '.next', '.wrangler', 'public', 'coverage']);

// Module-level config flags. Set by main() before analysis runs.
let flagJson = false;
let flagQuiet = false;

// === File discovery ========================================================

function listSourceFiles(root) {
  const out = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (SKIP_DIRS.has(e.name)) {
        continue;
      }
      const full = join(dir, e.name);
      if (e.isDirectory()) {
        walk(full);
      } else if (e.isFile() && SOURCE_EXTS.has(extname(e.name))) {
        out.push(full);
      }
    }
  }
  try {
    const st = statSync(root);
    if (st.isFile()) {
      if (SOURCE_EXTS.has(extname(root))) {
        out.push(resolve(root));
      }
    } else {
      walk(resolve(root));
    }
  } catch {
    // ignore missing roots
  }
  return out;
}

// === Import resolution =====================================================

function resolveImportPath(fromFile, spec) {
  // Only resolve relative imports. Bare specifiers (`kensington`, `react`) are
  // out of scope.
  if (!spec.startsWith('.') && !isAbsolute(spec)) {
    return null;
  }
  const baseDir = isAbsolute(spec) ? '/' : dirname(fromFile);
  const baseGuess = isAbsolute(spec) ? spec : join(baseDir, spec);
  // Try exact match, then extensions, then /index.{ext}.
  const candidates = [
    baseGuess,
    ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].map(ext => baseGuess + ext),
    ...['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'].map(ext => join(baseGuess, 'index' + ext)),
  ];
  // Spec may include .js extension for a .ts file (common with moduleResolution: node16).
  for (const cand of candidates) {
    try {
      const st = statSync(cand);
      if (st.isFile()) {
        return resolve(cand);
      }
    } catch {
      // continue
    }
  }
  // Try swapping .js -> .ts.
  if (spec.endsWith('.js')) {
    const swap = baseGuess.replace(/\.js$/, '.ts');
    try {
      if (statSync(swap).isFile()) {
        return resolve(swap);
      }
    } catch {
      // continue
    }
    const swapTsx = baseGuess.replace(/\.js$/, '.tsx');
    try {
      if (statSync(swapTsx).isFile()) {
        return resolve(swapTsx);
      }
    } catch {
      // continue
    }
  }
  return null;
}

// === Per-file analysis =====================================================

// Per-file record:
//   imports: Map<localName, { sourceFile: string|null, exportedName: string }>
//   exports: Map<exportedName, localName>   (exportedName 'default' for default exports)
//   funcs:   Map<localName, { unkeyedCalls: [{loc, primitive}], callees: Set<localName> }>
//   reactiveLocalEntries: Set<localName>    (function names passed as reactive callbacks within this file)

function analyzeFile(file) {
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  let ast;
  try {
    ast = parse(src, { loc: true, range: false, jsx: file.endsWith('.tsx') || file.endsWith('.jsx'), comment: true });
  } catch (err) {
    if (!flagQuiet) {
      process.stderr.write(`parse error: ${file}: ${err.message}\n`);
    }
    return null;
  }

  // Lines tagged with `// kensington-check-reactive-ignore` (or the
  // shorter `// check-reactive-ignore`) at the end of the line or the line
  // above are suppressed. Used for legitimate lazy-registry patterns and
  // similar cases where the rule's static analysis can't tell the call site
  // is safe in practice (e.g. registry pre-seeded at mount).
  const suppressedLines = new Set();
  const srcLines = src.split('\n');
  for (let i = 0; i < srcLines.length; i++) {
    const line = srcLines[i];
    if (/\/\/\s*(kensington-)?check-reactive-ignore\b/.test(line)) {
      // 1-based; suppress the line the comment is on AND the next code line.
      suppressedLines.add(i + 1);
      suppressedLines.add(i + 2);
    }
  }

  const imports = new Map();
  const exports = new Map();
  const funcs = new Map();
  const reactiveLocalEntries = new Set();

  // Kensington-imported reactive primitive names (local-alias resolution).
  const signalNames = new Set();
  const computedNames = new Set();
  const effectNames = new Set();
  // Live-signal names from `kensington/live`. Tracked separately because the
  // collision namespace differs from regular keyed signals: liveSignal names
  // are global across the app, regular keyed signal keys are per-computed.
  const liveSignalNames = new Set();
  // Per-file literal-key + literal-initial calls. Aggregated cross-file in
  // `findDuplicateKeyInitialMismatches` to surface collisions where two
  // unrelated call sites share a literal key/name but pass different
  // primitive initials.
  const keyedLiteralInits = [];

  // Track which function we are currently inside (named/binding) and how
  // deeply nested in a reactive callback we are.
  const fnStack = []; // entries: { name | null, rec }
  let reactiveDepth = 0;

  function currentFn() {
    return fnStack.length ? fnStack[fnStack.length - 1] : null;
  }

  function ensureFunc(name) {
    if (!funcs.has(name)) {
      funcs.set(name, { unkeyedCalls: [], callees: new Set() });
    }
    return funcs.get(name);
  }

  function fnBindingName(node, parent) {
    if (node.type === 'FunctionDeclaration' && node.id) {
      return node.id.name;
    }
    if (parent && parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier' && parent.init === node) {
      return parent.id.name;
    }
    if (parent && parent.type === 'AssignmentExpression' && parent.left.type === 'Identifier' && parent.right === node) {
      return parent.left.name;
    }
    if (parent && parent.type === 'Property' && !parent.computed && parent.key.type === 'Identifier' && parent.value === node) {
      // Object property method form. Less useful for graph but we record.
      return parent.key.name;
    }
    if (parent && parent.type === 'ExportDefaultDeclaration') {
      // Default export of an anonymous function. Use a synthetic name.
      return '__default__';
    }
    return null;
  }

  function isReactiveCallback(node, parent) {
    if (!parent || parent.type !== 'CallExpression') {
      return false;
    }
    const callee = parent.callee;
    if (callee.type === 'Identifier') {
      if ((computedNames.has(callee.name) || effectNames.has(callee.name)) && parent.arguments[0] === node) {
        return true;
      }
    }
    if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') {
      if (callee.property.name === 'transform' && parent.arguments[0] === node) {
        return true;
      }
      if (callee.property.name === 'mapWithKey' && parent.arguments[1] === node) {
        return true;
      }
    }
    return false;
  }

  // Generic AST walker.
  function walk(node, parent) {
    if (!node || typeof node !== 'object') {
      return;
    }
    if (Array.isArray(node)) {
      for (const child of node) { walk(child, parent); }
      return;
    }
    if (typeof node.type !== 'string') {
      return;
    }

    let pushedFrame = false;
    let pushedDepth = false;

    // Enter
    if (node.type === 'ImportDeclaration') {
      const sourceFile = resolveImportPath(file, node.source.value);
      for (const spec of node.specifiers) {
        if (spec.type === 'ImportSpecifier') {
          const imported = spec.imported.name;
          const local = spec.local.name;
          if (node.importKind === 'type') {
            continue;
          }
          if (spec.importKind === 'type') {
            continue;
          }
          imports.set(local, { sourceFile, exportedName: imported });
          if (node.source.value === 'kensington') {
            if (imported === 'signal') { signalNames.add(local); }
            else if (imported === 'computed') { computedNames.add(local); }
            else if (imported === 'effect') { effectNames.add(local); }
          } else if (node.source.value === 'kensington/live') {
            if (imported === 'liveSignal') { liveSignalNames.add(local); }
          }
        } else if (spec.type === 'ImportDefaultSpecifier') {
          imports.set(spec.local.name, { sourceFile, exportedName: 'default' });
        } else if (spec.type === 'ImportNamespaceSpecifier') {
          imports.set(spec.local.name, { sourceFile, exportedName: '*' });
        }
      }
    } else if (node.type === 'ExportNamedDeclaration') {
      if (node.declaration) {
        if (node.declaration.type === 'FunctionDeclaration' && node.declaration.id) {
          exports.set(node.declaration.id.name, node.declaration.id.name);
        } else if (node.declaration.type === 'VariableDeclaration') {
          for (const d of node.declaration.declarations) {
            if (d.id.type === 'Identifier') {
              exports.set(d.id.name, d.id.name);
            }
          }
        }
      }
      if (node.specifiers) {
        for (const spec of node.specifiers) {
          if (spec.type !== 'ExportSpecifier') { continue; }
          const exported = spec.exported.name;
          const local = spec.local.name;
          if (node.source) {
            // Re-export from another file. exported -> { sourceFile, exportedName }
            const sourceFile = resolveImportPath(file, node.source.value);
            // Treat as both import (so resolution can chain) and export.
            imports.set(local, { sourceFile, exportedName: local });
          }
          exports.set(exported, local);
        }
      }
    } else if (node.type === 'ExportDefaultDeclaration') {
      const inner = node.declaration;
      if (inner.type === 'Identifier') {
        exports.set('default', inner.name);
      } else if (inner.type === 'FunctionDeclaration' && inner.id) {
        exports.set('default', inner.id.name);
      } else if (inner.type === 'FunctionDeclaration' || inner.type === 'ArrowFunctionExpression' || inner.type === 'FunctionExpression') {
        exports.set('default', '__default__');
      }
    } else if (node.type === 'ExportAllDeclaration') {
      if (node.source) {
        const sourceFile = resolveImportPath(file, node.source.value);
        if (sourceFile) {
          exports.set('*', { reExportAll: sourceFile });
        }
      }
    }

    if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') {
      const name = fnBindingName(node, parent);
      const rec = name ? ensureFunc(name) : { unkeyedCalls: [], callees: new Set(), anonymous: true };
      fnStack.push({ name, rec });
      pushedFrame = true;
      if (isReactiveCallback(node, parent)) {
        reactiveDepth++;
        pushedDepth = true;
      }
    }

    if (node.type === 'CallExpression') {
      handleCall(node);
    }

    // Recurse into children.
    for (const key of Object.keys(node)) {
      if (key === 'parent' || key === 'loc' || key === 'range' || key === 'type') {
        continue;
      }
      walk(node[key], node);
    }

    // Exit
    if (pushedDepth) { reactiveDepth--; }
    if (pushedFrame) { fnStack.pop(); }
  }

  function handleCall(node) {
    const callee = node.callee;
    const hasKey = node.arguments.length >= 2;

    // Capture (literal-key, literal-initial) pairs for cross-file collision detection.
    // signal(initial, 'literal-key') and liveSignal(initial, 'literal-name') only.
    // Computed and .transform don't have an "initial" so collisions there
    // can't be mismatched in the same way.
    if (node.arguments.length === 2) {
      const arg0 = node.arguments[0];
      const arg1 = node.arguments[1];
      const isStringLiteralKey = arg1 && arg1.type === 'Literal' && typeof arg1.value === 'string';
      const isPrimitiveLiteralInitial = arg0 && arg0.type === 'Literal'
        && (arg0.value === null || ['string', 'number', 'boolean'].includes(typeof arg0.value));
      if (isStringLiteralKey && isPrimitiveLiteralInitial) {
        let primitive = null;
        if (callee.type === 'Identifier' && signalNames.has(callee.name)) { primitive = 'signal'; }
        else if (callee.type === 'Identifier' && liveSignalNames.has(callee.name)) { primitive = 'liveSignal'; }
        if (primitive !== null) {
          const loc = node.loc ? { line: node.loc.start.line, column: node.loc.start.column + 1 } : { line: 0, column: 0 };
          if (!suppressedLines.has(loc.line)) {
            keyedLiteralInits.push({ primitive, key: arg1.value, initial: arg0.value, loc });
          }
        }
      }
    }

    // Reactive-callback bare-identifier detection (callback IS an identifier,
    // not a function expression).
    function detectBareIdent(arg, _reason) {
      if (arg && arg.type === 'Identifier') {
        reactiveLocalEntries.add(arg.name);
      }
    }
    if (callee.type === 'Identifier') {
      if (computedNames.has(callee.name)) { detectBareIdent(node.arguments[0]); }
      else if (effectNames.has(callee.name)) { detectBareIdent(node.arguments[0]); }
    } else if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') {
      if (callee.property.name === 'transform') { detectBareIdent(node.arguments[0]); }
      else if (callee.property.name === 'mapWithKey') { detectBareIdent(node.arguments[1]); }
    }

    // While we're lexically inside any reactive callback, every named-identifier
    // call also makes that function a reactive entry point.
    if (reactiveDepth > 0 && callee.type === 'Identifier') {
      reactiveLocalEntries.add(callee.name);
    }

    // Record unkeyed reactive-primitive calls in the current named function.
    const fn = currentFn();
    if (!fn || !fn.name || fn.rec.anonymous) {
      return;
    }
    const loc = node.loc ? { line: node.loc.start.line, column: node.loc.start.column + 1 } : { line: 0, column: 0 };
    if (suppressedLines.has(loc.line)) {
      return;
    }
    if (callee.type === 'Identifier' && signalNames.has(callee.name) && !hasKey) {
      fn.rec.unkeyedCalls.push({ loc, primitive: 'signal' });
    } else if (callee.type === 'Identifier' && computedNames.has(callee.name) && !hasKey) {
      fn.rec.unkeyedCalls.push({ loc, primitive: 'computed' });
    } else if (
      callee.type === 'MemberExpression'
      && !callee.computed
      && callee.property.type === 'Identifier'
      && callee.property.name === 'transform'
      && !hasKey
    ) {
      fn.rec.unkeyedCalls.push({ loc, primitive: '.transform' });
    } else if (callee.type === 'Identifier') {
      fn.rec.callees.add(callee.name);
    }
  }

  walk(ast, null);

  return { file, imports, exports, funcs, reactiveLocalEntries, keyedLiteralInits };
}

// === Cross-file resolution + propagation ===================================

function buildProjectIndex(roots) {
  const files = new Set();
  for (const r of roots) {
    for (const f of listSourceFiles(r)) { files.add(f); }
  }
  const index = new Map(); // file -> per-file record
  for (const f of files) {
    const rec = analyzeFile(f);
    if (rec) {
      index.set(f, rec);
    }
  }
  return index;
}

// Resolve a local name in a file to a (file, fnName) pair where fnName is
// defined. Follows re-exports. Returns null if it doesn't resolve to a local
// function in any scanned file. The exportedName='*' (namespace import) case
// is not followed.
function resolveLocal(index, file, localName, visited = new Set()) {
  const visitKey = `${file}::${localName}`;
  if (visited.has(visitKey)) { return null; }
  visited.add(visitKey);

  const rec = index.get(file);
  if (!rec) { return null; }
  // Local function defined here?
  if (rec.funcs.has(localName)) {
    return { file, fnName: localName };
  }
  // Imported?
  const imp = rec.imports.get(localName);
  if (imp && imp.sourceFile && index.has(imp.sourceFile) && imp.exportedName !== '*') {
    const targetRec = index.get(imp.sourceFile);
    const exportedLocal = targetRec.exports.get(imp.exportedName);
    if (typeof exportedLocal === 'string') {
      return resolveLocal(index, imp.sourceFile, exportedLocal, visited);
    }
    // Re-export-all: search every file in the * chain.
    if (exportedLocal && typeof exportedLocal === 'object' && exportedLocal.reExportAll) {
      const r = resolveLocal(index, exportedLocal.reExportAll, imp.exportedName, visited);
      if (r) { return r; }
    }
    // Last-resort. Maybe the target file has the function by the imported name
    // (common pattern: re-export named directly).
    if (targetRec.funcs.has(imp.exportedName)) {
      return { file: imp.sourceFile, fnName: imp.exportedName };
    }
  }
  return null;
}

function propagate(index) {
  // Seed reactive-reachable set.
  const reachable = new Map(); // key 'file::fnName' -> reason string
  const queue = [];
  for (const [file, rec] of index) {
    for (const local of rec.reactiveLocalEntries) {
      const r = resolveLocal(index, file, local);
      if (r) {
        const key = `${r.file}::${r.fnName}`;
        if (!reachable.has(key)) {
          reachable.set(key, `entered via ${relPath(file)} reactive callback`);
          queue.push(r);
        }
      }
    }
  }
  // BFS through callees.
  while (queue.length) {
    const { file, fnName } = queue.shift();
    const rec = index.get(file);
    if (!rec) { continue; }
    const fn = rec.funcs.get(fnName);
    if (!fn) { continue; }
    for (const callee of fn.callees) {
      const r = resolveLocal(index, file, callee);
      if (!r) { continue; }
      const key = `${r.file}::${r.fnName}`;
      if (!reachable.has(key)) {
        reachable.set(key, `called from ${fnName} in ${relPath(file)}`);
        queue.push(r);
      }
    }
  }
  return reachable;
}

function relPath(p) {
  const cwd = process.cwd() + sep;
  if (p.startsWith(cwd)) { return p.slice(cwd.length); }
  return p;
}

function report(index, reachable) {
  const findings = [];
  for (const [file, rec] of index) {
    for (const [fnName, fn] of rec.funcs) {
      const key = `${file}::${fnName}`;
      if (!reachable.has(key)) { continue; }
      const reason = reachable.get(key);
      for (const hit of fn.unkeyedCalls) {
        findings.push({
          kind: 'unkeyed-in-reactive-callback',
          file: relPath(file),
          line: hit.loc.line,
          column: hit.loc.column,
          primitive: hit.primitive,
          fnName,
          reason,
        });
      }
    }
  }
  for (const f of findDuplicateKeyInitialMismatches(index)) {
    findings.push(f);
  }
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column);
  return findings;
}

// Cross-file aggregation. Groups every `signal(literal, 'literal-key')` and
// `liveSignal(literal, 'literal-name')` call by (primitive, key) and emits one
// finding per call site when the group has disagreeing initial values. The
// two primitives are grouped separately because their collision namespaces
// differ: liveSignal names are global; regular signal keys are per-computed
// (but two calls with the same literal key landing in the same outer computed
// from different files is the bug shape we want to surface).
function findDuplicateKeyInitialMismatches(index) {
  const groups = new Map(); // `${primitive}::${key}` -> Array<{ file, loc, initial, primitive, key }>
  for (const [file, rec] of index) {
    if (!rec.keyedLiteralInits) { continue; }
    for (const entry of rec.keyedLiteralInits) {
      const groupKey = `${entry.primitive}::${entry.key}`;
      let group = groups.get(groupKey);
      if (group === undefined) { group = []; groups.set(groupKey, group); }
      group.push({ ...entry, file });
    }
  }
  const out = [];
  for (const [, group] of groups) {
    if (group.length < 2) { continue; }
    // Find any disagreement among initials. Object.is for primitive comparison.
    const first = group[0].initial;
    const allMatch = group.every(e => Object.is(e.initial, first));
    if (allMatch) { continue; }
    // Disagreement: emit one finding per call site, cross-referencing the group.
    const others = group.map(e => `${relPath(e.file)}:${e.loc.line}:${e.loc.column} (initial=${formatInitial(e.initial)})`);
    for (const entry of group) {
      out.push({
        kind: 'duplicate-key-initial-mismatch',
        file: relPath(entry.file),
        line: entry.loc.line,
        column: entry.loc.column,
        primitive: entry.primitive,
        key: entry.key,
        initial: entry.initial,
        groupSize: group.length,
        otherSites: others.filter(s => !s.startsWith(`${relPath(entry.file)}:${entry.loc.line}:${entry.loc.column}`)),
      });
    }
  }
  return out;
}

function formatInitial(v) {
  if (v === null) { return 'null'; }
  if (typeof v === 'string') { return JSON.stringify(v); }
  return String(v);
}

// === Public API ============================================================

// Programmatic entry. Returns { findings, fileCount }. Pure (no process exit,
// no stdout). Suitable for tests and tooling integration.
export function analyzeProject(roots, opts = {}) {
  const prevQuiet = flagQuiet;
  flagQuiet = opts.quiet ?? true;
  try {
    const index = buildProjectIndex(roots);
    const reachable = propagate(index);
    const findings = report(index, reachable);
    return { findings, fileCount: index.size };
  } finally {
    flagQuiet = prevQuiet;
  }
}

// === Main ==================================================================

function printHelp() {
  process.stdout.write(
    'kensington-check-reactive (EXPERIMENTAL, NOT YET RELEASED)\n'
    + '\n'
    + 'Cross-file static analyzer for two classes of kensington reactive bugs:\n'
    + '  1. Unkeyed signal()/computed()/.transform() inside helpers reachable\n'
    + '     from a reactive callback anywhere in the project.\n'
    + '  2. Duplicate signal(initial, KEY) or liveSignal(initial, NAME) calls\n'
    + '     with the same literal key/name but different primitive initials.\n'
    + '\n'
    + 'This binary is shipped for early testing only. The CLI surface, output\n'
    + 'format, detection rules, and even its presence in the package may change\n'
    + 'without notice. Do not build tooling on top of it until it appears in\n'
    + 'README.md. See the comment header in bin/check-reactive.js for the\n'
    + 'canonical description until then.\n'
    + '\n'
    + 'Usage:\n'
    + '  kensington-check-reactive [paths...]            scan and print findings\n'
    + '  kensington-check-reactive [paths...] --json     structured JSON output\n'
    + '  kensington-check-reactive [paths...] --quiet    exit code only, no output\n'
    + '  kensington-check-reactive --help                this message\n'
    + '\n'
    + 'Paths default to the current working directory. Suppress per call site\n'
    + 'with `// kensington-check-reactive-ignore` on or above the line.\n'
    + '\n'
    + 'Exits 0 on no findings, 1 on findings, 2 on script error.\n',
  );
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }
  flagJson = args.includes('--json');
  flagQuiet = args.includes('--quiet');
  const roots = args.filter(a => !a.startsWith('--'));
  if (roots.length === 0) {
    roots.push('.');
  }

  const index = buildProjectIndex(roots);
  if (index.size === 0) {
    if (!flagQuiet) {
      process.stderr.write(`no source files found under: ${roots.join(', ')}\n`);
    }
    process.exit(2);
  }
  const reachable = propagate(index);
  const findings = report(index, reachable);

  if (flagJson) {
    process.stdout.write(JSON.stringify({ findings }, null, 2) + '\n');
  } else if (!flagQuiet) {
    if (findings.length === 0) {
      process.stdout.write(`kensington-check-reactive: 0 findings across ${index.size} files\n`);
    } else {
      for (const f of findings) {
        if (f.kind === 'duplicate-key-initial-mismatch') {
          const others = f.otherSites.length ? ` (other sites: ${f.otherSites.join('; ')})` : '';
          process.stdout.write(
            `${f.file}:${f.line}:${f.column}: warning: ${f.primitive}(initial=${formatInitial(f.initial)}, '${f.key}') `
            + `disagrees with other call sites' initial for the same key${others}\n`,
          );
        } else {
          process.stdout.write(
            `${f.file}:${f.line}:${f.column}: warning: ${f.primitive}() unkeyed in \`${f.fnName}\` (${f.reason})\n`,
          );
        }
      }
      process.stdout.write(`\n${findings.length} finding${findings.length === 1 ? '' : 's'} across ${index.size} files\n`);
    }
  }

  process.exit(findings.length > 0 ? 1 : 0);
}

// Run main() only when invoked as a CLI, not when imported.
if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
