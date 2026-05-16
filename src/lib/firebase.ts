import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '@/src/firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);

export const formatPhoneToEmail = (phone: string) => {
  // Remove any non-alphanumeric characters and append dummy domain
  const cleanPhone = phone.replace(/[^a-zA-Z0-9]/g, '');
  return `${cleanPhone}@hullee.local`;
};
