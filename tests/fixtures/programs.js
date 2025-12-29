// Sample program data for testing
export const samplePrograms = [
  {
    id: 'prog1',
    name: 'Push Pull Legs',
    days: [
      { name: 'Push', exercises: ['bench-press', 'lateral-raise', 'tricep-pushdown'] },
      { name: 'Pull', exercises: ['barbell-row', 'pull-up', 'bicep-curl'] },
      { name: 'Legs', exercises: ['barbell-squat', 'romanian-deadlift', 'leg-curl'] }
    ],
    createdAt: '2025-01-01T00:00:00Z'
  },
  {
    id: 'prog2',
    name: 'Full Body',
    days: [
      { name: 'Day A', exercises: ['bench-press', 'barbell-row', 'barbell-squat'] },
      { name: 'Day B', exercises: ['pull-up', 'push-up', 'romanian-deadlift'] }
    ],
    createdAt: '2025-01-15T00:00:00Z'
  },
  {
    id: 'prog3',
    name: 'Upper Lower',
    days: [
      { name: 'Upper', exercises: ['bench-press', 'barbell-row', 'lateral-raise', 'bicep-curl'] },
      { name: 'Lower', exercises: ['barbell-squat', 'romanian-deadlift', 'leg-curl'] }
    ],
    createdAt: '2025-02-01T00:00:00Z'
  }
];

// Program with invalid exercise references (for validation tests)
export const invalidProgram = {
  id: 'invalid',
  name: 'Invalid References',
  days: [
    { name: 'Day 1', exercises: ['nonexistent-exercise', 'bench-press', 'another-fake'] }
  ],
  createdAt: '2025-03-01T00:00:00Z'
};

// Program with too few exercises (for validation tests)
export const tooFewExercisesProgram = {
  id: 'toofew',
  name: 'Too Few',
  days: [
    { name: 'Day 1', exercises: ['bench-press', 'barbell-row'] }
  ],
  createdAt: '2025-03-01T00:00:00Z'
};

// Program with too many exercises (for validation tests)
export const tooManyExercisesProgram = {
  id: 'toomany',
  name: 'Too Many',
  days: [
    {
      name: 'Day 1',
      exercises: [
        'bench-press', 'barbell-row', 'barbell-squat',
        'pull-up', 'push-up', 'bicep-curl', 'tricep-pushdown'
      ]
    }
  ],
  createdAt: '2025-03-01T00:00:00Z'
};
