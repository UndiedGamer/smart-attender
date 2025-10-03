import {
  addDoc,
  collection,
  doc,
  getDoc,
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
import type { DeviceRegistration } from '@/services/device-trust';
import type { StudentProfile } from '@/services/student-profile';

const qrPayloadSchema = z.object({
  sessionId: z.string().min(1),
  sessionToken: z.string().min(8),
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
  device: DeviceRegistration | null;
  profile: StudentProfile | null;
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
        id: payload.sessionId,
        teacherId: payload.teacherId,
        className: payload.className,
        subject: payload.subject,
        scheduledFor: payload.scheduledFor,
        durationMinutes: payload.durationMinutes,
        location: `${payload.locationCoordinates.latitude.toFixed(5)}, ${payload.locationCoordinates.longitude.toFixed(5)}`,
        locationCoordinates: payload.locationCoordinates,
        sessionToken: payload.sessionToken
      }
    };
  }

  const db = getFirestoreDb();
  const sessionsRef = collection(db, `teachers/${payload.teacherId}/sessions`);

  let resolvedRef: DocumentReference<DocumentData> | undefined;
  let data: Record<string, unknown> | null = null;

  if (payload.sessionId) {
    const directRef = doc(db, `teachers/${payload.teacherId}/sessions`, payload.sessionId);
    const directSnapshot = await getDoc(directRef);

    if (directSnapshot.exists()) {
      const directData = directSnapshot.data() as Record<string, unknown>;
      const storedToken = typeof directData.sessionToken === 'string' ? directData.sessionToken : null;

      if (storedToken && storedToken !== payload.sessionToken) {
        throw new Error('This session QR code has expired. Ask your teacher to refresh it and try again.');
      }

      resolvedRef = directSnapshot.ref;
      data = directData;
    }
  }

  if (!data) {
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
    const fallbackData = docSnapshot.data() as Record<string, unknown>;
    const storedToken = typeof fallbackData.sessionToken === 'string' ? fallbackData.sessionToken : null;

    if (storedToken && storedToken !== payload.sessionToken) {
      throw new Error('This session token does not match. Request a fresh QR code from your teacher.');
    }

    resolvedRef = docSnapshot.ref;
    data = fallbackData;
  }

  if (!resolvedRef || !data) {
    throw new Error('Unable to resolve session details. Please rescan the QR code.');
  }

  const locationCoordinatesRaw = data.locationCoordinates as Record<string, unknown> | undefined;

  const locationCoordinates: SessionLocationCoordinates | undefined = locationCoordinatesRaw
    ? {
        latitude: Number(locationCoordinatesRaw.latitude ?? payload.locationCoordinates.latitude),
        longitude: Number(locationCoordinatesRaw.longitude ?? payload.locationCoordinates.longitude),
        accuracy:
          typeof locationCoordinatesRaw.accuracy === 'number'
            ? locationCoordinatesRaw.accuracy
            : typeof payload.locationCoordinates.accuracy === 'number'
              ? payload.locationCoordinates.accuracy
              : undefined,
        capturedAt:
          typeof locationCoordinatesRaw.capturedAt === 'string'
            ? locationCoordinatesRaw.capturedAt
            : undefined
      }
    : payload.locationCoordinates;

  const session: AttendanceSession = {
    id: resolvedRef.id,
    teacherId: payload.teacherId,
    className: String(data.className ?? payload.className),
    subject: String(data.subject ?? payload.subject),
    scheduledFor: typeof data.scheduledFor === 'string' ? data.scheduledFor : payload.scheduledFor,
    durationMinutes: Number(data.durationMinutes ?? payload.durationMinutes),
    location:
      typeof data.location === 'string'
        ? data.location
        : `${locationCoordinates?.latitude?.toFixed(5) ?? payload.locationCoordinates.latitude.toFixed(5)}, ${
            locationCoordinates?.longitude?.toFixed(5) ?? payload.locationCoordinates.longitude.toFixed(5)
          }`,
    locationCoordinates,
    sessionToken: typeof data.sessionToken === 'string' ? data.sessionToken : payload.sessionToken
  };

  return {
    payload,
    session,
    sessionRef: resolvedRef,
    isMock: false
  };
}

export function computeProximity(
  studentLocation: { latitude: number; longitude: number; accuracy?: number | null },
  targetLocation?: SessionLocationCoordinates
): number {
  if (!targetLocation) {
    return Number.POSITIVE_INFINITY;
  }

  const rawDistance = haversineDistanceMeters(studentLocation, targetLocation);
  const studentAccuracy = Math.max(0, studentLocation.accuracy ?? 0);
  const targetAccuracy = Math.max(0, targetLocation.accuracy ?? 0);
  const combinedUncertainty = studentAccuracy + targetAccuracy;

  if (combinedUncertainty === 0) {
    return rawDistance;
  }

  return Math.max(0, rawDistance - combinedUncertainty);
}

export async function recordAttendance({
  student,
  session,
  studentLocation,
  device,
  profile
}: AttendanceCheckInput): Promise<AttendanceCheckResult> {
  if (!device) {
    throw new Error('This device is not registered. Refresh the device status and try again.');
  }

  if (device.approvalState !== 'approved') {
    throw new Error('This device has not been approved for attendance. Contact your administrator.');
  }

  const activeDeviceKey = profile?.activeDeviceKey;
  if (activeDeviceKey && activeDeviceKey !== device.deviceKey) {
    throw new Error('Another device is currently approved for this account. Switch back to the approved device.');
  }

  const proximityMeters = computeProximity(studentLocation, session.session.locationCoordinates);
  const notes: string[] = [];
  const threshold = DEFAULT_THRESHOLD_METERS;

  const accuracyMargin =
    Math.max(0, studentLocation.accuracy ?? 0) +
    Math.max(0, session.session.locationCoordinates?.accuracy ?? 0);

  if (accuracyMargin > 0) {
    notes.push(`Distance adjusted by ±${Math.round(accuracyMargin)}m for GPS accuracy.`);
  }

  let status: AttendanceStatus = 'present';

  if (Number.isFinite(proximityMeters) && proximityMeters > threshold) {
    status = 'flagged';
    notes.push(`Distance exceeded ${threshold}m threshold`);
  }

  notes.push(`Device key ${device.deviceKey}`);
  if (!device.isPhysicalDevice) {
    notes.push('Device reported as virtual.');
    status = 'flagged';
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
      scannedAt: serverTimestamp(),
      deviceKey: device.deviceKey,
      devicePlatform: device.platform,
      deviceModel: device.modelName
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
    deviceKey: device.deviceKey,
    devicePlatform: device.platform,
    deviceModel: device.modelName,
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
