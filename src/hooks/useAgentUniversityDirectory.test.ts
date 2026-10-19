import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchUniversityDirectory } from './useAgentUniversityDirectory';

const mocks = vi.hoisted(() => ({
  collection: vi.fn((_db, name: string) => name),
  getDocs: vi.fn(),
}));
vi.mock('../lib/firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({ collection: mocks.collection, getDocs: mocks.getDocs }));

describe('fetchUniversityDirectory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only school identity fields from the signed-in university directory', async () => {
    mocks.getDocs.mockResolvedValue({ docs: [{
      id: 'uni-1',
      data: () => ({ name: 'Example University', country: 'UK', status: 'ACTIVE', agentRate: 40, masterRate: 70 }),
    }] });

    await expect(fetchUniversityDirectory()).resolves.toEqual([
      { id: 'uni-1', name: 'Example University', country: 'UK' },
    ]);
    expect(mocks.collection).toHaveBeenCalledWith({}, 'universities');
  });
});
