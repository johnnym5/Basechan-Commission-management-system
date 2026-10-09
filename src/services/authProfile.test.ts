import { describe, expect, it } from 'vitest';
import { buildUserProfileRecord } from './authProfile';

describe('buildUserProfileRecord', () => {
  it('writes only the signed-in user profile fields and never stores a client role', () => {
    const payload = buildUserProfileRecord(
      {
        uid: 'user-1',
        email: 'agent@example.com',
        displayName: 'Agent One',
        photoURL: 'https://example.com/photo.png',
      },
      { createdAt: '2025-01-01T00:00:00.000Z' },
      new Date('2026-10-09T12:00:00.000Z')
    );

    expect(payload).toEqual({
      uid: 'user-1',
      email: 'agent@example.com',
      displayName: 'Agent One',
      photoURL: 'https://example.com/photo.png',
      createdAt: '2025-01-01T00:00:00.000Z',
      lastLoginAt: '2026-10-09T12:00:00.000Z',
      isOnline: true,
    });
    expect(payload).not.toHaveProperty('role');
    expect(payload).not.toHaveProperty('isDisabled');
  });

  it('uses safe display-name fallbacks for an incomplete Google profile', () => {
    expect(
      buildUserProfileRecord(
        { uid: 'user-2', email: 'new.agent@example.com', displayName: null, photoURL: null },
        null,
        new Date('2026-10-09T12:00:00.000Z')
      ).displayName
    ).toBe('new.agent');
  });
});
