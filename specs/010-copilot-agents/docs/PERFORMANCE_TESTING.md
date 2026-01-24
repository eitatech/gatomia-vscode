# Performance Testing & Validation Guide

## Overview

This document defines performance benchmarks and testing procedures for the Copilot Agents Integration feature. All performance targets must be met before release.

**Target Version**: GatomIA v0.31.0+

## Performance Targets

### Agent Discovery & Registration

| Metric | Target | Acceptable | Critical Failure |
|--------|--------|-----------|-----------------|
| Agent registration per agent | <1s | <5s | >10s |
| Total startup time | <5s | <10s | >15s |
| Resource discovery | <1s | <2s | >5s |
| Chat participant registration | <200ms/agent | <500ms/agent | >1s/agent |

### Tool Execution

| Metric | Target | Acceptable | Critical Failure |
|--------|--------|-----------|-----------------|
| Tool method invocation | <10ms | <50ms | >100ms |
| Parameter validation | <5ms | <20ms | >50ms |
| Resource lookup (cached) | <1ms | <5ms | >10ms |
| Error handling overhead | <5ms | <20ms | >50ms |
| Average tool execution | <30s | <60s | >120s |

### User Interface Responsiveness

| Metric | Target | Acceptable | Critical Failure |
|--------|--------|-----------|-----------------|
| Autocomplete suggestions | <200ms | <500ms | >1s |
| Agent list fetch | <100ms | <300ms | >500ms |
| Command suggestion display | <100ms | <300ms | >500ms |
| Chat response streaming | <50ms initial | <100ms | >200ms |

### Resource Management

| Metric | Target | Acceptable | Critical Failure |
|--------|--------|-----------|-----------------|
| Resource loading (100 files) | <1s | <2s | >5s |
| In-memory cache size | <10MB | <20MB | >50MB |
| Hot-reload detection | <500ms | <1s | >5s |
| Resource update application | <200ms | <500ms | >1s |

## Testing Procedures

### Test Environment Setup

```bash
# Prerequisites
Node.js 18+
npm 8+
VS Code 1.84.0+
GitHub Copilot Chat extension installed

# Install dependencies
npm run install:all

# Build project
npm run build

# Launch test environment
code --new-window /path/to/project --enable-proposed-api github.copilot-chat
```

### Test 1: Agent Discovery Performance

**Objective**: Verify agent discovery completes within performance targets

**Procedure**:

1. Create test agents (5, 10, 20, 50 agents)
2. Place in `resources/agents/` directory
3. Launch extension
4. Measure time from launch to "Initialization complete" in output
5. Record results

**Expected Output**:
```
[AgentService] Loaded 20 agents in 234ms
[AgentService] Registration complete: 20 succeeded, 0 failed
[AgentService] Initialization complete
```

**Success Criteria**:
- 5 agents: <500ms
- 10 agents: <1000ms
- 20 agents: <2000ms
- 50 agents: <5000ms

### Test 2: Tool Execution Baseline

**Objective**: Measure tool execution time without network I/O

**Procedure**:

1. Create simple test tool:
```typescript
export async function testBaseline(
	params: ToolExecutionParams
): Promise<ToolResponse> {
	const start = Date.now();
	// Minimal work
	await new Promise(r => setTimeout(r, 10));
	const duration = Date.now() - start;
	return { content: `# Result\n\nDuration: ${duration}ms` };
}
```

2. Register tool: `test.baseline`
3. Execute tool 10 times via Copilot Chat
4. Record average execution time
5. Calculate overhead

**Expected Results**:
- Tool invocation + validation: <15ms
- Tool execution (10ms work): 10-25ms total
- Error handling path: <30ms

### Test 3: Resource Caching Performance

**Objective**: Verify resource cache provides fast lookups

**Procedure**:

1. Create 100 resource files (mix of prompts, skills, instructions)
2. Place in appropriate `resources/` subdirectories
3. Note startup time to load all resources
4. Perform 1000 cache lookups of varying resources
5. Measure average lookup time

**Test Code**:
```typescript
const cache = new ResourceCache(outputChannel);
await cache.load("resources");

const resources = ["prompt1", "skill1", "instruction1"];
const startTime = Date.now();

for (let i = 0; i < 1000; i++) {
	for (const resource of resources) {
		const found = cache.get("prompt", resource + ".prompt.md");
	}
}

const totalTime = Date.now() - startTime;
const avgLookupTime = totalTime / (1000 * resources.length);

console.log(`Average cache lookup: ${avgLookupTime}ms`);
```

**Expected Results**:
- Cache load (100 files): <1000ms
- Average lookup: <1ms
- Worst case: <5ms

### Test 4: Hot-Reload Performance

**Objective**: Verify hot-reload doesn't negatively impact performance

**Procedure**:

1. Start extension with hot-reload enabled
2. Create file: `resources/prompts/test-prompt.prompt.md`
3. Record detection time in output channel
4. Measure cache update time
5. Repeat 5-10 times

**Expected Output**:
```
[FileWatcher] Detected changes: [1 files]
[ResourceCache] Reloading resources...
[ResourceCache] Reloaded 1 resource files
```

**Success Criteria**:
- Detection: <500ms
- Update: <200ms
- Total reload: <1s

### Test 5: UI Responsiveness - Autocomplete

**Objective**: Measure autocomplete suggestion latency

**Procedure**:

1. Open Copilot Chat
2. Type `@` slowly: `@ s p e c k i t`
3. Measure time from typing `@spec` to suggestions appearing
4. Repeat 5 times

**Manual Verification**:
- Press `@` → suggestions appear immediately
- Type agent name slowly → suggestions update with each character
- Autocomplete completes within 200ms

**Automated Test** (if available):
```typescript
const start = Date.now();
const suggestions = await getChatParticipantSuggestions("spec");
const duration = Date.now() - start;
assert.isBelow(duration, 200); // <200ms
```

### Test 6: Concurrent Tool Execution

**Objective**: Verify multiple tool executions don't block each other

**Procedure**:

1. Execute multiple tools concurrently:
```typescript
const promises = [
	toolRegistry.execute("tool.a", params),
	toolRegistry.execute("tool.b", params),
	toolRegistry.execute("tool.c", params),
];

const startTime = Date.now();
const results = await Promise.all(promises);
const totalTime = Date.now() - startTime;
```

2. Measure total time vs sequential execution
3. Verify parallelism improves performance

**Expected Results**:
- Sequential (3 × 5s tools): ~15s
- Parallel (3 × 5s tools): ~5-6s
- Speedup: 2.5-3x

### Test 7: Error Handling Overhead

**Objective**: Verify error handling doesn't cause performance regression

**Procedure**:

1. Execute tools that throw errors
2. Verify error handling completes quickly
3. Compare with successful execution

**Test Cases**:
```typescript
// Case 1: Validation error
toolRegistry.execute("tool", invalidParams); // <30ms

// Case 2: Tool throws error
toolRegistry.execute("bad.tool", params); // <50ms

// Case 3: Resource not found
toolRegistry.execute("tool", paramsWithMissingResource); // <20ms
```

**Expected Results**:
- Error detection: <10ms
- Error wrapping: <5ms
- Error logging: <10ms
- Total error path: <30ms

### Test 8: Memory Usage

**Objective**: Verify agent system doesn't consume excessive memory

**Procedure**:

1. Record memory before startup
2. Start extension
3. Load agents and resources
4. Record memory after initialization
5. Execute tools and operations
6. Record peak memory
7. Allow garbage collection
8. Record final memory

**Measurement Commands**:
```bash
# Check memory usage of VS Code process
ps aux | grep "code --extension-host"

# Or use Activity Monitor (macOS)
# Look for "Code Helper" processes
```

**Success Criteria**:
- Initial overhead: <50MB
- Peak runtime: <100MB
- After GC: <75MB

## Performance Profile Collection

### Using Chrome DevTools

1. Open VS Code DevTools: `Help → Developer → Open DevTools`
2. Click Performance tab
3. Record your actions:
   - Start recording
   - Execute agent operations
   - Stop recording
4. Analyze flame charts and bottlenecks

### Using VS Code Profiling

```bash
# Profile extension startup
code --prof-startup-prefix ./profiles

# Analyze results
code ./profiles
```

## Benchmark Reporting

### Template

```markdown
## Performance Test Results - [Date]

### Environment
- OS: [macOS/Windows/Linux]
- VS Code Version: 1.XX.0
- Node Version: 18.X.X
- Test Duration: HH:MM

### Agent Discovery
- Agents tested: 20
- Load time: 234ms
- Registration time: 156ms
- Total startup: 890ms
- Status: ✅ PASS / ❌ FAIL

### Tool Execution
- Tool latency (avg): 24ms
- Tool latency (p95): 42ms
- Tool latency (p99): 58ms
- Status: ✅ PASS / ❌ FAIL

### UI Responsiveness
- Autocomplete latency (avg): 87ms
- Autocomplete latency (p95): 156ms
- Status: ✅ PASS / ❌ FAIL

### Resource Management
- Memory peak: 42MB
- Cache lookup (avg): 0.8ms
- Hot-reload time: 187ms
- Status: ✅ PASS / ❌ FAIL

### Overall Assessment
[Summary of performance findings and any concerns]
```

## Performance Regression Testing

### Continuous Integration

Before each release, verify:

1. ✅ Agent loading: <5s
2. ✅ Tool execution: <30s average
3. ✅ Autocomplete: <200ms
4. ✅ Memory: <100MB peak
5. ✅ Cache lookup: <1ms average
6. ✅ No memory leaks after extended use

### Baseline Comparison

Compare against baseline:

```bash
# Record baseline
npm run perf:baseline

# Run current tests
npm run perf:test

# Compare results
npm run perf:compare
```

## Troubleshooting Performance Issues

### Issue: Slow Agent Loading

**Symptoms**:
- "Initialization complete" takes >10s
- Significant delays on startup

**Investigation**:
1. Check number of agents: `resources/agents/` file count
2. Check agent file sizes (especially markdown content)
3. Review output channel for parsing/validation errors
4. Check for network I/O during loading

**Solution**:
- Remove unused agents
- Split large agents into smaller agents
- Check for synchronous I/O in agent loaders

### Issue: Slow Tool Execution

**Symptoms**:
- Tool responses delayed >30s
- Inconsistent execution times

**Investigation**:
1. Profile tool handler with DevTools
2. Check for blocking I/O
3. Measure resource lookup times
4. Check for event loop blocking

**Solution**:
- Use async/await properly
- Implement timeouts
- Cache expensive operations
- Consider parallel processing

### Issue: High Memory Usage

**Symptoms**:
- Memory grows unbounded during use
- VS Code becomes sluggish

**Investigation**:
1. Check Activity Monitor for memory
2. Force garbage collection
3. Profile memory with DevTools
4. Check for circular references in caches

**Solution**:
- Implement resource limits
- Clear caches periodically
- Fix memory leaks in event listeners
- Use weak references if appropriate

## Performance Monitoring in Production

### Telemetry

The agent system sends telemetry events with timing data:

```typescript
sendTelemetry("agent.service.initialized", {
	"agent.count": 20,
	"load.duration.ms": 234,
	"registration.success": 20,
	"registration.failed": 0,
});
```

### Alert Thresholds

Configure alerts for:
- Initialization time >10s
- Tool execution >60s
- Autocomplete latency >500ms
- Memory usage >200MB

### Production Monitoring

Tracked metrics:
- Daily: Agent loading time distribution
- Daily: Tool execution time distribution
- Weekly: Memory usage trends
- Monthly: Performance regression analysis

---

**Last Updated**: January 24, 2026  
**Status**: ✅ Ready for Testing
