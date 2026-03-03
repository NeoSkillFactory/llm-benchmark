---
name: llm-benchmark
description: Automated LLM benchmarking across multiple models with standardized prompts and performance reports.
version: 1.0.0
triggers:
  - benchmark these models
  - compare LLM responses
  - run performance test on models
  - generate benchmark report
  - automate LLM comparison
  - run automated benchmark suite
  - test model quality
  - compare model performance
---

# llm-benchmark

Automated LLM benchmarking across multiple models with standardized prompts and performance reports.

## Core Capabilities

### 1. Multi-Model Benchmarking
Execute the same standardized prompts across multiple LLM models simultaneously. Compares responses from different providers and versions to identify quality differences, latency characteristics, and output consistency.

### 2. Standardized Prompt Library
Uses a curated library of benchmark prompts covering reasoning, coding, summarization, creativity, factual recall, and instruction following. Ensures fair, reproducible comparisons across all models.

### 3. Quality Metrics Evaluation
Evaluates responses against defined metrics:
- **Response length**: Word/token count analysis
- **Latency**: Time-to-first-token and total response time
- **Consistency**: Variance across repeated runs
- **Keyword coverage**: Presence of expected answer components
- **Format compliance**: Whether responses follow requested structure

### 4. Multi-Format Report Generation
Exports benchmark results in:
- **JSON**: Machine-readable structured data for downstream processing
- **CSV**: Spreadsheet-compatible format for analysis
- **Markdown**: Human-readable formatted report with tables

### 5. Result Caching
Caches benchmark results to avoid redundant API calls. Cache is keyed by model name + prompt hash. Re-runs only models/prompts that are new or explicitly forced with `--force`.

### 6. CLI Interface
Full command-line interface with:
- Model selection (`--models`)
- Prompt file or built-in suite (`--prompts`)
- Output format selection (`--format`)
- Cache control (`--force`, `--no-cache`)
- Report output path (`--output`)

### 7. Agent Workflow Integration
Exposes a programmatic API for use in OpenClaw agent workflows:
```javascript
const { run } = require('./scripts/benchmark');
const report = await run({ models: ['claude-haiku-4-5', 'claude-sonnet-4-6'], suite: 'standard' });
```

## Out of Scope

- **Manual prompt management**: The skill uses a fixed prompt library. Custom prompts can be provided via file but are not edited by the skill.
- **Model API management**: Authentication and API key management is handled externally via environment variables.
- **Statistical analysis beyond defined metrics**: No regression testing, A/B significance testing, or custom statistical models.
- **Model training or fine-tuning**: This skill only evaluates models, not trains them.
- **Web UI**: CLI and programmatic API only. No browser-based interface.
- **Real-time streaming evaluation**: Benchmarks use complete responses, not streaming.

## References

| File | Purpose |
|------|---------|
| `references/prompts.json` | Curated benchmark prompt library with categories and expected outputs |
| `references/metrics.json` | Metric definitions, scoring weights, and evaluation criteria |
| `references/config-template.json` | Template for user-defined benchmark configurations |

## Usage Examples

### Basic CLI Usage

```bash
# Run full standard benchmark suite on two models
node scripts/cli.js --models claude-haiku-4-5,claude-sonnet-4-6 --suite standard

# Run with custom prompts file and export as markdown
node scripts/cli.js --models gpt-4o,claude-sonnet-4-6 --prompts references/prompts.json --format markdown --output report.md

# Force re-run (ignore cache)
node scripts/cli.js --models claude-haiku-4-5 --suite coding --force

# Dry run (mock API, no real calls)
node scripts/cli.js --models claude-haiku-4-5,gpt-4o --suite standard --dry-run

# JSON output for scripting
node scripts/cli.js --models claude-haiku-4-5 --suite reasoning --format json --output results.json
```

### Programmatic API

```javascript
const { run } = require('./scripts/benchmark');
const { generateReport } = require('./scripts/reporter');

const results = await run({
  models: ['claude-haiku-4-5', 'claude-sonnet-4-6'],
  suite: 'standard',
  dryRun: false,
  useCache: true
});

const report = generateReport(results, { format: 'markdown' });
console.log(report);
```

### OpenClaw Agent Integration

```javascript
// In an OpenClaw agent workflow
const benchmark = require('./scripts/benchmark');

const report = await benchmark.run({
  models: ['claude-haiku-4-5', 'claude-sonnet-4-6'],
  suite: 'standard',
  dryRun: true
});

// Use report data in downstream tasks
console.log(`Best model: ${report.summary.bestModel}`);
```

## Versioning

This skill follows semantic versioning. The current version is `1.0.0`.

| Version | Changes |
|---------|---------|
| 1.0.0 | Initial release with standard benchmark suite |
