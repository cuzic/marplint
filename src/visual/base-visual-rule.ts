/**
 * Base class for visual rules using Template Method pattern
 * Eliminates code duplication across visual rule checkers
 */

import { execSync } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { type Browser, chromium, type Page } from 'playwright';
import type { LintError } from '../rules/slide-line-count.js';

export interface BaseVisualConfig {
  enabled?: boolean;
  viewport?: {
    width?: number;
    height?: number;
  };
}

export interface VisualCheckResult<TResult> {
  errors: LintError[];
  results: TResult[];
}

const DEFAULT_VIEWPORT = {
  width: 1280,
  height: 720
};

/**
 * Detect installed Chromium-based browser
 */
export function detectInstalledBrowser(): string | null {
  const browserPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/opt/google/chrome/chrome',
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
    '/snap/bin/chromium'
  ];

  for (const browserPath of browserPaths) {
    if (existsSync(browserPath)) {
      return browserPath;
    }
  }

  const commands = ['google-chrome', 'chromium', 'chromium-browser', 'microsoft-edge'];
  for (const cmd of commands) {
    try {
      const result = execSync(`which ${cmd}`, { encoding: 'utf-8' }).trim();
      if (result) return result;
    } catch {}
  }

  return null;
}

/**
 * Build Marp HTML from markdown file
 */
export async function buildMarpHtml(
  markdownPath: string,
  tmpPrefix: string
): Promise<{ htmlContent: string; tmpDir: string }> {
  const tmpDir = await fs.mkdtemp(join(tmpdir(), `marplint-${tmpPrefix}-`));
  const tmpHtmlPath = join(tmpDir, 'output.html');

  const absolutePath = resolve(markdownPath);
  execSync(
    `bunx --bun @marp-team/marp-cli@latest --no-stdin --html --allow-local-files "${absolutePath}" -o "${tmpHtmlPath}"`,
    { stdio: 'pipe', encoding: 'utf-8' }
  );

  const htmlContent = await fs.readFile(tmpHtmlPath, 'utf-8');
  return { htmlContent, tmpDir };
}

/**
 * Launch browser with detected or bundled Chromium
 */
export async function launchBrowser(): Promise<Browser> {
  const browserPath = detectInstalledBrowser();
  const launchOptions: { headless: boolean; executablePath?: string } = { headless: true };
  if (browserPath) {
    launchOptions.executablePath = browserPath;
  }
  return chromium.launch(launchOptions);
}

/**
 * Setup page with viewport and content
 */
export async function setupPage(
  browser: Browser,
  htmlContent: string,
  viewport: { width: number; height: number }
): Promise<Page> {
  const page = await browser.newPage();
  await page.setViewportSize(viewport);
  await page.setContent(htmlContent, { waitUntil: 'networkidle' });
  return page;
}

/**
 * Cleanup temporary directory
 */
export async function cleanupTmpDir(tmpDir: string): Promise<void> {
  try {
    await fs.rm(tmpDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Get merged viewport configuration
 */
export function getMergedViewport(config?: { width?: number; height?: number }): { width: number; height: number } {
  return {
    width: config?.width ?? DEFAULT_VIEWPORT.width,
    height: config?.height ?? DEFAULT_VIEWPORT.height
  };
}

/**
 * Abstract base class for visual rules using Template Method pattern
 */
export abstract class BaseVisualRule<TConfig extends BaseVisualConfig, TResult> {
  protected abstract readonly tmpPrefix: string;
  protected abstract readonly defaultConfig: Required<TConfig>;

  /**
   * Template method: orchestrates the visual check process
   */
  async check(markdownPath: string, config: TConfig = {} as TConfig): Promise<VisualCheckResult<TResult>> {
    const mergedConfig = this.mergeConfig(config);

    if (!mergedConfig.enabled) {
      return { errors: [], results: [] };
    }

    const { htmlContent, tmpDir } = await buildMarpHtml(markdownPath, this.tmpPrefix);

    try {
      const browser = await launchBrowser();

      try {
        const viewport = getMergedViewport(mergedConfig.viewport);
        const page = await setupPage(browser, htmlContent, viewport);

        const results = await this.analyze(page, mergedConfig);
        const errors = this.convertToErrors(results, mergedConfig);

        return { errors, results };
      } finally {
        await browser.close();
      }
    } finally {
      await cleanupTmpDir(tmpDir);
    }
  }

  /**
   * Hook: merge user config with defaults
   */
  protected mergeConfig(config: TConfig): Required<TConfig> {
    return {
      ...this.defaultConfig,
      ...config,
      viewport: {
        ...this.defaultConfig.viewport,
        ...config.viewport
      }
    } as Required<TConfig>;
  }

  /**
   * Abstract method: perform the actual visual analysis
   * Subclasses must implement this with their specific logic
   */
  protected abstract analyze(page: Page, config: Required<TConfig>): Promise<TResult[]>;

  /**
   * Abstract method: convert analysis results to lint errors
   * Subclasses must implement this with their specific error creation logic
   */
  protected abstract convertToErrors(results: TResult[], config: Required<TConfig>): LintError[];
}
