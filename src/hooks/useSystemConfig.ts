import { useState, useEffect } from 'react';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { SystemConfigDefaults, IntakeLifecycleSetting } from '../types';

export function useSystemConfig() {
  const [defaultIntake, setDefaultIntake] = useState<string>('ALL');
  const [defaultAggregator, setDefaultAggregator] = useState<string>('ALL');
  const [defaultStudyLevel, setDefaultStudyLevel] = useState<string>('ALL');
  const [defaultViewMode, setDefaultViewMode] = useState<'cards' | 'table'>('cards');
  const [defaultSortBy, setDefaultSortBy] = useState<string>('universityName');
  const [intakeLifecycles, setIntakeLifecycles] = useState<Record<string, IntakeLifecycleSetting>>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);

    const docRef = doc(db, 'settings', 'system_config');
    const unsubscribeConfig = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as SystemConfigDefaults;
          if (data.defaultIntake) setDefaultIntake(data.defaultIntake);
          if (data.defaultAggregator) setDefaultAggregator(data.defaultAggregator);
          if (data.defaultStudyLevel) setDefaultStudyLevel(data.defaultStudyLevel);
          if (data.defaultViewMode) setDefaultViewMode(data.defaultViewMode);
          if (data.defaultSortBy) setDefaultSortBy(data.defaultSortBy);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching system config:', err);
        setLoading(false);
      }
    );

    const lifecyclesRef = collection(db, 'settings', 'system_config', 'intake_lifecycles');
    const unsubscribeLifecycles = onSnapshot(
      lifecyclesRef,
      (snapshot) => {
        const map: Record<string, IntakeLifecycleSetting> = {};
        snapshot.docs.forEach((item) => {
          map[item.id] = { sheetName: item.id, ...item.data() } as IntakeLifecycleSetting;
        });
        setIntakeLifecycles(map);
      },
      (err) => console.error('Error fetching intake lifecycles:', err)
    );

    return () => {
      unsubscribeConfig();
      unsubscribeLifecycles();
    };
  }, []);

  const updateSystemDefaults = async (
    updates: Partial<SystemConfigDefaults>,
    userEmail: string
  ) => {
    const docRef = doc(db, 'settings', 'system_config');
    const payload = {
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail,
    };

    await setDoc(docRef, payload, { merge: true });
  };

  const updateDefaultIntake = async (newDefaultIntake: string, userEmail: string) => {
    await updateSystemDefaults({ defaultIntake: newDefaultIntake }, userEmail);
  };

  const updateIntakeLifecycle = async (
    sheetName: string,
    setting: Partial<IntakeLifecycleSetting>,
    userEmail: string
  ) => {
    if (!sheetName) return;
    const docRef = doc(db, 'settings', 'system_config', 'intake_lifecycles', sheetName.trim());
    await setDoc(
      docRef,
      {
        sheetName: sheetName.trim(),
        ...setting,
        updatedAt: new Date().toISOString(),
        updatedBy: userEmail,
      },
      { merge: true }
    );
  };

  return {
    defaultIntake,
    defaultAggregator,
    defaultStudyLevel,
    defaultViewMode,
    defaultSortBy,
    intakeLifecycles,
    loading,
    updateDefaultIntake,
    updateSystemDefaults,
    updateIntakeLifecycle,
  };
}
