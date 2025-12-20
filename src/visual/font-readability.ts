/**
 * Visual rule: marp/font-readability
 * Checks if font sizes are readable (minimum size thresholds)
 */

import type { Page } from 'playwright';
import { BaseVisualRule, type BaseVisualConfig } from './base-visual-rule.js';
import type { LintError } from '../rules/slide-line-count.js';

export interface FontReadabilityConfig extends BaseVisualConfig {
  minFontSize?: number; // Minimum font size in pixels
  warnFontSize?: number; // Warn if font is smaller than this
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

class FontReadabilityRule extends BaseVisualRule<FontReadabilityConfig, FontReadabilityResult> {
  protected readonly tmpPrefix = 'font';
  protected readonly defaultConfig = DEFAULT_CONFIG;

  protected async analyze(page: Page, config: Required<FontReadabilityConfig>): Promise<FontReadabilityResult[]> {
    return await page.evaluate((warnSize: number) => {
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
            if (fontSize < warnSize) {
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
    }, config.warnFontSize) as FontReadabilityResult[];
  }

  protected convertToErrors(results: FontReadabilityResult[], config: Required<FontReadabilityConfig>): LintError[] {
    const errors: LintError[] = [];

    for (const result of results) {
      if (result.minFontSize > 0 && result.minFontSize < config.minFontSize) {
        errors.push({
          ruleId: 'marp/font-readability',
          slideNumber: result.slideNumber,
          lineNumber: 0,
          message: `Slide ${result.slideNumber}: Font size ${result.minFontSize}px is below minimum (${config.minFontSize}px). Text may be unreadable.`,
          severity: 'error'
        });
      } else if (result.minFontSize > 0 && result.minFontSize < config.warnFontSize) {
        errors.push({
          ruleId: 'marp/font-readability',
          slideNumber: result.slideNumber,
          lineNumber: 0,
          message: `Slide ${result.slideNumber}: Small font detected (${result.minFontSize}px). Consider using larger text for better readability.`,
          severity: 'warning'
        });
      }
    }

    return errors;
  }
}

// Singleton instance
const fontReadabilityChecker = new FontReadabilityRule();

/**
 * Check font readability in slides
 */
export async function checkFontReadability(
  markdownPath: string,
  config: FontReadabilityConfig = {}
): Promise<{ errors: LintError[]; results: FontReadabilityResult[] }> {
  return fontReadabilityChecker.check(markdownPath, config);
}
