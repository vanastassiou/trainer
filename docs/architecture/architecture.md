# Architecture

Health Tracker is a mobile-first PWA for logging workouts, body measurements,
and reading fitness research. It runs entirely client-side with no build step.

## Directory structure

```
/home/v/repos/trainer/
├── index.html              # Single-page application shell
├── styles.css              # All application styles
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker for offline support
├── js/
│   ├── app.js              # Thin orchestrator, initialization
│   ├── state.js            # Centralized state management
│   ├── db.js               # Database operations (native IndexedDB)
│   ├── workout.js          # Workout logging, exercise cards
│   ├── programs.js         # Program CRUD, template management
│   ├── goals.js            # Goal tracking, profile page
│   ├── measurements.js     # Body/daily metrics, field configs
│   ├── learn.js            # Research articles display
│   ├── utils.js            # Generic utilities (fetchJSON, DOM helpers)
│   ├── ui.js               # UI patterns (tabs, modals, toasts)
│   ├── filters.js          # Exercise filtering logic
│   ├── validation.js       # Form validation functions
│   └── charts.js           # Chart rendering functions
├── data/
│   ├── exercises.json      # Exercise definitions (reference data)
│   ├── articles.json       # Research article summaries (reference data)
│   ├── glossary.json       # Term definitions (reference data)
│   ├── sources.json        # External source references (reference data)
│   └── schemas/            # JSON Schema definitions
│       ├── journal.schema.json
│       ├── program.schema.json
│       ├── goal.schema.json
│       ├── exercises.schema.json
│       ├── articles.schema.json
│       ├── glossary.schema.json
│       └── source.schema.json
└── docs/
    └── architecture.md     # This file
```

## Data architecture

Data is organized into three categories:

| Category | Description | Storage | Mutability |
| -------- | ----------- | ------- | ---------- |
| Journal | User's daily log entries | IndexedDB | Read/write |
| Reference | App-provided content | Static JSON | Read-only |
| UserConfig | User templates and settings | IndexedDB | Read/write |

### Journal entries

Daily log entries keyed by date (YYYY-MM-DD). Each entry contains:

```javascript
{
  date: "2025-12-25",
  lastModified: "2025-12-25T10:30:00Z",

  body: {                           // Body measurements
    weight: 75.5,                   // kg
    bodyFat: 18.2,                  // %
    restingHR: 62,                  // bpm
    circumferences: {               // All in cm
      neck, chest, waist, hips,
      leftBiceps, rightBiceps,
      leftQuadriceps, rightQuadriceps,
      leftCalf, rightCalf
    }
  },

  daily: {                          // Daily vitals/habits
    calories: 2500,                 // kcal
    protein: 180,                   // g
    fibre: 35,                      // g
    water: 3.5,                     // L
    steps: 8500,
    sleep: 7.5,                     // hrs
    recovery: 7                     // 1-10
  },

  workout: {
    programId: "abc123",            // Reference to program
    dayNumber: 3,
    exercises: [{
      exerciseId: "bench-press",    // Reference to exercise definition
      sets: [{ reps: 8, weight: 100, rir: 2 }]
    }]
  },

  notes: "Free-form text"
}
```

### Reference data

Static JSON files loaded at runtime. Not user-modifiable.

- **exercises.json**: Exercise definitions with instructions, muscle groups,
  equipment requirements. Keyed by `id` (slug format).
- **articles.json**: Research article summaries with takeaways and methodology.
- **glossary.json**: Fitness term definitions organized by category.
- **sources.json**: External authoritative sources (government, academic,
  nonprofit).

### User configuration

User-editable templates stored in IndexedDB.

**Programs** (workout templates):

```javascript
{
  id: "abc123",
  name: "Push Pull Legs",
  days: [{
    name: "Push",                   // Optional day label
    exercises: ["bench-press", "ohp", "tricep-dips"]  // Exercise IDs
  }],
  createdAt: "2025-12-01T00:00:00Z"
}
```

**Goals** (fitness targets):

```javascript
{
  id: "goal123",
  type: "body",                     // body | habit
  metric: "weight",
  target: 70,
  unit: "kg",
  direction: "decrease",            // increase | decrease | maintain
  deadline: "2025-06-01",
  createdAt: "2025-01-01T00:00:00Z",
  completedAt: null
}
```

## Database schema

IndexedDB database `HealthTracker` with four tables:

| Table | Key | Indexes | Purpose |
| ----- | --- | ------- | ------- |
| journals | date | - | Daily log entries |
| programs | id | name | Workout templates |
| goals | id | type, metric, completedAt | Fitness targets |
| profile | id | - | User profile (singleton) |

## Module architecture

```
index.html
    └── js/app.js (orchestrator)
            ├── js/state.js         (centralized state)
            ├── js/db.js            (database operations)
            ├── js/workout.js       (workout forms, exercise cards)
            ├── js/programs.js      (program CRUD UI)
            ├── js/goals.js         (goal tracking, profile)
            ├── js/measurements.js  (body/daily forms)
            ├── js/learn.js         (research articles)
            ├── js/utils.js         (fetchJSON, formatters)
            ├── js/ui.js            (tabs, modals, toasts)
            ├── js/filters.js       (exercise filtering)
            ├── js/validation.js    (form validation)
            └── js/charts.js        (chart rendering)
```

### Module responsibilities

**app.js** - Application orchestrator (~480 lines):
- Module initialization and coordination
- Date navigation logic
- Data loading per date
- Chart initialization
- Export/import handlers

**state.js** - Centralized state:
- All global state with getter/setter access
- Modal controller references
- Cache stores (exercises, articles, journal dates)
- Selected date tracking
- `exerciseByName` Map for O(1) exercise lookups (built on load)

**db.js** - Database operations:
- Native IndexedDB initialization
- CRUD operations with standardized error handling via `handleError()`
- Transaction support for imports
- `getAllGoalsPartitioned()` for efficient active/completed goal fetching
- Designed for future sync service extensibility

```javascript
// Future extensibility: could wrap external sync services
export async function getJournalForDate(date) {
  // Currently: IndexedDB via Dexie
  // Future: Could check sync service, merge conflicts
  return db.journals.get(date);
}
```

**workout.js** - Workout logging:
- Exercise card rendering with set management
- Exercise picker modal with filtering
- Exercise info modal
- Template loading from programs

**programs.js** - Program management:
- Program list rendering with event delegation
- Program editor modal
- Day builder UI
- Program selector population
- Program generation with volume-based exercise selection (see `volume-guidelines.md`)

**goals.js** - Goal tracking:
- Goal creation form
- Progress calculation
- Active/completed goal lists
- Profile form management
- Statistics rendering

**measurements.js** - Body/daily tracking:
- Field configuration exports (BODY_FIELDS, DAILY_FIELDS, etc.)
- Form row generation
- Previous measurements display
- Data loading/saving utilities

**learn.js** - Research articles:
- Article rendering
- Category filtering
- Lazy loading on modal open
- `glossaryIndex` Map for O(1) term lookups (built on load)

**utils.js** - Generic utilities:
- `fetchJSON(url)` - Fetch and parse JSON
- `getTodayDate()` - Current date in YYYY-MM-DD
- `formatLabel(str)` - Format snake_case to Title Case
- `renderListItems(items)` - Generate list HTML
- `swapVisibility(showEl, hideEl)` - Toggle element visibility
- `escapeHtml(str)` - Escape HTML special characters for XSS prevention
- `handleError(err, context, fallback)` - Standardized error logging

**ui.js** - UI patterns:
- `createTabController()` - Tab navigation with localStorage persistence
- `createModalController()` - Dialog lifecycle management
- `showToast(message)` - Toast notifications
- `showConfirmDialog()` - Confirmation dialogs

**filters.js** - Exercise database queries:
- `filterExercises(exercises, criteria)` - Multi-field filtering
- `getUniqueValues(exercises, field)` - Extract filter options
- `getExerciseFilterValues()` - Current filter state

**validation.js** - Business rules:
- `validateProgram(name, days)` - Program structure validation (3-6 exercises/day)
- `validateProgramExercises(program, index)` - Referential integrity check
- `hasUnsavedWorkoutData(container)` - Dirty form detection
- `collectWorkoutData(container)` - Extract workout from form
- `collectProgramDays(container)` - Extract program days from form

**charts.js** - Data visualization:
- `getChartData(db, metric, source, days)` - Query data for charts
- `renderLineChart(canvas, data)` - Line chart rendering
- `renderBarChart(canvas, data)` - Bar chart rendering
- `getChartSummary(data)` - Min/max/average statistics

## UI structure

### Main tabs

| Tab | Sub-tabs | Purpose |
| --- | -------- | ------- |
| Metrics | Daily, Measurements | Track body and daily metrics |
| Exercise | Workouts, Programs | Log workouts, manage programs |
| Profile | - | User profile, stats, goals |

### Date navigation

Both Metrics and Exercise tabs share synchronized date navigation:
- Previous/next day buttons
- Calendar modal for date selection
- Journal entries loaded per-date

### Modal dialogs

Native `<dialog>` elements with `showModal()`/`close()` API:
- exercise-info-modal: Exercise instructions and tips
- edit-program-modal: Program CRUD operations
- workout-switch-dialog: Unsaved changes confirmation
- exercise-picker-modal: Exercise search and filter
- calendar-modal: Date selection
- research-modal: Research articles browser

## Data flow

### Loading data

```
Page load
  → loadExercisesDB()        # Fetch reference data
  → loadDataForDate(today)   # Load today's journal
  → populateProgramSelector() # Load user programs
  → refreshAllCharts()       # Render 30-day charts
```

### Saving data

```
Form submit
  → collectData()            # Extract form values
  → validate()               # Business rule checks
  → getJournalForDate()      # Get or create entry
  → journal.section = data   # Update section
  → saveJournalForDate()     # Persist to IndexedDB
  → updateChart()            # Refresh visualization
  → showToast('Saved')       # User feedback
```

### Export/import

Export format (version 2):

```javascript
{
  version: 2,
  exportedAt: "2025-12-25T00:00:00Z",
  journals: [...],
  programs: [...],
  goals: [...],
  profile: {...}
}
```

## Offline support

Service worker (`sw.js`) implements cache-first strategy:

1. On install: Cache all static assets
2. On fetch: Return cached response or fetch from network
3. On activate: Delete old cache versions

Cached assets include:
- HTML, CSS, JavaScript modules
- Static JSON data files
- PWA manifest and icons

IndexedDB operations work fully offline. Data syncs to cache on save.

## Load optimization

ES modules create a waterfall loading pattern where each module waits for its
imports. With high-latency connections, this stacks up significantly.

### Module preloading

All JS modules are preloaded in `index.html` to fetch in parallel:

```html
<link rel="modulepreload" href="js/app.js">
<link rel="modulepreload" href="js/state.js">
<!-- ... all modules -->
```

This breaks the waterfall by telling the browser to fetch all modules upfront
instead of discovering them one-by-one through import chains.

### Parallel data loading

Data fetches run concurrently where safe in `app.js`:

```javascript
// Exercises must load before picker init (picker reads state.exercisesDB)
await loadExercisesDB();
initExercisePicker();

// Glossary and profile can load in parallel (no UI depends on them yet)
await Promise.all([
  loadGlossary(),
  initProfile()
]);
initGlossaryModal();  // safe now - glossary data ready
```

**Constraint:** UI components that read data on init must wait for that data.
The exercise picker and glossary modal access `state.exercisesDB` and
`state.glossary` when opened, so their init must follow the respective loads.

### Non-blocking initialization

Operations that don't block rendering run without `await`:

```javascript
requestPersistentStorage();  // Storage API, no UI impact
registerServiceWorker();     // Background registration
```

### Load sequence

1. HTML parsed, modulepreload hints trigger parallel JS fetches
2. CSS blocks render (required for correct layout)
3. DOMContentLoaded fires, sync UI initialization runs
4. Exercises load, then exercise picker/info modal init
5. Glossary and profile load in parallel, then glossary modal init
6. Today's journal loads, charts render

## Design decisions

### No build step

Native ES modules served directly. Benefits:
- Rapid iteration without compilation
- 95%+ browser support for ES modules
- Simple deployment (static file hosting)

### Client-only architecture

All data stored locally in IndexedDB. Benefits:
- Complete user privacy
- Works offline
- No server infrastructure

Future consideration: The db.js module is designed with an async API that could
wrap external sync services (Google Health, Fitbit) without changing consumers.

### Dexie vs native IndexedDB

The app uses native IndexedDB directly (previously used Dexie.js). This trade-off
was evaluated:

**Former Dexie usage** (now implemented natively in `js/db.js`):
- CRUD: `get`, `add`, `put`, `update`, `delete`
- Queries: `where().below()`, `where().between()`, `filter()`
- Transactions: `db.transaction('rw', ...)`
- Bulk operations: `bulkAdd`, `clear`

Note: Schema migrations were removed as unnecessary for a development project.
Clear IndexedDB in browser dev tools if schema changes.

**Arguments for keeping Dexie:**

| Benefit               | Detail                                           |
| --------------------- | ------------------------------------------------ |
| Concise API           | `db.journals.get(date)` vs 10+ lines native IDB  |
| Schema migrations     | Version upgrades handled declaratively           |
| Promise-based         | Native IDB is callback/event-based               |
| Query builder         | `where().between()` vs manual cursor iteration   |
| Transaction ergonomics| Automatic scope management                       |
| Error handling        | Consistent promise rejections                    |

**Arguments for removing Dexie:**

| Benefit            | Detail                                              |
| ------------------ | --------------------------------------------------- |
| Zero dependencies  | No third-party code to load, audit, or update       |
| Smaller payload    | Removes 96KB from initial load                      |
| No version drift   | Native API is stable, no breaking changes           |
| Full control       | Direct access to IDB features and behavior          |
| Learning value     | Understanding the underlying platform               |

**Rough effort to remove:**

The `db.js` module (~600 lines) would need rewriting. Key changes:
- Manual `IDBDatabase.createObjectStore()` for schema
- Wrap all operations in `new Promise()` with `onsuccess`/`onerror`
- Replace `where()` queries with cursor iteration
- Manual transaction scoping

**Decision:** Native IndexedDB was chosen to eliminate external dependencies.
The migration was straightforward since all database access is centralized in
`db.js`.

### Native dialog elements

`<dialog>` instead of custom modals. Benefits:
- Built-in accessibility (focus trap, escape key)
- Native backdrop handling
- Reduced JavaScript

### Exercise IDs vs names

Exercises referenced by ID (slug format) not display name. Benefits:
- Robust to exercise renames
- Consistent foreign key pattern
- Enables exercise lookup by ID

### Event delegation

Dynamic lists use container-level event delegation:

```javascript
container.addEventListener('click', (e) => {
  const editBtn = e.target.closest('.edit-btn');
  if (editBtn) {
    const card = editBtn.closest('.program-card');
    // handle edit
  }
});
```

Benefits:
- Single listener per container vs per-element
- Automatically handles dynamically added items
- Better memory usage

### Exercise count per session

Programs require 3-6 exercises per training day. See `docs/volume-guidelines.md`
for the research basis and generation algorithm.

## Design patterns

### Centralized state

All global state accessed through `js/state.js` module:

```javascript
import { state } from './state.js';

// Read state
const date = state.selectedDate;
const exercises = state.exercisesDB;

// Write state
state.selectedDate = '2025-12-25';
state.exercisesDB = loadedExercises;
```

Benefits:
- Single source of truth
- Easy to trace state changes
- Enables future debugging tools

### Tab controller pattern

`createTabController()` handles all tab navigation:

```javascript
createTabController('.tabs > .tab', 'main > section.page', {
  storageKey: 'activeTab',
  tabAttr: 'data-tab',
  onActivate: (tabId) => { /* optional callback */ }
});
```

### Modal controller pattern

`createModalController()` wraps native dialog API:

```javascript
const modal = createModalController(document.getElementById('my-modal'));
modal.open();   // Shows modal
modal.close();  // Hides modal
```

### Direction configuration

`DIRECTION_CONFIG` centralizes goal direction symbols and labels:

```javascript
const DIRECTION_CONFIG = {
  decrease: { symbol: '↓', label: 'Decrease to' },
  increase: { symbol: '↑', label: 'Increase to' },
  maintain: { symbol: '↔', label: 'Maintain at' }
};
```

### Performance patterns

**Lookup indexes:** Frequently accessed collections build Map indexes on load for
O(1) lookups instead of O(n) array searches:

```javascript
// state.js - exercise index built when exercisesDB is set
set exercisesDB(v) {
  _exercisesDB = v;
  _exerciseByName = new Map(v.map(ex => [ex.name.toLowerCase(), ex]));
}

// learn.js - glossary index built on load
glossaryIndex.set(term.term.toLowerCase(), term);
term.aliases?.forEach(alias => glossaryIndex.set(alias.toLowerCase(), term));
```

**Data caching:** Functions accept optional pre-fetched data to avoid redundant
database calls:

```javascript
// charts.js - journals passed through to avoid 3 separate fetches
async function refreshAllCharts() {
  const journals = await getRecentJournals(true);
  await Promise.all([
    updateDailyChart(journals),
    updateMeasurementsChart(journals),
    updateWorkoutsChart(journals)
  ]);
}
```

**Partitioned queries:** When multiple filtered views of the same data are
needed, fetch once and partition:

```javascript
// db.js - single fetch for active and completed goals
export async function getAllGoalsPartitioned() {
  const goals = await getAllFromStore('goals');
  return {
    active: goals.filter(g => !g.completedAt),
    completed: goals.filter(g => !!g.completedAt)
  };
}
```

### Data integrity

**Referential integrity checks:** Programs reference exercises by name. The
`validateProgramExercises()` function warns about stale references when the
exercise database changes:

```javascript
// Called when programs are loaded
programs.forEach(p => validateProgramExercises(p, state.exerciseByName));
// Logs: 'Program "X" has invalid exercise references: ["deleted-exercise"]'
```

**Version metadata:** Static JSON files include version info for cache
validation:

```json
{
  "version": 1,
  "lastUpdated": "2025-01-01",
  "exercises": [...]
}
```

## CSS architecture

CSS is organized into cascade layers for explicit specificity management:

```css
@layer reset, tokens, base, components, utilities, overrides;
```

See `docs/architecture/css-style.md` for the full style guide.

### Base classes

| Class | Purpose |
| ----- | ------- |
| `.card` | Container with surface background, border, padding |
| `.card--compact` | Reduced padding variant |
| `.card--inset` | Background color variant |
| `.data-row` | Flex row for form inputs with label/input/unit |
| `.row` | Generic flex container with centered items |
| `.hidden` | Display none with !important |

### Card pattern

Elements needing card styling add `.card` class in HTML:

```html
<div class="previous-measurements card card--compact">
  <!-- content -->
</div>
```

Component-specific overrides apply additional styling:

```css
.exercise-card { box-shadow: var(--shadow); }
```

### Data row pattern

Form rows use `.data-row` base class:

```html
<div class="measurement-row data-row">
  <label>Weight</label>
  <input type="number">
  <span class="unit">kg</span>
</div>
```

### Modifier conventions

- Gap modifiers: `.row--gap-sm`, `.row--gap-md`, `.row--gap-lg`
- Card modifiers: `.card--compact`, `.card--inset`, `.card--active`

All spacing, colors, and transitions use CSS custom properties defined in
`:root` within `@layer tokens`.

## Responsive design

### Minimum supported width

The app targets a minimum viewport width of **320px** (iPhone SE 1st gen,
iPhone 5). This is the narrowest device that can run a modern mobile browser.

| Width | Device examples |
| ----- | --------------- |
| 320px | iPhone SE (1st), iPhone 5 (historical minimum) |
| 360px | Most Android devices, modern practical minimum |
| 375px | iPhone 6/7/8, iPhone SE (2nd) |
| 390px | iPhone 12/13/14 |

Design guidelines:
- All UI elements must be usable at 320px
- Prefer vertical stacking over horizontal layouts at narrow widths
- Exercise cards use flexible column widths (Reps, Weight, RIR)
- Touch targets should be minimum 44x44px per Apple HIG
