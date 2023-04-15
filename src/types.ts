/**
 * Options for the favicon generator
 *
 * @public
 */
export interface FaviconOptions {
  /**
   * The source image to use for the favicon. Can be a file path, a URL or a Buffer.
   *
   * Needs to be a square image with a minimum size of 512x512 pixels,
   * and should preferably be a SVG.
   */
  sourceFile: string | Buffer

  /**
   * The output directory for the generated favicons.
   * Defaults to a `favicons` folder within the current working directory.
   */
  outputDir?: string

  /**
   * Function to use for printing warnings.
   * Pass `false` to disable warnings.
   *
   * Defaults to `console.warn`.
   */
  warn?: typeof console.warn | false

  /**
   * Base path to use for printed HTML and web manifest files.
   * Defaults to `/`.
   */
  basePath?: string
}

/**
 * The result of a favicon creation run
 *
 * @public
 */
export interface FaviconResult {
  /**
   * The HTML code to place in the `<head>` of your HTML document.
   * Note: You may need to adjust paths (use `basePath` option to programatically do so).
   */
  html: string
}
