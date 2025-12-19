/**
 * Rule: marp/duplicate-content
 * Detects duplicate or very similar slides
 */

import type { LintError } from './slide-line-count.js';
import { visitSlides, type LineContext } from '../utils/slide-visitor.js';

export interface DuplicateContentConfig {
  enabled?: boolean;
  similarityThreshold?: number; // 0.0 - 1.0, how similar slides need to be
  minContentLength?: number; // Minimum content length to check
  ignoreTitles?: boolean; // Only compare content, not titles
}

const DEFAULT_CONFIG: Required<DuplicateContentConfig> = {
  enabled: true,
  similarityThreshold: 0.8,
  minContentLength: 50,
  ignoreTitles: true
};

interface SlideContent {
  slideNumber: number;
  startLine: number;
  title: string;
  content: string;
  normalizedContent: string;
}

export function duplicateContent(
  content: string,
  config: DuplicateContentConfig = {}
): LintError[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  if (!mergedConfig.enabled) {
    return [];
  }

  const slides = parseSlides(content);
  const errors: LintError[] = [];
  const reportedPairs = new Set<string>();

  for (let i = 0; i < slides.length; i++) {
    const slideA = slides[i];
    if (!slideA || slideA.normalizedContent.length < mergedConfig.minContentLength) {
      continue;
    }

    for (let j = i + 1; j < slides.length; j++) {
      const slideB = slides[j];
      if (!slideB || slideB.normalizedContent.length < mergedConfig.minContentLength) {
        continue;
      }

      const similarity = calculateSimilarity(
        slideA.normalizedContent,
        slideB.normalizedContent
      );

      if (similarity >= mergedConfig.similarityThreshold) {
        const pairKey = `${slideA.slideNumber}-${slideB.slideNumber}`;
        if (!reportedPairs.has(pairKey)) {
          reportedPairs.add(pairKey);
          errors.push({
            ruleId: 'marp/duplicate-content',
            slideNumber: slideA.slideNumber,
            lineNumber: slideA.startLine,
            message: `Slide ${slideA.slideNumber} and ${slideB.slideNumber} are ${Math.round(similarity * 100)}% similar. Consider consolidating.`,
            severity: 'warning'
          });
        }
      }
    }
  }

  return errors;
}

function parseSlides(content: string): SlideContent[] {
  const slides: SlideContent[] = [];
  let slideLines: string[] = [];
  let title = '';
  let slideStartLine = 1;

  visitSlides(content, {
    onSlideStart(slideNumber: number, startLine: number) {
      slideLines = [];
      title = '';
      slideStartLine = startLine;
    },

    onSlideEnd(slideNumber: number) {
      if (slideLines.length > 0) {
        const slideContent = slideLines.join('\n');
        slides.push({
          slideNumber,
          startLine: slideStartLine,
          title,
          content: slideContent,
          normalizedContent: normalizeContent(slideContent)
        });
      }
    },

    onHeading(_level: number, text: string, _context: LineContext) {
      if (!title) {
        title = text;
      }
    },

    onLine(line: string, _context: LineContext) {
      slideLines.push(line);
    }
  });

  return slides;
}

function normalizeContent(content: string): string {
  return content
    .toLowerCase()
    .replace(/^#+\s+.+$/gm, '') // Remove headings
    .replace(/<!--[\s\S]*?-->/g, '') // Remove comments
    .replace(/<[^>]+>/g, '') // Remove HTML tags
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}

function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  // Use Jaccard similarity on words
  const wordsA = new Set(a.split(/\s+/));
  const wordsB = new Set(b.split(/\s+/));

  const intersection = new Set([...wordsA].filter(w => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}
