// Shared helpers used by the formatting rules.

// HTML boolean attributes per the WHATWG HTML spec. Kebab-case form is the
// attribute name; camelCase keys (e.g. `formNoValidate`) also match because the
// tag-call check looks at the key text after camel-to-kebab conversion.
export const HTML_BOOLEAN_ATTRS = new Set([
  'allowfullscreen',
  'async',
  'autofocus',
  'autoplay',
  'checked',
  'controls',
  'default',
  'defer',
  'disabled',
  'formnovalidate',
  'hidden',
  'inert',
  'ismap',
  'itemscope',
  'loop',
  'multiple',
  'muted',
  'nomodule',
  'novalidate',
  'open',
  'playsinline',
  'readonly',
  'required',
  'reversed',
  'selected',
  'shadowrootclonable',
  'shadowrootdelegatesfocus',
  'shadowrootserializable',
]);

export function camelToKebab(str) {
  return str.replace(/[A-Z]+(?![a-z])|[A-Z]/g, ($, ofs) => (ofs ? '-' : '') + $.toLowerCase());
}

export function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

// `name` may be a quoted-kebab string ('aria-label') or a camelCase identifier
// (ariaLabel). Returns the kebab-case form.
export function normalizeAttrName(name) {
  return name.includes('-') ? name : camelToKebab(name);
}

// Returns true when an identifier name is a safe JS identifier.
const IDENT_RE = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
export function isValidIdentifier(str) {
  return IDENT_RE.test(str);
}

// Tag-method matcher: callee is `<obj>.<lowercaseMethod>(...)` where `<obj>` is
// in `objectNames` (default `['t']`, the documented Kensington convention).
// Returns the call's first ObjectExpression argument (the attributes object) or
// null when the call doesn't look like a tag call with attributes.
export function isTagCall(node, objectNames = ['t']) {
  if (node.type !== 'CallExpression') { return false; }
  if (node.callee.type !== 'MemberExpression') { return false; }
  if (node.callee.object.type !== 'Identifier') { return false; }
  if (!objectNames.includes(node.callee.object.name)) { return false; }
  if (node.callee.property.type !== 'Identifier') { return false; }
  if (!/^[a-z][a-zA-Z0-9]*$/.test(node.callee.property.name)) { return false; }
  return true;
}

export function getTagAttrsObject(node, objectNames) {
  if (!isTagCall(node, objectNames)) { return null; }
  const first = node.arguments[0];
  if (!first || first.type !== 'ObjectExpression') { return null; }
  return first;
}

// Standard rule schema entry for the `objectNames` option.
export const objectNamesSchema = {
  type: 'array',
  items: { type: 'string' },
  uniqueItems: true,
};

// Resolve `objectNames` from per-rule options first, then from plugin-level
// settings (`settings.kensington.objectNames`). Returns undefined when neither
// is set, letting the helpers fall back to the built-in default of `['t']`.
export function getObjectNames(context) {
  return context.options[0]?.objectNames ?? context.settings?.kensington?.objectNames;
}

// Default set of attribute namespaces — kebab prefixes whose hyphenated
// children form an unbounded, namespaced family (data-*, aria-*). Mirrors the
// Kensington `additionalNamespaces` defaults.
export const DEFAULT_NAMESPACES = ['data', 'aria'];

// Standard rule schema entry for the `namespaces` option.
export const namespacesSchema = {
  type: 'array',
  items: { type: 'string' },
  uniqueItems: true,
};

// Resolve `namespaces` from per-rule options first, then from plugin-level
// settings (`settings.kensington.namespaces`), then from `DEFAULT_NAMESPACES`.
export function getNamespaces(context) {
  return (
    context.options[0]?.namespaces
    ?? context.settings?.kensington?.namespaces
    ?? DEFAULT_NAMESPACES
  );
}

// Returns the property key as a string, or null if computed/unrecognised.
export function getPropertyKey(prop) {
  if (prop.type !== 'Property') { return null; }
  if (prop.computed) { return null; }
  if (prop.key.type === 'Identifier') { return prop.key.name; }
  if (prop.key.type === 'Literal' && typeof prop.key.value === 'string') { return prop.key.value; }
  return null;
}

// Split a CSS declaration string ("color: red; z-index: 2") into entries.
// Respects quoted values so semicolons inside strings don't split.
export function splitCssDeclarations(css) {
  const result = [];
  let current = '';
  let inStr = null;
  for (const c of css) {
    if (inStr) {
      current += c;
      if (c === inStr) { inStr = null; }
    } else if (c === '"' || c === "'") {
      inStr = c;
      current += c;
    } else if (c === ';') {
      result.push(current);
      current = '';
    } else {
      current += c;
    }
  }
  if (current.trim()) { result.push(current); }
  return result;
}

// Parse a CSS string into { property, value } entries. Returns null if any
// declaration is malformed.
export function parseStyleString(css) {
  const entries = [];
  for (const decl of splitCssDeclarations(css)) {
    const i = decl.indexOf(':');
    if (i === -1) { continue; }
    const prop = decl.slice(0, i).trim();
    const val = decl.slice(i + 1).trim();
    if (!prop || !val) { continue; }
    entries.push({ property: prop, value: val });
  }
  return entries.length ? entries : null;
}
