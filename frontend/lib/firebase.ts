import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

const defaultFirebaseConfig = {
  apiKey: 'AIzaSyBGm9d3NrRyNbEf_r5uXl0fZzZs2LQbsWk',
  authDomain: 'smart-attender-fc154.firebaseapp.com',
  projectId: 'smart-attender-fc154',
  storageBucket: 'smart-attender-fc154.firebasestorage.app',
  messagingSenderId: '650205817613',
  appId: '1:650205817613:web:9a701b66adfebdd4e31e44',
  measurementId: 'G-51KGDTN2VW'
} as const;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? defaultFirebaseConfig.apiKey,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? defaultFirebaseConfig.authDomain,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? defaultFirebaseConfig.projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? defaultFirebaseConfig.storageBucket,
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? defaultFirebaseConfig.messagingSenderId,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? defaultFirebaseConfig.appId,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? defaultFirebaseConfig.measurementId
};

const requiredKeys = (Object.entries(firebaseConfig) as [keyof typeof firebaseConfig, string | undefined][]).filter(
  ([key]) => key !== 'measurementId'
);

export const isFirebaseConfigured = requiredKeys.every(([, value]) => Boolean(value));

let firebaseApp: FirebaseApp | undefined;

function ensureApp() {
  if (!isFirebaseConfigured) {
    throw new Error(
      'Firebase is not configured. Provide the NEXT_PUBLIC_FIREBASE_* variables in a .env.local file.'
    );
  }

  if (!firebaseApp) {
    firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig as Record<string, string>);
  }

  return firebaseApp;
}

export function getFirebaseAuth(): Auth {
  return getAuth(ensureApp());
}

export function getFirestoreDb(): Firestore {
  return getFirestore(ensureApp());
}
