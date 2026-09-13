// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * Config única para todo el monorepo. Los paquetes corren `eslint .` con esta
 * raíz: una sola lista de reglas evita que cada uno derive por su cuenta.
 */
export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.d.ts', '**/coverage/**', '**/public/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // El `_` por delante marca un parámetro que existe sólo por posición.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // Código de shadcn/ui, pegado tal cual del generador. Se deja como viene
    // para que una actualización del upstream sea una copia y no un merge.
    files: ['**/components/ui/**'],
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/test/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-constant-binary-expression': 'off',
    },
  },
);
