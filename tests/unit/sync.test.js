import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the core module
vi.mock('../../core/js/index.js', () => {
  return {
    createSyncEngine: vi.fn((config) => ({
      sync: vi.fn().mockResolvedValue({ status: 'synced' }),
      canSync: vi.fn().mockReturnValue(true),
      getStatus: vi.fn().mockReturnValue('idle'),
      onStatusChange: vi.fn().mockReturnValue(() => {}),
      getLastSync: vi.fn().mockReturnValue(null)
    })),
    createGoogleDriveProvider: vi.fn((config) => ({
      connect: vi.fn().mockResolvedValue(true),
      disconnect: vi.fn(),
      isConnected: vi.fn().mockReturnValue(false),
      isFolderConfigured: vi.fn().mockReturnValue(false),
      selectFolder: vi.fn().mockResolvedValue({ id: 'folder-123', name: 'seneschal-sync' }),
      getFolder: vi.fn().mockReturnValue(null),
      handleAuthCallback: vi.fn().mockResolvedValue(true)
    })),
    hasOAuthCallback: () => false
  };
});

// Mock db module
vi.mock('../../js/db.js', () => ({
  exportAllData: vi.fn().mockResolvedValue({
    version: 3,
    exportedAt: new Date().toISOString(),
    programs: [],
    journals: [],
    goals: [],
    profile: null
  }),
  mergeData: vi.fn().mockResolvedValue(undefined)
}));

// Import after mocking
import * as sync from '../../js/sync.js';

// =============================================================================
// Module exports tests
// =============================================================================

describe('sync module exports', () => {
  it('should export initSync function', () => {
    expect(typeof sync.initSync).toBe('function');
  });

  it('should export checkOAuthCallback function', () => {
    expect(typeof sync.checkOAuthCallback).toBe('function');
  });

  it('should export handleOAuthCallback function', () => {
    expect(typeof sync.handleOAuthCallback).toBe('function');
  });

  it('should export connect function', () => {
    expect(typeof sync.connect).toBe('function');
  });

  it('should export disconnect function', () => {
    expect(typeof sync.disconnect).toBe('function');
  });

  it('should export isConnected function', () => {
    expect(typeof sync.isConnected).toBe('function');
  });

  it('should export isFolderConfigured function', () => {
    expect(typeof sync.isFolderConfigured).toBe('function');
  });

  it('should export selectFolder function', () => {
    expect(typeof sync.selectFolder).toBe('function');
  });

  it('should export getFolder function', () => {
    expect(typeof sync.getFolder).toBe('function');
  });

  it('should export sync function', () => {
    expect(typeof sync.sync).toBe('function');
  });

  it('should export canSync function', () => {
    expect(typeof sync.canSync).toBe('function');
  });

  it('should export getStatus function', () => {
    expect(typeof sync.getStatus).toBe('function');
  });

  it('should export onStatusChange function', () => {
    expect(typeof sync.onStatusChange).toBe('function');
  });

  it('should export getLastSync function', () => {
    expect(typeof sync.getLastSync).toBe('function');
  });

  it('should export default object with all functions', () => {
    expect(typeof sync.default).toBe('object');
    expect(typeof sync.default.initSync).toBe('function');
    expect(typeof sync.default.connect).toBe('function');
    expect(typeof sync.default.sync).toBe('function');
  });
});

// =============================================================================
// Pre-initialization behavior tests
// =============================================================================

describe('sync pre-initialization', () => {
  it('should return false for isConnected before init', () => {
    expect(sync.isConnected()).toBe(false);
  });

  it('should return false for isFolderConfigured before init', () => {
    expect(sync.isFolderConfigured()).toBe(false);
  });

  it('should return null for getFolder before init', () => {
    expect(sync.getFolder()).toBeNull();
  });

  it('should return false for canSync before init', () => {
    expect(sync.canSync()).toBe(false);
  });

  it('should return idle for getStatus before init', () => {
    expect(sync.getStatus()).toBe('idle');
  });

  it('should return null for getLastSync before init', () => {
    expect(sync.getLastSync()).toBeNull();
  });

  it('should return noop function for onStatusChange before init', () => {
    const unsubscribe = sync.onStatusChange(() => {});
    expect(typeof unsubscribe).toBe('function');
  });
});

// =============================================================================
// Initialization tests
// =============================================================================

describe('sync initialization', () => {
  const mockConfig = {
    google: {
      clientId: 'test-client-id',
      apiKey: 'test-api-key'
    },
    redirectUri: 'http://localhost'
  };

  it('should return provider and syncEngine from initSync', () => {
    const result = sync.initSync(mockConfig);

    expect(result).toHaveProperty('provider');
    expect(result).toHaveProperty('syncEngine');
    expect(result.provider).not.toBeNull();
    expect(result.syncEngine).not.toBeNull();
  });

  it('should allow isConnected after init', () => {
    sync.initSync(mockConfig);
    const connected = sync.isConnected();
    expect(typeof connected).toBe('boolean');
  });

  it('should allow getStatus after init', () => {
    sync.initSync(mockConfig);
    const status = sync.getStatus();
    expect(typeof status).toBe('string');
  });

  it('should check OAuth callback status', () => {
    const result = sync.checkOAuthCallback();
    expect(typeof result).toBe('boolean');
  });
});

// =============================================================================
// Operations after init
// =============================================================================

describe('sync operations after init', () => {
  const mockConfig = {
    google: {
      clientId: 'test-client-id',
      apiKey: 'test-api-key'
    },
    redirectUri: 'http://localhost'
  };

  beforeEach(() => {
    sync.initSync(mockConfig);
  });

  it('should return boolean for isConnected', () => {
    const result = sync.isConnected();
    expect(typeof result).toBe('boolean');
  });

  it('should return boolean for isFolderConfigured', () => {
    const result = sync.isFolderConfigured();
    expect(typeof result).toBe('boolean');
  });

  it('should return value or null for getFolder', () => {
    const result = sync.getFolder();
    expect(result === null || typeof result === 'object').toBe(true);
  });

  it('should return boolean for canSync', () => {
    const result = sync.canSync();
    expect(typeof result).toBe('boolean');
  });

  it('should return string for getStatus', () => {
    const result = sync.getStatus();
    expect(typeof result).toBe('string');
  });

  it('should return unsubscribe function for onStatusChange', () => {
    const unsubscribe = sync.onStatusChange(() => {});
    expect(typeof unsubscribe).toBe('function');
  });

  it('disconnect should not throw', () => {
    expect(() => sync.disconnect()).not.toThrow();
  });
});
