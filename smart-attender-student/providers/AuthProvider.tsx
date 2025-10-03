import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import {
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase';
import { ensureStudentProfile } from '@/services/student-profile';
import { createMockStudent } from '@/services/mock-student';

export type AuthenticatedStudent = User | ReturnType<typeof createMockStudent>;

interface AuthContextValue {
  user: AuthenticatedStudent | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  isMock: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthenticatedStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMock, setIsMock] = useState(!isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setLoading(false);
      return () => undefined;
    }

    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), async (firebaseUser: User | null) => {
      setUser(firebaseUser);
      setLoading(false);

      if (firebaseUser) {
        try {
          await ensureStudentProfile(firebaseUser);
        } catch (profileError) {
          console.error('Failed to ensure student profile', profileError);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      if (!isFirebaseConfigured) {
        const mockUser = createMockStudent(email);
        setUser(mockUser);
        setIsMock(true);
        return;
      }

      const auth = getFirebaseAuth();
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      await ensureStudentProfile(credential.user);
      setUser(credential.user);
      setIsMock(false);
    } catch (err) {
      console.error(err);
      setError('Unable to sign in. Check your credentials and try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (!isFirebaseConfigured) {
        setUser(null);
        return;
      }

      await firebaseSignOut(getFirebaseAuth());
      setUser(null);
    } catch (err) {
      console.error(err);
      setError('Failed to sign out. Please try again.');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    setError(null);
    try {
      if (!isFirebaseConfigured) {
        return;
      }
      await sendPasswordResetEmail(getFirebaseAuth(), email.trim());
    } catch (err) {
      console.error(err);
      setError('Unable to send password reset email.');
      throw err;
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      error,
      signIn,
      signOut,
      requestPasswordReset,
      isMock
    }),
    [user, loading, error, signIn, signOut, requestPasswordReset, isMock]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
