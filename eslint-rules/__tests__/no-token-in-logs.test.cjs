'use strict';

const { RuleTester } = require('eslint');
const rule = require('../no-token-in-logs.cjs');

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

ruleTester.run('no-token-in-logs', rule, {
  valid: [
    { code: "console.log('starting flow');" },
    { code: "console.info('user', user.id);" },
    { code: "console.error('failed', error.message);" },
    { code: "console.warn('count', items.length);" },
    { code: "console.log({ ok: true, count: 5 });" },
    { code: "console.log(`user ${user.email}`);" },
    { code: "logger.log('token-like value');" }, // not console
    { code: "console.log(session.user.id);" }, // session.user.id — neither segment matches
    { code: "console.log({ hasAccessToken: !!params.accessToken });" }, // boolean presence check
    { code: "console.log({ token: !!params.token });" }, // ditto
    { code: "console.log({ jwt: Boolean(x) });" }, // Boolean() wrapper
    { code: "console.log({ password: false });" }, // boolean literal
  ],
  invalid: [
    {
      code: "console.log('login', accessToken);",
      errors: [{ messageId: 'noTokenInLogs' }],
    },
    {
      code: "console.info('refresh', refreshToken);",
      errors: [{ messageId: 'noTokenInLogs' }],
    },
    {
      code: "console.debug('length', accessToken.length);",
      errors: [{ messageId: 'noTokenInLogs' }],
    },
    {
      code: "console.log('jwt', jwt);",
      errors: [{ messageId: 'noTokenInLogs' }],
    },
    {
      code: "console.log({ token: 'x' });",
      errors: [{ messageId: 'noTokenInLogs' }],
    },
    {
      code: "console.log({ jwt });", // shorthand
      errors: [{ messageId: 'noTokenInLogs' }],
    },
    {
      code: "console.log('user', user.password);",
      errors: [{ messageId: 'noTokenInLogs' }],
    },
    {
      code: "console.log(`session: ${refreshToken}`);",
      errors: [{ messageId: 'noTokenInLogs' }],
    },
    {
      code: "console.log('api secret', apiSecret);",
      errors: [{ messageId: 'noTokenInLogs' }],
    },
    {
      code: "console.warn('credential', credential);",
      errors: [{ messageId: 'noTokenInLogs' }],
    },
    {
      // Both args bad — should report twice
      code: "console.log(accessToken, refreshToken);",
      errors: [
        { messageId: 'noTokenInLogs' },
        { messageId: 'noTokenInLogs' },
      ],
    },
  ],
});

// RuleTester throws on failure — if we get here, all cases passed.
console.log('no-token-in-logs: all RuleTester cases passed.'); // eslint-disable-line no-console
