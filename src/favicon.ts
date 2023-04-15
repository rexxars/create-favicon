import path from 'node:path'
import {mkdir, readFile, writeFile} from 'node:fs/promises'
import sharp from 'sharp'
import {request} from 'undici'
import {sharpToIco} from './ico.js'
import {generateWebManifest} from './webmanifest.js'
import type {FaviconOptions, FaviconResult} from './types.js'

/**
 * Create variations of a favicon from a source image
 *
 * @param options - Options for the favicon generator
 * @returns An object containing results of the favicon generation
 * @public
 */
export async function createFavicon(options: FaviconOptions): Promise<FaviconResult> {
  if (!options) {
    throw new Error('No options specified')
  }

  const {
    sourceFile,
    outputDir = path.join(process.cwd(), 'favicons'),
    warn = console.warn,
    basePath = '/',
  } = options

  if (!sourceFile) {
    throw new Error('No source file specified')
  }

  if (typeof sourceFile !== 'string' && !Buffer.isBuffer(sourceFile)) {
    throw new Error('Source file must be a string (file path or URL) or a Buffer')
  }

  const isBuffer = Buffer.isBuffer(sourceFile)
  const isUrl = !isBuffer && /^https?:\/\//.test(sourceFile)

  let source = Buffer.isBuffer(sourceFile) ? sourceFile : undefined
  if (isUrl) {
    source = await downloadImage(sourceFile)
  } else if (!isBuffer) {
    source = await readImage(path.resolve(process.cwd(), sourceFile))
  }

  if (!source) {
    throw new Error('Could not read source image')
  }

  const image = sharp(source)
  const {width, height, format} = await image.metadata()
  if (!width || !height) {
    throw new Error('Could not read image dimensions')
  }

  if (format !== 'svg' && (width < 512 || height < 512)) {
    throw new Error('Source image must be at least 512x512 pixels')
  }

  if (format !== 'svg') {
    printWarning('Source image is not an SVG - skipping SVG output', warn)
  }

  await mkdir(outputDir, {recursive: true})

  const base = image.ensureAlpha()

  if (width !== height) {
    printWarning(
      'Source image is not square - it is HIGHLY recommended that input image is square',
      warn
    )
    const size = Math.max(width, height, 512)
    base.resize(size, size, {fit: 'contain', background: 'transparent'})
  }

  // 512x512 and 192x192 for Android devices
  await base.clone().resize(512, 512).png().toFile(path.join(outputDir, 'icon-512.png'))
  await base.clone().resize(192, 192).png().toFile(path.join(outputDir, 'icon-192.png'))

  // 180x180 for iOS devices
  await base.clone().resize(180, 180).png().toFile(path.join(outputDir, 'apple-touch-icon.png'))

  // 32x32 favicon for older browsers
  await writeFile(path.join(outputDir, 'favicon.ico'), await sharpToIco(base.clone()))

  // Web manifest file pointing to the generated files
  await writeFile(path.join(outputDir, 'manifest.webmanifest'), generateWebManifest(basePath))

  // If the input is an SVG, pass-through the original SVG as well
  if (format === 'svg') {
    await writeFile(path.join(outputDir, 'icon.svg'), source)
  }

  // Generate the HTML needed for the `<head>` of the HTML document
  const html = generateHtml({basePath, hasSvg: format === 'svg'})

  return {html}
}

/**
 * Generates the HTML required for the `<head>` of the HTML document
 *
 * @param options - Options for the HTML generator
 * @returns The `<link>` tags required, unindented and separated by newlines
 * @internal
 */
function generateHtml(options: {basePath: string; hasSvg: boolean}): string {
  const {basePath, hasSvg} = options
  const base = basePath.endsWith('/') ? basePath.replace(/\/+$/, '') : basePath

  const links = [`<link rel="icon" href="${base}/favicon.ico" sizes="any">`]

  if (hasSvg) {
    links.push(`<link rel="icon" href="${base}/icon.svg" type="image/svg+xml">`)
  }

  links.push(
    `<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png">`,
    `<link rel="manifest" href="${base}/manifest.webmanifest">`
  )

  return links.join('\n')
}

/**
 * Downloads an image from a URL to a Buffer
 *
 * @param url - The URL to download
 * @returns A buffer containing the downloaded image
 * @internal
 */
async function downloadImage(url: string): Promise<Buffer> {
  const {statusCode, body} = await request(url, {reset: true}).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : `${err}`
    throw new Error(`Failed fetching image from "${url}": ${message}`)
  })

  if (statusCode !== 200) {
    throw new Error(`Failed fetching image from "${url}": Server returned HTTP ${statusCode}`)
  }

  const buffers: Buffer[] = []
  for await (const chunk of body) {
    buffers.push(chunk)
  }

  return Buffer.concat(buffers)
}

/**
 * Read an image from the filesystem to a buffer, with a helpful error message on errors
 *
 * @param filePath - The path to the file to read
 * @returns A buffer containing the image data
 * @internal
 */
async function readImage(filePath: string): Promise<Buffer> {
  try {
    return await readFile(filePath)
  } catch (err) {
    const message = err instanceof Error ? err.message : `${err}`
    throw new Error(`Could not read file "${filePath}": ${message}`)
  }
}

/**
 * Print a warning message with the given warner function.
 * If the warner is the default `console.warn`, we will add a prefix and color it yellow.
 *
 * @param message - Message to print
 * @param warner - Function to use for printing the message
 * @internal
 */
function printWarning(message: string, warner: typeof console.warn | false): void {
  if (!warner) {
    return
  }

  warner(warner === console.warn ? `\u001b[93m[warn]\u001b[39m ${message}` : message)
}
