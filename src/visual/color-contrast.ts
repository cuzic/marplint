/**
 * Visual rule: marp/color-contrast
 * Checks color contrast ratio for WCAG compliance
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import type { LintError } from '../rules/slide-line-count.js';

export interface ColorContrastConfig {
  enabled?: boolean;
  minContrastRatio?: number; // WCAG AA requires 4.5:1 for normal text
  minContrastRatioLarge?: number; // WCAG AA requires 3:1 for large text (18px+)
  viewport?: {
    width?: number;
    height?: number;
  };
}

export interface ColorContrastResult {
  slideNumber: number;
  lowContrastElements: Array<{
    text: string;
    foreground: string;
    background: string;
    ratio: number;
    fontSize: number;
  }>;
}

const DEFAULT_CONFIG: Required<ColorContrastConfig> = {
  enabled: true,
  minContrastRatio: 4.5,
  minContrastRatioLarge: 3.0,
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

export async function checkColorContrast(
  markdownPath: string,
  config: ColorContrastConfig = {}
): Promise<{ errors: LintError[]; results: ColorContrastResult[] }> {
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    viewport: { ...DEFAULT_CONFIG.viewport, ...config.viewport }
  };

  if (!mergedConfig.enabled) {
    return { errors: [], results: [] };
  }

  const tmpDir = await fs.mkdtemp(join(tmpdir(), 'marplint-contrast-'));
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

      const results = await page.evaluate((config: { minRatio: number; minRatioLarge: number }) => {
        // Helper functions for color contrast calculation
        function parseColor(colorStr: string): { r: number; g: number; b: number; a: number } | null {
          // Handle rgb/rgba
          const rgbMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
          if (rgbMatch) {
            return {
              r: parseInt(rgbMatch[1] ?? '0'),
              g: parseInt(rgbMatch[2] ?? '0'),
              b: parseInt(rgbMatch[3] ?? '0'),
              a: parseFloat(rgbMatch[4] ?? '1')
            };
          }
          return null;
        }

        function getLuminance(r: number, g: number, b: number): number {
          const [rs, gs, bs] = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
          });
          return 0.2126 * (rs ?? 0) + 0.7152 * (gs ?? 0) + 0.0722 * (bs ?? 0);
        }

        function getContrastRatio(l1: number, l2: number): number {
          const lighter = Math.max(l1, l2);
          const darker = Math.min(l1, l2);
          return (lighter + 0.05) / (darker + 0.05);
        }

        const sections = Array.from(document.querySelectorAll('section'));

        return sections.map((section, index) => {
          const lowContrastElements: Array<{
            text: string;
            foreground: string;
            background: string;
            ratio: number;
            fontSize: number;
          }> = [];

          const textElements = section.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, span, td, th');

          textElements.forEach((el) => {
            const style = window.getComputedStyle(el);
            const text = (el as HTMLElement).innerText?.trim().substring(0, 30) || '';
            if (!text) return;

            const foreground = style.color;
            const background = style.backgroundColor;
            const fontSize = parseFloat(style.fontSize);

            const fgColor = parseColor(foreground);
            const bgColor = parseColor(background);

            if (fgColor && bgColor && bgColor.a > 0) {
              const fgLum = getLuminance(fgColor.r, fgColor.g, fgColor.b);
              const bgLum = getLuminance(bgColor.r, bgColor.g, bgColor.b);
              const ratio = getContrastRatio(fgLum, bgLum);

              const requiredRatio = fontSize >= 18 ? config.minRatioLarge : config.minRatio;

              if (ratio < requiredRatio) {
                lowContrastElements.push({
                  text,
                  foreground,
                  background,
                  ratio: Math.round(ratio * 100) / 100,
                  fontSize: Math.round(fontSize)
                });
              }
            }
          });

          return {
            slideNumber: index + 1,
            lowContrastElements: lowContrastElements.slice(0, 3)
          };
        });
      }, { minRatio: mergedConfig.minContrastRatio, minRatioLarge: mergedConfig.minContrastRatioLarge }) as ColorContrastResult[];

      const errors: LintError[] = [];
      for (const result of results) {
        if (result.lowContrastElements.length > 0) {
          const element = result.lowContrastElements[0];
          if (element) {
            errors.push({
              ruleId: 'marp/color-contrast',
              slideNumber: result.slideNumber,
              lineNumber: 0,
              message: `Slide ${result.slideNumber}: Low color contrast (${element.ratio}:1). WCAG AA requires at least 4.5:1 for normal text.`,
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
