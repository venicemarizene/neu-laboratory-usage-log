# **App Name**: NEU Lab Log

## Core Features:

- Secure Google-based Login: Implement Firebase Authentication allowing only institutional Google accounts, including domain restriction and a 'blocked' user status check.
- User Profile & Role Management: Define and manage user profiles in Firestore (UID, Name, Email, Role, Blocked status, QR_String), supporting 'Professor' and 'Admin' roles.
- Role-Based Access Control: Implement logic to redirect users to appropriate dashboards ('Professor' or 'Admin') based on their assigned role after login. A distinct option for Admin login will be available before general login.
- QR Code Scanning & User Validation: Utilize the device camera to scan QR Codes. The app will then look up the 'QR_String' in the Firestore 'Users' collection and perform a 'Blocked' status check to prevent access.
- Room Usage Logging to Firestore: Upon successful QR code scan and validation, create a new record in the 'Room_Logs' collection containing: Professor_Name, Room_Number, Timestamp, and Status (Active). A success message, 'Thank you for using room [Room_Number].', will be triggered.
- Admin Usage Dashboard: Provide an administrative interface to view, filter, and monitor real-time and historical laboratory usage logs and user status. Includes Card Statistics displaying 'Total Room Uses today', 'Total Unique Professors', and 'Number of Blocked Users'. Features a Search and Filterable Table for 'Room_Logs' allowing filtering by Professor Name and custom Date Ranges (Daily, Weekly, Monthly).
- Professor Management View: Allow Admins to view a list of all Professors and toggle a 'Blocked' boolean field in their Firestore document to revoke or grant access.
- Firestore Security Rules for Room Logs: Implement Firebase Security Rules to ensure that only users with the 'Admin' role can read the 'Room_Logs' collection.
- AI-Powered Usage Report Tool: A generative AI tool for administrators to summarize weekly lab usage data, highlighting trends and potential anomalies for review.

## Style Guidelines:

- Primary color: A professional, deep institutional blue (#1A4CBB), chosen for clarity and reliability, creating strong contrast on light backgrounds.
- Background color: A very light desaturated blue-grey (#EBF0F8) provides a clean and expansive canvas, visibly derived from the primary hue but much brighter.
- Accent color: A vibrant yet analogous cyan (#4FBFDA) to draw attention to interactive elements and calls to action, ensuring distinctiveness from the primary color.
- Body and headline font: 'Inter' (sans-serif) for a modern, objective, and highly legible experience across all text elements.
- Use a set of clean, minimalist line-based icons that convey functionality directly and without unnecessary visual noise, ensuring coherence with the app's professional tone.
- Adopt a clean, card-based layout with clear spatial hierarchies to make information digestible, ensuring responsiveness across desktop and mobile devices for optimal user experience.
- Incorporate subtle, functional animations and transitions, such as smooth fades or gentle shifts on interactive elements, to enhance usability without distraction.