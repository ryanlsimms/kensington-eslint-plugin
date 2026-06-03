import { RuleTester } from 'eslint';
import rule from '../rules/prefer-camelcase-attrs.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('prefer-camelcase-attrs', rule, {
  valid: [
    `t.div({ class: 'x' });`,
    `t.div({ ariaLabel: 'foo' });`,
    `t.div({ dataKey: 'k' });`,
    // identifier key without hyphen, untouched
    `t.div({ id: 'a' });`,
    // computed key, skip
    `t.div({ [key]: 'v' });`,
    // shorthand, skip
    `t.div({ foo });`,
    // not a tag call
    `obj.method({ 'aria-label': 'x' });`,
    // already-quoted but non-kebab string key
    `t.div({ 'with space': 'v' });`,
  ],

  invalid: [
    {
      code: `t.div({ 'aria-label': 'x' });`,
      output: `t.div({ ariaLabel: 'x' });`,
      errors: [{ messageId: 'preferCamelCase' }],
    },
    {
      code: `t.td({ 'data-label': h });`,
      output: `t.td({ dataLabel: h });`,
      errors: [{ messageId: 'preferCamelCase' }],
    },
    {
      code: `t.div({ 'data-bs-toggle': 'collapse' });`,
      output: `t.div({ dataBsToggle: 'collapse' });`,
      errors: [{ messageId: 'preferCamelCase' }],
    },
    // settings.kensington.objectNames overrides the default — `tag.<x>(...)` is now recognised
    {
      code: `tag.div({ 'aria-label': 'x' });`,
      output: `tag.div({ ariaLabel: 'x' });`,
      settings: { kensington: { objectNames: ['tag'] } },
      errors: [{ messageId: 'preferCamelCase' }],
    },
    // per-rule option overrides settings
    {
      code: `k.div({ 'aria-label': 'x' });`,
      output: `k.div({ ariaLabel: 'x' });`,
      settings: { kensington: { objectNames: ['tag'] } },
      options: [{ objectNames: ['k'] }],
      errors: [{ messageId: 'preferCamelCase' }],
    },
    // multiple in one object
    {
      code: `t.div({ 'aria-label': 'a', 'data-key': 'k' });`,
      output: `t.div({ ariaLabel: 'a', dataKey: 'k' });`,
      errors: [{ messageId: 'preferCamelCase' }, { messageId: 'preferCamelCase' }],
    },
  ],
});
