// Sample journal entries for testing
export const sampleJournals = [
  {
    date: '2025-06-15',
    lastModified: '2025-06-15T18:00:00Z',
    body: {
      bodyFat: 15.5,
      circumferences: { waist: 80, chest: 100 }
    },
    daily: {
      weight: 75,
      restingHR: 60,
      calories: 2200,
      protein: 150,
      fibre: 30,
      water: 2.5,
      steps: 8000,
      sleep: 7.5,
      recovery: 8
    },
    workout: {
      programId: 'prog1',
      dayNumber: 1,
      exercises: [
        {
          id: 'bench-press',
          name: 'Bench press',
          sets: [
            { reps: 8, weight: 80, rir: 2 },
            { reps: 8, weight: 80, rir: 1 }
          ]
        }
      ]
    },
    notes: 'Good session'
  },
  {
    date: '2025-06-14',
    lastModified: '2025-06-14T17:00:00Z',
    body: null,
    daily: {
      weight: 74.8,
      calories: 2100,
      protein: 145,
      sleep: 8,
      steps: 10000
    },
    workout: null,
    notes: null
  },
  {
    date: '2025-06-13',
    lastModified: '2025-06-13T19:00:00Z',
    body: null,
    daily: {
      weight: 75.2,
      calories: 2300,
      protein: 160,
      sleep: 6.5
    },
    workout: {
      programId: 'prog1',
      dayNumber: 2,
      exercises: [
        {
          id: 'barbell-squat',
          name: 'Barbell squat',
          sets: [{ reps: 5, weight: 100, rir: 2 }]
        }
      ]
    },
    notes: null
  },
  {
    date: '2025-06-12',
    lastModified: '2025-06-12T20:00:00Z',
    body: null,
    daily: {
      weight: 75,
      calories: 2000
    },
    workout: null,
    notes: 'Rest day'
  },
  {
    date: '2025-06-11',
    lastModified: '2025-06-11T18:30:00Z',
    body: { bodyFat: 15.3 },
    daily: {
      weight: 74.5,
      restingHR: 58,
      calories: 2150,
      protein: 155,
      fibre: 28,
      water: 3,
      steps: 12000,
      sleep: 8,
      recovery: 9
    },
    workout: {
      programId: 'prog1',
      dayNumber: 1,
      exercises: [
        {
          id: 'bench-press',
          name: 'Bench press',
          sets: [
            { reps: 8, weight: 77.5, rir: 2 },
            { reps: 7, weight: 77.5, rir: 1 }
          ]
        }
      ]
    },
    notes: null
  }
];

// Journal with all daily fields filled (for completion tests)
export const completeJournal = {
  date: '2025-06-15',
  lastModified: '2025-06-15T18:00:00Z',
  body: { bodyFat: 15 },
  daily: {
    weight: 75,
    restingHR: 60,
    calories: 2200,
    protein: 150,
    fibre: 30,
    water: 2.5,
    steps: 8000,
    sleep: 7.5,
    recovery: 8
  },
  workout: null,
  notes: null
};

// Journal with partial daily fields (for completion tests)
export const partialJournal = {
  date: '2025-06-14',
  lastModified: '2025-06-14T17:00:00Z',
  body: null,
  daily: {
    weight: 74.8,
    calories: 2100,
    protein: 145
  },
  workout: null,
  notes: null
};

// Empty journal (for completion tests)
export const emptyJournal = {
  date: '2025-06-13',
  lastModified: '2025-06-13T10:00:00Z',
  body: null,
  daily: {},
  workout: null,
  notes: null
};

// Journal with legacy weight in body (migration test)
export const legacyJournal = {
  date: '2025-01-01',
  lastModified: '2025-01-01T10:00:00Z',
  body: { weight: 70, bodyFat: 18 },
  daily: { calories: 2000 },
  workout: null,
  notes: null
};
