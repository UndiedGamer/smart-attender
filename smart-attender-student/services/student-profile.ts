import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase';
import { isMockStudent, type MockStudentUser } from '@/services/mock-student';

type AllowedUser = User | MockStudentUser;

export interface StudentProfile {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  enrolledClasses: string[];
  createdAt?: string;
  updatedAt?: string;
}

export async function ensureStudentProfile(user: AllowedUser | null | undefined): Promise<void> {
  if (!user || isMockStudent(user) || !isFirebaseConfigured) {
    return;
  }

  const db = getFirestoreDb();
  const profileRef = doc(db, 'students', user.uid);
  const snapshot = await getDoc(profileRef);

  if (!snapshot.exists()) {
    await setDoc(profileRef, {
      displayName: user.displayName ?? null,
      email: user.email ?? null,
      photoURL: user.photoURL ?? null,
      enrolledClasses: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    } satisfies StudentProfile);
  } else {
    await updateDoc(profileRef, {
      displayName: user.displayName ?? snapshot.data()?.displayName ?? null,
      photoURL: user.photoURL ?? snapshot.data()?.photoURL ?? null,
      updatedAt: serverTimestamp()
    });
  }
}
