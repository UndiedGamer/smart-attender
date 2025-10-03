export interface MockStudentUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  providerId: 'demo';
  isMockUser: true;
}

export function createMockStudent(email: string): MockStudentUser {
  return {
    uid: `mock-${Math.random().toString(36).slice(2, 10)}`,
    email,
    displayName: email ? email.split('@')[0] : 'Demo Student',
    photoURL: null,
    providerId: 'demo',
    isMockUser: true
  };
}

export function isMockStudent(user: unknown): user is MockStudentUser {
  return Boolean(user && typeof user === 'object' && 'isMockUser' in user);
}
