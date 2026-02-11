# 3D Semantic Search Endpoint - Architecture & Strategy Guide

## Executive Summary

This document outlines the strategy for implementing a new `/api/search-quotes-3d` endpoint that extends existing podcast search with 3D spatial coordinates for "galaxy view" visualization. Results are projected into 3D space using dimensionality reduction, where proximity indicates semantic similarity.

**Key Decisions:**
- **Separate endpoint** from `/api/search-quotes` to avoid performance impact on standard searches
- **Expected latency**: 1-2 seconds for 100 results on current hardware (16GB RAM, 4 vCPU)
- **Concurrent capacity**: 2-3 simultaneous requests
- **Technology**: Node.js backend with dimensionality reduction library

---

## Product Goals

### User Experience
- Enable visual exploration of semantic space as a 3D "star field"
- Stars closer together = semantically similar content
- Interactive: click star → open context panel, right-click → search from that point
- Alternative to list view, not a replacement

### Technical Goals
- Maintain existing search quality and filters
- Add 3D coordinates without breaking existing API
- Keep latency acceptable (< 2-3 seconds)
- Future-proof for hierarchy levels beyond paragraphs

---

## API Design

### Endpoint Structure

```
POST /api/search-quotes-3d
```

**Key Design Decisions:**

1. **Separate endpoint** (not a query param on existing endpoint)
   - **Why**: Avoids performance overhead for users not using galaxy view
   - **Why**: Allows different caching and optimization strategies
   - **Why**: Easier to monitor and debug separately

2. **Same auth and filters** as `/api/search-quotes`
   - **Why**: Consistent security model
   - **Why**: Users expect same filtering capabilities

3. **Return format extends existing search response**
   - **Why**: Minimizes frontend code duplication
   - **Why**: Easy to render in either list or galaxy view

### Request Schema

```json
{
  "query": "Bitcoin mining",
  "limit": 100,              // Default: 100, Max: 200
  "feedIds": ["feed_123"],   // Optional filters (same as regular search)
  "minDate": "2024-01-01",
  "maxDate": "2024-12-31",
  "episodeName": "Episode"
}
```

### Response Schema Extensions

Add to each result object:

```json
{
  // ... all existing fields from /api/search-quotes ...
  
  // NEW: 3D coordinates
  "coordinates3d": {
    "x": 0.234,    // Normalized to [-1, 1] range
    "y": -0.456,
    "z": 0.123
  },
  
  // NEW: Hierarchy level (for color coding)
  "hierarchyLevel": "paragraph"  // feed | episode | chapter | paragraph
}
```

Add metadata block:

```json
{
  "results": [...],
  "metadata": {
    "numResults": 100,
    "umapTimeMs": 1234,     // Time spent on 3D projection
    "searchTimeMs": 456,    // Time spent on vector search
    "totalTimeMs": 1690
  }
}
```

---

## Dimensionality Reduction Strategy

### The Challenge

- Embeddings: 1536 dimensions (OpenAI Ada)
- Visualization: 3 dimensions (x, y, z)
- Need: Preserve semantic relationships in reduced space

### Recommended Approach: UMAP

**UMAP (Uniform Manifold Approximation and Projection)**

**Pros:**
- Fast: ~1-2s for 100 points on your hardware
- Preserves both local and global structure
- Works well with cosine similarity (embedding space)
- Mature libraries available

**Cons:**
- Non-deterministic (mitigated with random seed)
- Requires minimum 4 data points
- Computationally expensive (hence separate endpoint)

**Alternative Considered: t-SNE**
- Slower (~3-5s for 100 points)
- Better known, but UMAP is generally superior for this use case

**Alternative Considered: PCA**
- Very fast (<0.5s)
- Poor quality: linear reduction loses semantic structure
- Not recommended for visualization

### Implementation Strategy

#### Node.js Library Options

1. **umap-js** (JavaScript port)
   - Pure JS implementation
   - Runs in Node.js
   - Performance: Acceptable for 100 points
   - **Recommendation**: Start here for simplicity

2. **Python microservice** (if performance issues)
   - Call Python UMAP library from Node.js
   - Better performance (multi-threaded)
   - Adds deployment complexity
   - **Recommendation**: Only if umap-js is too slow

#### Configuration Parameters

Recommended starting values (tune based on testing):

```javascript
{
  nComponents: 3,          // Output dimensionality
  nNeighbors: 15,          // Balance local/global structure
  minDist: 0.1,            // Minimum distance between points
  metric: 'cosine',        // Match embedding similarity
  randomState: 42          // Reproducibility
}
```

**Fast mode** (if latency becomes issue):
```javascript
{
  nNeighbors: 8,           // Faster, slight quality loss
  minDist: 0.05
}
```

---

## Implementation Phases

### Phase 1: Core Functionality (Week 1)

**Backend:**
1. Create new endpoint handler in existing routes
2. Reuse search logic from `/api/search-quotes`
3. **Critical**: Request embeddings from Pinecone (`includeValues: true`)
4. Integrate UMAP library
5. Add coordinate normalization (scale to [-1, 1])
6. Add hierarchy level detection

**Testing:**
- Unit tests for UMAP wrapper
- Integration tests for endpoint
- Manual testing with various queries
- Performance benchmarking

**Success Criteria:**
- < 2s latency for 100 results
- Coordinates distributed across 3D space
- No errors with edge cases (few results, etc.)

### Phase 2: Optimization (Week 2)

**Backend:**
1. Add caching layer (Redis) for repeated queries
2. Implement query parameter for fast mode
3. Add detailed timing metrics
4. Set up monitoring and alerts

**Success Criteria:**
- Cache hit rate > 30% for popular queries
- Fast mode < 1s latency
- Comprehensive metrics in place

### Phase 3: Advanced Features (Week 3+)

**Backend:**
1. Pre-computation for popular queries (nightly job)
2. Rate limiting (more restrictive than regular search)
3. Support for "search from this point" (re-search using a result's embedding)

**Success Criteria:**
- Pre-computed queries return < 500ms
- No performance degradation under load
- "Search from point" working end-to-end

---

## Technical Architecture

### High-Level Flow

```
User searches "Bitcoin" in galaxy view
    ↓
1. Frontend calls /api/search-quotes-3d
    ↓
2. Backend: Get query embedding (OpenAI)
    ↓
3. Backend: Search Pinecone (include embeddings!)
    ↓
4. Backend: Extract embeddings from top 100 results
    ↓
5. Backend: Run UMAP to project to 3D
    ↓
6. Backend: Normalize coordinates to [-1, 1]
    ↓
7. Backend: Add hierarchy level to each result
    ↓
8. Frontend: Render as 3D star field
```

### Key Architectural Decisions

#### 1. Where to compute 3D coordinates?

**Decision: Backend (not frontend)**

**Rationale:**
- UMAP is CPU-intensive
- Server has more compute resources
- Can cache results
- Frontend stays lightweight

#### 2. When to compute 3D coordinates?

**Decision: On-demand (not pre-computed globally)**

**Rationale:**
- Search results vary by user (filters, auth)
- Pre-computing all combinations is impractical
- On-demand latency (1-2s) is acceptable for "fancy viz mode"
- Can add pre-computation for popular queries later

#### 3. How to handle Pinecone embeddings?

**Decision: Request in search query (`includeValues: true`)**

**Rationale:**
- Pinecone stores embeddings but doesn't return by default
- Requesting them adds minimal latency (~50ms)
- Alternative (store separately) adds complexity and sync issues

#### 4. How to normalize coordinates?

**Decision: Min-max scaling to [-1, 1] on all axes**

**Rationale:**
- Predictable range for frontend rendering
- Prevents one axis from dominating
- Easy to validate and debug

---

## Performance Considerations

### Expected Latency Breakdown (100 results)

| Step | Time | Optimization Strategy |
|------|------|----------------------|
| Query embedding | 50-100ms | Cache common queries |
| Pinecone search | 200-400ms | Existing optimization |
| UMAP projection | 500-1500ms | Fast mode, caching |
| Response building | 50-100ms | Efficient serialization |
| **Total** | **1-2 seconds** | Multi-pronged |

### Hardware Utilization

**Current setup: 16GB RAM, 4 vCPU**

- **CPU**: UMAP will use ~80% of 1 core (or 20% of all 4)
- **Memory**: ~200MB for 100 results (embeddings + UMAP)
- **Concurrent requests**: 2-3 before queuing needed

### Scaling Strategy

**Horizontal scaling** (if traffic grows):
- Stateless endpoint, easy to load balance
- Add more backend instances
- Share Redis cache across instances

**Vertical scaling** (not needed now):
- Current hardware is sufficient
- Could upgrade to 8 vCPU if latency becomes issue

---

## Error Handling

### Edge Cases to Handle

1. **Too few results** (< 4)
   - UMAP requires minimum 4 points
   - Return 400 with clear error message
   - Frontend falls back to list view

2. **UMAP computation failure**
   - Log detailed error
   - Return 500 with generic message
   - Alert on-call engineer

3. **Pinecone timeout**
   - Same handling as regular search
   - Return 504 Gateway Timeout

4. **Degenerate coordinates** (all clustered)
   - Validate coordinate distribution
   - Return error if std dev too low
   - Suggests problem with embeddings

### Error Response Format

```json
{
  "error": "Insufficient results for 3D visualization",
  "message": "Need at least 4 results. Found: 2",
  "results": []
}
```

---

## Monitoring & Observability

### Key Metrics to Track

**Performance:**
- `api.search_3d.latency.p50`, `p95`, `p99`
- `api.search_3d.umap_time` (separate from total)
- `api.search_3d.result_count` distribution

**Usage:**
- `api.search_3d.requests_per_minute`
- `api.search_3d.cache_hit_rate`
- `api.search_3d.error_rate`

**Resource:**
- `system.cpu.usage` during UMAP
- `system.memory.usage`
- `api.search_3d.concurrent_requests`

### Alerts

Set up alerts for:
- Latency p95 > 5 seconds (degradation)
- Error rate > 5% (system issues)
- Memory usage > 14GB (approaching limit)
- Concurrent requests > 3 (need queuing)

### Logging

Log these data points per request:
```javascript
{
  timestamp: "2024-03-15T10:30:00Z",
  query: "Bitcoin",  // Or hash for privacy
  resultCount: 100,
  umapTimeMs: 1234,
  searchTimeMs: 456,
  totalTimeMs: 1690,
  userId: "user_123",
  cacheHit: false
}
```

---

## Future Enhancements

### Phase 4: Pre-computation Strategy

For popular/recent searches, pre-compute 3D coordinates:

1. **Nightly job**: Run top 100 queries
2. **Store in cache**: Redis with 24hr TTL
3. **Cache key**: Query hash + filters
4. **Result**: Popular searches return < 500ms

### Phase 5: "Search from point" Feature

Allow re-searching using a result's embedding:

1. **Frontend**: Right-click star → "Search from here"
2. **Backend**: New endpoint `/api/search-from-embedding`
3. **Input**: Paragraph ID (to look up its embedding)
4. **Output**: k-nearest neighbors with 3D coords
5. **UX**: Smooth transition to new constellation

### Phase 6: Hybrid Pre-computation

Pre-compute UMAP on entire corpus, store in Pinecone:

**Pros:**
- Zero UMAP latency (just look up)
- Consistent coordinates across searches

**Cons:**
- Nightly batch job needed
- Coordinates are "global" not "query-relative"
- Might lose some semantic nuance

**Decision**: Evaluate after Phase 1-3 data collection

---

## Security & Rate Limiting

### Authentication

**Decision: Same auth as `/api/search-quotes`**

- Inherit existing JWT/API key validation
- Respect same user permissions and feed access
- No new auth logic needed

### Rate Limiting

**Recommendation: More restrictive than regular search**

```javascript
{
  free: "5 requests per minute",
  paid: "20 requests per minute",
  enterprise: "100 requests per minute"
}
```

**Rationale:**
- More expensive to compute (UMAP)
- Optional feature (not core functionality)
- Prevents abuse/DoS

### Data Privacy

- Don't log full query text (PII concerns)
- Hash queries for caching keys
- Respect existing data access controls

---

## Testing Strategy

### Unit Tests

**UMAP Wrapper:**
- Correct output dimensionality
- Coordinate normalization
- Error handling (too few points)
- Deterministic with seed

**Coordinate Validation:**
- Range checking ([-1, 1])
- No NaN or Inf values
- Reasonable distribution (not all clustered)

### Integration Tests

**Endpoint:**
- Successful 3D search
- Various result counts (10, 50, 100, 200)
- Filter combinations (feedIds, dates, episode)
- Error cases (no results, UMAP failure)

### Performance Tests

**Load testing:**
- Single request latency
- Concurrent request handling (2-3 simultaneous)
- Cache effectiveness
- Memory usage under load

**Benchmark queries:**
```
"Bitcoin" (100 results)
"artificial intelligence" (100 results)
"climate change" (50 results)
```

Target: 95% of requests < 2.5 seconds

---

## Deployment Plan

### Rollout Strategy

**Phase 1: Internal Testing** (Week 1)
- Deploy to staging
- Team testing with real data
- Performance validation
- Bug fixes

**Phase 2: Soft Launch** (Week 2)
- Deploy to production with feature flag OFF
- Enable for internal users only
- Monitor metrics for 48 hours
- Tune configuration as needed

**Phase 3: Beta** (Week 3)
- Enable for 10% of paid users
- Collect feedback
- A/B test against list view
- Monitor error rates

**Phase 4: General Availability** (Week 4+)
- Enable for all users
- Make galaxy view default (or not, based on data)
- Continue monitoring and optimization

### Rollback Plan

If issues arise:
1. Feature flag OFF (instant rollback)
2. Investigate issues in staging
3. Fix and redeploy
4. Gradual re-enable

---

## Success Metrics

### Technical Metrics
- ✅ Latency p95 < 2.5 seconds
- ✅ Error rate < 1%
- ✅ Cache hit rate > 30%
- ✅ No memory/CPU issues under load

### Product Metrics
- % of users who try galaxy view
- % who use it regularly (> 1x per week)
- Average session time in galaxy vs list view
- Conversion impact (if applicable)

### User Feedback
- Qualitative feedback (surveys, interviews)
- Bug reports and edge cases
- Feature requests (e.g., "search from point")

---

## Open Questions & Decisions Needed

1. **Should galaxy view be default for podcast search?**
   - Recommendation: No, make it opt-in toggle initially
   - Collect data before making default

2. **Should we support galaxy view for web search mode?**
   - Recommendation: No, podcast search only for MVP
   - Web search has different result structure

3. **Pre-computation strategy?**
   - Recommendation: Phase 3+ based on usage patterns
   - Wait for real traffic data

4. **Mobile support?**
   - Recommendation: Desktop only for MVP
   - Mobile 3D navigation is complex

---

## Resources & Dependencies

### Node.js Libraries
- `umap-js`: UMAP implementation
- Existing Pinecone client (ensure `includeValues` support)
- Existing Redis client (for caching)

### Infrastructure
- No new infrastructure needed
- Current 16GB/4 vCPU droplet is sufficient
- Redis already in place (or add if not)

### Documentation
- API docs update (Swagger/OpenAPI)
- Internal architecture docs
- Frontend integration guide

---

## Appendix: Alternative Approaches Considered

### Approach 1: Client-side UMAP
**Decision: Rejected**

- Too slow in browser
- Heavy dependency (~2MB)
- Blocks UI thread

### Approach 2: Pre-compute all 3D coordinates globally
**Decision: Rejected for MVP**

- Doesn't account for search context
- Results feel less "query-relevant"
- Can reconsider for Phase 3+

### Approach 3: Use PCA instead of UMAP
**Decision: Rejected**

- Much faster but poor quality
- Linear reduction loses semantic structure
- User testing showed confusing results

### Approach 4: 2D instead of 3D
**Decision: Rejected**

- Less information density
- Less "wow factor" for visualization
- 3D is worth the complexity

