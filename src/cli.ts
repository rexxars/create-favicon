#!/usr/bin/env node
/* eslint-disable no-process-exit, no-console */
import cac from 'cac'
import {version} from '../package.json'
import {createFavicon} from './favicon.js'

const cli = cac('create-favicon')

cli
  .command('<source-file> [output-dir]', 'Generate favicons from a source image', {
    ignoreOptionDefaultValue: true,
  })
  .option('--overwrite', 'Overwrite existing files', {default: false})
  .option('--base-path <path>', 'Base path for printed HTML and web manifest', {default: '/'})
  .option('--no-manifest', 'Skip outputting a webmanifest', {default: false})
  .option('--no-warn', 'Disable warnings', {default: false})
  .example((name) => `${name} source.svg`)
  .example((name) => `${name} https://example.com/source.png --output-dir icons`)
  .action(async (sourceFile, outputDir, flags) => {
    const {basePath, warn, overwrite, manifest} = flags
    const options = {sourceFile, outputDir, basePath, warn, overwrite, manifest}

    try {
      const result = await createFavicon(options)
      console.log(result.html)
    } catch (err) {
      console.error(err)
      process.exit(1)
    }
  })

// Display help message when `-h` or `--help` appears
cli.help()

// Display version number when `-v` or `--version` appears
// It's also used in help message
cli.version(version)

// Trigger parsing and execute commands
try {
  cli.parse()
} catch (err: unknown) {
  if (!(err instanceof Error)) {
    throw new Error(`Unknown error: ${err}`)
  }

  if (err.message.includes('missing required args')) {
    cli.outputHelp()
    process.exit(1)
  }

  console.error(err)
  process.exit(1)
}
