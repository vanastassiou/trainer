# Volume guidelines

This document outlines the research basis for exercise selection in generated
workout programs.

## Sources

- Schoenfeld et al. 2017 (PMID: 27433992): "Dose-response relationship between
  weekly resistance training volume and increases in muscle mass"
- Glossary entries: volume, MV, MEV, MAV, MRV

## Weekly volume targets

| Goal        | Sets/muscle/week | Notes                           |
| ----------- | ---------------- | ------------------------------- |
| Maintenance | 3-6              | Preserve muscle mass            |
| Growth      | 10-20            | Hypertrophy stimulus            |
| Age 60+     | 6-10 maintenance | Higher minimum for older adults |

## Per-session limits

Research shows per-session benefits plateau around **10-11 sets per muscle group**.
Exceeding this yields diminishing returns and increases fatigue without proportional
benefit.

Volume should be distributed across 1-2 sessions per muscle group per week (2-3 for
adults 60+).

## Exercise count derivation

Assuming 3-4 working sets per exercise:

| Split     | Muscle groups | Maintenance | Growth |
| --------- | ------------- | ----------- | ------ |
| Pull      | 3             | 3           | 5      |
| Push      | 4             | 4           | 6      |
| Legs      | 5             | 5           | 6      |
| Full body | 6             | 6           | 6      |

**Constraints:**

- Minimum: 3 exercises (covers any split at maintenance volume)
- Maximum: 6 exercises (respects per-session fatigue limits)

## Generation algorithm

1. Select one compound/basic exercise per muscle group (covers maintenance)
2. For growth goal: add auxiliary exercises until target reached
3. Prioritize isolation movements for auxiliary selection
4. Cap at 6 exercises to prevent overtraining

### Target calculation

```javascript
const muscleCount = dayTemplate.muscles.length;
const targetExercises = goal === 'maintenance'
  ? Math.max(3, muscleCount)
  : Math.min(6, muscleCount + 2);
```

### Exercise selection priority

**First pass (compound/basic):**

1. Compound movements (push, pull, squat, hinge, lunge)
2. Basic role exercises
3. Alphabetically for consistency

**Second pass (auxiliary/isolation):**

1. Isolation movements (non-compound patterns)
2. Auxiliary role exercises
3. Cycles through muscle groups for variety

## Validation

Programs are validated to ensure each day has 3-6 exercises. This range:

- Allows maintenance protocols on splits with few muscle groups (e.g., pull day)
- Prevents excessive per-session volume that exceeds recovery capacity
- Aligns with research on dose-response for muscle hypertrophy
