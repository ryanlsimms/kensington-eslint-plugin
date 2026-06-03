import { RuleTester } from 'eslint';
import rule from '../rules/prefer-nested-attr-groups.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('prefer-nested-attr-groups', rule, {
  valid: [
    // single member of a prefix, keep flat
    `t.input({ ariaLabel: 'foo' });`,
    // already nested
    `t.input({ data: { page: '1', id: '2' } });`,
    // no shared prefix
    `t.div({ class: 'x', id: 'y' });`,
    // not a tag call
    `obj.method({ 'data-x': '1', 'data-y': '2' });`,
    // prefix with invalid JS identifier as the prefix itself
    `t.div({ '1foo-bar': 'a', '1foo-baz': 'b' });`,
    // multi-word HTML/SVG attrs that happen to share a leading word — NOT a namespace
    `t.path({ strokeWidth: '2', strokeLinecap: 'round' });`,
    // hx-* is not a default namespace; no fire without explicit configuration
    `t.input({ hxGet: '/x', hxTrigger: 'change', hxTarget: '#y' });`,
  ],

  invalid: [
    // data-*, contiguous, auto-fix
    {
      code: `t.input({ 'data-page': '1', 'data-id': '2' });`,
      output: `t.input({ data: { page: '1', id: '2' } });`,
      errors: [{ messageId: 'preferNested' }],
    },
    // aria-*, contiguous, auto-fix
    {
      code: `t.button({ ariaLabel: 'close', ariaPressed: 'false' });`,
      output: `t.button({ aria: { label: 'close', pressed: 'false' } });`,
      errors: [{ messageId: 'preferNested' }],
    },
    // multi-level kebab: dataPageContent → data: { pageContent }
    {
      code: `t.div({ dataPageContent: 'a', dataPageNav: 'b' });`,
      output: `t.div({ data: { pageContent: 'a', pageNav: 'b' } });`,
      errors: [{ messageId: 'preferNested' }],
    },
    // group surrounded by other attrs
    {
      code: `t.input({ class: 'c', ariaLabel: 'go', ariaPressed: 'false', id: 'i' });`,
      output: `t.input({ class: 'c', aria: { label: 'go', pressed: 'false' }, id: 'i' });`,
      errors: [{ messageId: 'preferNested' }],
    },
    // non-contiguous members: report but no auto-fix
    {
      code: `t.input({ ariaLabel: 'a', class: 'c', ariaPressed: 'b' });`,
      output: null,
      errors: [{ messageId: 'preferNested' }],
    },
    // existing bare prefix sibling: report but no auto-fix
    {
      code: `t.input({ aria: extra, ariaLabel: 'a', ariaPressed: 'b' });`,
      output: null,
      errors: [{ messageId: 'preferNested' }],
    },
    // hx-* fires when configured via per-rule option
    {
      code: `t.input({ hxGet: '/x', hxTrigger: 'change', hxTarget: '#y' });`,
      output: `t.input({ hx: { get: '/x', trigger: 'change', target: '#y' } });`,
      options: [{ namespaces: ['data', 'aria', 'hx'] }],
      errors: [{ messageId: 'preferNested' }],
    },
    // namespaces via plugin-level settings
    {
      code: `t.input({ hxGet: '/x', hxTarget: '#y' });`,
      output: `t.input({ hx: { get: '/x', target: '#y' } });`,
      settings: { kensington: { namespaces: ['data', 'aria', 'hx'] } },
      errors: [{ messageId: 'preferNested' }],
    },
  ],
});
