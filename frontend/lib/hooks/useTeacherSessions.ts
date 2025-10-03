'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Timestamp,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type QuerySnapshot
} from 'firebase/firestore';
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase';

type SessionStatus = 'scheduled' | 'active' | 'completed';
type AttendanceStatus = 'present' | 'flagged' | 'late';

export interface SessionLocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  capturedAt?: string;
}

export interface SessionAttendee {
  id: string;
  name: string;
  status: AttendanceStatus;
  scannedAt?: string;
  proximityMeters?: number;
}

export interface AttendanceSession {
  id: string;
  className: string;
  subject: string;
  scheduledFor: string;
  location: string;
  locationCoordinates?: SessionLocationCoordinates;
  status: SessionStatus;
  qrCodeData?: string;
  sessionToken?: string;
  expectedAttendance: number;
  attendees: SessionAttendee[];
  createdAt: string;
}

interface SessionsMetrics {
  upcomingCount: number;
  averageAttendanceRate: number;
  activeSession?: AttendanceSession;
}

const mockSessions: AttendanceSession[] = [
  {
    id: 'mock-1',
    className: 'Grade 10 — Section A',
    subject: 'Mathematics',
    scheduledFor: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
    location: '12.9721, 77.5933',
    locationCoordinates: {
      latitude: 12.9721,
      longitude: 77.5933,
      accuracy: 12,
      capturedAt: new Date().toISOString()
    },
    status: 'scheduled',
    qrCodeData: 'mock-session-1',
    sessionToken: 'mock-token-1',
    expectedAttendance: 32,
    attendees: [
      {
        id: 's1',
        name: 'Riya Sharma',
        status: 'present',
        scannedAt: new Date().toISOString(),
        proximityMeters: 3
      },
      {
        id: 's2',
        name: 'Arjun Patel',
        status: 'flagged',
        scannedAt: new Date().toISOString(),
        proximityMeters: 28
      }
    ],
    createdAt: new Date().toISOString()
  },
  {
    id: 'mock-2',
    className: 'Grade 12 — Section C',
    subject: 'Physics Lab',
    scheduledFor: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    location: '12.9344, 77.6107',
    locationCoordinates: {
      latitude: 12.9344,
      longitude: 77.6107,
      accuracy: 18,
      capturedAt: new Date().toISOString()
    },
    status: 'active',
    qrCodeData: 'mock-session-2',
    sessionToken: 'mock-token-2',
    expectedAttendance: 28,
    attendees: [
      {
        id: 's3',
        name: 'Devika Iyer',
        status: 'present',
        scannedAt: new Date().toISOString(),
        proximityMeters: 6
      },
      {
        id: 's4',
        name: 'Kunal Singh',
        status: 'late',
        scannedAt: new Date().toISOString(),
        proximityMeters: 5
      }
    ],
    createdAt: new Date().toISOString()
  }
];

function transformSnapshot(snapshot: QuerySnapshot<Record<string, unknown>>) {
  return snapshot.docs.map((doc) => {
    const data = doc.data() ?? {};
    const attendees = Array.isArray(data.attendees)
      ? data.attendees.map((attendeeRaw: unknown) => {
          const attendee = attendeeRaw as Record<string, unknown>;
          const scannedAtValue = attendee.scannedAt as unknown;
          const proximityValue = attendee.proximityMeters as unknown;

          const scannedAt =
            scannedAtValue instanceof Timestamp
              ? scannedAtValue.toDate().toISOString()
              : typeof scannedAtValue === 'string'
                ? scannedAtValue
                : undefined;

          const proximityMeters =
            typeof proximityValue === 'number'
              ? proximityValue
              : Number.isFinite(Number(proximityValue))
                ? Number(proximityValue)
                : undefined;

          return {
            id: String(attendee.id ?? ''),
            name: String(attendee.name ?? 'Unknown'),
            status: (attendee.status as AttendanceStatus) ?? 'present',
            scannedAt,
            proximityMeters
          } satisfies SessionAttendee;
        })
      : [];

    const locationCoordinatesRaw = data.locationCoordinates as Record<string, unknown> | undefined;

    let locationCoordinates: SessionLocationCoordinates | undefined;
    if (locationCoordinatesRaw && typeof locationCoordinatesRaw === 'object') {
      const latitude = Number(locationCoordinatesRaw.latitude);
      const longitude = Number(locationCoordinatesRaw.longitude);

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        locationCoordinates = {
          latitude,
          longitude,
          accuracy: Number.isFinite(Number(locationCoordinatesRaw.accuracy))
            ? Number(locationCoordinatesRaw.accuracy)
            : undefined,
          capturedAt:
            locationCoordinatesRaw.capturedAt instanceof Timestamp
              ? locationCoordinatesRaw.capturedAt.toDate().toISOString()
              : typeof locationCoordinatesRaw.capturedAt === 'string'
                ? locationCoordinatesRaw.capturedAt
                : undefined
        };
      }
    }

    return {
      id: doc.id,
      className: String(data.className ?? 'Untitled Class'),
      subject: String(data.subject ?? 'Subject'),
      scheduledFor:
        data.scheduledFor instanceof Timestamp
          ? data.scheduledFor.toDate().toISOString()
          : String(data.scheduledFor ?? new Date().toISOString()),
      location:
        typeof data.location === 'string'
          ? data.location
          : locationCoordinates
            ? `${locationCoordinates.latitude.toFixed(5)}, ${locationCoordinates.longitude.toFixed(5)}`
            : 'Campus',
      locationCoordinates,
    status: (data.status as SessionStatus) ?? 'scheduled',
    qrCodeData: typeof data.qrCodeData === 'string' ? data.qrCodeData : undefined,
    sessionToken: typeof data.sessionToken === 'string' ? data.sessionToken : undefined,
      expectedAttendance:
        typeof data.expectedAttendance === 'number'
          ? data.expectedAttendance
          : parseInt(String(data.expectedAttendance ?? attendees.length), 10),
      attendees,
      createdAt:
        data.createdAt instanceof Timestamp
          ? data.createdAt.toDate().toISOString()
          : String(data.createdAt ?? new Date().toISOString())
    } satisfies AttendanceSession;
  });
}

function calculateMetrics(sessions: AttendanceSession[]): SessionsMetrics {
  const upcomingCount = sessions.filter((session) => {
    const scheduled = new Date(session.scheduledFor).getTime();
    return scheduled > Date.now() && session.status !== 'completed';
  }).length;

  const rates = sessions
    .filter((session) => session.expectedAttendance > 0)
    .map((session) => session.attendees.filter((a) => a.status === 'present').length / session.expectedAttendance);

  const averageAttendanceRate = rates.length
    ? Math.round((rates.reduce((sum, rate) => sum + rate, 0) / rates.length) * 100)
    : 0;

  const activeSession = sessions.find((session) => session.status === 'active');

  return {
    upcomingCount,
    averageAttendanceRate,
    activeSession
  };
}

export function useTeacherSessions(teacherId?: string) {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teacherId || !isFirebaseConfigured) {
      setSessions(mockSessions);
      setLoading(false);
      return () => undefined;
    }

    const q = query(
      collection(getFirestoreDb(), `teachers/${teacherId}/sessions`),
      orderBy('scheduledFor', 'desc'),
      limit(15)
    );

    const unsubscribe = onSnapshot(q, (snapshot: QuerySnapshot<Record<string, unknown>>) => {
      setSessions(transformSnapshot(snapshot));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [teacherId]);

  const metrics = useMemo(() => calculateMetrics(sessions), [sessions]);

  return {
    sessions,
    loading,
    metrics
  };
}
