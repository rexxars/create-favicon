import {defineConfig} from '@sanity/pkg-utils'

export default defineConfig({
  tsconfig: 'tsconfig.dist.json',
  runtime: 'node',
  bundles: [
    {
      source: './src/cli.ts',
      require: './dist/cli.cjs',
      runtime: 'node',
    },
  ],
})
