# 🏥 Accessible Hospital Appointment System 2026

A web-based hospital appointment system designed with **accessibility-first principles** to improve healthcare accessibility for **visually impaired individuals**, **older adults**, and users requiring additional support during the appointment process.

The project provides an intuitive and inclusive appointment experience through accessible interfaces, voice guidance, keyboard navigation, and location-based hospital recommendations.

---

## 🚀 Live Demo

### 🌐 Frontend (Vercel)

https://hastane-randevu-erisilebilirlik-projesi-2026-1wvk72arp.vercel.app

### ⚙️ Backend API (Render)

https://hospital-backend-gtgc.onrender.com

### 📚 API Documentation (Swagger)

https://hospital-backend-gtgc.onrender.com/docs

---

## 🎯 Project Goals

The primary goal of this project is to make healthcare appointment systems more accessible and user-friendly.

The application aims to:

* Improve accessibility for visually impaired users
* Simplify appointment booking for older adults
* Support screen readers and keyboard navigation
* Provide optional voice guidance throughout the appointment process
* Deliver an inclusive healthcare experience for everyone

---

## ✨ Features

### 👤 User Features

* User registration and login
* Secure authentication using JWT
* Hospital appointment booking
* Family physician appointment booking
* View active appointments
* View past appointments
* Cancel appointments
* Location-based nearby hospital recommendations
* Voice guidance support
* Accessible form validation and feedback

---

### 👨‍💼 Admin Features

* Dashboard with appointment statistics
* Hospital management
* Department management
* Doctor management
* Appointment slot management
* Appointment monitoring and control

---

## ♿ Accessibility Features

Accessibility is the core focus of this project.

Implemented accessibility features include:

* Full keyboard navigation support
* Screen reader compatibility
* Voice guidance using Web Speech API
* High contrast and large text support
* Visible focus indicators
* Accessible form validation messages
* Clear error announcements
* Mobile accessibility compatibility (TalkBack / VoiceOver)

The goal is **not to replace screen readers**, but to provide **task-focused guidance** that helps users complete healthcare-related tasks more easily.

---

## 🔒 Security Features

The application implements several security mechanisms:

* JWT-based Authentication
* Password hashing using bcrypt
* Role-based authorization (User/Admin)
* Protected API endpoints
* Secure session handling

---

## 🛠️ Technologies Used

### Frontend

* React
* Vite
* React Router
* Axios
* Web Speech API

### Backend

* FastAPI
* SQLAlchemy
* Pydantic
* Uvicorn

### Database

* Neon PostgreSQL

### Authentication & Security

* JWT
* bcrypt

### Deployment

* Frontend: Vercel
* Backend: Render

---

## 📋 Appointment Workflow

The hospital appointment process follows this structure:

```text
City
 ↓
District
 ↓
Department
 ↓
Hospital
 ↓
Doctor
 ↓
Available Slot
 ↓
Appointment Confirmation
```

Family physician appointments are managed separately.

---

## 📦 Installation

### Clone Repository

```bash
git clone https://github.com/Clumsy33-ES/Hastane-Randevu-Erisilebilirlik-Projesi-2026.git

cd Hastane-Randevu-Erisilebilirlik-Projesi-2026
```

---

### Backend Setup

```bash
cd backend

python -m venv .venv
```

Activate virtual environment:

Windows:

```bash
.venv\Scripts\activate
```

Mac/Linux:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run backend:

```bash
uvicorn app.main:app --reload
```

Backend will be available at:

```text
http://localhost:8000
```

Swagger documentation:

```text
http://localhost:8000/docs
```

---

### Frontend Setup

```bash
cd frontend

npm install
```

Create a `.env` file:

```env
VITE_API_URL=http://localhost:8000
```

Start development server:

```bash
npm run dev
```

Frontend will be available at:

```text
http://localhost:5173
```

---

## 🧪 Testing

The following functionalities have been tested successfully:

* User Registration
* User Login
* JWT Authentication
* Password Verification
* Hospital Appointment Booking
* Family Physician Appointment Booking
* Appointment Cancellation
* Appointment History
* Dashboard Statistics
* Admin Authorization
* Location-based Hospital Search
* Voice Guidance Features
* API Endpoints via Swagger

---

## 📱 Future Improvements

Planned future developments include:

* React Native + Expo mobile application
* Push notification reminders
* Enhanced voice guidance capabilities
* Multi-language support
* AI-assisted accessibility features
* Offline appointment support

---

## 👥 Target Users

This application was specifically designed for:

* Visually impaired individuals
* Older adults
* Users with accessibility needs
* People who need additional support while interacting with healthcare systems

The goal is to provide a **more inclusive and accessible healthcare experience**.

---

## 📄 License

This project was developed for educational and research purposes.

Feel free to use and improve the project for academic or accessibility-related initiatives.

---

## ❤️ Accessibility Matters

Healthcare is a fundamental right.

Technology should remove barriers, not create them.

This project was built with the belief that everyone deserves equal access to healthcare services, regardless of age or disability.
