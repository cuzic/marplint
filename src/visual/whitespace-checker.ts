/**
 * Visual whitespace checker using Playwright
 * Detects slides with excessive unused space
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import type { LintError } from '../rules/slide-line-count.js';

export interface WhitespaceCheckerConfig {
  enabled?: boolean;
  minUtilization?: number; // Minimum content utilization (0.0 - 1.0)
  viewport?: {
    width?: number;
    height?: number;
  };
}

export interface WhitespaceResult {
  slideNumber: number;
  utilization: number; // 0.0 - 1.0
  scrollHeight: number;
  clientHeight: number;
  isSparse: boolean;
  preview: string;
  dataClass?: string;
}

const DEFAULT_CONFIG: Required<WhitespaceCheckerConfig> = {
  enabled: true,
  minUtilization: 0.4,
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
 * Check for excessive whitespace in slides
 */
export async function checkWhitespace(
  markdownPath: string,
  config: WhitespaceCheckerConfig = {}
): Promise<{ errors: LintError[]; results: WhitespaceResult[] }> {
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    viewport: { ...DEFAULT_CONFIG.viewport, ...config.viewport }
  };

  if (!mergedConfig.enabled) {
    return { errors: [], results: [] };
  }

  // Create temp directory for HTML
  const tmpDir = await fs.mkdtemp(join(tmpdir(), 'marplint-ws-'));
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

      // Check whitespace for each slide
      const results = await page.evaluate(() => {
        const sections = Array.from(document.querySelectorAll('section'));
        return sections.map((section, index) => {
          const scrollHeight = section.scrollHeight;
          const clientHeight = section.clientHeight;
          const dataClass = section.getAttribute('data-class') || '';
          const textContent = section.textContent?.trim().substring(0, 50).replace(/\n/g, ' ') || '';

          // Calculate content utilization
          // This is a simplified metric - actual content height vs available height
          const utilization = scrollHeight / clientHeight;

          return {
            slideNumber: index + 1,
            utilization,
            scrollHeight,
            clientHeight,
            isSparse: utilization < 0.5, // Will be adjusted based on config
            preview: textContent,
            dataClass: dataClass || undefined
          };
        });
      }) as WhitespaceResult[];

      // Apply config threshold and convert to lint errors
      const errors: LintError[] = [];
      for (const result of results) {
        // Skip title/intro slides (usually sparse by design)
        if (result.slideNumber === 1) continue;

        // Update isSparse based on config
        result.isSparse = result.utilization < mergedConfig.minUtilization;

        if (result.isSparse) {
          const utilizationPercent = Math.round(result.utilization * 100);
          errors.push({
            ruleId: 'marp/whitespace',
            slideNumber: result.slideNumber,
            lineNumber: 0, // Visual rules don't have line numbers
            message: `Slide ${result.slideNumber} has low content utilization (${utilizationPercent}%). Consider adding more content or merging with another slide.`,
            severity: 'warning'
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
