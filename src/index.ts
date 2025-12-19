#!/usr/bin/env node

/**
 * marplint - Linter for Marp slides
 *
 * Usage:
 *   marplint src/slides/*.md
 *   marplint --static src/slides/*.md
 *   marplint --visual src/slides/*.md
 *   marplint --fix src/slides/*.md
 *   marplint --format json src/slides/*.md
 */

import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, basename } from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import { loadConfig, type MarplintConfig } from './utils/config.js';
import { runStaticRules, type LintError } from './rules/index.js';
import { runVisualRules } from './visual/index.js';
import { applyFixes, getFixableRules, type FixResult } from './fixers/index.js';
import { analyzeDocument, formatAnalysisReport } from './analysis/index.js';

const VERSION = '1.2.0';

interface LintResult {
  file: string;
  slideCount: number;
  errors: LintError[];
  warnings: LintError[];
  fixes?: FixResult[];
}

interface FormattedOutput {
  summary: {
    files: number;
    slides: number;
    errors: number;
    warnings: number;
    fixed?: number;
  };
  results: LintResult[];
}

const program = new Command();

program
  .name('marplint')
  .description('Linter for Marp slides - detects overflow and whitespace issues')
  .version(VERSION)
  .argument('<files...>', 'Markdown files to lint (glob patterns supported)')
  .option('-s, --static', 'Run only static rules (fast)')
  .option('-v, --visual', 'Include visual rules (slower, requires browser)')
  .option('-f, --format <type>', 'Output format: text, json, html', 'text')
  .option('-c, --config <path>', 'Path to config file')
  .option('-r, --rule <name>', 'Run only specified rule')
  .option('--fix', 'Automatically fix problems where possible')
  .option('--fix-dry-run', 'Show what would be fixed without making changes')
  .option('-w, --watch', 'Watch for file changes')
  .option('-a, --analyze', 'Run advanced analysis (complexity, reading time, accessibility)')
  .option('--no-color', 'Disable colored output')
  .action(async (filePatterns: string[], options) => {
    try {
      if (options.analyze) {
        await runAnalysis(filePatterns, options);
      } else if (options.watch) {
        await runWatcher(filePatterns, options);
      } else {
        await runLinter(filePatterns, options);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();

async function runLinter(
  filePatterns: string[],
  options: {
    static?: boolean;
    visual?: boolean;
    format: string;
    config?: string;
    rule?: string;
    fix?: boolean;
    fixDryRun?: boolean;
    color?: boolean;
  }
) {
  // Expand glob patterns
  const files: string[] = [];
  for (const pattern of filePatterns) {
    const matches = await glob(pattern);
    files.push(...matches);
  }

  if (files.length === 0) {
    console.error(chalk.yellow('No files found matching the patterns'));
    process.exit(1);
  }

  // Load config
  const config = loadConfig(options.config);

  // Determine which rules to run
  const runStatic = !options.visual || options.static;
  const runVisual = options.visual || (!options.static && !options.visual);

  const results: LintResult[] = [];
  let totalFixed = 0;

  if (options.format === 'text') {
    console.log(chalk.cyan.bold('\n🔍 marplint - Marp Slide Linter\n'));
    console.log(chalk.blue(`Scanning ${files.length} file(s)...\n`));

    if (options.fix) {
      console.log(chalk.magenta(`Auto-fix enabled. Fixable rules: ${getFixableRules().join(', ')}\n`));
    }
  }

  for (const file of files) {
    const absolutePath = resolve(file);

    if (!existsSync(absolutePath)) {
      console.error(chalk.red(`File not found: ${file}`));
      continue;
    }

    let content = readFileSync(absolutePath, 'utf-8');
    const errors: LintError[] = [];
    const warnings: LintError[] = [];
    let fixes: FixResult[] = [];

    // Run static rules
    if (runStatic) {
      const staticResult = runStaticRules(content, file, config);
      errors.push(...staticResult.errors);
      warnings.push(...staticResult.warnings);
    }

    // Run visual rules
    if (runVisual && !options.static) {
      try {
        const visualResult = await runVisualRules(absolutePath, config);
        errors.push(...visualResult.errors);
        warnings.push(...visualResult.warnings);
      } catch (error) {
        if (options.format === 'text') {
          console.warn(chalk.yellow(`  ⚠️  Visual check failed for ${basename(file)}: ${error instanceof Error ? error.message : error}`));
        }
      }
    }

    // Apply fixes if requested
    if (options.fix || options.fixDryRun) {
      const allIssues = [...errors, ...warnings];
      const { fixedContent, results: fixResults } = applyFixes(content, allIssues);

      if (fixResults.length > 0) {
        fixes = fixResults;
        totalFixed += fixResults.filter(f => f.applied).length;

        if (options.fix && !options.fixDryRun) {
          writeFileSync(absolutePath, fixedContent, 'utf-8');
          content = fixedContent; // Update for re-check
        }
      }
    }

    // Filter by specific rule if specified
    let filteredErrors = errors;
    let filteredWarnings = warnings;
    if (options.rule) {
      filteredErrors = errors.filter(e => e.ruleId === options.rule);
      filteredWarnings = warnings.filter(w => w.ruleId === options.rule);
    }

    // Count slides
    const slideCount = (content.match(/\n---\n/g) || []).length + 1;

    results.push({
      file,
      slideCount,
      errors: filteredErrors,
      warnings: filteredWarnings,
      fixes: fixes.length > 0 ? fixes : undefined
    });

    // Output progress for text format
    if (options.format === 'text') {
      outputFileResult(file, slideCount, filteredErrors, filteredWarnings, fixes, options.fixDryRun);
    }
  }

  // Output summary
  const output = formatOutput(results, totalFixed);

  if (options.format === 'json') {
    console.log(JSON.stringify(output, null, 2));
  } else if (options.format === 'html') {
    console.log(generateHtmlReport(output));
  } else {
    outputSummary(output.summary, options.fix, options.fixDryRun);
  }

  // Exit with error code if there are errors (after fixes)
  if (output.summary.errors > 0) {
    process.exit(1);
  }
}

async function runAnalysis(
  filePatterns: string[],
  options: { format: string }
) {
  const files: string[] = [];
  for (const pattern of filePatterns) {
    const matches = await glob(pattern);
    files.push(...matches);
  }

  if (files.length === 0) {
    console.error(chalk.yellow('No files found matching the patterns'));
    process.exit(1);
  }

  console.log(chalk.cyan.bold('\n📊 marplint - Document Analysis\n'));

  for (const file of files) {
    const absolutePath = resolve(file);
    if (!existsSync(absolutePath)) {
      console.error(chalk.red(`File not found: ${file}`));
      continue;
    }

    const content = readFileSync(absolutePath, 'utf-8');
    const analysis = analyzeDocument(content);

    console.log(chalk.bold(`\n📄 ${basename(file)}`));
    console.log('='.repeat(50));

    if (options.format === 'json') {
      console.log(JSON.stringify(analysis, null, 2));
    } else {
      console.log(formatAnalysisReport(analysis));
    }
  }
}

async function runWatcher(
  filePatterns: string[],
  options: {
    static?: boolean;
    visual?: boolean;
    format: string;
    config?: string;
    rule?: string;
    fix?: boolean;
    fixDryRun?: boolean;
    color?: boolean;
  }
) {
  const chokidar = await import('chokidar');

  console.log(chalk.cyan.bold('\n👀 marplint - Watch Mode\n'));
  console.log(chalk.blue(`Watching for changes in: ${filePatterns.join(', ')}\n`));

  const watcher = chokidar.watch(filePatterns, {
    persistent: true,
    ignoreInitial: true
  });

  const runCheck = async (path: string) => {
    console.log(chalk.blue(`\n📝 File changed: ${path}\n`));
    await runLinter([path], { ...options, watch: false });
  };

  watcher.on('change', runCheck);
  watcher.on('add', runCheck);

  // Run initial check
  await runLinter(filePatterns, { ...options, watch: false });

  console.log(chalk.yellow('\nWatching for changes... (Ctrl+C to exit)\n'));
}

function outputFileResult(
  file: string,
  slideCount: number,
  errors: LintError[],
  warnings: LintError[],
  fixes: FixResult[],
  isDryRun?: boolean
) {
  const fileName = basename(file);
  const status = errors.length === 0
    ? chalk.green('✓')
    : chalk.red('✗');

  console.log(`${status} ${chalk.bold(fileName)} (${slideCount} slides)`);

  for (const error of errors) {
    const location = error.lineNumber > 0
      ? `line ${error.lineNumber}`
      : `slide ${error.slideNumber}`;
    console.log(chalk.red(`    ✗ ${error.ruleId} [${location}]: ${error.message}`));
  }

  for (const warning of warnings) {
    const location = warning.lineNumber > 0
      ? `line ${warning.lineNumber}`
      : `slide ${warning.slideNumber}`;
    console.log(chalk.yellow(`    ⚠ ${warning.ruleId} [${location}]: ${warning.message}`));
  }

  for (const fix of fixes) {
    const prefix = isDryRun ? 'Would fix' : 'Fixed';
    console.log(chalk.magenta(`    🔧 ${prefix}: ${fix.description}`));
  }

  if (errors.length > 0 || warnings.length > 0 || fixes.length > 0) {
    console.log('');
  }
}

function formatOutput(results: LintResult[], totalFixed?: number): FormattedOutput {
  const summary = {
    files: results.length,
    slides: results.reduce((sum, r) => sum + r.slideCount, 0),
    errors: results.reduce((sum, r) => sum + r.errors.length, 0),
    warnings: results.reduce((sum, r) => sum + r.warnings.length, 0),
    fixed: totalFixed
  };

  return { summary, results };
}

function outputSummary(
  summary: FormattedOutput['summary'],
  fix?: boolean,
  fixDryRun?: boolean
) {
  console.log(chalk.bold('\n=== Summary ==='));
  console.log(`Files: ${summary.files}`);
  console.log(`Slides: ${summary.slides}`);
  console.log(chalk.green(`Passed: ${summary.files - (summary.errors > 0 ? 1 : 0)}`));

  if (summary.errors > 0) {
    console.log(chalk.red(`Errors: ${summary.errors}`));
  }
  if (summary.warnings > 0) {
    console.log(chalk.yellow(`Warnings: ${summary.warnings}`));
  }
  if (summary.fixed && summary.fixed > 0) {
    const fixLabel = fixDryRun ? 'Would fix' : 'Fixed';
    console.log(chalk.magenta(`${fixLabel}: ${summary.fixed}`));
  }

  if (summary.errors === 0) {
    console.log(chalk.green.bold('\n✨ All checks passed!\n'));
  } else {
    console.log(chalk.red.bold(`\n❌ ${summary.errors} error(s) found\n`));
  }
}

function generateHtmlReport(output: FormattedOutput): string {
  const { summary, results } = output;

  const errorRows = results.flatMap(r =>
    [...r.errors, ...r.warnings].map(e => `
      <tr class="${e.severity}">
        <td>${basename(r.file)}</td>
        <td>${e.slideNumber}</td>
        <td>${e.ruleId}</td>
        <td>${e.message}</td>
        <td>${e.severity}</td>
      </tr>
    `)
  ).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>marplint Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 40px; }
    h1 { color: #333; }
    .summary { display: flex; gap: 20px; margin-bottom: 30px; }
    .stat { background: #f5f5f5; padding: 15px 25px; border-radius: 8px; }
    .stat-value { font-size: 2em; font-weight: bold; }
    .stat-label { color: #666; }
    .errors .stat-value { color: #e53935; }
    .warnings .stat-value { color: #fb8c00; }
    .passed .stat-value { color: #43a047; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; }
    tr.error td:last-child { color: #e53935; }
    tr.warning td:last-child { color: #fb8c00; }
  </style>
</head>
<body>
  <h1>🔍 marplint Report</h1>

  <div class="summary">
    <div class="stat">
      <div class="stat-value">${summary.files}</div>
      <div class="stat-label">Files</div>
    </div>
    <div class="stat">
      <div class="stat-value">${summary.slides}</div>
      <div class="stat-label">Slides</div>
    </div>
    <div class="stat errors">
      <div class="stat-value">${summary.errors}</div>
      <div class="stat-label">Errors</div>
    </div>
    <div class="stat warnings">
      <div class="stat-value">${summary.warnings}</div>
      <div class="stat-label">Warnings</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>File</th>
        <th>Slide</th>
        <th>Rule</th>
        <th>Message</th>
        <th>Severity</th>
      </tr>
    </thead>
    <tbody>
      ${errorRows || '<tr><td colspan="5">No issues found</td></tr>'}
    </tbody>
  </table>

  <p style="color: #666; margin-top: 30px;">
    Generated by marplint v${VERSION} at ${new Date().toISOString()}
  </p>
</body>
</html>`;
}
