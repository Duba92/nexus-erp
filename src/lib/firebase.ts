import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);

export const normalizePhone = (phone: string) => {
  // Remove all non-digits
  return phone.replace(/\D/g, '');
};

export const formatPhoneToEmail = (phone: string) => {
  const cleanPhone = normalizePhone(phone);
  return `${cleanPhone}@hullee.local`;
};
