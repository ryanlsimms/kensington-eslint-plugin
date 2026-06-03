import { RuleTester } from 'eslint';
import rule from '../rules/prefer-style-object.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('prefer-style-object', rule, {
  valid: [
    // already an object
    `t.div({ style: { backgroundColor: 'red' } });`,
    // signal value, can't statically rewrite
    `t.div({ style: someSignal });`,
    // template literal with interpolation, leave alone
    `t.div({ style: \`color: \${c}\` });`,
    // not a tag call
    `obj.method({ style: 'color: red' });`,
    // empty/whitespace-only string, nothing to convert
    `t.div({ style: '' });`,
    // CSS custom property — would need a quoted key, skip
    `t.div({ style: '--bg-color: red' });`,
    // vendor prefix — kebab round-trip via camelToKebab would lose the leading dash, skip
    `t.div({ style: '-webkit-appearance: none' });`,
    // mixed clean + custom property — bail entirely
    `t.div({ style: 'color: red; --accent: blue' });`,
  ],

  invalid: [
    {
      code: `t.div({ style: 'color: red' });`,
      output: `t.div({ style: { color: "red" } });`,
      errors: [{ messageId: 'preferObject' }],
    },
    {
      code: `t.div({ style: 'background-color: red; z-index: 2' });`,
      output: `t.div({ style: { backgroundColor: "red", zIndex: "2" } });`,
      errors: [{ messageId: 'preferObject' }],
    },
    // multi declarations with quotes preserved
    {
      code: `t.div({ style: "font-family: 'Helvetica Neue'; color: blue" });`,
      output: `t.div({ style: { fontFamily: "'Helvetica Neue'", color: "blue" } });`,
      errors: [{ messageId: 'preferObject' }],
    },
  ],
});
