#!/usr/bin/env node
'use strict';

const { program } = require('commander');
const { run } = require('./benchmark');
const { generateReport } = require('./reporter');
const pkg = require('../package.json');

program
  .name('llm-benchmark')
  .description('Automated LLM benchmarking across multiple models with standardized prompts and performance reports.')
  .version(pkg.version)
  .option('--models <models>', 'Comma-separated list of model IDs (e.g. claude-haiku-4-5,claude-sonnet-4-6)')
  .option('--suite <suite>', 'Benchmark suite to run: standard, coding, reasoning, creative', 'standard')
  .option('--prompts <file>', 'Path to custom prompts JSON file')
  .option('--format <format>', 'Output format: json, csv, markdown', 'markdown')
  .option('--output <path>', 'Output file path (default: stdout)')
  .option('--force', 'Force re-run, ignoring cache', false)
  .option('--no-cache', 'Disable result caching')
  .option('--cache-dir <dir>', 'Cache directory', '.cache')
  .option('--dry-run', 'Use mock responses instead of real API calls', false)
  .option('--verbose', 'Show detailed progress output', false)
  .helpOption('-h, --help', 'Display this help message')
  .addHelpText('after', `
Examples:
  $ node cli.js --models claude-haiku-4-5 --suite standard --dry-run
  $ node cli.js --models claude-haiku-4-5,claude-sonnet-4-6 --suite coding --dry-run --format markdown
  $ node cli.js --models claude-haiku-4-5 --suite reasoning --format json --output report.json
  $ node cli.js --models claude-haiku-4-5 --prompts ./my-prompts.json --dry-run

Environment Variables:
  ANTHROPIC_API_KEY   Required for live benchmarking (not needed with --dry-run)
  LLM_CACHE_DIR       Override default cache directory
`);

async function main() {
  program.parse(process.argv);
  const opts = program.opts();

  // Validate required options
  if (!opts.models) {
    console.error('Error: --models is required. Example: --models claude-haiku-4-5,claude-sonnet-4-6');
    process.exit(1);
  }

  const models = opts.models.split(',').map(m => m.trim()).filter(Boolean);
  if (models.length === 0) {
    console.error('Error: At least one model must be specified.');
    process.exit(1);
  }

  const cacheDir = process.env.LLM_CACHE_DIR || opts.cacheDir;
  const useCache = opts.cache !== false; // commander uses --no-cache to set cache=false

  if (opts.verbose) {
    process.stderr.write(`llm-benchmark v${pkg.version}\n`);
    process.stderr.write(`Models: ${models.join(', ')}\n`);
    process.stderr.write(`Suite: ${opts.suite}\n`);
    process.stderr.write(`Format: ${opts.format}\n`);
    process.stderr.write(`Dry run: ${opts.dryRun}\n`);
    process.stderr.write(`Cache: ${useCache ? `enabled (${cacheDir})` : 'disabled'}\n`);
    process.stderr.write('\n');
  }

  let data;
  try {
    data = await run({
      models,
      suite: opts.suite,
      prompts: opts.prompts || null,
      dryRun: opts.dryRun,
      useCache,
      force: opts.force,
      cacheDir,
      verbose: opts.verbose
    });
  } catch (err) {
    console.error(`Benchmark error: ${err.message}`);
    if (opts.verbose) console.error(err.stack);
    process.exit(1);
  }

  let report;
  try {
    report = generateReport(data, {
      format: opts.format,
      outputPath: opts.output || null
    });
  } catch (err) {
    console.error(`Report generation error: ${err.message}`);
    if (opts.verbose) console.error(err.stack);
    process.exit(1);
  }

  if (!opts.output) {
    process.stdout.write(report + '\n');
  } else {
    process.stderr.write(`Report written to: ${opts.output}\n`);
  }

  // Exit non-zero if there were errors
  if (data.summary.errorCount > 0) {
    process.stderr.write(`Warning: ${data.summary.errorCount} benchmark run(s) failed.\n`);
    process.exit(2);
  }

  process.exit(0);
}

main();
