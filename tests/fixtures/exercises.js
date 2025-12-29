// Sample exercise data for testing
export const sampleExercises = [
  {
    id: 'barbell-row',
    name: 'Barbell row',
    muscle_group: 'back',
    movement_pattern: 'pull',
    direction: 'horizontal',
    equipment: 'barbell',
    difficulty: 'intermediate',
    joint_type: 'compound',
    kinetic_chain: 'open',
    laterality: 'bilateral',
    role: 'basic',
    primary_muscles: ['latissimus dorsi', 'trapezius', 'rhomboideus'],
    secondary_muscles: ['biceps brachii', 'deltoideus posterior']
  },
  {
    id: 'bench-press',
    name: 'Bench press',
    muscle_group: 'chest',
    movement_pattern: 'push',
    direction: 'horizontal',
    equipment: 'barbell',
    difficulty: 'intermediate',
    joint_type: 'compound',
    kinetic_chain: 'open',
    laterality: 'bilateral',
    role: 'basic',
    primary_muscles: ['pectoralis major'],
    secondary_muscles: ['deltoideus anterior', 'triceps brachii']
  },
  {
    id: 'bicep-curl',
    name: 'Bicep curl',
    muscle_group: 'biceps',
    movement_pattern: 'pull',
    equipment: 'dumbbell',
    difficulty: 'beginner',
    joint_type: 'isolation',
    kinetic_chain: 'open',
    laterality: 'bilateral',
    role: 'auxiliary',
    primary_muscles: ['biceps brachii'],
    secondary_muscles: ['brachialis']
  },
  {
    id: 'barbell-squat',
    name: 'Barbell squat',
    muscle_group: 'quadriceps',
    movement_pattern: 'squat',
    equipment: 'barbell',
    difficulty: 'intermediate',
    joint_type: 'compound',
    kinetic_chain: 'closed',
    laterality: 'bilateral',
    role: 'basic',
    primary_muscles: ['quadriceps'],
    secondary_muscles: ['gluteus maximus', 'hamstrings']
  },
  {
    id: 'pull-up',
    name: 'Pull-up',
    muscle_group: 'back',
    movement_pattern: 'pull',
    direction: 'vertical',
    equipment: 'bodyweight',
    difficulty: 'intermediate',
    joint_type: 'compound',
    kinetic_chain: 'closed',
    laterality: 'bilateral',
    role: 'basic',
    primary_muscles: ['latissimus dorsi'],
    secondary_muscles: ['biceps brachii', 'rhomboideus']
  },
  {
    id: 'push-up',
    name: 'Push-up',
    muscle_group: 'chest',
    movement_pattern: 'push',
    direction: 'horizontal',
    equipment: 'bodyweight',
    difficulty: 'beginner',
    joint_type: 'compound',
    kinetic_chain: 'closed',
    laterality: 'bilateral',
    role: 'basic',
    primary_muscles: ['pectoralis major'],
    secondary_muscles: ['deltoideus anterior', 'triceps brachii']
  },
  {
    id: 'tricep-pushdown',
    name: 'Tricep pushdown',
    muscle_group: 'triceps',
    movement_pattern: 'push',
    equipment: 'machine',
    difficulty: 'beginner',
    joint_type: 'isolation',
    kinetic_chain: 'open',
    laterality: 'bilateral',
    role: 'auxiliary',
    primary_muscles: ['triceps brachii'],
    secondary_muscles: []
  },
  {
    id: 'romanian-deadlift',
    name: 'Romanian deadlift',
    muscle_group: 'hamstrings',
    movement_pattern: 'hinge',
    equipment: 'barbell',
    difficulty: 'intermediate',
    joint_type: 'compound',
    kinetic_chain: 'open',
    laterality: 'bilateral',
    role: 'basic',
    primary_muscles: ['hamstrings', 'gluteus maximus'],
    secondary_muscles: ['erector spinae']
  },
  {
    id: 'lateral-raise',
    name: 'Lateral raise',
    muscle_group: 'shoulders',
    movement_pattern: 'push',
    equipment: 'dumbbell',
    difficulty: 'beginner',
    joint_type: 'isolation',
    kinetic_chain: 'open',
    laterality: 'bilateral',
    role: 'auxiliary',
    primary_muscles: ['deltoideus lateral'],
    secondary_muscles: ['trapezius']
  },
  {
    id: 'leg-curl',
    name: 'Leg curl',
    muscle_group: 'hamstrings',
    movement_pattern: 'pull',
    equipment: 'machine',
    difficulty: 'beginner',
    joint_type: 'isolation',
    kinetic_chain: 'open',
    laterality: 'bilateral',
    role: 'auxiliary',
    primary_muscles: ['hamstrings'],
    secondary_muscles: ['gastrocnemius']
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
