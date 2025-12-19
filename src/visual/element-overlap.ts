/**
 * Visual rule: marp/element-overlap
 * Detects overlapping elements in slides
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join, resolve } from 'path';
import type { LintError } from '../rules/slide-line-count.js';

export interface ElementOverlapConfig {
  enabled?: boolean;
  minOverlapArea?: number; // Minimum overlap area in pixels to report
  viewport?: {
    width?: number;
    height?: number;
  };
}

export interface ElementOverlapResult {
  slideNumber: number;
  overlaps: Array<{
    element1: string;
    element2: string;
    overlapArea: number;
  }>;
}

const DEFAULT_CONFIG: Required<ElementOverlapConfig> = {
  enabled: true,
  minOverlapArea: 100, // 100 square pixels
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

export async function checkElementOverlap(
  markdownPath: string,
  config: ElementOverlapConfig = {}
): Promise<{ errors: LintError[]; results: ElementOverlapResult[] }> {
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    viewport: { ...DEFAULT_CONFIG.viewport, ...config.viewport }
  };

  if (!mergedConfig.enabled) {
    return { errors: [], results: [] };
  }

  const tmpDir = await fs.mkdtemp(join(tmpdir(), 'marplint-overlap-'));
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

      const results = await page.evaluate((minArea: number) => {
        function getOverlapArea(rect1: DOMRect, rect2: DOMRect): number {
          const xOverlap = Math.max(0, Math.min(rect1.right, rect2.right) - Math.max(rect1.left, rect2.left));
          const yOverlap = Math.max(0, Math.min(rect1.bottom, rect2.bottom) - Math.max(rect1.top, rect2.top));
          return xOverlap * yOverlap;
        }

        function getElementDescription(el: Element): string {
          const tag = el.tagName.toLowerCase();
          const text = (el as HTMLElement).innerText?.trim().substring(0, 20) || '';
          return text ? `${tag}: "${text}..."` : tag;
        }

        const sections = Array.from(document.querySelectorAll('section'));

        return sections.map((section, index) => {
          const overlaps: Array<{
            element1: string;
            element2: string;
            overlapArea: number;
          }> = [];

          // Get all positioned or block elements
          const elements = Array.from(section.querySelectorAll('h1, h2, h3, h4, h5, h6, p, ul, ol, table, div, img, figure'));
          const rects: Array<{ element: Element; rect: DOMRect }> = [];

          elements.forEach((el) => {
            const rect = el.getBoundingClientRect();
            // Only consider elements with actual size
            if (rect.width > 10 && rect.height > 10) {
              rects.push({ element: el, rect });
            }
          });

          // Check for overlaps
          for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
              const r1 = rects[i];
              const r2 = rects[j];
              if (!r1 || !r2) continue;

              // Skip if one is ancestor of another
              if (r1.element.contains(r2.element) || r2.element.contains(r1.element)) {
                continue;
              }

              const overlapArea = getOverlapArea(r1.rect, r2.rect);
              if (overlapArea >= minArea) {
                overlaps.push({
                  element1: getElementDescription(r1.element),
                  element2: getElementDescription(r2.element),
                  overlapArea: Math.round(overlapArea)
                });
              }
            }
          }

          return {
            slideNumber: index + 1,
            overlaps: overlaps.slice(0, 3) // Limit to first 3
          };
        });
      }, mergedConfig.minOverlapArea) as ElementOverlapResult[];

      const errors: LintError[] = [];
      for (const result of results) {
        if (result.overlaps.length > 0) {
          const overlap = result.overlaps[0];
          if (overlap) {
            errors.push({
              ruleId: 'marp/element-overlap',
              slideNumber: result.slideNumber,
              lineNumber: 0,
              message: `Slide ${result.slideNumber}: Elements are overlapping (${overlap.overlapArea}px²). "${overlap.element1}" overlaps with "${overlap.element2}".`,
              severity: 'error'
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
