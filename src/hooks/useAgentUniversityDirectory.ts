import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface DirectoryUniversity {
  id: string;
  name: string;
  country?: string;
}

export async function fetchUniversityDirectory(): Promise<DirectoryUniversity[]> {
  const snapshot = await getDocs(collection(db, 'universities'));
  return snapshot.docs.flatMap((item) => {
    const data = item.data();
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) return [];
    return [{
      id: item.id,
      name,
      ...(typeof data.country === 'string' && data.country.trim() ? { country: data.country.trim() } : {}),
    }];
  });
}

export function useAgentUniversityDirectory(enabled: boolean): DirectoryUniversity[] {
  const [universities, setUniversities] = useState<DirectoryUniversity[]>([]);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setUniversities([]);
      return () => { active = false; };
    }
    void fetchUniversityDirectory()
      .then((items) => { if (active) setUniversities(items); })
      .catch((error) => {
        console.error('Could not load the university directory:', error);
        if (active) setUniversities([]);
      });
    return () => { active = false; };
  }, [enabled]);

  return universities;
}
