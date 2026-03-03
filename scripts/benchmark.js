'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PROMPTS_FILE = path.join(__dirname, '../references/prompts.json');
const METRICS_FILE = path.join(__dirname, '../references/metrics.json');

/**
 * Mock response generator for dry-run mode.
 * Returns a plausible-looking response without API calls.
 */
function generateMockResponse(model, prompt) {
  const words = prompt.prompt.toLowerCase().split(/\s+/).slice(0, 5).join(' ');
  const mockResponses = {
    reasoning: `Based on logical analysis: yes, the conclusion follows directly. The reasoning is transitive — if all A are B and all B are C, then all A are C. This is a classic syllogism pattern used in formal logic.`,
    summarization: `The Internet is a global network of interconnected computers, developed from ARPANET in the 1960s, that now connects billions of devices worldwide enabling email, web browsing, and social media.`,
    coding: `// Function to sum even numbers from an array\nfunction sumEvenNumbers(arr) {\n  return arr.filter(n => n % 2 === 0).reduce((sum, n) => sum + n, 0);\n}`,
    factual: `The capital of France is Paris. The famous iron tower located there is the Eiffel Tower, built in 1889.`,
    instruction_following: `1. Improved cardiovascular health and reduced heart disease risk.\n2. Enhanced mental health and reduced symptoms of anxiety and depression.\n3. Increased strength and muscle mass supporting long-term mobility.`,
    creative: `The robot, R-9, pressed its cold metal fingers against the canvas for the first time, uncertain. Color bloomed beneath its touch like something it had never computed — emotion. By nightfall, R-9 had painted every sunset it had ever processed, finally understanding what it meant to feel warm.`,
    default: `This is a mock response for the prompt: "${words}...". In a real benchmark, this would be the actual model output from ${model}.`
  };

  const category = prompt.category || 'default';
  return mockResponses[category] || mockResponses.default;
}

/**
 * Score a response against expected keywords.
 */
function scoreKeywordCoverage(response, expectedKeywords) {
  if (!expectedKeywords || expectedKeywords.length === 0) return 1.0;
  const lowerResponse = response.toLowerCase();
  const matched = expectedKeywords.filter(kw => lowerResponse.includes(kw.toLowerCase()));
  return matched.length / expectedKeywords.length;
}

/**
 * Score response quality based on structural factors.
 */
function scoreResponseQuality(response) {
  if (!response || response.trim().length === 0) return 0;

  const words = response.trim().split(/\s+/);
  const errorPatterns = /error|exception|failed|unauthorized|rate.limit/i;

  const factors = {
    nonEmpty: response.trim().length > 0 ? 1.0 : 0.0,
    minLength: words.length >= 10 ? 1.0 : words.length / 10,
    noErrors: errorPatterns.test(response) ? 0.0 : 1.0,
    structured: words.length >= 20 ? 1.0 : 0.5
  };

  const weights = { nonEmpty: 0.30, minLength: 0.20, noErrors: 0.30, structured: 0.20 };
  return Object.keys(factors).reduce((sum, k) => sum + factors[k] * weights[k], 0);
}

/**
 * Score latency against thresholds.
 */
function scoreLatency(latencyMs) {
  if (latencyMs <= 1000) return 1.0;
  if (latencyMs <= 3000) return 0.75;
  if (latencyMs <= 8000) return 0.50;
  if (latencyMs <= 15000) return 0.25;
  return 0.0;
}

/**
 * Calculate composite score from individual metrics.
 */
function calculateCompositeScore(metrics) {
  const weights = { latency: 0.20, keywordCoverage: 0.40, responseQuality: 0.30, wordCount: 0.10 };
  return (
    metrics.latencyScore * weights.latency +
    metrics.keywordCoverage * weights.keywordCoverage +
    metrics.responseQuality * weights.responseQuality +
    metrics.wordCountScore * weights.wordCount
  );
}

/**
 * Assign letter grade based on composite score.
 */
function assignGrade(score) {
  if (score >= 0.85) return 'A';
  if (score >= 0.70) return 'B';
  if (score >= 0.55) return 'C';
  if (score >= 0.40) return 'D';
  return 'F';
}

/**
 * Get cache file path for a model+prompt combination.
 */
function getCachePath(cacheDir, model, promptId) {
  const hash = crypto.createHash('md5').update(`${model}:${promptId}`).digest('hex');
  return path.join(cacheDir, `${hash}.json`);
}

/**
 * Load cached result if available and not expired.
 */
function loadFromCache(cacheDir, model, promptId, ttlHours = 24) {
  const cachePath = getCachePath(cacheDir, model, promptId);
  if (!fs.existsSync(cachePath)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const ageMs = Date.now() - data.timestamp;
    if (ageMs > ttlHours * 3600 * 1000) return null;
    return data.result;
  } catch {
    return null;
  }
}

/**
 * Save result to cache.
 */
function saveToCache(cacheDir, model, promptId, result) {
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  const cachePath = getCachePath(cacheDir, model, promptId);
  fs.writeFileSync(cachePath, JSON.stringify({ timestamp: Date.now(), result }, null, 2));
}

/**
 * Call Anthropic API for a real model response.
 */
async function callAnthropicAPI(model, promptText, maxTokens) {
  let Anthropic;
  try {
    Anthropic = require('@anthropic-ai/sdk');
  } catch {
    throw new Error('Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk');
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set. Use --dry-run for mock results.');
  }

  const client = new Anthropic.default({ apiKey });
  const start = Date.now();

  const message = await client.messages.create({
    model,
    max_tokens: maxTokens || 200,
    messages: [{ role: 'user', content: promptText }]
  });

  const latency = Date.now() - start;
  const text = message.content[0]?.text || '';
  return { text, latency, inputTokens: message.usage?.input_tokens || 0, outputTokens: message.usage?.output_tokens || 0 };
}

/**
 * Run a single prompt against a single model.
 */
async function runSingleBenchmark(model, prompt, options = {}) {
  const { dryRun = false, useCache = true, cacheDir = '.cache', verbose = false } = options;

  if (verbose) process.stderr.write(`  Running ${prompt.id} on ${model}...\n`);

  // Check cache first
  if (useCache && !options.force) {
    const cached = loadFromCache(cacheDir, model, prompt.id);
    if (cached) {
      if (verbose) process.stderr.write(`  Cache hit for ${prompt.id}/${model}\n`);
      return { ...cached, fromCache: true };
    }
  }

  let responseText, latencyMs, inputTokens = 0, outputTokens = 0;

  if (dryRun) {
    // Simulate latency for dry run
    const mockLatency = 200 + Math.floor(Math.random() * 800);
    await new Promise(r => setTimeout(r, Math.min(mockLatency, 50))); // fast in tests
    responseText = generateMockResponse(model, prompt);
    latencyMs = mockLatency;
    inputTokens = Math.floor(prompt.prompt.split(/\s+/).length * 1.3);
    outputTokens = Math.floor(responseText.split(/\s+/).length * 1.3);
  } else {
    try {
      const apiResult = await callAnthropicAPI(model, prompt.prompt, prompt.maxTokens || 200);
      responseText = apiResult.text;
      latencyMs = apiResult.latency;
      inputTokens = apiResult.inputTokens;
      outputTokens = apiResult.outputTokens;
    } catch (err) {
      return {
        model,
        promptId: prompt.id,
        promptName: prompt.name,
        category: prompt.category,
        error: err.message,
        latencyMs: 0,
        metrics: { latencyScore: 0, keywordCoverage: 0, responseQuality: 0, wordCountScore: 0 },
        compositeScore: 0,
        grade: 'F',
        fromCache: false
      };
    }
  }

  const words = responseText.trim().split(/\s+/).filter(Boolean);
  const keywordCoverage = scoreKeywordCoverage(responseText, prompt.expectedKeywords);
  const responseQuality = scoreResponseQuality(responseText);
  const latencyScore = scoreLatency(latencyMs);
  const targetWords = Math.floor((prompt.maxTokens || 200) * 0.75);
  const wordCountScore = Math.min(words.length / targetWords, 1.0);

  const metrics = { latencyScore, keywordCoverage, responseQuality, wordCountScore };
  const compositeScore = calculateCompositeScore(metrics);
  const grade = assignGrade(compositeScore);

  const result = {
    model,
    promptId: prompt.id,
    promptName: prompt.name,
    category: prompt.category,
    response: responseText,
    latencyMs,
    wordCount: words.length,
    inputTokens,
    outputTokens,
    metrics,
    compositeScore: Math.round(compositeScore * 100) / 100,
    grade,
    fromCache: false
  };

  if (useCache) saveToCache(cacheDir, model, prompt.id, result);
  return result;
}

/**
 * Load prompts for a given suite name.
 */
function loadPromptSuite(suiteName, customPromptsFile = null) {
  if (customPromptsFile) {
    const data = JSON.parse(fs.readFileSync(customPromptsFile, 'utf8'));
    if (data.suites && data.suites[suiteName]) return data.suites[suiteName].prompts;
    if (Array.isArray(data)) return data;
    throw new Error(`Suite "${suiteName}" not found in custom prompts file.`);
  }

  const data = JSON.parse(fs.readFileSync(PROMPTS_FILE, 'utf8'));
  if (!data.suites[suiteName]) {
    throw new Error(`Suite "${suiteName}" not found. Available: ${Object.keys(data.suites).join(', ')}`);
  }
  return data.suites[suiteName].prompts;
}

/**
 * Build summary statistics from all results.
 */
function buildSummary(results) {
  const validResults = results.filter(r => !r.error);
  if (validResults.length === 0) return { bestModel: 'N/A', totalPrompts: 0, totalModels: 0 };

  const byModel = {};
  for (const r of validResults) {
    if (!byModel[r.model]) byModel[r.model] = [];
    byModel[r.model].push(r.compositeScore);
  }

  const modelAvgScores = Object.entries(byModel).map(([model, scores]) => ({
    model,
    avgScore: Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100
  }));

  modelAvgScores.sort((a, b) => b.avgScore - a.avgScore);

  return {
    bestModel: modelAvgScores[0]?.model || 'N/A',
    bestScore: modelAvgScores[0]?.avgScore || 0,
    totalPrompts: new Set(results.map(r => r.promptId)).size,
    totalModels: Object.keys(byModel).length,
    totalRuns: results.length,
    modelRankings: modelAvgScores,
    errorCount: results.filter(r => r.error).length
  };
}

/**
 * Main benchmark runner. Returns structured results.
 */
async function run(options = {}) {
  const {
    models = [],
    suite = 'standard',
    prompts: customPromptsFile = null,
    dryRun = false,
    useCache = true,
    force = false,
    cacheDir = '.cache',
    verbose = false
  } = options;

  if (!models || models.length === 0) {
    throw new Error('No models specified. Provide at least one model via --models or options.models');
  }

  const prompts = loadPromptSuite(suite, customPromptsFile);
  if (verbose) process.stderr.write(`Loaded ${prompts.length} prompts from suite "${suite}"\n`);

  const results = [];
  const startTime = Date.now();

  for (const model of models) {
    if (verbose) process.stderr.write(`\nBenchmarking model: ${model}\n`);
    for (const prompt of prompts) {
      const result = await runSingleBenchmark(model, prompt, { dryRun, useCache, force, cacheDir, verbose });
      results.push(result);
    }
  }

  const totalDuration = Date.now() - startTime;
  const summary = buildSummary(results);

  return {
    meta: {
      timestamp: new Date().toISOString(),
      suite,
      models,
      dryRun,
      totalDurationMs: totalDuration
    },
    summary,
    results
  };
}

module.exports = { run, loadPromptSuite, buildSummary, scoreKeywordCoverage, scoreResponseQuality, calculateCompositeScore, assignGrade };
