// =============================================================================
// UI PATTERNS
// =============================================================================

/**
 * Create a tab controller for tab-based navigation.
 * @param {string} tabsSelector - Selector for tab elements
 * @param {string} pagesSelector - Selector for page elements
 * @param {Object} options - Configuration options
 * @param {string} [options.storageKey] - localStorage key for persistence
 * @param {string} [options.tabAttr='data-tab'] - Attribute containing target page ID
 * @param {Function} [options.onActivate] - Callback when tab is activated
 * @returns {Object} Tab controller with activate method
 */
export function createTabController(tabsSelector, pagesSelector, options = {}) {
  const {
    storageKey = null,
    tabAttr = 'data-tab',
    onActivate = null
  } = options;

  const tabs = document.querySelectorAll(tabsSelector);
  const pages = document.querySelectorAll(pagesSelector);

  function activate(targetId) {
    tabs.forEach(t => t.classList.remove('active'));
    pages.forEach(p => p.classList.remove('active'));

    const tab = document.querySelector(`${tabsSelector}[${tabAttr}="${targetId}"]`);
    const page = document.getElementById(targetId);

    if (tab && page) {
      tab.classList.add('active');
      page.classList.add('active');

      if (storageKey) {
        localStorage.setItem(storageKey, targetId);
      }

      if (onActivate) {
        onActivate(targetId);
      }
    }
  }

  // Restore saved state or activate default
  if (storageKey) {
    const savedTab = localStorage.getItem(storageKey);
    // Default must match inline script in index.html
    const defaultTab = storageKey === 'activeTab' ? 'workouts' : tabs[0]?.getAttribute(tabAttr);
    activate(savedTab || defaultTab);
    // Remove inline style helper now that JS has taken over
    if (storageKey === 'activeTab') {
      delete document.documentElement.dataset.tab;
    }
  }

  // Bind click handlers
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute(tabAttr);
      activate(targetId);
    });
  });

  return { activate };
}

/**
 * Create a modal controller wrapping native <dialog> element.
 * @param {HTMLDialogElement} dialog - The dialog element
 * @returns {Object} Modal controller with open, close methods
 */
export function createModalController(dialog) {
  function open() {
    dialog.showModal();
  }

  function close() {
    dialog.close();
  }

  // Close on backdrop click
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) {
      close();
    }
  });

  // Close button handler
  const closeBtn = dialog.querySelector('.modal-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', close);
  }

  return { open, close, dialog };
}

/**
 * Show a promise-based confirmation dialog.
 * @param {HTMLDialogElement} dialog - The dialog element
 * @param {Object} buttons - Button selectors mapped to return values
 * @returns {Promise<string>} Resolves with the button value clicked
 */
export function showConfirmDialog(dialog, buttons) {
  return new Promise((resolve) => {
    dialog.showModal();

    const handlers = {};

    const cleanup = () => {
      dialog.close();
      Object.entries(handlers).forEach(([selector, handler]) => {
        const btn = dialog.querySelector(selector);
        if (btn) btn.removeEventListener('click', handler);
      });
    };

    Object.entries(buttons).forEach(([selector, value]) => {
      const btn = dialog.querySelector(selector);
      if (btn) {
        handlers[selector] = () => {
          cleanup();
          resolve(value);
        };
        btn.addEventListener('click', handlers[selector]);
      }
    });
  });
}

/**
 * Show a toast notification.
 * @param {string} message - Message to display
 * @param {number} duration - Duration in milliseconds
 */
export function showToast(message, duration = 2000) {
  let toast = document.querySelector('.status-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'status-toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add('visible');

  setTimeout(() => {
    toast.classList.remove('visible');
  }, duration);
}
