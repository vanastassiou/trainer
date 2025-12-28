# Movement pattern classification research

<!-- toc -->
<!-- tocstop -->

This document summarizes kinesiological research on exercise classification systems
to inform improvements to the exercise database schema.

## Current schema limitations

The existing `movement_pattern` field conflates two distinct concepts:

1. **Functional movement patterns** (push, pull, hinge, squat, lunge, rotation, carry)
2. **Joint involvement** (isolation as a movement pattern rather than a classification)

The current values `push`, `pull`, `hinge`, `squat`, `lunge`, `rotation`, `carry`, and
`isolation` mix these concepts. A biceps curl is classified as `isolation` rather than
`pull`, losing functional information.

## Kinesiological classification dimensions

Research from the NSCA, ACSM, and biomechanics literature identifies several
orthogonal dimensions for classifying resistance exercises.

### 1. Functional movement pattern

The seven fundamental human movements recognized in functional training:

| Pattern  | Description                        | Lower/Upper | Examples                    |
| -------- | ---------------------------------- | ----------- | --------------------------- |
| squat    | Hip, knee, ankle flexion together  | Lower       | Squat, leg press            |
| hinge    | Hip flexion with minimal knee bend | Lower       | Deadlift, RDL, kettlebell swing |
| lunge    | Split stance hip/knee flexion      | Lower       | Lunge, split squat, step-up |
| push     | Moving load away from torso        | Upper       | Bench press, overhead press |
| pull     | Moving load toward torso           | Upper       | Row, pull-up, curl          |
| rotation | Twisting through transverse plane  | Core        | Cable woodchop, Russian twist |
| carry    | Loaded locomotion                  | Full body   | Farmer carry, suitcase carry |

Source: [Science for Sport - Basic Movement Patterns](https://www.scienceforsport.com/basic-movement-patterns/)

### 2. Movement plane/direction

Upper body push and pull patterns should be subclassified by direction:

| Direction  | Push examples           | Pull examples        |
| ---------- | ----------------------- | -------------------- |
| horizontal | Bench press, push-up    | Row, face pull       |
| vertical   | Overhead press, dip     | Pull-up, lat pulldown|

This distinction matters because horizontal and vertical movements emphasize
different muscle groups despite sharing the same pattern.

Source: [StrengthLog - The Four Basic Movements](https://www.strengthlog.com/four-basic-movements/)

### 3. Joint involvement

The most fundamental biomechanical classification:

| Type       | Definition                          | Examples              |
| ---------- | ----------------------------------- | --------------------- |
| compound   | Multi-joint movement                | Squat, bench press    |
| isolation  | Single-joint movement               | Curl, leg extension   |

Compound exercises allow heavier loads and recruit more total muscle mass.
Isolation exercises target specific muscles for hypertrophy or rehabilitation.

Source: [Men's Health - Isolation Exercises](https://www.menshealth.com/fitness/a39175582/isolation-exercises/)

### 4. Exercise role

Within a program, exercises serve different purposes:

| Role      | Characteristics                              | Examples            |
| --------- | -------------------------------------------- | ------------------- |
| basic     | Primary strength builders, compound, heavy   | Squat, deadlift, press |
| auxiliary | Support main lifts, isolation or accessory   | Curl, lateral raise |

This aligns with the existing `role` field in the schema.

### 5. Kinetic chain

Classification based on extremity fixation:

| Type   | Definition                              | Examples                |
| ------ | --------------------------------------- | ----------------------- |
| closed | Distal segment fixed against surface    | Squat, push-up, pull-up |
| open   | Distal segment moves freely             | Leg extension, curl     |

Closed chain exercises provide greater joint stability and functional transfer.
Open chain exercises allow targeted isolation.

Source: [ISSA - Kinetic Chain Exercises](https://www.issaonline.com/blog/post/kinetic-chain-exercises-open-versus-closed)

### 6. Limb involvement

Bilateral vs unilateral classification:

| Type       | Definition                    | Examples                   |
| ---------- | ----------------------------- | -------------------------- |
| bilateral  | Both limbs work together      | Squat, bench press         |
| unilateral | Single limb works             | Lunge, single-arm row      |

Unilateral exercises reveal asymmetries, challenge balance, and transfer better
to real-world single-leg activities like running.

Source: [Basecamp Clinic - Bilateral vs Unilateral](https://www.basecampclinic.com/education/v/bvuandopenvsclosedchain)

### 7. Force vector (advanced)

Direction of resistance relative to body:

| Vector          | Description              | Examples                      |
| --------------- | ------------------------ | ----------------------------- |
| axial           | Vertical/top-down load   | Squat, deadlift, overhead press |
| anteroposterior | Horizontal front-to-back | Bench press, hip thrust       |
| lateromedial    | Side-to-side             | Lateral lunge, side plank     |
| torsional       | Rotational               | Cable woodchop                |

Source: [Bret Contreras - Load Vector Training](https://bretcontreras.com/load-vector-training-lvt/)

## Recommended schema changes

Based on this research, I recommend the following changes:

### New field: `joint_type`

```json
{
  "joint_type": {
    "type": "string",
    "enum": ["compound", "isolation"]
  }
}
```

This replaces using `isolation` as a movement pattern value.

### New field: `direction`

```json
{
  "direction": {
    "type": "string",
    "enum": ["horizontal", "vertical"],
    "description": "Direction for push/pull movements"
  }
}
```

Only applicable when `movement_pattern` is `push` or `pull`.

### New field: `kinetic_chain`

```json
{
  "kinetic_chain": {
    "type": "string",
    "enum": ["open", "closed"]
  }
}
```

### New field: `laterality`

```json
{
  "laterality": {
    "type": "string",
    "enum": ["bilateral", "unilateral"]
  }
}
```

### Updated `movement_pattern` field

Remove `isolation` from the enum, leaving only functional patterns:

```json
{
  "movement_pattern": {
    "type": "string",
    "enum": ["push", "pull", "hinge", "squat", "lunge", "rotation", "carry"]
  }
}
```

## Priority of fields for filtering

Based on usefulness for exercise selection:

1. **joint_type** - Most important for program design (compound vs isolation)
2. **movement_pattern** - Core functional classification
3. **direction** - Critical for upper body balance (horizontal/vertical push-pull)
4. **laterality** - Important for addressing imbalances
5. **kinetic_chain** - Useful for rehabilitation contexts

## Migration considerations

- 52 exercises currently have `movement_pattern: "isolation"`. These need:
  - Reassignment to their true functional pattern (mostly `pull` for curls, `push` for extensions)
  - Setting `joint_type: "isolation"`
- All existing exercises need classification for new fields
- Code in `programs.js` updated to use `joint_type` instead of `COMPOUND_PATTERNS`

## Sources

- [NSCA - Progressive Strategies for Teaching Movement Patterns](https://www.nsca.com/education/articles/ptq/teaching-resistance-training-movement-patterns/)
- [Science for Sport - Basic Movement Patterns](https://www.scienceforsport.com/basic-movement-patterns/)
- [StrengthLog - The Four Basic Movements](https://www.strengthlog.com/four-basic-movements/)
- [BarBend - The 7 Fundamental Movement Patterns](https://barbend.com/fundamental-movement-patterns/)
- [ISSA - Kinetic Chain Exercises](https://www.issaonline.com/blog/post/kinetic-chain-exercises-open-versus-closed)
- [Science for Sport - Force Vector Training](https://www.scienceforsport.com/force-vector-training/)
- [Bret Contreras - Load Vector Training](https://bretcontreras.com/load-vector-training-lvt/)
- [PMC - Movement Pattern Definitions for Resistance Training](https://pmc.ncbi.nlm.nih.gov/articles/PMC11385598/)
