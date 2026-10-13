import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'src/generated/**'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Paramètres préfixés par « _ » : volontairement inutilisés (signatures imposées).
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
)
