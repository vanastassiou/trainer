// =============================================================================
// LEARN MODULE
// =============================================================================
// Handles research articles, glossary, and references display.

import { state } from './state.js';
import { fetchJSON, formatLabel, renderListItems, getAgeFromBirthDate, getVolumeRecommendations, escapeHtml, getCitationAuthor } from './utils.js';
import { createModalController } from './ui.js';
import { getProfile } from './db.js';

// Glossary term index for O(1) lookups
let glossaryIndex = new Map();

// =============================================================================
// DATA LOADING
// =============================================================================

export async function loadArticles() {
  if (state.articlesData?.articles?.length) return state.articlesData;
  const data = await fetchJSON('data/articles.json', { articles: {} });
  // Convert object map to array, adding pmid to each article
  const articlesArray = Object.entries(data.articles || {}).map(([pmid, article]) => ({
    pmid,
    ...article
  }));
  state.articlesData = { ...data, articles: articlesArray };
  return state.articlesData;
}

export async function loadResources() {
  if (state.resourcesData?.resources?.length) return state.resourcesData;
  const data = await fetchJSON('data/resources.json', { resources: {} });
  // Convert object map to array, adding id to each resource
  const resourcesArray = Object.entries(data.resources || {}).map(([id, resource]) => ({
    id,
    ...resource
  }));
  state.resourcesData = { resources: resourcesArray };
  return state.resourcesData;
}

// =============================================================================
// ARTICLE FILTERING
// =============================================================================

function populateTagFilter() {
  const filter = document.getElementById('article-category-filter');
  // Collect all unique tags from articles
  const allTags = new Set();
  state.articlesData?.articles?.forEach(a => {
    a.tags?.forEach(tag => allTags.add(tag));
  });
  const sortedTags = [...allTags].sort();

  filter.innerHTML = '<option value="">All tags</option>' +
    sortedTags.map(tag => `<option value="${tag}">${formatLabel(tag)}</option>`).join('');
}

function filterArticles() {
  if (!state.articlesData) return;

  const tag = document.getElementById('article-category-filter').value;
  let filtered = state.articlesData.articles;

  if (tag) {
    filtered = filtered.filter(a => a.tags?.includes(tag));
  }

  filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
  renderArticles(filtered);
}

// =============================================================================
// ARTICLE RENDERING
// =============================================================================

// Map study types to glossary term keys
const STUDY_TYPE_TERMS = {
  'systematic-review-with-meta-analysis': 'meta-analysis',
  'systematic-review-with-meta-regression': 'meta-analysis',
  'systematic-review': 'systematic-review',
  'umbrella-review': 'umbrella-review',
  'randomized-controlled-trial': 'randomized-controlled-trial',
  'intervention-study': 'intervention-study',
  'prospective-cohort': 'cohort-study',
  'retrospective-cohort': 'cohort-study',
  'cross-sectional': 'cross-sectional-study',
  'narrative-review': 'narrative-review',
  'position-statement': 'position-statement'
};

function renderMethodology(article) {
  const m = article.methodology;
  if (!m) return '';

  const items = [];

  // Evidence level
  if (article.evidenceLevel) {
    items.push(`<dt data-term="evidence-level">Evidence level</dt><dd><span data-term="${article.evidenceLevel}">${article.evidenceLevel}</span></dd>`);
  }

  // Study type
  if (m.studyType) {
    const termKey = STUDY_TYPE_TERMS[m.studyType] || null;
    const label = formatLabel(m.studyType.replace(/-/g, ' '));
    items.push(`<dt data-term="study-design">Design</dt><dd>${termKey ? `<span data-term="${termKey}">${label}</span>` : label}</dd>`);
  }

  // Sample size
  if (m.sampleSize) {
    items.push(`<dt data-term="sample-size">Sample</dt><dd>${m.sampleSize.toLocaleString()} participants</dd>`);
  }

  // Duration
  if (m.duration) {
    items.push(`<dt data-term="study-duration">Duration</dt><dd>${m.duration}</dd>`);
  }

  // Population
  if (m.population) {
    const pop = m.population;
    const parts = [];
    const sentenceCase = s => s.replace(/-/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
    if (pop.sex?.length) parts.push(pop.sex.map(sentenceCase).join(', '));
    if (pop.ageGroup?.length) parts.push(pop.ageGroup.map(sentenceCase).join(', '));
    if (pop.trainingStatus?.length) parts.push(pop.trainingStatus.map(sentenceCase).join(', '));
    if (pop.healthStatus?.length && !pop.healthStatus.every(h => h === 'healthy')) {
      parts.push(pop.healthStatus.map(sentenceCase).join(', '));
    }
    if (parts.length) {
      items.push(`<dt data-term="study-population">Population</dt><dd>${parts.join('; ')}</dd>`);
    }
  }

  // Limitations
  if (m.limitations?.length) {
    const limitationsText = m.limitations
      .map(s => s.toLowerCase().replace(/^\w/, c => c.toUpperCase()))
      .join('; ');
    items.push(`<dt data-term="study-limitations">Limitations</dt><dd>${limitationsText}</dd>`);
  }

  if (items.length === 0) return '';

  return `
    <details class="article-methodology">
      <summary>Methodology</summary>
      <dl>${items.join('')}</dl>
    </details>
  `;
}

function renderArticles(articles) {
  const container = document.getElementById('articles-container');
  const emptyMessage = document.getElementById('no-articles-message');

  if (articles.length === 0) {
    container.innerHTML = '';
    emptyMessage.classList.remove('hidden');
    return;
  }

  emptyMessage.classList.add('hidden');
  container.innerHTML = articles.map(article => `
    <div class="learn-card learn-card--collapsible">
      <div class="learn-card-header">
        <span class="expand-icon">▶</span>
        <div class="learn-card-header-content">
          <div class="learn-card-title">${article.question || article.title}</div>
        </div>
      </div>
      <div class="learn-card-body">
        <h3 class="article-title">
          <a href="${article.pmid && article.pmid !== 'undefined' ? `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/` : article.url}" target="_blank" rel="noopener">${article.title}</a> (${article.year})
        </h3>
        <div class="article-meta">
          ${article.authors.length > 4
            ? article.authors.slice(0, 4).join(', ') + ' et al.'
            : article.authors.join(', ')}
        </div>
        <div class="article-takeaways">
          <div class="article-takeaways-label">TL;DR</div>
          <ul>${renderListItems(article.takeaways)}</ul>
        </div>
        ${renderMethodology(article)}
        ${article.tags?.length ? `<div class="learn-card-tags">${article.tags.map(tag => `<span class="learn-tag">${formatLabel(tag)}</span>`).join('')}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// =============================================================================
// GLOSSARY LIST
// =============================================================================

function populateGlossaryCategoryFilter(categories) {
  const filter = document.getElementById('glossary-category-filter');
  const categoryNames = Object.entries(categories)
    .sort((a, b) => a[1].localeCompare(b[1]));

  filter.innerHTML = '<option value="">All categories</option>' +
    categoryNames.map(([key, label]) => `<option value="${key}">${label}</option>`).join('');
}

function filterGlossary() {
  if (!state.glossaryData) return;

  const category = document.getElementById('glossary-category-filter').value;
  let filtered = state.glossaryData.glossary.terms;

  if (category) {
    filtered = filtered.filter(t => t.category === category);
  }

  filtered = [...filtered].sort((a, b) => a.term.localeCompare(b.term));
  renderGlossaryList(filtered);
}

function renderGlossaryList(terms) {
  const container = document.getElementById('glossary-list');
  const emptyMessage = document.getElementById('no-glossary-message');
  const categories = state.glossaryData?.glossary?.categories || {};

  if (terms.length === 0) {
    container.innerHTML = '';
    emptyMessage.classList.remove('hidden');
    return;
  }

  emptyMessage.classList.add('hidden');
  container.innerHTML = terms.map(term => `
    <div class="learn-card learn-card--collapsible">
      <div class="learn-card-header">
        <span class="expand-icon">▶</span>
        <div class="learn-card-header-content">
          <div class="learn-card-title">${escapeHtml(term.term)}</div>
          <div class="learn-card-meta">${escapeHtml(categories[term.category] || term.category)}</div>
        </div>
      </div>
      <div class="learn-card-body">
        <div class="learn-card-description">${escapeHtml(term.description)}</div>
        ${term.aliases?.length ? `<div class="glossary-aliases">Also: ${escapeHtml(term.aliases.join(', '))}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// =============================================================================
// REFERENCES LIST
// =============================================================================

function populateReferencesTypeFilter(resources) {
  const filter = document.getElementById('references-type-filter');
  const types = [...new Set(resources.map(r => r.type))].filter(Boolean).sort();

  filter.innerHTML = '<option value="">All types</option>' +
    types.map(t => `<option value="${t}">${formatLabel(t)}</option>`).join('');
}

function filterReferences() {
  if (!state.resourcesData) return;

  const type = document.getElementById('references-type-filter').value;
  let filtered = state.resourcesData.resources;

  if (type) {
    filtered = filtered.filter(r => r.type === type);
  }

  filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  renderReferencesList(filtered);
}

function renderReferencesList(resources) {
  const container = document.getElementById('references-list');
  const emptyMessage = document.getElementById('no-references-message');

  if (resources.length === 0) {
    container.innerHTML = '';
    emptyMessage.classList.remove('hidden');
    return;
  }

  emptyMessage.classList.add('hidden');
  container.innerHTML = resources.map(resource => `
    <div class="learn-card">
      <div class="learn-card-title">
        <a href="${resource.url}" target="_blank" rel="noopener">${resource.name}</a>
      </div>
      <div class="learn-card-meta">${resource.organization}</div>
      <div class="learn-card-description">${resource.description}</div>
      <div class="learn-card-tags">
        <span class="learn-tag">${formatLabel(resource.type)}</span>
        ${resource.free_access ? '<span class="learn-tag">Free access</span>' : ''}
      </div>
    </div>
  `).join('');
}

// =============================================================================
// INITIALIZATION
// =============================================================================

export async function initLearnPage() {
  // Articles
  const articlesData = await loadArticles();
  populateTagFilter();
  const sortedArticles = [...articlesData.articles].sort((a, b) => a.title.localeCompare(b.title));
  renderArticles(sortedArticles);
  document.getElementById('article-category-filter').addEventListener('change', filterArticles);

  // Glossary
  const glossaryData = await loadGlossary();
  populateGlossaryCategoryFilter(glossaryData.glossary.categories);
  const sortedTerms = [...glossaryData.glossary.terms].sort((a, b) => a.term.localeCompare(b.term));
  renderGlossaryList(sortedTerms);
  document.getElementById('glossary-category-filter').addEventListener('change', filterGlossary);

  // References
  const resourcesData = await loadResources();
  populateReferencesTypeFilter(resourcesData.resources);
  const sortedResources = [...resourcesData.resources].sort((a, b) => a.name.localeCompare(b.name));
  renderReferencesList(sortedResources);
  document.getElementById('references-type-filter').addEventListener('change', filterReferences);

  const learnTab = document.getElementById('learn');

  // Glossary term links - must be before collapsible handler
  learnTab.addEventListener('click', (e) => {
    const termEl = e.target.closest('[data-term]');
    if (termEl) {
      e.preventDefault();
      e.stopPropagation();
      showGlossaryTerm(termEl.dataset.term);
    }
  });

  // Collapsible cards - delegate click handler
  learnTab.addEventListener('click', (e) => {
    const header = e.target.closest('.learn-card-header');
    if (!header) return;
    // Don't toggle if clicking a link
    if (e.target.closest('a')) return;
    const card = header.closest('.learn-card--collapsible');
    if (card) {
      card.classList.toggle('expanded');
    }
  });
}

// =============================================================================
// GLOSSARY
// =============================================================================

export async function loadGlossary() {
  if (state.glossaryData) return state.glossaryData;
  const data = await fetchJSON('data/glossary.json', { glossary: { terms: {}, categories: {} } });
  // Convert object map to array, adding id to each term
  const termsArray = Object.entries(data.glossary?.terms || {}).map(([id, term]) => ({
    id,
    term: term.name, // Keep 'term' field for backwards compatibility
    ...term
  }));
  state.glossaryData = {
    ...data,
    glossary: {
      ...data.glossary,
      terms: termsArray
    }
  };
  // Build lookup index for O(1) term lookups
  buildGlossaryIndex(state.glossaryData.glossary.terms);
  return state.glossaryData;
}

function buildGlossaryIndex(terms) {
  glossaryIndex = new Map();
  for (const term of terms) {
    glossaryIndex.set(term.term.toLowerCase(), term);
    if (term.aliases) {
      for (const alias of term.aliases) {
        glossaryIndex.set(alias.toLowerCase(), term);
      }
    }
  }
}

export function getGlossaryTerm(name) {
  if (!state.glossaryData) return null;
  return glossaryIndex.get(name.toLowerCase()) || null;
}

export function initGlossaryModal() {
  state.glossaryDialog = createModalController(
    document.getElementById('glossary-modal')
  );

  // Global handler for data-term elements outside the learn tab
  document.body.addEventListener('click', (e) => {
    // Skip if inside learn tab (handled separately)
    if (e.target.closest('#learn')) return;
    const termEl = e.target.closest('[data-term]');
    if (termEl) {
      e.preventDefault();
      showGlossaryTerm(termEl.dataset.term);
    }
  });
}

// Volume-related terms that get personalized recommendations
const VOLUME_TERMS = ['maintenance volume', 'minimum effective volume', 'maximum adaptive volume', 'maximum recoverable volume'];

/**
 * Check if a term is volume-related based on its name or aliases.
 * @param {object} term - Glossary term object
 * @returns {boolean}
 */
function isVolumeTerm(term) {
  const termLower = term.term.toLowerCase();
  if (VOLUME_TERMS.includes(termLower)) return true;
  if (term.aliases) {
    const aliasLower = term.aliases.map(a => a.toLowerCase());
    return ['mv', 'mev', 'mav', 'mrv'].some(alias => aliasLower.includes(alias));
  }
  return false;
}

/**
 * Get personalized volume note based on user's age.
 * @param {object} term - Glossary term object
 * @param {number|null} age - User's age
 * @returns {string} HTML string for personalized note
 */
function getPersonalizedVolumeNote(term, age) {
  if (!isVolumeTerm(term)) return '';

  const recs = getVolumeRecommendations(age);
  const termLower = term.term.toLowerCase();

  if (age == null) {
    return '<p class="glossary-personalized">Add your birth date in Profile for personalized recommendations.</p>';
  }

  let note = '';
  if (termLower === 'maintenance volume' || term.aliases?.includes('MV')) {
    note = `For you: ${recs.maintenance.description} with ${recs.frequency.description}.`;
  } else if (termLower === 'minimum effective volume' || term.aliases?.includes('MEV')) {
    note = `For you: Start mesocycles around ${recs.growth.min} sets per muscle per week.`;
  } else if (termLower === 'maximum adaptive volume' || term.aliases?.includes('MAV')) {
    note = `For you: Progress toward ${recs.growth.max} sets per muscle per week during training blocks.`;
  } else if (termLower === 'maximum recoverable volume' || term.aliases?.includes('MRV')) {
    note = `For you: ${recs.perSession.description}. Distribute volume across ${recs.frequency.description}.`;
  }

  if (recs.ageGroup === 'older-adult') {
    note += ' Research shows adults 60+ benefit from training each muscle 2-3× per week.';
  }

  return note ? `<p class="glossary-personalized">${note}</p>` : '';
}

export async function showGlossaryTerm(termName) {
  const term = getGlossaryTerm(termName);
  if (!term) {
    return;
  }

  const nameEl = document.getElementById('glossary-term-name');
  const contentEl = document.getElementById('glossary-term-content');

  nameEl.textContent = term.term;

  const categoryLabel = state.glossaryData.glossary.categories[term.category] || term.category;
  const hasDetails = term.details || (term.references && term.references.length > 0);

  // Get personalized note for volume terms
  let personalizedNote = '';
  if (isVolumeTerm(term)) {
    const profile = await getProfile();
    const age = getAgeFromBirthDate(profile.birthDate);
    personalizedNote = getPersonalizedVolumeNote(term, age);
  }

  let html = `
    <span class="glossary-category">${categoryLabel}</span>
    <p class="glossary-description">${term.description}</p>
    ${personalizedNote}
  `;

  if (term.aliases && term.aliases.length > 0) {
    html += `
      <p class="glossary-aliases"><strong>Also known as:</strong> ${term.aliases.join(', ')}</p>
    `;
  }

  if (hasDetails) {
    html += `
      <button type="button" class="glossary-details-toggle" aria-expanded="false">
        <span class="expand-icon">▶</span>
        More details
      </button>
      <div class="glossary-details">
    `;

    if (term.details) {
      html += `<p class="glossary-details-text">${term.details}</p>`;
    }

    if (term.references && term.references.length > 0) {
      const refHtml = term.references.map(ref => {
        // PMID reference - look up article from articles.json
        if (ref.pmid) {
          const article = state.articlesData?.articles?.find(a => a.pmid === ref.pmid);
          if (article) {
            const author = getCitationAuthor(article.authors);
            const url = article.doi ? `https://doi.org/${article.doi}` : `https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/`;
            return `<li><a href="${url}" target="_blank" rel="noopener">${author} (${article.year}). ${article.title}</a></li>`;
          }
          // Fallback if article not found in database
          const url = `https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/`;
          return `<li><a href="${url}" target="_blank" rel="noopener">PMID: ${ref.pmid}</a></li>`;
        }
        // Non-indexed article (preprints, etc.)
        if (ref.author && ref.year && ref.url) {
          return `<li><a href="${ref.url}" target="_blank" rel="noopener">${ref.author} (${ref.year}). ${ref.title}</a></li>`;
        }
        // External source reference
        if (ref.source && ref.url) {
          return `<li><a href="${ref.url}" target="_blank" rel="noopener">${ref.source}</a></li>`;
        }
        return '';
      }).filter(Boolean).join('');

      html += `
        <div class="glossary-references">
          <h5>References</h5>
          <ul>${refHtml}</ul>
        </div>
      `;
    }

    html += `</div>`;
  }

  contentEl.innerHTML = html;

  // Set up toggle handler
  const toggle = contentEl.querySelector('.glossary-details-toggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const details = contentEl.querySelector('.glossary-details');
      const isExpanded = toggle.classList.toggle('expanded');
      details.classList.toggle('expanded', isExpanded);
      toggle.setAttribute('aria-expanded', isExpanded);
    });
  }

  state.glossaryDialog.open();
}
