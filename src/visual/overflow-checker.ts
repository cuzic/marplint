/**
 * Visual overflow checker using Playwright
 * Renders slides and detects actual pixel overflow
 */

import { chromium, type Browser, type Page } from 'playwright';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import type { LintError } from '../rules/slide-line-count.js';

export interface OverflowCheckerConfig {
  enabled?: boolean;
  threshold?: number; // Minimum overflow in pixels to report
  viewport?: {
    width?: number;
    height?: number;
  };
}

export interface OverflowResult {
  slideNumber: number;
  hasOverflow: boolean;
  hasVerticalOverflow: boolean;
  hasHorizontalOverflow: boolean;
  overflowHeight: number;
  overflowWidth: number;
  scrollHeight: number;
  clientHeight: number;
  preview: string;
  dataClass?: string;
}

const DEFAULT_CONFIG: Required<OverflowCheckerConfig> = {
  enabled: true,
  threshold: 10,
  viewport: {
    width: 1280,
    height: 720
  }
};

/**
 * Detect installed Chromium-based browser
 */
function detectInstalledBrowser(): string | null {
  const browserPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/opt/google/chrome/chrome',
    '/usr/bin/microsoft-edge',
    '/usr/bin/microsoft-edge-stable',
    '/snap/bin/chromium',
  ];

  const existsSync = require('fs').existsSync;
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
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Check for overflow in a single markdown file
 */
export async function checkOverflow(
  markdownPath: string,
  config: OverflowCheckerConfig = {}
): Promise<{ errors: LintError[]; results: OverflowResult[] }> {
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    viewport: { ...DEFAULT_CONFIG.viewport, ...config.viewport }
  };

  if (!mergedConfig.enabled) {
    return { errors: [], results: [] };
  }

  // Create temp directory for HTML
  const tmpDir = await fs.mkdtemp(join(tmpdir(), 'marplint-'));
  const tmpHtmlPath = join(tmpDir, 'output.html');

  try {
    // Build with Marp CLI
    const absolutePath = resolve(markdownPath);
    execSync(
      `bunx --bun @marp-team/marp-cli@latest --no-stdin --html --allow-local-files "${absolutePath}" -o "${tmpHtmlPath}"`,
      { stdio: 'pipe', encoding: 'utf-8' }
    );

    // Read HTML content
    const htmlContent = await fs.readFile(tmpHtmlPath, 'utf-8');

    // Launch browser
    const browserPath = detectInstalledBrowser();
    const launchOptions: { headless: boolean; executablePath?: string } = { headless: true };
    if (browserPath) {
      launchOptions.executablePath = browserPath;
    }

    const browser = await chromium.launch(launchOptions);

    try {
      const page = await browser.newPage();
      await page.setViewportSize({
        width: mergedConfig.viewport.width,
        height: mergedConfig.viewport.height
      });

      await page.setContent(htmlContent, { waitUntil: 'networkidle' });

      // Check overflow for each slide
      const results = await page.evaluate(() => {
        const sections = Array.from(document.querySelectorAll('section'));
        return sections.map((section, index): OverflowResult => {
          const scrollHeight = section.scrollHeight;
          const clientHeight = section.clientHeight;
          const scrollWidth = section.scrollWidth;
          const clientWidth = section.clientWidth;
          const dataClass = section.getAttribute('data-class') || '';
          const textContent = section.textContent?.trim().substring(0, 50).replace(/\n/g, ' ') || '';

          const hasVerticalOverflow = scrollHeight > clientHeight;
          const hasHorizontalOverflow = scrollWidth > clientWidth;

          return {
            slideNumber: index + 1,
            hasOverflow: hasVerticalOverflow || hasHorizontalOverflow,
            hasVerticalOverflow,
            hasHorizontalOverflow,
            overflowHeight: scrollHeight - clientHeight,
            overflowWidth: scrollWidth - clientWidth,
            scrollHeight,
            clientHeight,
            preview: textContent,
            dataClass: dataClass || undefined
          };
        });
      }) as OverflowResult[];

      // Convert to lint errors
      const errors: LintError[] = [];
      for (const result of results) {
        if (result.hasVerticalOverflow && result.overflowHeight > mergedConfig.threshold) {
          errors.push({
            ruleId: 'marp/overflow',
            slideNumber: result.slideNumber,
            lineNumber: 0, // Visual rules don't have line numbers
            message: `Slide ${result.slideNumber} has vertical overflow of ${result.overflowHeight}px. Content exceeds slide height.`,
            severity: 'error'
          });
        }

        if (result.hasHorizontalOverflow && result.overflowWidth > mergedConfig.threshold) {
          errors.push({
            ruleId: 'marp/overflow',
            slideNumber: result.slideNumber,
            lineNumber: 0,
            message: `Slide ${result.slideNumber} has horizontal overflow of ${result.overflowWidth}px. Content exceeds slide width.`,
            severity: 'error'
          });
        }
      }

      return { errors, results };

    } finally {
      await browser.close();
    }

  } finally {
    // Cleanup temp files
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
