import { RuleTester } from 'eslint';
import rule from '../rules/prefer-array-for-multiline-content.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('prefer-array-for-multiline-content', rule, {
  valid: [
    // single-line, bare content
    `t.div('hello');`,
    `t.p({ class: 'x' }, 'hello');`,
    `t.div({ class: 'x' }, t.p('inner'));`,

    // multi-line but content stays on the call's opening line
    `t.div({ class: 'x' }, t.p('inner', {
       extra: true,
     }));`,

    // stacked attrs, single-line content trailing on the closing-paren line
    `t.a({
       href: 'https://example.com',
       target: '_blank',
     }, 'VS Code');`,

    // already an array
    `t.div({ class: 'x' }, [
       t.p('only'),
     ]);`,

    // single-arg call where the arg is the attrs object (no content)
    `t.div({
       class: 'x',
     });`,

    // not a tag call
    `obj.method(
       something
     );`,
  ],

  invalid: [
    // single-child content on its own line — `[` hugs the attrs `}` line, `]` hugs the `)` line
    {
      code: `t.div({ class: 'x' },\n  t.p('only')\n);`,
      output: `t.div({ class: 'x' }, [\n  t.p('only'),\n]);`,
      errors: [{ messageId: 'wrapInArray' }],
    },
    // single-arg content on its own line — `[` hugs the call's `(`, `]` hugs the `)`
    {
      code: `t.div(\n  t.p('only')\n);`,
      output: `t.div([\n  t.p('only'),\n]);`,
      errors: [{ messageId: 'wrapInArray' }],
    },
    // string content on its own line
    {
      code: `t.p({ class: 'x' },\n  'hello world'\n);`,
      output: `t.p({ class: 'x' }, [\n  'hello world',\n]);`,
      errors: [{ messageId: 'wrapInArray' }],
    },
    // existing trailing comma after content — don't double up
    {
      code: `t.div({ class: 'x' },\n  t.p('only'),\n);`,
      output: `t.div({ class: 'x' }, [\n  t.p('only'),\n]);`,
      errors: [{ messageId: 'wrapInArray' }],
    },
  ],
});
