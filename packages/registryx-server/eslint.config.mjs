import tseslint from 'typescript-eslint';
import security from 'eslint-plugin-security';

export default [
  ...tseslint.configs.recommended,
  security.configs.recommended,
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'security/detect-object-injection': 'off',
    },
  },
  { ignores: ['dist/', 'node_modules/', 'coverage/'] },
];
