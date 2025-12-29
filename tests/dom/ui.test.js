import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { showToast, createModalController, createTabController } from '../../js/ui.js';

// =============================================================================
// Test Setup
// =============================================================================

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// =============================================================================
// showToast
// =============================================================================

describe('showToast', () => {
  it('creates a toast element with message', () => {
    showToast('Test message');

    const toast = document.querySelector('.status-toast');
    expect(toast).toBeTruthy();
    expect(toast.textContent).toBe('Test message');
  });

  it('adds visible class to toast', () => {
    showToast('Visible toast');

    const toast = document.querySelector('.status-toast');
    expect(toast.classList.contains('visible')).toBe(true);
  });

  it('removes visible class after timeout', () => {
    showToast('Temporary message', 2000);

    const toast = document.querySelector('.status-toast');
    expect(toast.classList.contains('visible')).toBe(true);

    vi.advanceTimersByTime(2000);

    expect(toast.classList.contains('visible')).toBe(false);
  });

  it('reuses existing toast element', () => {
    showToast('First toast');
    showToast('Second toast');

    const toasts = document.querySelectorAll('.status-toast');
    expect(toasts).toHaveLength(1);
    expect(toasts[0].textContent).toBe('Second toast');
  });
});

// =============================================================================
// createModalController
// =============================================================================

describe('createModalController', () => {
  beforeEach(() => {
    // Create a mock dialog that implements showModal/close
    const mockDialog = document.createElement('div');
    mockDialog.id = 'test-dialog';
    mockDialog.innerHTML = '<button class="modal-close">Close</button>';

    // Mock showModal and close methods
    mockDialog.showModal = vi.fn(() => {
      mockDialog.open = true;
    });
    mockDialog.close = vi.fn(() => {
      mockDialog.open = false;
    });
    mockDialog.open = false;

    document.body.appendChild(mockDialog);
  });

  it('creates controller with open/close methods', () => {
    const dialog = document.getElementById('test-dialog');
    const controller = createModalController(dialog);

    expect(controller).toHaveProperty('open');
    expect(controller).toHaveProperty('close');
    expect(typeof controller.open).toBe('function');
    expect(typeof controller.close).toBe('function');
  });

  it('open method calls showModal', () => {
    const dialog = document.getElementById('test-dialog');
    const controller = createModalController(dialog);

    controller.open();

    expect(dialog.showModal).toHaveBeenCalled();
  });

  it('close method calls close', () => {
    const dialog = document.getElementById('test-dialog');
    const controller = createModalController(dialog);

    controller.open();
    controller.close();

    expect(dialog.close).toHaveBeenCalled();
  });

  it('returns dialog reference', () => {
    const dialog = document.getElementById('test-dialog');
    const controller = createModalController(dialog);

    expect(controller.dialog).toBe(dialog);
  });
});

// =============================================================================
// createTabController
// =============================================================================

describe('createTabController', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <button class="tab-btn" data-tab="tab1">Tab 1</button>
      <button class="tab-btn" data-tab="tab2">Tab 2</button>
      <button class="tab-btn" data-tab="tab3">Tab 3</button>
      <div class="tab-content" id="tab1">Content 1</div>
      <div class="tab-content" id="tab2">Content 2</div>
      <div class="tab-content" id="tab3">Content 3</div>
    `;
  });

  it('returns activate function', () => {
    const controller = createTabController('.tab-btn', '.tab-content');
    expect(typeof controller.activate).toBe('function');
  });

  it('activates correct tab and content on activate', () => {
    const controller = createTabController('.tab-btn', '.tab-content');
    controller.activate('tab2');

    const activeBtn = document.querySelector('.tab-btn.active');
    const activeContent = document.querySelector('.tab-content.active');

    expect(activeBtn.dataset.tab).toBe('tab2');
    expect(activeContent.id).toBe('tab2');
  });

  it('removes active class from other buttons and pages', () => {
    const controller = createTabController('.tab-btn', '.tab-content');
    controller.activate('tab1');
    controller.activate('tab3');

    const activeButtons = document.querySelectorAll('.tab-btn.active');
    const activePages = document.querySelectorAll('.tab-content.active');

    expect(activeButtons).toHaveLength(1);
    expect(activeButtons[0].dataset.tab).toBe('tab3');
    expect(activePages).toHaveLength(1);
    expect(activePages[0].id).toBe('tab3');
  });

  it('saves active tab to localStorage when storageKey provided', () => {
    const controller = createTabController('.tab-btn', '.tab-content', {
      storageKey: 'testActiveTab'
    });
    controller.activate('tab2');

    expect(localStorage.getItem('testActiveTab')).toBe('tab2');
  });

  it('calls onActivate callback with tab id', () => {
    const onActivate = vi.fn();
    const controller = createTabController('.tab-btn', '.tab-content', { onActivate });

    controller.activate('tab2');

    expect(onActivate).toHaveBeenCalledWith('tab2');
  });

  it('handles click events on tab buttons', () => {
    createTabController('.tab-btn', '.tab-content');

    const tab2Button = document.querySelector('[data-tab="tab2"]');
    tab2Button.click();

    const activeBtn = document.querySelector('.tab-btn.active');
    expect(activeBtn.dataset.tab).toBe('tab2');
  });
});
