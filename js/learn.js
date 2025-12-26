// =============================================================================
// LEARN MODULE
// =============================================================================
// Handles research articles display and filtering.

import { state } from './state.js';
import { fetchJSON, formatLabel, renderListItems, getAgeFromBirthDate, getVolumeRecommendations } from './utils.js';
import { createModalController } from './ui.js';
import { getProfile } from './db.js';

// =============================================================================
// DATA LOADING
// =============================================================================

export async function loadArticles() {
  if (state.articlesData?.articles?.length) return state.articlesData;
  state.articlesData = await fetchJSON('data/articles.json', { articles: [] });
  return state.articlesData;
}

// =============================================================================
// RESEARCH MODAL
// =============================================================================

export function initResearchButton() {
  state.researchDialog = createModalController(
    document.getElementById('research-modal')
  );

  document.getElementById('research-btn').addEventListener('click', async () => {
    state.researchDialog.open();
    // Lazy load articles on first open
    if (!state.articlesData) {
      await initLearnPage();
    }
  });
}

// =============================================================================
// ARTICLE FILTERING
// =============================================================================

function populateCategoryFilter(articles) {
  const filter = document.getElementById('article-category-filter');
  const categories = [...new Set(articles.map(a => a.category))].filter(Boolean).sort();

  filter.innerHTML = '<option value="">All categories</option>' +
    categories.map(c => `<option value="${c}">${formatLabel(c)}</option>`).join('');
}

function filterArticles() {
  if (!state.articlesData) return;

  const category = document.getElementById('article-category-filter').value;
  let filtered = state.articlesData.articles;

  if (category) {
    filtered = filtered.filter(a => a.category === category);
  }

  renderArticles(filtered);
}

// =============================================================================
// ARTICLE RENDERING
// =============================================================================

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
    <div class="article-card card">
      <h3 class="article-title">
        ${article.doi || article.url
          ? `<a href="${article.doi ? `https://doi.org/${article.doi}` : article.url}" target="_blank" rel="noopener">${article.title}</a>`
          : article.title}
      </h3>
      <div class="article-meta">
        ${article.authors.join(', ')} · ${article.journal} (${article.year})
      </div>
      ${article.question ? `<p class="article-summary">${article.question}</p>` : ''}
      <div class="article-takeaways">
        <div class="article-takeaways-label">Key takeaways</div>
        <ul>${renderListItems(article.takeaways)}</ul>
      </div>
      ${article.category ? `<span class="article-category">${formatLabel(article.category)}</span>` : ''}
    </div>
  `).join('');
}

// =============================================================================
// INITIALIZATION
// =============================================================================

export async function initLearnPage() {
  const data = await loadArticles();
  populateCategoryFilter(data.articles);
  renderArticles(data.articles);

  document.getElementById('article-category-filter').addEventListener('change', filterArticles);
}

// =============================================================================
// GLOSSARY
// =============================================================================

export async function loadGlossary() {
  if (state.glossaryData) return state.glossaryData;
  state.glossaryData = await fetchJSON('data/glossary.json', { glossary: { terms: [], categories: {} } });
  return state.glossaryData;
}

export function getGlossaryTerm(name) {
  if (!state.glossaryData) return null;

  const searchName = name.toLowerCase();
  return state.glossaryData.glossary.terms.find(term =>
    term.term.toLowerCase() === searchName ||
    (term.aliases && term.aliases.some(alias => alias.toLowerCase() === searchName))
  );
}

export function initGlossaryModal() {
  state.glossaryDialog = createModalController(
    document.getElementById('glossary-modal')
  );

  // Delegate click handler for all term info buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.term-info-btn');
    if (btn) {
      const termName = btn.dataset.term;
      if (termName) {
        showGlossaryTerm(termName);
      }
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
        if (ref.pmid && ref.author && ref.year) {
          const url = `https://pubmed.ncbi.nlm.nih.gov/${ref.pmid}/`;
          return `<li><a href="${url}" target="_blank" rel="noopener">${ref.author} (${ref.year}). ${ref.title}</a></li>`;
        }
        if (ref.author && ref.year && ref.url) {
          return `<li><a href="${ref.url}" target="_blank" rel="noopener">${ref.author} (${ref.year}). ${ref.title}</a></li>`;
        }
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
