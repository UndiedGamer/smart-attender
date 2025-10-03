# smart-attender
For this problem statement our aim is to integrate a smart attendance tracking system. The idea is as follows:
1. Teacher creates a qr link connected to the class name + subject name + date.
2. Student scans this from their phone and verifies their face. After their face scan is done, the system will calculate the proximity of teacher and student to decide whether the student gets the attendance or not.
3. During the free period, the system will suggest some tasks to the student based on their class and their learning capabilities.

## Core Flow of Attendance

Teacher initiates class → App generates a QR code tied to subject + time + location.
Student scans QR → App asks for face authentication.
GPS/Proximity check → Ensures student is within X meters of teacher’s registered location/device.
Backend validation → Marks attendance if all conditions are met.

## Technical Stack
* React-native for student and teacher app.
* NextJS for the teacher website.
* Firebase for teacher authentication + attendance saving + on-device ML model.
* React-native geolocation for the location barrier. openCV for face recognition.

## Teacher Web Portal (Next.js)

The `frontend/` directory contains the teacher-facing dashboard built with Next.js 14, Tailwind CSS, and Firebase. Key capabilities:

* **Firebase Auth** – email/password sign-in plus reset flow.
* **Session creator** – teachers generate QR-based attendance sessions that include auto-captured GPS coordinates for proximity checks.
* **Live overview** – dashboards for attendance metrics, activity feed, and personalized student task suggestions.

### Prerequisites

* [Bun](https://bun.sh) ≥ 1.2
* Node.js ≥ 18 (for tooling compatibility)

### Environment variables

Copy `.env.example` to `.env.local` inside the `frontend/` folder and fill in with your Firebase project details. The application no longer ships with default keys—every value must be supplied via environment variables.

> **Note:** The new Gemini-powered task generator requires a `GEMINI_API_KEY`. Create a key in Google AI Studio and add it to the `.env.local` file to enable live suggestions. Without it, the dashboard falls back to static tasks.

```bash
cp frontend/.env.example frontend/.env.local
```

### Install & run

```bash
cd frontend
bun install
bun run dev
```

Visit `http://localhost:3000` to sign in and explore the portal. The dashboard uses mock data until Firebase credentials are supplied.

### Firebase setup notes

* Update the Firebase Web App configuration in `frontend/lib/firebase.ts` or via env vars.
* The session creator stores GPS coordinates (lat/lng/accuracy) to enforce proximity verification downstream.
* Review the [security checklist](./SECURITY.md) for guidance on rotating Firebase keys and managing secrets safely.