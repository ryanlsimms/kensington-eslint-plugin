#!/usr/bin/env node
// kensington-check-reactive
//
// EXPERIMENTAL. NOT YET RELEASED.
// This binary ships in the published package but is intentionally not
// documented in README.md or CHANGELOG.md. The CLI flags, output format,
// suppression-comment syntax, presence in the package, and even its name
// may change or be removed in any future release without notice. Do not
// build tooling on top of it yet. The first release that documents this
// tool in README.md is the release that commits to its contract.
//
// Cross-file static analyzer for the kensington helper-function trap. Parses
// every .ts/.tsx/.js/.jsx file under the given roots, builds a project-wide
// call graph (across imports), and reports every unkeyed signal()/computed()/
// .transform() call site inside a function reachable from a reactive callback
// anywhere in the project.
//
// Complements the single-file ESLint rule (`no-helper-function-trap`). The
// ESLint rule catches the case where the helper and the reactive callback live
// in the same file. This script catches the case where they live in different
// files connected by imports.
//
// Usage (subject to change):
//   kensington-check-reactive [paths...]
//   kensington-check-reactive [paths...] --json
//   kensington-check-reactive [paths...] --quiet     # exit-code only, no output
//   kensington-check-reactive --help
//
// Exits 0 on no findings, 1 on findings, 2 on script error.

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

  return { file, imports, exports, funcs, reactiveLocalEntries };
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
  findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column);
  return findings;
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
    + 'Cross-file static analyzer for unkeyed signal()/computed()/.transform()\n'
    + 'calls inside helper functions reachable from a reactive callback. This\n'
    + 'binary is shipped for early testing only. The CLI surface, output format,\n'
    + 'and even its presence in the package may change without notice. Do not\n'
    + 'build tooling on top of it until it appears in README.md.\n'
    + '\n'
    + 'Usage:\n'
    + '  kensington-check-reactive [paths...]            scan and print findings\n'
    + '  kensington-check-reactive [paths...] --json     structured JSON output\n'
    + '  kensington-check-reactive [paths...] --quiet    exit code only, no output\n'
    + '  kensington-check-reactive --help                this message\n'
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
        process.stdout.write(
          `${f.file}:${f.line}:${f.column}: warning: ${f.primitive}() unkeyed in \`${f.fnName}\` (${f.reason})\n`,
        );
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
