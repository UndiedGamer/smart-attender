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