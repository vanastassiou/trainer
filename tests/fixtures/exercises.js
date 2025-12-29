// Sample exercise data for testing (matches new nested schema)
export const sampleExercises = [
  {
    id: 'barbell-row',
    name: 'Barbell row',
    muscles: {
      target: 'back',
      primary: ['latissimus dorsi', 'trapezius', 'rhomboideus'],
      synergists: ['biceps brachii', 'deltoideus posterior'],
      stabilizers: ['core', 'erector spinae']
    },
    movement: {
      pattern: 'horizontal_pull',
      joint_type: 'compound',
      kinetic_chain: 'open',
      laterality: 'bilateral',
      contraction: 'dynamic',
      arm_position: 'bent'
    },
    equipment: 'barbell',
    difficulty: 'intermediate'
  },
  {
    id: 'bench-press',
    name: 'Bench press',
    muscles: {
      target: 'chest',
      primary: ['pectoralis major'],
      synergists: ['deltoideus anterior', 'triceps brachii'],
      stabilizers: ['core', 'rotator cuff']
    },
    movement: {
      pattern: 'horizontal_push',
      joint_type: 'compound',
      kinetic_chain: 'open',
      laterality: 'bilateral',
      contraction: 'dynamic',
      arm_position: 'bent'
    },
    equipment: 'barbell',
    difficulty: 'intermediate'
  },
  {
    id: 'bicep-curl',
    name: 'Bicep curl',
    muscles: {
      target: 'biceps',
      primary: ['biceps brachii'],
      synergists: ['brachialis'],
      stabilizers: ['forearm flexors']
    },
    movement: {
      pattern: 'isolation',
      joint_type: 'isolation',
      kinetic_chain: 'open',
      laterality: 'bilateral',
      contraction: 'dynamic',
      arm_position: 'bent'
    },
    equipment: 'dumbbell',
    difficulty: 'beginner'
  },
  {
    id: 'barbell-squat',
    name: 'Barbell squat',
    muscles: {
      target: 'quadriceps',
      primary: ['quadriceps femoris'],
      synergists: ['gluteus maximus', 'biceps femoris'],
      stabilizers: ['core', 'erector spinae']
    },
    movement: {
      pattern: 'squat',
      joint_type: 'compound',
      kinetic_chain: 'closed',
      laterality: 'bilateral',
      contraction: 'dynamic',
      arm_position: 'n/a'
    },
    equipment: 'barbell',
    difficulty: 'intermediate'
  },
  {
    id: 'pull-up',
    name: 'Pull-up',
    muscles: {
      target: 'back',
      primary: ['latissimus dorsi'],
      synergists: ['biceps brachii', 'rhomboideus'],
      stabilizers: ['core', 'scapular stabilizers']
    },
    movement: {
      pattern: 'vertical_pull',
      joint_type: 'compound',
      kinetic_chain: 'closed',
      laterality: 'bilateral',
      contraction: 'dynamic',
      arm_position: 'bent'
    },
    equipment: 'bodyweight',
    difficulty: 'intermediate'
  },
  {
    id: 'push-up',
    name: 'Push-up',
    muscles: {
      target: 'chest',
      primary: ['pectoralis major'],
      synergists: ['deltoideus anterior', 'triceps brachii'],
      stabilizers: ['core', 'scapular stabilizers']
    },
    movement: {
      pattern: 'horizontal_push',
      joint_type: 'compound',
      kinetic_chain: 'closed',
      laterality: 'bilateral',
      contraction: 'dynamic',
      arm_position: 'bent'
    },
    equipment: 'bodyweight',
    difficulty: 'beginner'
  },
  {
    id: 'tricep-pushdown',
    name: 'Tricep pushdown',
    muscles: {
      target: 'triceps',
      primary: ['triceps brachii'],
      synergists: [],
      stabilizers: ['core']
    },
    movement: {
      pattern: 'isolation',
      joint_type: 'isolation',
      kinetic_chain: 'open',
      laterality: 'bilateral',
      contraction: 'dynamic',
      arm_position: 'bent'
    },
    equipment: 'machine',
    difficulty: 'beginner'
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian deadlift',
    muscles: {
      target: 'hamstrings',
      primary: ['biceps femoris', 'gluteus maximus'],
      synergists: ['erector spinae'],
      stabilizers: ['core', 'forearm flexors']
    },
    movement: {
      pattern: 'hinge',
      joint_type: 'compound',
      kinetic_chain: 'open',
      laterality: 'bilateral',
      contraction: 'dynamic',
      arm_position: 'straight'
    },
    equipment: 'barbell',
    difficulty: 'intermediate'
  },
  {
    id: 'lateral-raise',
    name: 'Lateral raise',
    muscles: {
      target: 'shoulders',
      primary: ['deltoideus lateralis'],
      synergists: ['trapezius'],
      stabilizers: ['core', 'rotator cuff']
    },
    movement: {
      pattern: 'isolation',
      joint_type: 'isolation',
      kinetic_chain: 'open',
      laterality: 'bilateral',
      contraction: 'dynamic',
      arm_position: 'straight'
    },
    equipment: 'dumbbell',
    difficulty: 'beginner'
  },
  {
    id: 'leg-curl',
    name: 'Leg curl',
    muscles: {
      target: 'hamstrings',
      primary: ['biceps femoris'],
      synergists: ['gastrocnemius'],
      stabilizers: ['core']
    },
    movement: {
      pattern: 'isolation',
      joint_type: 'isolation',
      kinetic_chain: 'open',
      laterality: 'bilateral',
      contraction: 'dynamic',
      arm_position: 'n/a'
    },
    equipment: 'machine',
    difficulty: 'beginner'
  },
  // Additional exercises to ensure coverage for all muscle groups
  {
    id: 'glute-bridge',
    name: 'Glute bridge',
    muscles: {
      target: 'glutes',
      primary: ['gluteus maximus'],
      synergists: ['biceps femoris'],
      stabilizers: ['core']
    },
    movement: {
      pattern: 'hinge',
      joint_type: 'compound',
      kinetic_chain: 'closed',
      laterality: 'bilateral',
      contraction: 'dynamic',
      arm_position: 'n/a'
    },
    equipment: 'bodyweight',
    difficulty: 'beginner'
  },
  {
    id: 'calf-raise',
    name: 'Calf raise',
    muscles: {
      target: 'calves',
      primary: ['gastrocnemius', 'soleus'],
      synergists: [],
      stabilizers: ['core']
    },
    movement: {
      pattern: 'isolation',
      joint_type: 'isolation',
      kinetic_chain: 'closed',
      laterality: 'bilateral',
      contraction: 'dynamic',
      arm_position: 'n/a'
    },
    equipment: 'bodyweight',
    difficulty: 'beginner'
  },
  {
    id: 'plank',
    name: 'Plank',
    muscles: {
      target: 'core',
      primary: ['rectus abdominis', 'transversus abdominis'],
      synergists: ['obliquus externus abdominis'],
      stabilizers: ['erector spinae', 'gluteus maximus']
    },
    movement: {
      pattern: 'isolation',
      joint_type: 'isolation',
      kinetic_chain: 'closed',
      laterality: 'bilateral',
      contraction: 'isometric',
      arm_position: 'bent'
    },
    equipment: 'bodyweight',
    difficulty: 'beginner'
  },
  {
    id: 'overhead-press',
    name: 'Overhead press',
    muscles: {
      target: 'shoulders',
      primary: ['deltoideus anterior'],
      synergists: ['triceps brachii', 'trapezius'],
      stabilizers: ['core', 'scapular stabilizers']
    },
    movement: {
      pattern: 'vertical_push',
      joint_type: 'compound',
      kinetic_chain: 'open',
      laterality: 'bilateral',
      contraction: 'dynamic',
      arm_position: 'bent'
    },
    equipment: 'barbell',
    difficulty: 'intermediate'
  },
  {
    id: 'bodyweight-squat',
    name: 'Bodyweight squat',
    muscles: {
      target: 'quadriceps',
      primary: ['quadriceps femoris'],
      synergists: ['gluteus maximus'],
      stabilizers: ['core']
    },
    movement: {
      pattern: 'squat',
      joint_type: 'compound',
      kinetic_chain: 'closed',
      laterality: 'bilateral',
      contraction: 'dynamic',
      arm_position: 'n/a'
    },
    equipment: 'bodyweight',
    difficulty: 'beginner'
  }
];

// Pre-built maps for testing
export const exercisesById = new Map(
  sampleExercises.map(ex => [ex.id, ex])
);

export const exerciseByName = new Map(
  sampleExercises.map(ex => [ex.name.toLowerCase(), ex])
);

// Exercise database in object format (as loaded from JSON)
export const exercisesDBObject = Object.fromEntries(
  sampleExercises.map(ex => {
    const { id, ...rest } = ex;
    return [id, rest];
  })
);
