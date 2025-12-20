/**
 * Rule: marp/duplicate-content
 * Detects duplicate or very similar slides
 */

import { type LineContext, visitSlides } from '../utils/slide-visitor.js';
import type { LintError } from './slide-line-count.js';

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

/** Check if slide has sufficient content */
function hasEnoughContent(slide: SlideContent | undefined, minLength: number): slide is SlideContent {
  return !!slide && slide.normalizedContent.length >= minLength;
}

/** Report duplicate slide pair */
function reportDuplicate(
  slideA: SlideContent,
  slideB: SlideContent,
  similarity: number,
  reportedPairs: Set<string>,
  errors: LintError[]
): void {
  const pairKey = `${slideA.slideNumber}-${slideB.slideNumber}`;
  if (reportedPairs.has(pairKey)) return;

  reportedPairs.add(pairKey);
  errors.push({
    ruleId: 'marp/duplicate-content',
    slideNumber: slideA.slideNumber,
    lineNumber: slideA.startLine,
    message: `Slide ${slideA.slideNumber} and ${slideB.slideNumber} are ${Math.round(similarity * 100)}% similar. Consider consolidating.`,
    severity: 'warning'
  });
}

export function duplicateContent(content: string, config: DuplicateContentConfig = {}): LintError[] {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  if (!mergedConfig.enabled) return [];

  const slides = parseSlides(content);
  const errors: LintError[] = [];
  const reportedPairs = new Set<string>();

  for (let i = 0; i < slides.length; i++) {
    const slideA = slides[i];
    if (!hasEnoughContent(slideA, mergedConfig.minContentLength)) continue;

    for (let j = i + 1; j < slides.length; j++) {
      const slideB = slides[j];
      if (!hasEnoughContent(slideB, mergedConfig.minContentLength)) continue;

      const similarity = calculateSimilarity(slideA.normalizedContent, slideB.normalizedContent);
      if (similarity >= mergedConfig.similarityThreshold) {
        reportDuplicate(slideA, slideB, similarity, reportedPairs, errors);
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
    onSlideStart(_slideNumber: number, startLine: number) {
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

  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}
