import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { AgentChatProfile, ChatConversation, ChatMessage, FavoriteSchool, UserUpdate } from '../types';
import { MAX_CHAT_INPUT_LENGTH, sanitizeChatInput } from './chatQuery';
import { assertFirestoreWritesAllowed } from './firestoreWriteGuard';
import { isQuotaOffline } from './firestoreOfflineMode';

export const MAX_CONVERSATIONS_PER_ACCOUNT = 5;
export const MAX_QUERIES_PER_SESSION = 50;
export const MAX_QUERIES_PER_MINUTE = 10;
export const PREFERENCE_LEARNING_THRESHOLD = 10;

function userSubcollection(uid: string, name: string) {
  return collection(db, 'users', uid, name);
}

export function sanitizeMessageText(text: string): string {
  const sanitized = sanitizeChatInput(text);
  if (!sanitized) throw new Error('Enter a message before sending.');
  if (text.length > MAX_CHAT_INPUT_LENGTH) throw new Error(`Messages must be ${MAX_CHAT_INPUT_LENGTH} characters or fewer.`);
  return sanitized;
}

export async function saveConversation(uid: string, conversation: ChatConversation): Promise<void> {
  assertFirestoreWritesAllowed('Chat history');
  if (!uid) throw new Error('A signed-in account is required.');
  const safeMessages: ChatMessage[] = conversation.messages.map((message) => {
    // Historical result IDs are retained, but payout/routing snapshots must be
    // reconstructed from the current role-safe read model when displayed.
    const safeMessage = Object.fromEntries(Object.entries(message).filter(([key]) => key !== 'resultRates')) as ChatMessage;
    return {
      ...safeMessage,
      text: message.role === 'user' ? sanitizeMessageText(message.text) : sanitizeStoredMessage(message.text),
    };
  });
  const ref = doc(db, 'users', uid, 'chat_conversations', conversation.id);
  const conversationsQuery = query(userSubcollection(uid, 'chat_conversations'), orderBy('updatedAt', 'desc'), limit(MAX_CONVERSATIONS_PER_ACCOUNT));
  const retainedSnapshot = await getDocs(conversationsQuery);
  await runTransaction(db, async (transaction) => {
    const [current, ...retained] = await Promise.all([
      transaction.get(ref),
      ...retainedSnapshot.docs.map((item) => transaction.get(item.ref)),
    ]);
    transaction.set(ref, { ...conversation, messages: safeMessages, updatedAt: new Date().toISOString() }, { merge: true });
    const existing = retainedSnapshot.docs.filter((_, index) => retained[index]?.exists());
    if (!current.exists() && existing.length >= MAX_CONVERSATIONS_PER_ACCOUNT) {
      const oldest = existing[existing.length - 1];
      if (oldest && oldest.id !== conversation.id) transaction.delete(oldest.ref);
    }
  });
}

export async function redactStoredResultSnapshots(uid: string): Promise<void> {
  assertFirestoreWritesAllowed('Saved chat cleanup');
  if (!uid) return;
  const snapshot = await getDocs(userSubcollection(uid, 'chat_conversations'));
  for (const conversation of snapshot.docs) {
    const messages = conversation.data().messages;
    if (!Array.isArray(messages) || !messages.some((message) => message && typeof message === 'object' && 'resultRates' in message)) continue;
    await setDoc(conversation.ref, {
      messages: messages.map((message) => {
        if (!message || typeof message !== 'object') return message;
        return Object.fromEntries(Object.entries(message as Record<string, unknown>).filter(([key]) => key !== 'resultRates'));
      }),
    }, { merge: true });
  }
}

function sanitizeStoredMessage(text: string): string {
  const sanitized = sanitizeChatInput(text);
  if (!sanitized) return '[Empty message removed]';
  return sanitized;
}

export async function loadRecentConversations(uid: string): Promise<ChatConversation[]> {
  const snapshot = await getDocs(query(userSubcollection(uid, 'chat_conversations'), orderBy('updatedAt', 'desc'), limit(MAX_CONVERSATIONS_PER_ACCOUNT)));
  return Promise.all(snapshot.docs.map(async (item) => {
    const data = item.data();
    const messages = Array.isArray(data.messages) ? data.messages : [];
    const safeMessages = messages.map((message) => message && typeof message === 'object'
      ? Object.fromEntries(Object.entries(message).filter(([key]) => key !== 'resultRates'))
      : message);
    if (messages.some((message) => message && typeof message === 'object' && 'resultRates' in message)) {
      if (navigator.onLine && !isQuotaOffline(uid)) await setDoc(item.ref, { messages: safeMessages }, { merge: true });
    }
    return { ...data, id: item.id, messages: safeMessages } as ChatConversation;
  }));
}

export async function deleteConversation(uid: string, conversationId: string): Promise<void> {
  assertFirestoreWritesAllowed('Chat history');
  await deleteDoc(doc(db, 'users', uid, 'chat_conversations', conversationId));
}

export async function saveFavorite(uid: string, favorite: FavoriteSchool): Promise<void> {
  assertFirestoreWritesAllowed('Favorites');
  await setDoc(doc(db, 'users', uid, 'favorite_schools', favorite.universityId), favorite);
}

export async function removeFavorite(uid: string, universityId: string): Promise<void> {
  assertFirestoreWritesAllowed('Favorites');
  await deleteDoc(doc(db, 'users', uid, 'favorite_schools', universityId));
}

export async function loadFavorites(uid: string): Promise<FavoriteSchool[]> {
  const snapshot = await getDocs(userSubcollection(uid, 'favorite_schools'));
  return snapshot.docs.map((item) => item.data() as FavoriteSchool);
}

export async function saveChatProfile(uid: string, profile: AgentChatProfile): Promise<void> {
  assertFirestoreWritesAllowed('Chat preferences');
  await setDoc(doc(db, 'users', uid, 'chat_private', 'profile'), profile, { merge: true });
}

export async function clearChatProfile(uid: string): Promise<void> {
  assertFirestoreWritesAllowed('Chat preferences');
  await deleteDoc(doc(db, 'users', uid, 'chat_private', 'profile'));
}

export async function loadChatProfile(uid: string): Promise<AgentChatProfile | null> {
  const { getDoc } = await import('firebase/firestore');
  const snapshot = await getDoc(doc(db, 'users', uid, 'chat_private', 'profile'));
  return snapshot.exists() ? snapshot.data() as AgentChatProfile : null;
}

export async function loadUserUpdates(uid: string): Promise<UserUpdate[]> {
  const snapshot = await getDocs(query(userSubcollection(uid, 'updates'), orderBy('createdAt', 'desc'), limit(100)));
  return snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as UserUpdate);
}

export function subscribeToUserUpdates(
  uid: string,
  onChange: (updates: UserUpdate[]) => void,
  onError?: (error: Error) => void,
): Unsubscribe {
  if (!uid) {
    onChange([]);
    return () => {};
  }
  return onSnapshot(
    query(userSubcollection(uid, 'updates'), orderBy('createdAt', 'desc'), limit(100)),
    (snapshot) => onChange(snapshot.docs.map((item) => ({ ...item.data(), id: item.id }) as UserUpdate)),
    (error) => onError?.(error),
  );
}

export async function markUpdateRead(uid: string, updateId: string): Promise<void> {
  assertFirestoreWritesAllowed('Activity updates');
  await setDoc(doc(db, 'users', uid, 'updates', updateId), { isRead: true, readAt: serverTimestamp() }, { merge: true });
}

export interface ChatUsageState {
  currentConversationId: string;
  queriesThisSession: number;
  queryTimestamps: number[];
  updatedAt: string;
}

export async function loadChatUsage(uid: string): Promise<ChatUsageState | null> {
  const { getDoc } = await import('firebase/firestore');
  const snapshot = await getDoc(doc(db, 'users', uid, 'chat_private', 'usage'));
  return snapshot.exists() ? snapshot.data() as ChatUsageState : null;
}

export async function saveChatUsage(uid: string, state: ChatUsageState): Promise<void> {
  assertFirestoreWritesAllowed('Chat usage');
  const ref = doc(db, 'users', uid, 'chat_private', 'usage');
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    const previous = snapshot.exists() ? snapshot.data() : {};
    const slots = Array.from({ length: 10 }, (_, index) => {
      const value = previous[`querySlot${index + 1}At`] as { toMillis?: () => number } | undefined;
      return typeof value?.toMillis === 'function' ? value.toMillis() : undefined;
    });
    const availableSlot = slots.findIndex((timestamp) => timestamp === undefined || Date.now() - timestamp >= 60_000);
    if (availableSlot < 0) throw new Error('You have reached the 10 questions per minute limit. Wait a moment and try again.');
    const slotField = `querySlot${availableSlot + 1}At`;
    transaction.set(ref, { ...state, [slotField]: serverTimestamp() }, { merge: true });
  });
}
