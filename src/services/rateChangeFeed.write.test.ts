import { describe, expect, it, vi, beforeEach } from 'vitest';
const { runTransaction, getDoc, set } = vi.hoisted(() => ({ runTransaction: vi.fn(), getDoc: vi.fn(), set: vi.fn() }));
vi.mock('firebase/firestore', () => ({ collection: vi.fn((_db, ...parts) => ({ path: [...(_db?.path ? [_db.path] : []), ...parts].join('/') })), doc: vi.fn((_db, ...parts) => ({ path: [...(_db?.path ? [_db.path] : []), ...parts].join('/') })), runTransaction }));
vi.mock('../lib/firebase', () => ({ db: {} }));
import { appendRateDeltas } from './rateChangeFeed';

describe('appendRateDeltas', () => {
  beforeEach(() => { vi.clearAllMocks(); runTransaction.mockImplementation(async (_db, callback) => callback({ get: getDoc, set })); getDoc.mockResolvedValue({ exists: () => false, data: () => ({ sequence: 4 }) }); });
  it('appends a package in one transaction with ordered sequence and one marker per delta', async () => {
    await appendRateDeltas('admin', [
      { operationId: 'op', kind: 'upsert', id: 'a', target: 'rates' },
      { operationId: 'op', kind: 'delete', id: 'b', target: 'rates' },
    ]);
    expect(runTransaction).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledTimes(5);
    expect(set.mock.calls.filter((call) => String(call[0].path).includes('/changes/'))).toHaveLength(2);
    expect(set.mock.calls.filter((call) => String(call[0].path).includes('/changes/')).map((call) => call[1]?.sequence)).toEqual([5, 6]);
  });
  it('does not append an already marked delta on retry', async () => {
    getDoc.mockResolvedValue({ exists: () => true, data: () => ({ sequence: 5 }) });
    await appendRateDeltas('admin', [{ operationId: 'op', kind: 'upsert', id: 'a', target: 'rates' }]);
    expect(set).not.toHaveBeenCalled();
  });
});


