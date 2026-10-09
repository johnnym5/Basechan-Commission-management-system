import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface SystemAnnouncement {
  id: string;
  title: string;
  message: string;
  targetRole: 'ALL' | 'STAFF' | 'AGENT' | string;
  isBanner: boolean;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  expiresAt?: string | null;
}

export function subscribeToSystemAnnouncements(
  onUpdate: (announcements: SystemAnnouncement[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, 'system_announcements');
  const q = query(colRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      })) as SystemAnnouncement[];
      onUpdate(items);
    },
    (err) => {
      console.error('Error fetching announcements:', err);
      if (onError) onError(err);
    }
  );
}

export async function publishAnnouncement(
  announcement: Omit<SystemAnnouncement, 'id' | 'createdAt'> & { id?: string },
  userEmail: string
): Promise<string> {
  const id = announcement.id || `anc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const docRef = doc(db, 'system_announcements', id);

  const payload: SystemAnnouncement = {
    ...announcement,
    id,
    createdAt: new Date().toISOString(),
    createdBy: userEmail,
  };

  await setDoc(docRef, payload, { merge: true });
  return id;
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const docRef = doc(db, 'system_announcements', id);
  await deleteDoc(docRef);
}
