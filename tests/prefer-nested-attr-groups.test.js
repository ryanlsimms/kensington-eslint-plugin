import { RuleTester } from 'eslint';
import rule from '../rules/prefer-nested-attr-groups.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('prefer-nested-attr-groups', rule, {
  valid: [
    // single member of a prefix — keep flat
    `t.input({ ariaLabel: 'foo' });`,
    // already nested
    `t.input({ hx: { get: '/x', target: '#y' } });`,
    // no shared prefix
    `t.div({ class: 'x', id: 'y' });`,
    // not a tag call
    `obj.method({ hxGet: '/x', hxTrigger: 'change' });`,
    // prefix with invalid JS identifier as the prefix itself
    `t.div({ '1foo-bar': 'a', '1foo-baz': 'b' });`,
  ],

  invalid: [
    // contiguous group, auto-fix
    {
      code: `t.input({ hxGet: '/x', hxTrigger: 'change', hxTarget: '#y' });`,
      output: `t.input({ hx: { get: '/x', trigger: 'change', target: '#y' } });`,
      errors: [{ messageId: 'preferNested' }],
    },
    // group via quoted-kebab keys
    {
      code: `t.input({ 'data-page': '1', 'data-id': '2' });`,
      output: `t.input({ data: { page: '1', id: '2' } });`,
      errors: [{ messageId: 'preferNested' }],
    },
    // group surrounded by other attrs
    {
      code: `t.input({ class: 'c', hxGet: '/x', hxTarget: '#y', id: 'i' });`,
      output: `t.input({ class: 'c', hx: { get: '/x', target: '#y' }, id: 'i' });`,
      errors: [{ messageId: 'preferNested' }],
    },
    // multi-level kebab: dataPageContent → data: { pageContent }
    {
      code: `t.div({ dataPageContent: 'a', dataPageNav: 'b' });`,
      output: `t.div({ data: { pageContent: 'a', pageNav: 'b' } });`,
      errors: [{ messageId: 'preferNested' }],
    },
    // non-contiguous members: report but no auto-fix
    {
      code: `t.input({ hxGet: '/x', class: 'c', hxTarget: '#y' });`,
      output: null,
      errors: [{ messageId: 'preferNested' }],
    },
    // existing bare prefix sibling: report but no auto-fix
    {
      code: `t.input({ hx: extra, hxGet: '/x', hxTarget: '#y' });`,
      output: null,
      errors: [{ messageId: 'preferNested' }],
    },
  ],
});
