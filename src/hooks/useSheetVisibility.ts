import { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserRole } from '../types';
import { assertFirestoreWritesAllowed } from '../services/firestoreWriteGuard';

export interface SheetVisibilitySetting {
  id: string;
  sheetName: string;
  disabledForStaff: boolean;
  disabledForAgents: boolean;
  updatedBy?: string;
  updatedAt?: string;
}

export function useSheetVisibility() {
  const [sheetSettings, setSheetSettings] = useState<SheetVisibilitySetting[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    setLoading(true);

    const unsubscribe = onSnapshot(
      collection(db, 'sheet_settings'),
      (snapshot) => {
        const list: SheetVisibilitySetting[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as SheetVisibilitySetting);
        });
        setSheetSettings(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching sheet settings:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const isSheetDisabled = (sheetOrIntakeName: string, role: UserRole): boolean => {
    if (role === 'ADMIN') return false; // Admin sees everything

    if (!sheetOrIntakeName) return false;
    const cleanName = sheetOrIntakeName.trim().toLowerCase();

    const setting = sheetSettings.find(
      (s) => s.sheetName.trim().toLowerCase() === cleanName || s.id.trim().toLowerCase() === cleanName
    );

    if (!setting) return false;

    if (role === 'STAFF' && setting.disabledForStaff) return true;
    if (role === 'AGENT' && setting.disabledForAgents) return true;

    return false;
  };

  const updateSheetVisibility = async (
    sheetName: string,
    roleToUpdate: 'STAFF' | 'AGENT',
    isDisabled: boolean,
    userEmail: string
  ) => {
    if (!sheetName) return;
    assertFirestoreWritesAllowed('Sheet visibility changes');
    const docId = sheetName.trim();
    const docRef = doc(db, 'sheet_settings', docId);

    const existing = sheetSettings.find((s) => s.id === docId);
    const disabledForStaff = roleToUpdate === 'STAFF' ? isDisabled : existing?.disabledForStaff || false;
    const disabledForAgents = roleToUpdate === 'AGENT' ? isDisabled : existing?.disabledForAgents || false;

    await setDoc(
      docRef,
      {
        sheetName: docId,
        disabledForStaff,
        disabledForAgents,
        updatedBy: userEmail,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    const [{ loadVisibilitySettings, syncRateReadModels, opaqueRateId }, { publishRelevantUpdates }] = await Promise.all([
      import('../services/rateReadModels'),
      import('../services/userUpdates'),
    ]);
    const canonicalCollection = collection(db, 'rates');
    const [bySourceSheet, byIntake] = await Promise.all([
      getDocs(query(canonicalCollection, where('sourceSheet', '==', docId))),
      getDocs(query(canonicalCollection, where('intake', '==', docId))),
    ]);
    const documents = new Map([...bySourceSheet.docs, ...byIntake.docs].map((item) => [item.id, item]));
    const canonicalRates = Array.from(documents.values()).map((item) => ({ ...item.data(), id: item.id } as import('../types').CommissionRate));
    const visibility = await loadVisibilitySettings();
    const operationId = `sheet-visibility-${crypto.randomUUID()}`;
    for (const rate of canonicalRates) {
      await syncRateReadModels(rate, { sheetVisibility: visibility, operationId: `${operationId}-${opaqueRateId(rate)}` });
    }
    if (canonicalRates.length) {
      await publishRelevantUpdates({
        type: 'access',
        title: 'School data visibility updated',
        summary: isDisabled ? 'Some school information is no longer available in this view.' : 'School information is available in this view again.',
        rates: canonicalRates,
        roles: [roleToUpdate],
        includeStaff: roleToUpdate === 'STAFF',
      });
    }
  };

  return { sheetSettings, loading, isSheetDisabled, updateSheetVisibility };
}
