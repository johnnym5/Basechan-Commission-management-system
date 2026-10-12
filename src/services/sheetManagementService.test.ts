import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory document store: path -> data
const mockStore = new Map<string, Record<string, any>>();
let batchCommitCount = 0;

vi.mock('../lib/firebase', () => ({
  db: { type: 'mock-db' },
}));

vi.mock('./firestoreWriteGuard', () => ({
  assertFirestoreWritesAllowed: vi.fn(),
}));

vi.mock('firebase/firestore', () => {
  const doc = vi.fn((_db: any, ...pathSegments: string[]) => {
    const path = pathSegments.join('/');
    return { path, type: 'doc' };
  });

  const collection = vi.fn((_db: any, ...pathSegments: string[]) => {
    const path = pathSegments.join('/');
    return { path, type: 'collection' };
  });

  const collectionGroup = vi.fn((_db: any, groupName: string) => {
    return { path: groupName, groupName, type: 'collectionGroup' };
  });

  const query = vi.fn((target: any, ...wheres: any[]) => {
    return { target, wheres, type: 'query' };
  });

  const where = vi.fn((field: string, op: string, value: any) => {
    return { field, op, value };
  });

  const getDoc = vi.fn(async (docRef: { path: string }) => {
    const exists = mockStore.has(docRef.path);
    const data = mockStore.get(docRef.path);
    return {
      exists: () => exists,
      data: () => data,
      ref: docRef,
    };
  });

  const getDocs = vi.fn(async (queryObj: any) => {
    let targetPath = '';
    let isGroup = false;
    let groupName = '';
    let wheres: Array<{ field: string; op: string; value: any }> = [];

    if (queryObj?.type === 'query') {
      wheres = queryObj.wheres || [];
      if (queryObj.target?.type === 'collectionGroup') {
        isGroup = true;
        groupName = queryObj.target.groupName;
      } else if (queryObj.target?.type === 'collection') {
        targetPath = queryObj.target.path;
      }
    } else if (queryObj?.type === 'collectionGroup') {
      isGroup = true;
      groupName = queryObj.groupName;
    } else if (queryObj?.type === 'collection') {
      targetPath = queryObj.path;
    }

    const docs: any[] = [];
    mockStore.forEach((data, path) => {
      let matchesTarget = false;
      if (isGroup) {
        const parts = path.split('/');
        if (parts.length >= 2 && parts[parts.length - 2] === groupName) {
          matchesTarget = true;
        }
      } else {
        if (
          path.startsWith(targetPath + '/') &&
          path.split('/').length === targetPath.split('/').length + 1
        ) {
          matchesTarget = true;
        }
      }

      if (matchesTarget) {
        const matchesWhere = wheres.every((w) => {
          if (w.op === '==') {
            return data[w.field] === w.value;
          }
          return true;
        });

        if (matchesWhere) {
          docs.push({
            id: path.split('/').pop(),
            ref: { path, type: 'doc' },
            data: () => data,
          });
        }
      }
    });

    return {
      docs,
      empty: docs.length === 0,
      size: docs.length,
    };
  });

  const setDoc = vi.fn(
    async (
      docRef: { path: string },
      data: any,
      options?: { merge?: boolean }
    ) => {
      if (options?.merge && mockStore.has(docRef.path)) {
        const existing = mockStore.get(docRef.path) || {};
        mockStore.set(docRef.path, { ...existing, ...data });
      } else {
        mockStore.set(docRef.path, { ...data });
      }
    }
  );

  const deleteDoc = vi.fn(async (docRef: { path: string }) => {
    mockStore.delete(docRef.path);
  });

  const writeBatch = vi.fn(() => {
    const ops: Array<() => void> = [];
    return {
      delete: vi.fn((ref: { path: string }) => {
        ops.push(() => mockStore.delete(ref.path));
      }),
      update: vi.fn((ref: { path: string }, updates: Record<string, any>) => {
        ops.push(() => {
          const existing = mockStore.get(ref.path) || {};
          mockStore.set(ref.path, { ...existing, ...updates });
        });
      }),
      set: vi.fn(
        (ref: { path: string }, data: any, options?: { merge?: boolean }) => {
          ops.push(() => {
            if (options?.merge && mockStore.has(ref.path)) {
              const existing = mockStore.get(ref.path) || {};
              mockStore.set(ref.path, { ...existing, ...data });
            } else {
              mockStore.set(ref.path, { ...data });
            }
          });
        }
      ),
      commit: vi.fn(async () => {
        batchCommitCount++;
        ops.forEach((op) => op());
      }),
    };
  });

  return {
    doc,
    collection,
    collectionGroup,
    query,
    where,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    writeBatch,
  };
});

import {
  archivePreviousIntakes,
  deleteSheets,
  renameSheet,
  setSheetAsDefault,
  toggleSheetVisibility,
} from './sheetManagementService';

describe('sheetManagementService', () => {
  beforeEach(() => {
    mockStore.clear();
    batchCommitCount = 0;
    vi.clearAllMocks();
  });

  describe('deleteSheets', () => {
    it('deletes sheet settings, lifecycles, and associated rates across all subcollections', async () => {
      mockStore.set('sheet_settings/Sept 2026', { sheetName: 'Sept 2026' });
      mockStore.set('intake_lifecycles/Sept 2026', { sheetName: 'Sept 2026' });
      mockStore.set('rates/r1', { sourceSheet: 'Sept 2026', uni: 'Uni A' });
      mockStore.set('rates/r2', { intake: 'Sept 2026', uni: 'Uni B' });
      mockStore.set('staff_rates/r1', { sourceSheet: 'Sept 2026' });
      mockStore.set('agent_rates/r2', { intake: 'Sept 2026' });
      mockStore.set('organization_agent_rates/org1/rates/r1', {
        sourceSheet: 'Sept 2026',
      });
      mockStore.set('rates/unrelated', { sourceSheet: 'Jan 2027' });

      await deleteSheets(['Sept 2026'], 'admin@basechan.com');

      expect(mockStore.has('sheet_settings/Sept 2026')).toBe(false);
      expect(mockStore.has('intake_lifecycles/Sept 2026')).toBe(false);
      expect(mockStore.has('rates/r1')).toBe(false);
      expect(mockStore.has('rates/r2')).toBe(false);
      expect(mockStore.has('staff_rates/r1')).toBe(false);
      expect(mockStore.has('agent_rates/r2')).toBe(false);
      expect(mockStore.has('organization_agent_rates/org1/rates/r1')).toBe(
        false
      );
      // Unrelated document remains intact
      expect(mockStore.has('rates/unrelated')).toBe(true);
    });

    it('performs batch deletes in chunks of up to 450 documents when deleting large datasets', async () => {
      for (let i = 0; i < 500; i++) {
        mockStore.set(`rates/rate-${i}`, { sourceSheet: 'BigSheet' });
      }

      await deleteSheets(['BigSheet'], 'admin@basechan.com');

      expect(batchCommitCount).toBeGreaterThanOrEqual(2);
      expect(mockStore.size).toBe(0);
    });

    it('handles empty sheetNames or non-existent sheets gracefully', async () => {
      await deleteSheets([], 'admin@basechan.com');
      expect(batchCommitCount).toBe(0);
    });
  });

  describe('renameSheet', () => {
    it('renames sheet settings, lifecycles, and updates matching rates', async () => {
      mockStore.set('sheet_settings/Sept 2026', {
        sheetName: 'Sept 2026',
        disabledForStaff: true,
      });
      mockStore.set('intake_lifecycles/Sept 2026', {
        sheetName: 'Sept 2026',
        status: 'active',
      });
      mockStore.set('rates/r1', { sourceSheet: 'Sept 2026', uni: 'Uni A' });
      mockStore.set('rates/r2', { intake: 'Sept 2026', uni: 'Uni B' });
      mockStore.set('staff_rates/r1', { sourceSheet: 'Sept 2026' });

      await renameSheet('Sept 2026', 'Sept 2027', 'admin@basechan.com');

      expect(mockStore.has('sheet_settings/Sept 2026')).toBe(false);
      expect(mockStore.get('sheet_settings/Sept 2027')).toMatchObject({
        sheetName: 'Sept 2027',
        disabledForStaff: true,
        updatedBy: 'admin@basechan.com',
      });

      expect(mockStore.has('intake_lifecycles/Sept 2026')).toBe(false);
      expect(mockStore.get('intake_lifecycles/Sept 2027')).toMatchObject({
        sheetName: 'Sept 2027',
        status: 'active',
        updatedBy: 'admin@basechan.com',
      });

      expect(mockStore.get('rates/r1')?.sourceSheet).toBe('Sept 2027');
      expect(mockStore.get('rates/r2')?.intake).toBe('Sept 2027');
      expect(mockStore.get('staff_rates/r1')?.sourceSheet).toBe('Sept 2027');
    });

    it('creates default settings and lifecycles if old ones did not exist', async () => {
      await renameSheet('NonExistent', 'NewSheet', 'admin@basechan.com');

      expect(mockStore.get('sheet_settings/NewSheet')).toMatchObject({
        sheetName: 'NewSheet',
        disabledForStaff: false,
        disabledForAgents: false,
        updatedBy: 'admin@basechan.com',
      });
      expect(mockStore.get('intake_lifecycles/NewSheet')).toMatchObject({
        sheetName: 'NewSheet',
        updatedBy: 'admin@basechan.com',
      });
    });

    it('chunks updates into batches of up to 450 items for large datasets', async () => {
      for (let i = 0; i < 500; i++) {
        mockStore.set(`rates/rate-${i}`, { sourceSheet: 'OldBig' });
      }

      await renameSheet('OldBig', 'NewBig', 'admin@basechan.com');

      expect(batchCommitCount).toBeGreaterThanOrEqual(2);
      expect(mockStore.get('rates/rate-0')?.sourceSheet).toBe('NewBig');
      expect(mockStore.get('rates/rate-499')?.sourceSheet).toBe('NewBig');
    });

    it('does nothing if oldName equals newName or names are invalid', async () => {
      await renameSheet('Same', 'Same', 'admin@basechan.com');
      expect(batchCommitCount).toBe(0);
    });
  });

  describe('toggleSheetVisibility', () => {
    it('sets disabledForStaff for STAFF role and preserves existing fields', async () => {
      mockStore.set('sheet_settings/Sept 2026', {
        sheetName: 'Sept 2026',
        disabledForAgents: true,
      });

      await toggleSheetVisibility('Sept 2026', 'STAFF', true, 'admin@basechan.com');

      expect(mockStore.get('sheet_settings/Sept 2026')).toMatchObject({
        sheetName: 'Sept 2026',
        disabledForStaff: true,
        disabledForAgents: true,
        updatedBy: 'admin@basechan.com',
      });
    });

    it('sets disabledForAgents for AGENT role', async () => {
      await toggleSheetVisibility('Sept 2026', 'AGENT', true, 'admin@basechan.com');

      expect(mockStore.get('sheet_settings/Sept 2026')).toMatchObject({
        sheetName: 'Sept 2026',
        disabledForAgents: true,
        updatedBy: 'admin@basechan.com',
      });
    });
  });

  describe('setSheetAsDefault', () => {
    it('updates system config in settings/system_config and system_config/global', async () => {
      await setSheetAsDefault('Sept 2026', 'admin@basechan.com');

      expect(mockStore.get('settings/system_config')).toMatchObject({
        defaultIntake: 'Sept 2026',
        updatedBy: 'admin@basechan.com',
      });
      expect(mockStore.get('system_config/global')).toMatchObject({
        defaultIntake: 'Sept 2026',
        updatedBy: 'admin@basechan.com',
      });
    });
  });

  describe('archivePreviousIntakes', () => {
    it('sets defaultIntake in config docs, archives previous lifecycles, and activates newActiveSheet', async () => {
      mockStore.set('intake_lifecycles/Sept 2026', {
        sheetName: 'Sept 2026',
        status: 'active',
      });
      mockStore.set('intake_lifecycles/Jan 2027', {
        sheetName: 'Jan 2027',
        status: 'active',
      });
      mockStore.set('settings/system_config/intake_lifecycles/Sept 2026', {
        sheetName: 'Sept 2026',
        status: 'active',
      });

      await archivePreviousIntakes('2027 Master Baseline', 'admin@basechan.com');

      expect(mockStore.get('settings/system_config')).toMatchObject({
        defaultIntake: '2027 Master Baseline',
        updatedBy: 'admin@basechan.com',
      });
      expect(mockStore.get('system_config/global')).toMatchObject({
        defaultIntake: '2027 Master Baseline',
        updatedBy: 'admin@basechan.com',
      });

      expect(mockStore.get('intake_lifecycles/Sept 2026')).toMatchObject({
        status: 'archived',
        updatedBy: 'admin@basechan.com',
      });
      expect(mockStore.get('intake_lifecycles/Jan 2027')).toMatchObject({
        status: 'archived',
        updatedBy: 'admin@basechan.com',
      });
      expect(mockStore.get('settings/system_config/intake_lifecycles/Sept 2026')).toMatchObject({
        status: 'archived',
        updatedBy: 'admin@basechan.com',
      });

      expect(mockStore.get('intake_lifecycles/2027 Master Baseline')).toMatchObject({
        sheetName: '2027 Master Baseline',
        status: 'active',
        updatedBy: 'admin@basechan.com',
      });
      expect(mockStore.get('settings/system_config/intake_lifecycles/2027 Master Baseline')).toMatchObject({
        sheetName: '2027 Master Baseline',
        status: 'active',
        updatedBy: 'admin@basechan.com',
      });
    });
  });
});
