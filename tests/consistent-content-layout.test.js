import { RuleTester } from 'eslint';
import rule from '../rules/consistent-content-layout.js';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });

tester.run('consistent-content-layout', rule, {
  valid: [
    // inline, no attrs
    `t.div('hello');`,
    // inline, with attrs
    `t.div({ class: 'x' }, 'hello');`,
    `t.div({ class: 'x' }, t.p('inner'));`,

    // stacked content, with attrs — [ on attrs line, ] on ) line
    `t.div({ class: 'x' }, [
      t.p('a'),
      t.p('b'),
    ]);`,

    // stacked attrs AND stacked content
    `t.div({
      class: 'x',
    }, [
      t.p('a'),
    ]);`,

    // stacked content, no attrs — [ on call line, ] on ) line
    `t.div([
      t.p('a'),
      t.p('b'),
    ]);`,

    // attrs only, no content
    `t.div({ class: 'x' });`,

    // not a tag call
    `obj.method({ a: 1 },
      something
    );`,
  ],

  invalid: [
    // content (single tag) on a separate line from attrs
    {
      code: `t.div({ class: 'x' },
  t.p('inner')
);`,
      output: `t.div({ class: 'x' }, t.p('inner'));`,
      errors: [
        { messageId: 'contentMustStartOnAnchorLine' },
        { messageId: 'contentMustEndOnClosingParenLine' },
      ],
    },
    // single-arg content on a separate line from (
    {
      code: `t.div(
  t.p('inner')
);`,
      output: `t.div(t.p('inner'));`,
      errors: [
        { messageId: 'contentMustStartOnAnchorLine' },
        { messageId: 'contentMustEndOnClosingParenLine' },
      ],
    },
    // array content with [ on a separate line from attrs
    {
      code: `t.div({ class: 'x' },
  [
    t.p('a'),
  ]);`,
      output: `t.div({ class: 'x' }, [
    t.p('a'),
  ]);`,
      errors: [{ messageId: 'contentMustStartOnAnchorLine' }],
    },
    // ] on a separate line from )
    {
      code: `t.div({ class: 'x' }, [
  t.p('a'),
]
);`,
      output: `t.div({ class: 'x' }, [
  t.p('a'),
]);`,
      errors: [{ messageId: 'contentMustEndOnClosingParenLine' }],
    },
    // trailing comma after content, ) on next line
    {
      code: `t.div({ class: 'x' }, t.p('inner'),
);`,
      output: `t.div({ class: 'x' }, t.p('inner'),);`,
      errors: [{ messageId: 'contentMustEndOnClosingParenLine' }],
    },
    // comment between , and content: report but no fix
    {
      code: `t.div({ class: 'x' },
  // first
  t.p('inner'));`,
      output: null,
      errors: [{ messageId: 'contentMustStartOnAnchorLine' }],
    },
  ],
});
