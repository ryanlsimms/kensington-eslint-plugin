import { RuleTester } from 'eslint';
import rule from '../rules/prefer-boolean-attribute-true.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('prefer-boolean-attribute-true', rule, {
  valid: [
    `t.input({ disabled: true });`,
    `t.input({ type: 'checkbox' });`,
    // empty string on a non-boolean attribute is fine
    `t.input({ value: '' });`,
    // boolean attribute set to a non-empty string is a user choice, don't touch
    `t.input({ disabled: 'disabled' });`,
    // boolean attribute set to a variable, can't tell statically
    `t.input({ disabled: someVar });`,
    // not a tag call
    `obj.input({ disabled: '' });`,
  ],

  invalid: [
    {
      code: `t.input({ disabled: '' });`,
      output: `t.input({ disabled: true });`,
      errors: [{ messageId: 'preferTrue' }],
    },
    {
      code: `t.option({ selected: "" });`,
      output: `t.option({ selected: true });`,
      errors: [{ messageId: 'preferTrue' }],
    },
    {
      code: `t.input({ type: 'checkbox', checked: '', disabled: '' });`,
      output: `t.input({ type: 'checkbox', checked: true, disabled: true });`,
      errors: [{ messageId: 'preferTrue' }, { messageId: 'preferTrue' }],
    },
    // HTML's compound-word boolean attribute
    {
      code: `t.form({ novalidate: '' });`,
      output: `t.form({ novalidate: true });`,
      errors: [{ messageId: 'preferTrue' }],
    },
    // extra boolean attrs via options
    {
      code: `t.div({ 'my-flag': '' });`,
      output: `t.div({ 'my-flag': true });`,
      options: [{ extraBooleanAttrs: ['my-flag'] }],
      errors: [{ messageId: 'preferTrue' }],
    },
  ],
});
