# Backup scalability

Health Tracker exports all user data as a single JSON file. This document
analyzes when this approach becomes unwieldy.

<!-- toc -->
<!-- tocstop -->

## Data growth projection

### Per-entry sizes

| Data type | Typical size |
| --------- | ------------ |
| Date, timestamps | ~50 bytes |
| Body measurements | ~200 bytes |
| Daily metrics | ~150 bytes |
| Workout (6 exercises x 4 sets) | ~1-2 KB |
| **Journal entry with workout** | ~2 KB |
| **Journal entry without workout** | ~400 bytes |

### Projected backup sizes

| Duration | Entries | Estimated size |
| -------- | ------- | -------------- |
| 1 year | 365 | 300 KB - 700 KB |
| 5 years | 1,825 | 1.5 - 3.5 MB |
| 10 years | 3,650 | 3 - 7 MB |
| 20 years | 7,300 | 6 - 15 MB |

Programs and goals add negligible overhead (typically <50 KB total).

## Bottlenecks

Listed in order of likely failure:

1. **Share API limits** - Some platforms cap shared file size. iOS historically
   limited to ~20 MB, varies by receiving app.

2. **Main thread blocking** - `JSON.stringify()` on 10+ MB causes noticeable UI
   freeze (~100-500ms). User perceives jank but operation completes.

3. **Memory pressure** - On low-end mobile devices, 50+ MB JSON in memory could
   trigger garbage collection pauses or crash the tab.

## Conclusion

A fitness tracker with daily entries does not generate enough data to cause
problems within a realistic usage timeframe (10+ years).

## Future optimization

If users report issues, the primary improvement would be moving JSON
serialization to a Web Worker:

```javascript
// worker.js
self.onmessage = (e) => {
  const json = JSON.stringify(e.data, null, 2);
  self.postMessage(json);
};

// app.js
const worker = new Worker('worker.js');
worker.postMessage(data);
worker.onmessage = (e) => {
  const blob = new Blob([e.result], { type: 'application/json' });
  // ... continue with download/share
};
```

This optimization should be deferred until users actually report the problem.
