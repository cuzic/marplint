/**
 * Advanced analysis features for marplint
 */

import {
  checkHeadingHierarchy,
  checkImageAltText,
  checkLinkTextQuality,
  extractHeadings,
  extractImages,
  extractLinks,
  hasTableHeader
} from '../utils/accessibility-checks.js';
import { countCharacters, countContentLines, countListItems, parseSlides } from '../utils/slide-parser.js';

export interface SlideAnalysis {
  slideNumber: number;
  complexity: ComplexityScore;
  readingTime: ReadingTimeEstimate;
  accessibility: AccessibilityScore;
}

export interface ComplexityScore {
  score: number; // 0-100
  level: 'simple' | 'moderate' | 'complex' | 'very-complex';
  factors: {
    lineCount: number;
    charCount: number;
    listItems: number;
    codeBlocks: number;
    tables: number;
    images: number;
    nestedLevels: number;
  };
}

export interface ReadingTimeEstimate {
  seconds: number;
  formatted: string; // e.g., "1:30"
  wordsPerMinute: number;
  wordCount: number;
}

export interface AccessibilityScore {
  score: number; // 0-100
  issues: AccessibilityIssue[];
  passedChecks: string[];
}

export interface AccessibilityIssue {
  type: string;
  message: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
}

export interface DocumentAnalysis {
  slides: SlideAnalysis[];
  summary: {
    totalSlides: number;
    avgComplexity: number;
    totalReadingTime: ReadingTimeEstimate;
    avgAccessibility: number;
    recommendations: string[];
  };
}

/**
 * Analyze a Marp document
 */
export function analyzeDocument(content: string): DocumentAnalysis {
  const { slides } = parseSlides(content);
  const slideAnalyses: SlideAnalysis[] = [];

  for (const slide of slides) {
    slideAnalyses.push({
      slideNumber: slide.slideNumber,
      complexity: analyzeComplexity(slide),
      readingTime: estimateReadingTime(slide),
      accessibility: checkAccessibility(slide)
    });
  }

  return {
    slides: slideAnalyses,
    summary: generateSummary(slideAnalyses)
  };
}

/**
 * Analyze slide complexity
 */
function analyzeComplexity(slide: ReturnType<typeof parseSlides>['slides'][0]): ComplexityScore {
  const content = slide.lines.join('\n');

  const factors = {
    lineCount: countContentLines(slide),
    charCount: countCharacters(slide),
    listItems: countListItems(slide),
    codeBlocks: (content.match(/```/g) || []).length / 2,
    tables: (content.match(/^\|/gm) || []).length,
    images: (content.match(/!\[/g) || []).length,
    nestedLevels: countMaxNesting(slide.contentLines)
  };

  // Calculate complexity score (0-100)
  let score = 0;

  // Line count contributes up to 30 points
  score += Math.min(30, factors.lineCount * 1);

  // Character count contributes up to 20 points
  score += Math.min(20, factors.charCount / 50);

  // List items contribute up to 15 points
  score += Math.min(15, factors.listItems * 1);

  // Code blocks contribute up to 15 points
  score += Math.min(15, factors.codeBlocks * 5);

  // Tables contribute up to 10 points
  score += Math.min(10, factors.tables * 1);

  // Nesting contributes up to 10 points
  score += Math.min(10, factors.nestedLevels * 3);

  // Normalize to 0-100
  score = Math.min(100, Math.round(score));

  let level: ComplexityScore['level'];
  if (score < 25) level = 'simple';
  else if (score < 50) level = 'moderate';
  else if (score < 75) level = 'complex';
  else level = 'very-complex';

  return { score, level, factors };
}

function countMaxNesting(lines: string[]): number {
  let maxNesting = 0;
  for (const line of lines) {
    const match = line.match(/^(\s*)/);
    if (match) {
      const indent = match[1]?.length ?? 0;
      const nesting = Math.floor(indent / 2);
      maxNesting = Math.max(maxNesting, nesting);
    }
  }
  return maxNesting;
}

/**
 * Estimate reading time for a slide
 */
function estimateReadingTime(slide: ReturnType<typeof parseSlides>['slides'][0]): ReadingTimeEstimate {
  const content = slide.contentLines.join(' ');

  // Count words (handle both English and Japanese)
  const englishWords = content.match(/[a-zA-Z]+/g) || [];
  const japaneseChars = content.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || [];

  // Japanese reading speed: ~400-600 chars/min, English: ~150-200 words/min
  // For slides, assume slower reading due to visual processing
  const JAPANESE_CHARS_PER_MIN = 300;
  const ENGLISH_WORDS_PER_MIN = 120;

  const japaneseTime = japaneseChars.length / JAPANESE_CHARS_PER_MIN;
  const englishTime = englishWords.length / ENGLISH_WORDS_PER_MIN;

  // Add time for images, code blocks, tables
  const images = (slide.lines.join('\n').match(/!\[/g) || []).length;
  const codeBlocks = (slide.lines.join('\n').match(/```/g) || []).length / 2;
  const tables = (slide.lines.join('\n').match(/^\|/gm) || []).length;

  const visualTime = images * 0.25 + codeBlocks * 0.5 + tables * 0.1;

  const totalMinutes = japaneseTime + englishTime + visualTime;
  const seconds = Math.round(totalMinutes * 60);

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const formatted = `${mins}:${secs.toString().padStart(2, '0')}`;

  return {
    seconds,
    formatted,
    wordsPerMinute: 150,
    wordCount: englishWords.length + Math.round(japaneseChars.length / 2)
  };
}

/**
 * Check accessibility issues
 * Uses shared validation functions from accessibility-checks.ts
 */
function checkAccessibility(slide: ReturnType<typeof parseSlides>['slides'][0]): AccessibilityScore {
  const content = slide.lines.join('\n');
  const issues: AccessibilityIssue[] = [];
  const passedChecks: string[] = [];

  // Check 1: Images have alt text (using shared function)
  const images = extractImages(content);
  const altIssues = checkImageAltText(images);
  for (const _issue of altIssues) {
    issues.push({
      type: 'image-alt',
      message: 'Image missing alt text',
      severity: 'serious'
    });
  }
  if (images.length > 0 && altIssues.length === 0) {
    passedChecks.push('All images have alt text');
  }

  // Check 2: Proper heading hierarchy (using shared function)
  const headings = extractHeadings(content);
  const hierarchyIssues = checkHeadingHierarchy(headings);
  for (const issue of hierarchyIssues) {
    issues.push({
      type: 'heading-hierarchy',
      message: `Heading level jumped from H${issue.fromLevel} to H${issue.toLevel}`,
      severity: 'moderate'
    });
  }
  if (headings.length > 0 && hierarchyIssues.length === 0) {
    passedChecks.push('Proper heading hierarchy');
  }

  // Check 3: Links have descriptive text (using shared function)
  const links = extractLinks(content);
  const linkIssues = checkLinkTextQuality(links);
  for (const issue of linkIssues) {
    issues.push({
      type: 'link-text',
      message: `Link text "${issue.text}" is not descriptive`,
      severity: 'moderate'
    });
  }
  if (links.length > 0 && linkIssues.length === 0) {
    passedChecks.push('Links have descriptive text');
  }

  // Check 4: Table has header (using shared function)
  const hasTables = content.match(/^\|[^|]+\|/gm) || [];
  if (hasTables.length > 0) {
    if (!hasTableHeader(content)) {
      issues.push({
        type: 'table-header',
        message: 'Table may be missing header row',
        severity: 'moderate'
      });
    } else {
      passedChecks.push('Tables have headers');
    }
  }

  // Check 5: Color contrast (basic check - just look for explicit colors)
  // This is a simplified check; real contrast checking is done in visual rules
  if (content.includes('color:') || content.includes('background:')) {
    issues.push({
      type: 'color-check',
      message: 'Custom colors detected - ensure sufficient contrast',
      severity: 'minor'
    });
  }

  // Calculate score
  const maxScore = 100;
  const severityPenalty = {
    critical: 30,
    serious: 20,
    moderate: 10,
    minor: 5
  };

  let penalty = 0;
  for (const issue of issues) {
    penalty += severityPenalty[issue.severity];
  }

  const score = Math.max(0, maxScore - penalty);

  return { score, issues, passedChecks };
}

/**
 * Generate summary from slide analyses
 */
function generateSummary(slides: SlideAnalysis[]): DocumentAnalysis['summary'] {
  const totalSlides = slides.length;

  const avgComplexity = Math.round(slides.reduce((sum, s) => sum + s.complexity.score, 0) / totalSlides);

  const totalSeconds = slides.reduce((sum, s) => sum + s.readingTime.seconds, 0);
  const totalMins = Math.floor(totalSeconds / 60);
  const totalSecs = totalSeconds % 60;

  const avgAccessibility = Math.round(slides.reduce((sum, s) => sum + s.accessibility.score, 0) / totalSlides);

  const recommendations: string[] = [];

  // Complexity recommendations
  const complexSlides = slides.filter((s) => s.complexity.level === 'very-complex');
  if (complexSlides.length > 0) {
    recommendations.push(
      `${complexSlides.length} slides are very complex. Consider simplifying slides ${complexSlides.map((s) => s.slideNumber).join(', ')}.`
    );
  }

  // Reading time recommendations
  const longSlides = slides.filter((s) => s.readingTime.seconds > 120);
  if (longSlides.length > 0) {
    recommendations.push(
      `${longSlides.length} slides may take >2 minutes to present. Consider splitting slides ${longSlides.map((s) => s.slideNumber).join(', ')}.`
    );
  }

  // Accessibility recommendations
  const lowAccessibility = slides.filter((s) => s.accessibility.score < 70);
  if (lowAccessibility.length > 0) {
    recommendations.push(
      `${lowAccessibility.length} slides have accessibility issues. Review slides ${lowAccessibility.map((s) => s.slideNumber).join(', ')}.`
    );
  }

  // Overall recommendations
  if (totalSeconds > totalSlides * 90) {
    recommendations.push('Presentation may be too long. Average slide time exceeds 1.5 minutes.');
  }

  if (avgComplexity > 60) {
    recommendations.push('Overall complexity is high. Consider using simpler layouts and less text.');
  }

  return {
    totalSlides,
    avgComplexity,
    totalReadingTime: {
      seconds: totalSeconds,
      formatted: `${totalMins}:${totalSecs.toString().padStart(2, '0')}`,
      wordsPerMinute: 150,
      wordCount: slides.reduce((sum, s) => sum + s.readingTime.wordCount, 0)
    },
    avgAccessibility,
    recommendations
  };
}

/**
 * Format analysis as text report
 */
export function formatAnalysisReport(analysis: DocumentAnalysis): string {
  const { slides, summary } = analysis;

  let report = `
📊 Document Analysis Report
============================

📈 Summary
----------
Total Slides: ${summary.totalSlides}
Average Complexity: ${summary.avgComplexity}/100 (${getComplexityLabel(summary.avgComplexity)})
Estimated Reading Time: ${summary.totalReadingTime.formatted}
Average Accessibility: ${summary.avgAccessibility}/100

📋 Slide Details
----------------`;

  for (const slide of slides) {
    report += `
Slide ${slide.slideNumber}:
  Complexity: ${slide.complexity.score}/100 (${slide.complexity.level})
  Reading Time: ${slide.readingTime.formatted}
  Accessibility: ${slide.accessibility.score}/100
  ${slide.accessibility.issues.length > 0 ? `Issues: ${slide.accessibility.issues.map((i) => i.message).join(', ')}` : 'No accessibility issues'}
`;
  }

  if (summary.recommendations.length > 0) {
    report += `
💡 Recommendations
------------------`;
    for (const rec of summary.recommendations) {
      report += `\n• ${rec}`;
    }
  }

  return report;
}

function getComplexityLabel(score: number): string {
  if (score < 25) return 'Simple';
  if (score < 50) return 'Moderate';
  if (score < 75) return 'Complex';
  return 'Very Complex';
}
