import { initializeApp, deleteApp, getApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const firestore = getFirestore(app);

export const normalizePhone = (phone: string) => {
  // Remove all non-digits
  let digits = phone.replace(/\D/g, '');
  // Standardize Ethiopian numbers: if starts with 09 or 07, prepend 251 (and remove leading 0)
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '251' + digits.substring(1);
  }
  // If it's a 9-digit number starting with 9 or 7, prepend 251
  if (digits.length === 9 && (digits.startsWith('9') || digits.startsWith('7'))) {
    digits = '251' + digits;
  }
  return digits;
};

export const formatPhoneToEmail = (phone: string) => {
  const cleanPhone = normalizePhone(phone);
  return `${cleanPhone}@hullee.app`; // Use a consistent domain
};

/**
 * Creates a new Firebase Auth user using a secondary app instance.
 * This prevents the current admin user from being signed out.
 */
export const createSecondaryAuthUser = async (phone: string, password: string) => {
  let secondaryApp;
  try {
    const existingApp = getApp('SecondaryApp');
    if (existingApp) {
      await deleteApp(existingApp);
    }
  } catch (e) {
    // Expected if SecondaryApp does not exist
  }

  secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
  const secondaryAuth = getAuth(secondaryApp);
  const email = formatPhoneToEmail(phone);
  
  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const uid = userCredential.user.uid;
    // Sign out of the secondary instance immediately
    await secondaryAuth.signOut();
    // Delete the secondary app instance to clean up
    await deleteApp(secondaryApp);
    return uid;
  } catch (error) {
    // Attempt to cleanup even on failure
    try { await deleteApp(secondaryApp); } catch (e) {}
    throw error;
  }
};
