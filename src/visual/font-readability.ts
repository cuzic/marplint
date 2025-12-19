/**
 * Visual rule: marp/font-readability
 * Checks if font sizes are readable (minimum size thresholds)
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import type { LintError } from '../rules/slide-line-count.js';

export interface FontReadabilityConfig {
  enabled?: boolean;
  minFontSize?: number; // Minimum font size in pixels
  warnFontSize?: number; // Warn if font is smaller than this
  viewport?: {
    width?: number;
    height?: number;
  };
}

export interface FontReadabilityResult {
  slideNumber: number;
  minFontSize: number;
  avgFontSize: number;
  smallTextCount: number;
  elements: Array<{
    text: string;
    fontSize: number;
  }>;
}

const DEFAULT_CONFIG: Required<FontReadabilityConfig> = {
  enabled: true,
  minFontSize: 12,
  warnFontSize: 16,
  viewport: {
    width: 1280,
    height: 720
  }
};

function detectInstalledBrowser(): string | null {
  const browserPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/snap/bin/chromium',
  ];

  const existsSync = require('fs').existsSync;
  for (const browserPath of browserPaths) {
    if (existsSync(browserPath)) {
      return browserPath;
    }
  }
  return null;
}

export async function checkFontReadability(
  markdownPath: string,
  config: FontReadabilityConfig = {}
): Promise<{ errors: LintError[]; results: FontReadabilityResult[] }> {
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    viewport: { ...DEFAULT_CONFIG.viewport, ...config.viewport }
  };

  if (!mergedConfig.enabled) {
    return { errors: [], results: [] };
  }

  const tmpDir = await fs.mkdtemp(join(tmpdir(), 'marplint-font-'));
  const tmpHtmlPath = join(tmpDir, 'output.html');

  try {
    const absolutePath = resolve(markdownPath);
    execSync(
      `bunx --bun @marp-team/marp-cli@latest --no-stdin --html --allow-local-files "${absolutePath}" -o "${tmpHtmlPath}"`,
      { stdio: 'pipe', encoding: 'utf-8' }
    );

    const htmlContent = await fs.readFile(tmpHtmlPath, 'utf-8');

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

      const results = await page.evaluate((minSize: number) => {
        const sections = Array.from(document.querySelectorAll('section'));

        return sections.map((section, index) => {
          const textElements = section.querySelectorAll('*');
          const fontSizes: number[] = [];
          const smallElements: Array<{ text: string; fontSize: number }> = [];

          textElements.forEach((el) => {
            const style = window.getComputedStyle(el);
            const fontSize = parseFloat(style.fontSize);
            const text = (el as HTMLElement).innerText?.trim().substring(0, 30) || '';

            if (text && fontSize > 0) {
              fontSizes.push(fontSize);
              if (fontSize < minSize) {
                smallElements.push({ text, fontSize: Math.round(fontSize) });
              }
            }
          });

          const minFontSize = fontSizes.length > 0 ? Math.min(...fontSizes) : 0;
          const avgFontSize = fontSizes.length > 0
            ? fontSizes.reduce((a, b) => a + b, 0) / fontSizes.length
            : 0;

          return {
            slideNumber: index + 1,
            minFontSize: Math.round(minFontSize),
            avgFontSize: Math.round(avgFontSize),
            smallTextCount: smallElements.length,
            elements: smallElements.slice(0, 3) // Limit to first 3
          };
        });
      }, mergedConfig.warnFontSize) as FontReadabilityResult[];

      const errors: LintError[] = [];
      for (const result of results) {
        if (result.minFontSize > 0 && result.minFontSize < mergedConfig.minFontSize) {
          errors.push({
            ruleId: 'marp/font-readability',
            slideNumber: result.slideNumber,
            lineNumber: 0,
            message: `Slide ${result.slideNumber}: Font size ${result.minFontSize}px is below minimum (${mergedConfig.minFontSize}px). Text may be unreadable.`,
            severity: 'error'
          });
        } else if (result.minFontSize > 0 && result.minFontSize < mergedConfig.warnFontSize) {
          errors.push({
            ruleId: 'marp/font-readability',
            slideNumber: result.slideNumber,
            lineNumber: 0,
            message: `Slide ${result.slideNumber}: Small font detected (${result.minFontSize}px). Consider using larger text for better readability.`,
            severity: 'warning'
          });
        }
      }

      return { errors, results };

    } finally {
      await browser.close();
    }

  } finally {
    try {
      await fs.rm(tmpDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  }
}
