import { useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { firestore } from '@/src/lib/firebase';
import { db } from '@/src/lib/db';
import { useAuthStore } from '@/src/store/useAuthStore';

export function useSync() {
  const { currentCompany, currentUser } = useAuthStore();

  useEffect(() => {
    if (!currentCompany || !currentUser) return;

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

    const unsubscribers: (() => void)[] = [];

    syncCollections.forEach(collName => {
      const q = query(
        collection(firestore, collName),
        where('companyId', '==', currentCompany.id)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          const docData = change.doc.data();
          const localTable = (db as any)[collName];
          if (!localTable) return;

          if (change.type === 'removed') {
            await localTable.delete(change.doc.id);
          } else {
            // Added or modified
            await localTable.put({
              id: change.doc.id,
              ...docData,
              // Convert timestamps back to Dates for Dexie
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

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [currentCompany?.id, currentUser?.id]);
}
