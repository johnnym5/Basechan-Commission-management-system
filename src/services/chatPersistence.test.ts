import { beforeEach, describe, expect, it, vi } from 'vitest';

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn((...args: unknown[]) => ({ path: args.slice(1).join('/') })),
  limit: vi.fn((value: number) => ({ limit: value })),
  orderBy: vi.fn((field: string, direction: string) => ({ field, direction })),
  query: vi.fn((...args: unknown[]) => ({ args })),
  onSnapshot: vi.fn(),
}));

vi.mock('firebase/firestore', () => ({
  collection: firestoreMocks.collection,
  limit: firestoreMocks.limit,
  orderBy: firestoreMocks.orderBy,
  query: firestoreMocks.query,
  onSnapshot: firestoreMocks.onSnapshot,
  deleteDoc: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
  setDoc: vi.fn(),
}));
vi.mock('../lib/firebase', () => ({ db: { name: 'test-db' } }));

import { subscribeToUserUpdates } from './chatPersistence';

describe('user update subscription', () => {
  beforeEach(() => vi.clearAllMocks());

  it('subscribes to the signed-in account update path and maps new notices', () => {
    const unsubscribe = vi.fn();
    let receiveSnapshot: ((snapshot: unknown) => void) | undefined;
    firestoreMocks.onSnapshot.mockImplementation((_query, callback) => {
      receiveSnapshot = callback;
      return unsubscribe;
    });
    const onChange = vi.fn();
    const onError = vi.fn();

    const stop = subscribeToUserUpdates('agent-1', onChange, onError);
    receiveSnapshot?.({ docs: [{ id: 'update-1', data: () => ({ title: 'Rates updated' }) }] });

    expect(firestoreMocks.collection).toHaveBeenCalledWith({ name: 'test-db' }, 'users', 'agent-1', 'updates');
    expect(onChange).toHaveBeenCalledWith([{ id: 'update-1', title: 'Rates updated' }]);
    expect(onError).not.toHaveBeenCalled();
    stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
