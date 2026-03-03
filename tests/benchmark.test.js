'use strict';

const assert = require('assert');
const { run, scoreKeywordCoverage, scoreResponseQuality, calculateCompositeScore, assignGrade } = require('../scripts/benchmark');
const { generateReport } = require('../scripts/reporter');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

async function main() {
  console.log('\nllm-benchmark test suite\n');

  // --- Unit tests: scoring functions ---
  console.log('Scoring functions:');

  test('scoreKeywordCoverage: all keywords present', () => {
    const score = scoreKeywordCoverage('The transitive reasoning shows all bloops are lazzies', ['transitive', 'all', 'bloops', 'lazzies']);
    assert.ok(score === 1.0, `Expected 1.0, got ${score}`);
  });

  test('scoreKeywordCoverage: partial keywords', () => {
    const score = scoreKeywordCoverage('all bloops', ['all', 'bloops', 'lazzies', 'transitive']);
    assert.ok(score === 0.5, `Expected 0.5, got ${score}`);
  });

  test('scoreKeywordCoverage: no keywords', () => {
    const score = scoreKeywordCoverage('completely irrelevant text', ['bloops', 'lazzies']);
    assert.ok(score === 0.0, `Expected 0.0, got ${score}`);
  });

  test('scoreKeywordCoverage: empty keyword list returns 1.0', () => {
    const score = scoreKeywordCoverage('some response', []);
    assert.ok(score === 1.0, `Expected 1.0, got ${score}`);
  });

  test('scoreKeywordCoverage: case insensitive', () => {
    const score = scoreKeywordCoverage('FRANCE PARIS EIFFEL TOWER', ['france', 'paris', 'eiffel', 'tower']);
    assert.ok(score === 1.0, `Expected 1.0, got ${score}`);
  });

  test('scoreResponseQuality: empty string returns 0', () => {
    const score = scoreResponseQuality('');
    assert.ok(score === 0, `Expected 0, got ${score}`);
  });

  test('scoreResponseQuality: good response returns high score', () => {
    const score = scoreResponseQuality('This is a well-structured response with multiple sentences providing good coverage of the topic. It includes detailed explanation and reasoning.');
    assert.ok(score > 0.8, `Expected >0.8, got ${score}`);
  });

  test('calculateCompositeScore: all ones returns 1.0', () => {
    const score = calculateCompositeScore({ latencyScore: 1, keywordCoverage: 1, responseQuality: 1, wordCountScore: 1 });
    assert.ok(Math.abs(score - 1.0) < 0.001, `Expected 1.0, got ${score}`);
  });

  test('calculateCompositeScore: all zeros returns 0.0', () => {
    const score = calculateCompositeScore({ latencyScore: 0, keywordCoverage: 0, responseQuality: 0, wordCountScore: 0 });
    assert.ok(score === 0.0, `Expected 0.0, got ${score}`);
  });

  test('assignGrade: A for score >= 0.85', () => {
    assert.strictEqual(assignGrade(0.90), 'A');
    assert.strictEqual(assignGrade(0.85), 'A');
  });

  test('assignGrade: B for 0.70-0.84', () => {
    assert.strictEqual(assignGrade(0.75), 'B');
  });

  test('assignGrade: F for score < 0.40', () => {
    assert.strictEqual(assignGrade(0.10), 'F');
    assert.strictEqual(assignGrade(0.0), 'F');
  });

  // --- Integration tests: benchmark runner ---
  console.log('\nBenchmark runner (dry-run):');

  await testAsync('run() with dry-run produces results for all prompts', async () => {
    const data = await run({ models: ['test-model'], suite: 'standard', dryRun: true, useCache: false });
    assert.ok(data.results.length === 5, `Expected 5 results, got ${data.results.length}`);
    assert.ok(data.summary.totalModels === 1);
    assert.ok(data.summary.totalPrompts === 5);
  });

  await testAsync('run() with two models produces 2x results', async () => {
    const data = await run({ models: ['model-a', 'model-b'], suite: 'coding', dryRun: true, useCache: false });
    assert.ok(data.results.length === 6, `Expected 6 results (2 models x 3 prompts), got ${data.results.length}`);
  });

  await testAsync('run() results have required fields', async () => {
    const data = await run({ models: ['test-model'], suite: 'standard', dryRun: true, useCache: false });
    const r = data.results[0];
    assert.ok(r.model, 'Missing model');
    assert.ok(r.promptId, 'Missing promptId');
    assert.ok(r.response, 'Missing response');
    assert.ok(typeof r.compositeScore === 'number', 'compositeScore should be a number');
    assert.ok(r.grade, 'Missing grade');
    assert.ok(r.metrics, 'Missing metrics');
  });

  await testAsync('run() throws on empty models array', async () => {
    let threw = false;
    try {
      await run({ models: [], suite: 'standard', dryRun: true });
    } catch (err) {
      threw = true;
      assert.ok(err.message.includes('No models'), `Expected 'No models' error, got: ${err.message}`);
    }
    assert.ok(threw, 'Expected an error to be thrown');
  });

  await testAsync('run() throws on invalid suite name', async () => {
    let threw = false;
    try {
      await run({ models: ['test'], suite: 'nonexistent-suite', dryRun: true });
    } catch (err) {
      threw = true;
      assert.ok(err.message.includes('not found'), `Expected 'not found' error, got: ${err.message}`);
    }
    assert.ok(threw, 'Expected an error for invalid suite');
  });

  // --- Reporter tests ---
  console.log('\nReport generation:');

  await testAsync('generateReport markdown produces # heading', async () => {
    const data = await run({ models: ['test-model'], suite: 'standard', dryRun: true, useCache: false });
    const report = generateReport(data, { format: 'markdown' });
    assert.ok(report.startsWith('# LLM Benchmark Report'), `Expected markdown heading, got: ${report.slice(0, 40)}`);
    assert.ok(report.includes('## Summary'), 'Missing Summary section');
    assert.ok(report.includes('## Model Rankings'), 'Missing Model Rankings section');
  });

  await testAsync('generateReport json produces valid JSON', async () => {
    const data = await run({ models: ['test-model'], suite: 'coding', dryRun: true, useCache: false });
    const report = generateReport(data, { format: 'json' });
    const parsed = JSON.parse(report);
    assert.ok(parsed.meta, 'Missing meta in JSON');
    assert.ok(parsed.results, 'Missing results in JSON');
    assert.ok(parsed.summary, 'Missing summary in JSON');
  });

  await testAsync('generateReport csv has header row', async () => {
    const data = await run({ models: ['test-model'], suite: 'reasoning', dryRun: true, useCache: false });
    const report = generateReport(data, { format: 'csv' });
    const lines = report.split('\n');
    assert.ok(lines[0].includes('model,promptId'), `Expected CSV header, got: ${lines[0]}`);
    assert.ok(lines.length > 1, 'CSV should have data rows');
  });

  // --- Summary ---
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
