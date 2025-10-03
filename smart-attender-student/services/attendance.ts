import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type DocumentReference,
  type Transaction
} from 'firebase/firestore';
import { z } from 'zod';
import { format } from 'date-fns';
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase';
import { haversineDistanceMeters } from '@/lib/utils/geo';
import type { AttendanceStatus, AttendanceSession, SessionLocationCoordinates } from '@/lib/types/session';
import { isMockStudent, type MockStudentUser } from '@/services/mock-student';

const qrPayloadSchema = z.object({
  teacherId: z.string().min(1),
  className: z.string().min(1),
  subject: z.string().min(1),
  scheduledFor: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  locationCoordinates: z.object({
    latitude: z.number(),
    longitude: z.number(),
    accuracy: z.number().optional()
  })
});

export type ScannedSessionPayload = z.infer<typeof qrPayloadSchema>;

export interface ResolvedSession {
  payload: ScannedSessionPayload;
  session: AttendanceSession;
  sessionRef?: DocumentReference<DocumentData>;
  isMock: boolean;
}

export interface AttendanceCheckInput {
  student: { uid: string; displayName?: string | null; email?: string | null } | MockStudentUser;
  session: ResolvedSession;
  studentLocation: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  };
  faceVerificationEnabled?: boolean;
  faceVerified?: boolean;
}

export interface AttendanceCheckResult {
  status: AttendanceStatus;
  proximityMeters: number;
  message: string;
  notes: string[];
}

const DEFAULT_THRESHOLD_METERS = Number(process.env.EXPO_PUBLIC_PROXIMITY_THRESHOLD_METERS ?? 50);

export function parseQrPayload(rawValue: string): ScannedSessionPayload {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawValue);
  } catch (error) {
    throw new Error('Invalid QR code. Ensure you scanned a Smart Attender session.');
  }

  const result = qrPayloadSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('QR code contents are malformed. Please request a new code from your teacher.');
  }

  return result.data;
}

export async function resolveSessionFromPayload(payload: ScannedSessionPayload): Promise<ResolvedSession> {
  if (!isFirebaseConfigured) {
    return {
      payload,
      isMock: true,
      session: {
        id: 'mock-session',
        teacherId: payload.teacherId,
        className: payload.className,
        subject: payload.subject,
        scheduledFor: payload.scheduledFor,
        durationMinutes: payload.durationMinutes,
        location: `${payload.locationCoordinates.latitude.toFixed(5)}, ${payload.locationCoordinates.longitude.toFixed(5)}`,
        locationCoordinates: payload.locationCoordinates
      }
    };
  }

  const db = getFirestoreDb();
  const sessionsRef = collection(db, `teachers/${payload.teacherId}/sessions`);
  const sessionQuery = query(
    sessionsRef,
    where('scheduledFor', '==', payload.scheduledFor),
    where('className', '==', payload.className),
    limit(1)
  );

  const snapshot = await getDocs(sessionQuery);
  if (snapshot.empty) {
    throw new Error('Session not found. Ask your teacher to regenerate the QR code.');
  }

  const docSnapshot = snapshot.docs[0];
  const data = docSnapshot.data() as Record<string, unknown>;
  const locationCoordinatesRaw = data.locationCoordinates as Record<string, unknown> | undefined;

  const locationCoordinates: SessionLocationCoordinates | undefined = locationCoordinatesRaw
    ? {
        latitude: Number(locationCoordinatesRaw.latitude ?? payload.locationCoordinates.latitude),
        longitude: Number(locationCoordinatesRaw.longitude ?? payload.locationCoordinates.longitude),
        accuracy: typeof locationCoordinatesRaw.accuracy === 'number' ? locationCoordinatesRaw.accuracy : undefined,
        capturedAt:
          typeof locationCoordinatesRaw.capturedAt === 'string'
            ? locationCoordinatesRaw.capturedAt
            : undefined
      }
    : payload.locationCoordinates;

  const session: AttendanceSession = {
    id: docSnapshot.id,
    teacherId: payload.teacherId,
    className: String(data.className ?? payload.className),
    subject: String(data.subject ?? payload.subject),
    scheduledFor: typeof data.scheduledFor === 'string' ? data.scheduledFor : payload.scheduledFor,
    durationMinutes: Number(data.durationMinutes ?? payload.durationMinutes),
    location:
      typeof data.location === 'string'
        ? data.location
        : `${locationCoordinates.latitude.toFixed(5)}, ${locationCoordinates.longitude.toFixed(5)}`,
    locationCoordinates
  };

  return {
    payload,
    session,
    sessionRef: docSnapshot.ref,
    isMock: false
  };
}

export function computeProximity(
  studentLocation: { latitude: number; longitude: number },
  targetLocation?: SessionLocationCoordinates
): number {
  if (!targetLocation) {
    return Number.POSITIVE_INFINITY;
  }

  return haversineDistanceMeters(studentLocation, targetLocation);
}

export async function recordAttendance({
  student,
  session,
  studentLocation,
  faceVerificationEnabled,
  faceVerified = true
}: AttendanceCheckInput): Promise<AttendanceCheckResult> {
  const proximityMeters = computeProximity(studentLocation, session.session.locationCoordinates);
  const notes: string[] = [];
  const threshold = DEFAULT_THRESHOLD_METERS;

  let status: AttendanceStatus = 'present';

  if (faceVerificationEnabled && faceVerified === false) {
    status = 'flagged';
    notes.push('Face verification failed');
  }

  if (Number.isFinite(proximityMeters) && proximityMeters > threshold) {
    status = 'flagged';
    notes.push(`Distance exceeded ${threshold}m threshold`);
  }

  if (!isFirebaseConfigured || session.isMock || isMockStudent(student)) {
    notes.push('Attendance recorded locally (mock mode).');
    return {
      status,
      proximityMeters,
      message: status === 'present' ? 'Attendance recorded (demo).' : 'Attendance flagged (demo).',
      notes
    };
  }

  const db = getFirestoreDb();
  if (!session.sessionRef) {
    throw new Error('Session reference unavailable.');
  }

  await runTransaction(db, async (transaction: Transaction) => {
    const snapshot = await transaction.get(session.sessionRef!);
    if (!snapshot.exists()) {
      throw new Error('Session was removed before attendance could be recorded.');
    }

    const data = snapshot.data() as Record<string, unknown>;
    const attendees = Array.isArray(data.attendees) ? [...(data.attendees as Array<Record<string, unknown>>)] : [];

    const attendeeEntry = {
      id: student.uid,
      name: student.displayName ?? student.email ?? 'Student',
      status,
      proximityMeters,
      scannedAt: serverTimestamp()
    } satisfies Record<string, unknown>;

    const existingIndex = attendees.findIndex((attendee) => attendee?.id === student.uid);
    if (existingIndex >= 0) {
      attendees[existingIndex] = attendeeEntry;
    } else {
      attendees.push(attendeeEntry);
    }

    transaction.update(session.sessionRef!, {
      attendees
    });
  });

  const attendanceLog = {
    sessionId: session.session.id,
    className: session.session.className,
    subject: session.session.subject,
    teacherId: session.session.teacherId,
    status,
    proximityMeters,
    recordedAt: serverTimestamp(),
    recordedAtLabel: format(new Date(), 'PPpp'),
    latitude: studentLocation.latitude,
    longitude: studentLocation.longitude,
  ...(faceVerificationEnabled ? { faceVerified } : {}),
    notes
  } satisfies Record<string, unknown>;

  await addDoc(collection(db, 'students', student.uid, 'attendanceLogs'), attendanceLog);

  return {
    status,
    proximityMeters,
    message: status === 'present' ? 'You were marked present.' : 'Attendance flagged for review.',
    notes
  };
}
