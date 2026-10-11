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
  const [activeIntakesState, setActiveIntakesState] = useState<string[]>([]);
  const [intakeLifecycles, setIntakeLifecycles] = useState<Record<string, IntakeLifecycleSetting>>({});
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);

    // Listen to system_config/global in Firestore
    const globalDocRef = doc(db, 'system_config', 'global');
    const unsubscribeGlobal = onSnapshot(
      globalDocRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.activeIntakes) && data.activeIntakes.length > 0) {
            setActiveIntakesState(data.activeIntakes);
          }
        }
      },
      (err) => console.error('Error fetching system_config/global:', err)
    );

    // Listen to settings/system_config in Firestore
    const docRef = doc(db, 'settings', 'system_config');
    const unsubscribeConfig = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as SystemConfigDefaults & { activeIntakes?: string[] };
          if (data.defaultIntake) setDefaultIntake(data.defaultIntake);
          if (data.defaultAggregator) setDefaultAggregator(data.defaultAggregator);
          if (data.defaultStudyLevel) setDefaultStudyLevel(data.defaultStudyLevel);
          if (data.defaultViewMode) setDefaultViewMode(data.defaultViewMode);
          if (data.defaultSortBy) setDefaultSortBy(data.defaultSortBy);
          if (Array.isArray(data.activeIntakes) && data.activeIntakes.length > 0) {
            setActiveIntakesState(data.activeIntakes);
          }
        }
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching settings/system_config:', err);
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
      unsubscribeGlobal();
      unsubscribeConfig();
      unsubscribeLifecycles();
    };
  }, []);

  const updateSystemDefaults = async (
    updates: Partial<SystemConfigDefaults & { activeIntakes?: string[] }>,
    userEmail: string
  ) => {
    const docRef = doc(db, 'settings', 'system_config');
    const globalRef = doc(db, 'system_config', 'global');
    const payload = {
      ...updates,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail,
    };

    await Promise.all([
      setDoc(docRef, payload, { merge: true }),
      setDoc(globalRef, payload, { merge: true }),
    ]);
  };

  const updateDefaultIntake = async (newDefaultIntake: string, userEmail: string) => {
    await updateSystemDefaults({ defaultIntake: newDefaultIntake, activeIntakes: [newDefaultIntake] }, userEmail);
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

  const activeIntakes = activeIntakesState.length > 0
    ? activeIntakesState
    : defaultIntake !== 'ALL'
      ? [defaultIntake]
      : Object.keys(intakeLifecycles).filter((key) => (intakeLifecycles[key] as any)?.status !== 'archived');

  const updateActiveIntakes = async (newActiveIntakes: string[], userEmail: string) => {
    const mainDefault = newActiveIntakes[0] || 'ALL';
    await updateSystemDefaults({ defaultIntake: mainDefault, activeIntakes: newActiveIntakes }, userEmail);
  };

  return {
    defaultIntake,
    defaultAggregator,
    defaultStudyLevel,
    defaultViewMode,
    defaultSortBy,
    intakeLifecycles,
    activeIntakes,
    loading,
    updateDefaultIntake,
    updateActiveIntakes,
    updateSystemDefaults,
    updateIntakeLifecycle,
  };
}
