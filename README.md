# create-favicon

[![npm version](https://img.shields.io/npm/v/create-favicon.svg?style=flat-square)](https://www.npmjs.com/package/create-favicon)

Creates a minimal set of favicons that are compatible with most environments,
based on [this article](https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs) by Evil Martians.

Source image must be at least 512x512, preferably a square SVG.

The generated files are:

- 32x32 favicon (for older devices)
- 180x180 PNG icon for Apple devices
- 192x192 PNG icon for Android devices
- 512x512 PNG icon for Android devices
- Web manifest files pointing to the two larger PNG icons
- (If source is an SVG) An SVG icon for modern browsers - this also supports dark mode

Outputs the HTML needed to link these files up on success.
Available as a CLI tool and as an API.

## CLI usage

```sh
## Install globally and run
npm install -g create-favicon
create-favicon <path-to-image> [output-dir]

## Run straight from npm (separate flags with --)
npm create favicon <path-to-image> [output-dir]
npm create favicon <path-to-image> [output-dir] -- --overwrite

## Or use npx (separate flags with --)
npx create-favicon <path-to-image> [output-dir]
npx create-favicon <path-to-image> [output-dir] -- --no-warn
```

## CLI options

```
<path-to-image>     Source image
[output-dir]        Output directory (default: ./favicons)

--overwrite         Overwrite existing files (default: false)
--base-path <path>  Base path for printed HTML and web manifest (default: /)
--no-warn           Disable warnings (default: false)
--no-manifest       Skip outputting a webmanifest (default: false)
-h, --help          Display this message
-v, --version       Display version number
```

## API usage

```ts
import {createFavicon} from 'create-favicon'

// Outputs the files to the current working directory + /favicons,
// and returns the HTML to be inserted into the <head> of your HTML document
const {html} = await createFavicon({sourceFile: '/path/to/some/file.svg'})

// You can also specify the output directory:
const {html} = await createFavicon({
  sourceFile: '/path/to/some/file.svg',
  outputDir: '/path/to/output/dir',
})

// If your files are not going to be placed at the root of your domain,
// you will have to specify a custom base path:
const {html} = await createFavicon({
  sourceFile: '/path/to/some/file.svg',
  basePath: '/my/app',
})

// If you want to overwrite existing files, pass the `overwrite` option:
const {html} = await createFavicon({
  sourceFile: '/path/to/some/file.svg',
  overwrite: true,
})

// Warnings can be silenced by passing `false` to the `warn` option:
const {html} = await createFavicon({
  sourceFile: '/path/to/some/file.svg',
  warn: false,
})

// Manifest generation can be disabled:
const {html} = await createFavicon({
  sourceFile: '/path/to/some/file.svg',
  manifest: false,
})

// The favicon generator can also take a URL as input:
const {html} = await createFavicon({sourceFile: 'https://example.com/sourceLogo.svg'})

// For advanced HTTP cases (need to configure proxies, redirects etc),
// pull the image down yourself and pass it to the generator as a buffer:
const myImage = await someFetcher({
  url: 'https://example.com/sourceLogo.svg',
}).then((res) => res.buffer())

const {html} = await createFavicon({sourceFile: myImage})
```

## License

MIT © [Espen Hovlandsdal](https://espen.codes/)
