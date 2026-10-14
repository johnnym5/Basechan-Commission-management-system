import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { assertFirestoreWritesAllowed } from './firestoreWriteGuard';

const BATCH_SIZE = 450;

/**
 * Deletes sheets and all associated rate documents across collections and subcollections.
 *
 * @param sheetNames - Array of sheet names to delete
 * @param adminEmail - Email of the admin performing the deletion
 */
export async function deleteSheets(
  sheetNames: string[],
  _adminEmail: string
): Promise<void> {
  assertFirestoreWritesAllowed('Sheet deletion');
  if (!sheetNames || sheetNames.length === 0) return;

  const toDeleteMap = new Map<string, DocumentReference<DocumentData>>();

  for (const sheetName of sheetNames) {
    if (!sheetName) continue;

    // Direct document references for settings and lifecycles
    const sheetSettingRef = doc(db, 'sheet_settings', sheetName);
    const lifecycleRef = doc(db, 'intake_lifecycles', sheetName);
    const sysLifecycleRef = doc(
      db,
      'settings',
      'system_config',
      'intake_lifecycles',
      sheetName
    );

    toDeleteMap.set(sheetSettingRef.path, sheetSettingRef);
    toDeleteMap.set(lifecycleRef.path, lifecycleRef);
    toDeleteMap.set(sysLifecycleRef.path, sysLifecycleRef);

    // Targets for rates matching sourceSheet or intake
    const targets = [
      collectionGroup(db, 'rates'),
      collection(db, 'rates'),
      collection(db, 'staff_rates'),
      collection(db, 'agent_rates'),
    ];

    for (const target of targets) {
      try {
        const [bySourceSheet, byIntake] = await Promise.all([
          getDocs(query(target, where('sourceSheet', '==', sheetName))),
          getDocs(query(target, where('intake', '==', sheetName))),
        ]);

        bySourceSheet.docs.forEach((docSnap) => {
          toDeleteMap.set(docSnap.ref.path, docSnap.ref);
        });
        byIntake.docs.forEach((docSnap) => {
          toDeleteMap.set(docSnap.ref.path, docSnap.ref);
        });
      } catch (err) {
        console.error(`Error querying target for sheet deletion (${sheetName}):`, err);
        throw Object.assign(new Error(`Failed to query rate records for sheet deletion: ${err instanceof Error ? err.message : String(err)}`), { cause: err });
      }
    }
  }

  const docRefs = Array.from(toDeleteMap.values());

  for (let i = 0; i < docRefs.length; i += BATCH_SIZE) {
    const chunk = docRefs.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

/**
 * Renames a sheet across settings, lifecycles, and rate documents.
 *
 * @param oldName - Existing sheet name
 * @param newName - New sheet name
 * @param adminEmail - Email of the admin performing the rename
 */
export async function renameSheet(
  oldName: string,
  newName: string,
  adminEmail: string
): Promise<void> {
  assertFirestoreWritesAllowed('Sheet renaming');
  if (!oldName || !newName || oldName === newName) return;

  const now = new Date().toISOString();

  // 1. sheet_settings
  const oldSettingRef = doc(db, 'sheet_settings', oldName);
  const newSettingRef = doc(db, 'sheet_settings', newName);
  const settingSnap = await getDoc(oldSettingRef);

  if (settingSnap.exists()) {
    const data = settingSnap.data();
    await setDoc(
      newSettingRef,
      {
        ...data,
        sheetName: newName,
        updatedAt: now,
        updatedBy: adminEmail,
      },
      { merge: true }
    );
  } else {
    await setDoc(
      newSettingRef,
      {
        sheetName: newName,
        disabledForStaff: false,
        disabledForAgents: false,
        updatedAt: now,
        updatedBy: adminEmail,
      },
      { merge: true }
    );
  }
  await deleteDoc(oldSettingRef);

  // 2. intake_lifecycles (top-level)
  const oldLifecycleRef = doc(db, 'intake_lifecycles', oldName);
  const newLifecycleRef = doc(db, 'intake_lifecycles', newName);
  const lifecycleSnap = await getDoc(oldLifecycleRef);

  if (lifecycleSnap.exists()) {
    const data = lifecycleSnap.data();
    await setDoc(
      newLifecycleRef,
      {
        ...data,
        sheetName: newName,
        updatedAt: now,
        updatedBy: adminEmail,
      },
      { merge: true }
    );
  } else {
    await setDoc(
      newLifecycleRef,
      {
        sheetName: newName,
        updatedAt: now,
        updatedBy: adminEmail,
      },
      { merge: true }
    );
  }
  await deleteDoc(oldLifecycleRef);

  // 2b. intake_lifecycles (nested in settings/system_config)
  const oldSysLifecycleRef = doc(
    db,
    'settings',
    'system_config',
    'intake_lifecycles',
    oldName
  );
  const newSysLifecycleRef = doc(
    db,
    'settings',
    'system_config',
    'intake_lifecycles',
    newName
  );
  const sysLifecycleSnap = await getDoc(oldSysLifecycleRef);

  if (sysLifecycleSnap.exists()) {
    await setDoc(
      newSysLifecycleRef,
      {
        ...sysLifecycleSnap.data(),
        sheetName: newName,
        updatedAt: now,
        updatedBy: adminEmail,
      },
      { merge: true }
    );
    await deleteDoc(oldSysLifecycleRef);
  }

  // 3. Batch update sourceSheet or intake to newName on all rates matching oldName
  const targets = [
    collectionGroup(db, 'rates'),
    collection(db, 'rates'),
    collection(db, 'staff_rates'),
    collection(db, 'agent_rates'),
  ];

  const updateMap = new Map<
    string,
    { ref: DocumentReference<DocumentData>; updates: Record<string, unknown> }
  >();

  for (const target of targets) {
    try {
      const [bySourceSheet, byIntake] = await Promise.all([
        getDocs(query(target, where('sourceSheet', '==', oldName))),
        getDocs(query(target, where('intake', '==', oldName))),
      ]);

      const processDoc = (docSnap: QueryDocumentSnapshot<DocumentData>) => {
        const existing = updateMap.get(docSnap.ref.path);
        const data = docSnap.data();
        const updates: Record<string, unknown> = existing
          ? existing.updates
          : { updatedAt: now };

        if (data.sourceSheet === oldName) {
          updates.sourceSheet = newName;
        }
        if (data.intake === oldName) {
          updates.intake = newName;
        }

        updateMap.set(docSnap.ref.path, { ref: docSnap.ref, updates });
      };

      bySourceSheet.docs.forEach(processDoc);
      byIntake.docs.forEach(processDoc);
    } catch (err) {
      console.error(`Error querying target for sheet rename (${oldName}):`, err);
      throw Object.assign(new Error(`Failed to query rate records for sheet rename: ${err instanceof Error ? err.message : String(err)}`), { cause: err });
    }
  }

  const updatesList = Array.from(updateMap.values());

  for (let i = 0; i < updatesList.length; i += BATCH_SIZE) {
    const chunk = updatesList.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(({ ref, updates }) => batch.update(ref, updates));
    await batch.commit();
  }
}

/**
 * Toggles sheet visibility for a given role on sheet_settings/{sheetName}.
 *
 * @param sheetName - Name of the sheet
 * @param role - Role to configure ('STAFF' or 'AGENT')
 * @param disabled - Whether the sheet should be disabled for the given role
 * @param adminEmail - Email of the admin updating the visibility
 */
export async function toggleSheetVisibility(
  sheetName: string,
  role: 'STAFF' | 'AGENT',
  disabled: boolean,
  adminEmail: string
): Promise<void> {
  assertFirestoreWritesAllowed('Sheet visibility update');
  if (!sheetName) return;

  const docRef = doc(db, 'sheet_settings', sheetName.trim());
  const payload: Record<string, unknown> = {
    sheetName: sheetName.trim(),
    updatedBy: adminEmail,
    updatedAt: new Date().toISOString(),
  };

  if (role === 'STAFF') {
    payload.disabledForStaff = disabled;
  } else if (role === 'AGENT') {
    payload.disabledForAgents = disabled;
  }

  await setDoc(docRef, payload, { merge: true });
}

/**
 * Sets a sheet as default intake in settings/system_config and system_config/global.
 *
 * @param sheetName - Name of the sheet to set as default
 * @param adminEmail - Email of the admin setting the default sheet
 */
export async function setSheetAsDefault(
  sheetName: string,
  adminEmail: string
): Promise<void> {
  assertFirestoreWritesAllowed('Set default sheet');
  if (!sheetName) return;

  const configRef = doc(db, 'settings', 'system_config');
  const globalRef = doc(db, 'system_config', 'global');

  const payload = {
    defaultIntake: sheetName.trim(),
    updatedBy: adminEmail,
    updatedAt: new Date().toISOString(),
  };

  await Promise.all([
    setDoc(configRef, payload, { merge: true }),
    setDoc(globalRef, payload, { merge: true }),
  ]);
}

/**
 * Archives all previous intake sheets in intake_lifecycles and sets newActiveSheet as default active intake.
 *
 * @param newActiveSheet - Name of the new active sheet (e.g. "2027 Master Baseline")
 * @param adminEmail - Email of the admin performing the archiving
 */
export async function archivePreviousIntakes(
  newActiveSheet: string,
  adminEmail: string
): Promise<void> {
  assertFirestoreWritesAllowed('Archive previous intakes');
  if (!newActiveSheet || !newActiveSheet.trim()) return;

  const cleanNewSheet = newActiveSheet.trim();
  const now = new Date().toISOString();

  // 1. Set defaultIntake in settings/system_config and system_config/global
  await setSheetAsDefault(cleanNewSheet, adminEmail);

  // 2. Fetch all existing intake_lifecycles
  const lifecyclesRef = collection(db, 'intake_lifecycles');
  const sysLifecyclesRef = collection(
    db,
    'settings',
    'system_config',
    'intake_lifecycles'
  );

  const [lifecyclesSnap, sysLifecyclesSnap] = await Promise.all([
    getDocs(lifecyclesRef),
    getDocs(sysLifecyclesRef),
  ]);

  const batch = writeBatch(db);

  // Mark all existing sheets (except newActiveSheet) as archived in top-level intake_lifecycles
  lifecyclesSnap.docs.forEach((docSnap) => {
    if (docSnap.id !== cleanNewSheet) {
      batch.set(
        docSnap.ref,
        {
          status: 'archived',
          updatedAt: now,
          updatedBy: adminEmail,
        },
        { merge: true }
      );
    }
  });

  // Mark all existing sheets (except newActiveSheet) as archived in system_config intake_lifecycles
  sysLifecyclesSnap.docs.forEach((docSnap) => {
    if (docSnap.id !== cleanNewSheet) {
      batch.set(
        docSnap.ref,
        {
          status: 'archived',
          updatedAt: now,
          updatedBy: adminEmail,
        },
        { merge: true }
      );
    }
  });

  // 3. Set newActiveSheet status in intake_lifecycles/{newActiveSheet} to 'active'
  const newRef = doc(db, 'intake_lifecycles', cleanNewSheet);
  const sysNewRef = doc(
    db,
    'settings',
    'system_config',
    'intake_lifecycles',
    cleanNewSheet
  );

  batch.set(
    newRef,
    {
      sheetName: cleanNewSheet,
      status: 'active',
      updatedAt: now,
      updatedBy: adminEmail,
    },
    { merge: true }
  );

  batch.set(
    sysNewRef,
    {
      sheetName: cleanNewSheet,
      status: 'active',
      updatedAt: now,
      updatedBy: adminEmail,
    },
    { merge: true }
  );

  await batch.commit();
}

