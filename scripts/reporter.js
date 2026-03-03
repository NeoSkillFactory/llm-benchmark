'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Format a number as a percentage string.
 */
function pct(n) {
  return `${Math.round(n * 100)}%`;
}

/**
 * Pad a string to a fixed width for table alignment.
 */
function pad(str, width) {
  const s = String(str);
  return s.length >= width ? s.slice(0, width) : s + ' '.repeat(width - s.length);
}

/**
 * Generate a Markdown report from benchmark results.
 */
function generateMarkdown(data) {
  const { meta, summary, results } = data;
  const lines = [];

  lines.push('# LLM Benchmark Report');
  lines.push('');
  lines.push(`**Date:** ${new Date(meta.timestamp).toLocaleString()}`);
  lines.push(`**Suite:** ${meta.suite}`);
  lines.push(`**Models:** ${meta.models.join(', ')}`);
  lines.push(`**Mode:** ${meta.dryRun ? 'Dry Run (mock responses)' : 'Live API'}`);
  lines.push(`**Total Duration:** ${(meta.totalDurationMs / 1000).toFixed(2)}s`);
  lines.push('');

  // Summary
  lines.push('## Summary');
  lines.push('');
  lines.push(`- **Best Model:** ${summary.bestModel} (avg score: ${pct(summary.bestScore || 0)})`);
  lines.push(`- **Total Prompts:** ${summary.totalPrompts}`);
  lines.push(`- **Total Models:** ${summary.totalModels}`);
  lines.push(`- **Total Runs:** ${summary.totalRuns}`);
  if (summary.errorCount > 0) {
    lines.push(`- **Errors:** ${summary.errorCount}`);
  }
  lines.push('');

  // Model Rankings
  if (summary.modelRankings && summary.modelRankings.length > 0) {
    lines.push('## Model Rankings');
    lines.push('');
    lines.push('| Rank | Model | Avg Score | Grade |');
    lines.push('|------|-------|-----------|-------|');
    summary.modelRankings.forEach((m, i) => {
      const grade = m.avgScore >= 0.85 ? 'A' : m.avgScore >= 0.70 ? 'B' : m.avgScore >= 0.55 ? 'C' : m.avgScore >= 0.40 ? 'D' : 'F';
      lines.push(`| ${i + 1} | ${m.model} | ${pct(m.avgScore)} | ${grade} |`);
    });
    lines.push('');
  }

  // Results by Model
  lines.push('## Detailed Results');
  lines.push('');

  const byModel = {};
  for (const r of results) {
    if (!byModel[r.model]) byModel[r.model] = [];
    byModel[r.model].push(r);
  }

  for (const [model, modelResults] of Object.entries(byModel)) {
    lines.push(`### ${model}`);
    lines.push('');
    lines.push('| Prompt | Category | Score | Grade | Latency | Keywords | Quality |');
    lines.push('|--------|----------|-------|-------|---------|----------|---------|');

    for (const r of modelResults) {
      if (r.error) {
        lines.push(`| ${r.promptName} | ${r.category} | ERROR | F | - | - | ${r.error.slice(0, 40)} |`);
      } else {
        lines.push(
          `| ${r.promptName} | ${r.category} | ${pct(r.compositeScore)} | ${r.grade} | ${r.latencyMs}ms | ${pct(r.metrics.keywordCoverage)} | ${pct(r.metrics.responseQuality)} |`
        );
      }
    }
    lines.push('');

    // Show sample responses
    lines.push('#### Sample Responses');
    lines.push('');
    for (const r of modelResults.slice(0, 2)) {
      if (r.response) {
        lines.push(`**${r.promptName}:**`);
        lines.push('```');
        lines.push(r.response.trim().slice(0, 300) + (r.response.length > 300 ? '...' : ''));
        lines.push('```');
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

/**
 * Generate a JSON report (pretty-printed, with optional response truncation).
 */
function generateJSON(data, opts = {}) {
  const { truncateResponses = true, maxResponseLength = 500 } = opts;
  if (truncateResponses) {
    const clone = JSON.parse(JSON.stringify(data));
    for (const r of clone.results) {
      if (r.response && r.response.length > maxResponseLength) {
        r.response = r.response.slice(0, maxResponseLength) + '...[truncated]';
      }
    }
    return JSON.stringify(clone, null, 2);
  }
  return JSON.stringify(data, null, 2);
}

/**
 * Generate a CSV report with one row per model-prompt result.
 */
function generateCSV(data) {
  const headers = [
    'model', 'promptId', 'promptName', 'category',
    'compositeScore', 'grade', 'latencyMs', 'wordCount',
    'keywordCoverage', 'responseQuality', 'latencyScore',
    'inputTokens', 'outputTokens', 'fromCache', 'error'
  ];

  const escape = (val) => {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [headers.join(',')];
  for (const r of data.results) {
    rows.push([
      r.model,
      r.promptId,
      r.promptName,
      r.category,
      r.compositeScore,
      r.grade,
      r.latencyMs,
      r.wordCount,
      r.metrics?.keywordCoverage,
      r.metrics?.responseQuality,
      r.metrics?.latencyScore,
      r.inputTokens,
      r.outputTokens,
      r.fromCache,
      r.error
    ].map(escape).join(','));
  }

  return rows.join('\n');
}

/**
 * Main report generation function.
 * @param {object} data - Benchmark result data from benchmark.run()
 * @param {object} opts - Options: format ('markdown'|'json'|'csv'), outputPath
 * @returns {string} The formatted report
 */
function generateReport(data, opts = {}) {
  const { format = 'markdown', outputPath = null } = opts;

  let report;
  switch (format.toLowerCase()) {
    case 'json':
      report = generateJSON(data, opts);
      break;
    case 'csv':
      report = generateCSV(data);
      break;
    case 'markdown':
    case 'md':
    default:
      report = generateMarkdown(data);
      break;
  }

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (dir && dir !== '.') fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outputPath, report, 'utf8');
  }

  return report;
}

module.exports = { generateReport, generateMarkdown, generateJSON, generateCSV };
