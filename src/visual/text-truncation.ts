/**
 * Visual rule: marp/text-truncation
 * Detects text that may be truncated or cut off
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import type { LintError } from '../rules/slide-line-count.js';

export interface TextTruncationConfig {
  enabled?: boolean;
  viewport?: {
    width?: number;
    height?: number;
  };
}

export interface TextTruncationResult {
  slideNumber: number;
  truncatedElements: Array<{
    text: string;
    scrollWidth: number;
    clientWidth: number;
  }>;
}

const DEFAULT_CONFIG: Required<TextTruncationConfig> = {
  enabled: true,
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

export async function checkTextTruncation(
  markdownPath: string,
  config: TextTruncationConfig = {}
): Promise<{ errors: LintError[]; results: TextTruncationResult[] }> {
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    viewport: { ...DEFAULT_CONFIG.viewport, ...config.viewport }
  };

  if (!mergedConfig.enabled) {
    return { errors: [], results: [] };
  }

  const tmpDir = await fs.mkdtemp(join(tmpdir(), 'marplint-trunc-'));
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

      const results = await page.evaluate(() => {
        const sections = Array.from(document.querySelectorAll('section'));

        return sections.map((section, index) => {
          const truncatedElements: Array<{
            text: string;
            scrollWidth: number;
            clientWidth: number;
          }> = [];

          // Check text elements for horizontal overflow (truncation)
          const textElements = section.querySelectorAll('p, li, td, th, h1, h2, h3, h4, h5, h6, span');

          textElements.forEach((el) => {
            const htmlEl = el as HTMLElement;
            const text = htmlEl.innerText?.trim().substring(0, 40) || '';
            if (!text) return;

            // Check for horizontal overflow
            if (htmlEl.scrollWidth > htmlEl.clientWidth + 5) { // 5px tolerance
              truncatedElements.push({
                text,
                scrollWidth: htmlEl.scrollWidth,
                clientWidth: htmlEl.clientWidth
              });
            }

            // Check for text-overflow: ellipsis being applied
            const style = window.getComputedStyle(htmlEl);
            if (style.textOverflow === 'ellipsis' && style.overflow === 'hidden') {
              if (htmlEl.scrollWidth > htmlEl.clientWidth) {
                truncatedElements.push({
                  text,
                  scrollWidth: htmlEl.scrollWidth,
                  clientWidth: htmlEl.clientWidth
                });
              }
            }
          });

          return {
            slideNumber: index + 1,
            truncatedElements: truncatedElements.slice(0, 3)
          };
        });
      }) as TextTruncationResult[];

      const errors: LintError[] = [];
      for (const result of results) {
        if (result.truncatedElements.length > 0) {
          const element = result.truncatedElements[0];
          if (element) {
            errors.push({
              ruleId: 'marp/text-truncation',
              slideNumber: result.slideNumber,
              lineNumber: 0,
              message: `Slide ${result.slideNumber}: Text may be truncated. "${element.text}..." exceeds container width.`,
              severity: 'warning'
            });
          }
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
