# LLM Benchmark Report

**Date:** 3/2/2026, 12:00:00 PM
**Suite:** standard
**Models:** claude-haiku-4-5, claude-sonnet-4-6
**Mode:** Dry Run (mock responses)
**Total Duration:** 1.23s

## Summary

- **Best Model:** claude-sonnet-4-6 (avg score: 82%)
- **Total Prompts:** 5
- **Total Models:** 2
- **Total Runs:** 10

## Model Rankings

| Rank | Model | Avg Score | Grade |
|------|-------|-----------|-------|
| 1 | claude-sonnet-4-6 | 82% | B |
| 2 | claude-haiku-4-5 | 76% | B |

## Detailed Results

### claude-haiku-4-5

| Prompt | Category | Score | Grade | Latency | Keywords | Quality |
|--------|----------|-------|-------|---------|----------|---------|
| Logical Deduction | reasoning | 78% | B | 342ms | 80% | 90% |
| Text Summarization | summarization | 72% | C | 512ms | 75% | 85% |
| Simple Algorithm | coding | 80% | B | 621ms | 80% | 95% |
| Factual Recall | factual | 75% | B | 210ms | 100% | 90% |
| Format Compliance | instruction_following | 74% | C | 389ms | 60% | 85% |

#### Sample Responses

**Logical Deduction:**
```
Based on logical analysis: yes, the conclusion follows directly. The reasoning is transitive — if all A are B and all B are C, then all A are C. This is a classic syllogism pattern used in formal logic.
```

**Text Summarization:**
```
The Internet is a global network of interconnected computers, developed from ARPANET in the 1960s, that now connects billions of devices worldwide enabling email, web browsing, and social media.
```

### claude-sonnet-4-6

| Prompt | Category | Score | Grade | Latency | Keywords | Quality |
|--------|----------|-------|-------|---------|----------|---------|
| Logical Deduction | reasoning | 85% | A | 289ms | 100% | 95% |
| Text Summarization | summarization | 80% | B | 445ms | 75% | 90% |
| Simple Algorithm | coding | 85% | A | 534ms | 100% | 98% |
| Factual Recall | factual | 82% | B | 178ms | 100% | 92% |
| Format Compliance | instruction_following | 78% | B | 312ms | 80% | 88% |

#### Sample Responses

**Logical Deduction:**
```
Yes, all Bloops are definitely Lazzies. Here's the reasoning: (1) All Bloops are Razzies. (2) All Razzies are Lazzies. By transitivity, all Bloops must be Lazzies.
```

**Text Summarization:**
```
The Internet is a global computer network originally developed from ARPANET in the late 1960s that connects billions of devices worldwide. It enables a wide range of services including email, the World Wide Web, and social media.
```
