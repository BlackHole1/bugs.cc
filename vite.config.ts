import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    printWidth: 100,
    tabWidth: 2,
    useTabs: false,
    semi: true,
    singleQuote: true,
    trailingComma: 'all',
    endOfLine: 'lf',
    proseWrap: 'preserve',
    sortPackageJson: true,
    // .astro goes through the bundled prettier-plugin-astro, which needs @astrojs/compiler-rs.
    astro: true,
    ignorePatterns: [
      'dist/**',
      '.astro/**',
      'node_modules/**',
      'public/**',
      'bun.lock',
      'src/content/**',
    ],
  },
  lint: {
    plugins: ['typescript', 'unicorn', 'oxc', 'import', 'vitest'],
    categories: {
      correctness: 'error',
      suspicious: 'warn',
      perf: 'warn',
    },
    env: {
      browser: true,
      node: true,
      es2024: true,
    },
    ignorePatterns: ['dist/**', '.astro/**', 'node_modules/**', 'public/**', 'src/content/**'],
    rules: {
      eqeqeq: 'error',
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error', 'info'],
        },
      ],
      'typescript/consistent-type-imports': 'error',
      'typescript/no-explicit-any': 'warn',
      'import/no-cycle': 'warn',
      // Type-aware: the casts it flags narrow hast nodes and parsed JSON on purpose.
      'typescript/no-unsafe-type-assertion': 'off',
      'vite-plus/prefer-vite-plus-imports': 'error',
    },
    overrides: [
      {
        files: ['**/*.astro'],
        rules: {
          'no-unused-vars': 'off',
          'typescript/no-unused-vars': 'off',
          'import/no-unassigned-import': 'off',
        },
      },
      {
        files: ['scripts/**/*.ts'],
        rules: {
          'no-console': 'off',
          'no-await-in-loop': 'off',
        },
      },
      {
        files: ['tests/**/*.test.ts'],
        rules: {
          'typescript/no-explicit-any': 'off',
          'typescript/no-non-null-assertion': 'off',
        },
      },
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin',
      },
    ],
  },
});
