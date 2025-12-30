---
description: Search past plans and ledgers for relevant precedent
---

# /search

Search the artifact index to find relevant past work, patterns, and lessons learned.

## Usage

```
/search <query>
```

## Examples

```
/search oauth authentication
/search JWT tokens
/search database migration
/search error handling patterns
```

## What It Searches

- **Ledgers** (`thoughts/ledgers/`) - Past session states and decisions
- **Plans** (`thoughts/shared/plans/`) - Implementation plans

## Output Format

```markdown
## Search: {query}

### Relevant Results
{For each result: explain relevance and key takeaways}

### Recommendations
{Which files to read, patterns to consider}

### Alternative Searches
{If results sparse, suggest other queries}
```

## Notes

- Results are ranked by relevance
- Explains WHY each result matches your query
- Suggests next steps (files to read, patterns to apply)
- If no results, suggests alternative search terms
