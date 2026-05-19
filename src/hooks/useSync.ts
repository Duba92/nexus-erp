import { useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { firestore } from '@/src/lib/firebase';
import { db } from '@/src/lib/db';
import { useAuthStore } from '@/src/store/useAuthStore';
import { toast } from 'sonner';

export async function syncOfflineDataToCloud(companyId?: string, isSuper?: boolean) {
  if (!navigator.onLine) return;
  console.log('Online connection detected. Syncing offline changes to Firestore...');
  
  const collectionsToSync = [
    'users',
    'companies',
    'departments',
    'products',
    'categories',
    'suppliers',
    'loans',
    'sales',
    'saleItems',
    'purchases',
    'purchaseItems',
    'transactions',
    'attendance'
  ];

  for (const collName of collectionsToSync) {
    try {
      const localTable = (db as any)[collName];
      if (!localTable) continue;

      let localDocs = [];
      if (isSuper) {
        localDocs = await localTable.toArray();
      } else if (companyId) {
        if (collName === 'companies') {
          const companyObj = await localTable.get(companyId);
          localDocs = companyObj ? [companyObj] : [];
        } else {
          localDocs = await localTable.where('companyId').equals(companyId).toArray();
        }
      } else {
        continue;
      }

      for (const docObj of localDocs) {
        if (!docObj.id) continue;
        const firestoreDocRef = doc(firestore, collName, docObj.id);
        
        // Sanitize object values for writing to Firestore (avoid undefined fields)
        const cleanDoc: any = {};
        Object.entries(docObj).forEach(([k, v]) => {
          if (v !== undefined) {
            cleanDoc[k] = v;
          }
        });

        await setDoc(firestoreDocRef, cleanDoc, { merge: true });
      }
    } catch (err) {
      console.error(`Offline sync failed for ${collName}:`, err);
    }
  }
}

export function useSync() {
  const { currentCompany, currentUser } = useAuthStore();

  useEffect(() => {
    if (!currentUser) return;

    const isSuper = currentUser.role === 'SUPER_ADMIN';
    const companyId = currentCompany?.id;

    // Trigger immediate sync on load
    syncOfflineDataToCloud(companyId, isSuper);

    // Setup active listeners for incoming Firestore changes
    const unsubscribers: (() => void)[] = [];

    if (isSuper) {
      // Super Admin syncs all users and companies in real-time
      const globalCollections = ['companies', 'users'];
      
      globalCollections.forEach(collName => {
        const q = collection(firestore, collName);
        const unsubscribe = onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            const docData = change.doc.data();
            const localTable = (db as any)[collName];
            if (!localTable) return;

            if (change.type === 'removed') {
              await localTable.delete(change.doc.id);
            } else {
              await localTable.put({
                id: change.doc.id,
                ...docData,
                createdAt: docData.createdAt?.toDate?.() || (docData.createdAt ? new Date(docData.createdAt.seconds * 1000) : new Date()),
                updatedAt: docData.updatedAt?.toDate?.() || (docData.updatedAt ? new Date(docData.updatedAt.seconds * 1000) : undefined),
              });
            }
          });
        }, (error) => {
          console.error(`Super Admin sync error for ${collName}:`, error);
        });
        unsubscribers.push(unsubscribe);
      });

    } else if (companyId) {
      // Regular user: Sync company's settings and all modular data where companyId == companyId
      const syncCollections = [
        'users',
        'departments',
        'products',
        'categories',
        'suppliers',
        'loans',
        'sales',
        'saleItems',
        'purchases',
        'purchaseItems',
        'transactions',
        'attendance'
      ];

      // 1. Sync Company own record
      const companyQ = query(collection(firestore, 'companies'), where('id', '==', companyId));
      const unsubscribeComp = onSnapshot(companyQ, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          const docData = change.doc.data();
          if (change.type === 'removed') {
            await db.companies.delete(change.doc.id);
          } else {
            await db.companies.put({
              id: change.doc.id,
              ...docData,
              createdAt: docData.createdAt?.toDate?.() || (docData.createdAt ? new Date(docData.createdAt.seconds * 1000) : new Date()),
            } as any);
          }
        });
      });
      unsubscribers.push(unsubscribeComp);

      // 2. Sync Company tables
      syncCollections.forEach(collName => {
        const q = query(
          collection(firestore, collName),
          where('companyId', '==', companyId)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
          snapshot.docChanges().forEach(async (change) => {
            const docData = change.doc.data();
            const localTable = (db as any)[collName];
            if (!localTable) return;

            if (change.type === 'removed') {
              await localTable.delete(change.doc.id);
            } else {
              await localTable.put({
                id: change.doc.id,
                ...docData,
                createdAt: docData.createdAt?.toDate?.() || (docData.createdAt ? new Date(docData.createdAt.seconds * 1000) : new Date()),
                updatedAt: docData.updatedAt?.toDate?.() || (docData.updatedAt ? new Date(docData.updatedAt.seconds * 1000) : undefined),
                date: docData.date?.toDate?.() || (docData.date ? new Date(docData.date) : undefined),
                dueDate: docData.dueDate?.toDate?.() || undefined,
                checkIn: docData.checkIn?.toDate?.() || undefined,
                checkOut: docData.checkOut?.toDate?.() || undefined,
              });
            }
          });
        }, (error) => {
          console.error(`Real-time sync error for ${collName}:`, error);
        });

        unsubscribers.push(unsubscribe);
      });
    }

    // Set up window listener for internet reconnection auto-sync
    const handleOnline = () => {
      syncOfflineDataToCloud(companyId, isSuper);
      toast.success("Online connection restored! Auto-synchronized local database changes with Cloud Firestore.");
    };

    window.addEventListener('online', handleOnline);

    return () => {
      unsubscribers.forEach(unsub => unsub());
      window.removeEventListener('online', handleOnline);
    };
  }, [currentCompany?.id, currentUser?.id]);
}
