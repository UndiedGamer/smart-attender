'use client';

import { useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { getFirestoreDb, isFirebaseConfigured } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import type { AttendanceSession } from '@/lib/hooks/useTeacherSessions';

interface SessionCreatorState {
  className: string;
  subject: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  location: string;
  expectedAttendance: number;
}

const initialState: SessionCreatorState = {
  className: '',
  subject: '',
  date: new Date().toISOString().split('T')[0],
  startTime: format(new Date(), 'HH:mm'),
  durationMinutes: 45,
  location: 'Room 101',
  expectedAttendance: 30
};

interface SessionCreatorProps {
  onSessionCreated?: (session: AttendanceSession) => void;
}

export function SessionCreator({ onSessionCreated }: SessionCreatorProps) {
  const { user } = useAuth();
  const [formState, setFormState] = useState<SessionCreatorState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [qrPreview, setQrPreview] = useState<string | null>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
  setFormState((prev: SessionCreatorState) => ({
      ...prev,
      [name]: name === 'durationMinutes' || name === 'expectedAttendance' ? Number(value) : value
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const scheduledTimestamp = new Date(`${formState.date}T${formState.startTime}:00`);
      const sessionPayload = {
        className: formState.className,
        subject: formState.subject,
        scheduledFor: scheduledTimestamp.toISOString(),
        location: formState.location,
        durationMinutes: formState.durationMinutes,
        status: 'scheduled',
        expectedAttendance: formState.expectedAttendance,
        attendees: [],
        createdAt: serverTimestamp()
      };

      const qrData = JSON.stringify({
        className: sessionPayload.className,
        subject: sessionPayload.subject,
        scheduledFor: sessionPayload.scheduledFor,
        teacherId: user?.uid ?? 'demo-teacher',
        durationMinutes: sessionPayload.durationMinutes
      });

      const qrSvg = await QRCode.toDataURL(qrData, { width: 320 });
      setQrPreview(qrSvg);

      if (user && isFirebaseConfigured) {
        await addDoc(collection(getFirestoreDb(), `teachers/${user.uid}/sessions`), {
          ...sessionPayload,
          qrCodeData: qrData
        });
      }

      toast.success('Session prepared! Share the QR with your class.');
      onSessionCreated?.({
        id: crypto.randomUUID(),
        className: sessionPayload.className,
        subject: sessionPayload.subject,
        scheduledFor: sessionPayload.scheduledFor,
        location: sessionPayload.location,
        status: 'scheduled',
        qrCodeData: qrData,
        expectedAttendance: sessionPayload.expectedAttendance,
        attendees: [],
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error(error);
      toast.error('Unable to create session. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Launch a new session</h3>
            <p className="text-sm text-slate-500">Generate a QR code tied to this class to start marking attendance.</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Class name</span>
            <input
              name="className"
              value={formState.className}
              onChange={handleChange}
              required
              placeholder="Grade 10 — Section A"
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Subject</span>
            <input
              name="subject"
              value={formState.subject}
              onChange={handleChange}
              required
              placeholder="Mathematics"
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Date</span>
            <input
              type="date"
              name="date"
              value={formState.date}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Start time</span>
            <input
              type="time"
              name="startTime"
              value={formState.startTime}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Duration (minutes)</span>
            <input
              type="number"
              min={10}
              max={180}
              step={5}
              name="durationMinutes"
              value={formState.durationMinutes}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">Expected students</span>
            <input
              type="number"
              min={1}
              max={120}
              name="expectedAttendance"
              value={formState.expectedAttendance}
              onChange={handleChange}
              required
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>
          <label className="md:col-span-2 space-y-2">
            <span className="text-sm font-medium text-slate-700">Location</span>
            <input
              name="location"
              value={formState.location}
              onChange={handleChange}
              required
              placeholder="Main Building — Room 204"
              className="w-full rounded-lg border border-slate-200 px-4 py-3 text-slate-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-sm text-slate-500">
            You can preview the QR code instantly. If Firebase is configured, the session will be saved to Firestore automatically.
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-3 text-sm font-semibold text-white shadow hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-primary-400"
          >
            {isSubmitting ? 'Generating…' : 'Generate QR'}
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-dashed border-primary-200 bg-white p-6 text-center shadow-sm">
        <h4 className="text-lg font-semibold text-slate-900">QR preview</h4>
        <p className="mt-2 text-sm text-slate-500">Display this on the classroom screen for students to scan.</p>
        <div className="mt-6 flex items-center justify-center">
          {qrPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrPreview} alt="Generated session QR code" className="h-56 w-56 rounded-xl border border-slate-200 bg-white p-4 shadow" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-xl border border-slate-200 bg-slate-50">
              <span className="text-xs uppercase tracking-wide text-slate-400">Waiting for session details</span>
            </div>
          )}
        </div>
        {qrPreview ? (
          <p className="mt-4 text-xs text-slate-500">
            Tip: Save this QR code and project it when class begins. Students will still need to verify face & proximity.
          </p>
        ) : null}
      </div>
    </div>
  );
}
