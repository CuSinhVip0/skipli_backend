# SKIPLI - Backend API

Phần Backend API

## 📁 Cấu trúc thư mục

```
backend/
├── index.js                          # Entry point của ứng dụng
├── socket.js                         # Cấu hình Socket.IO
├── package.json                      # Dependencies và scripts
├── firebase-service-account.json     # Firebase credentials
├── config/                           # Cấu hình
│   ├── firebase.js                   # Khởi tạo Firebase Admin
│   ├── email.js                      # Cấu hình Nodemailer
│   └── twilio.js                     # Cấu hình Twilio
├── middleware/                       # Middleware
│   ├── auth.js                       # Xác thực JWT
│   └── errorHandler.js               # Xử lý lỗi
└── routes/                           # API Routes
    ├── auth.js                       # Authentication routes
    ├── instructor.js                 # Instructor routes
    ├── student.js                    # Student routes
    └── chat.js                       # Chat routes
```

## 🔧 Cài đặt

### 1. Cài đặt dependencies

```bash
npm install
```

### 2. Cấu hình biến môi trường

Tạo file `.env` trong thư mục `backend/` với nội dung:

```env
# Server
PORT=5000

# JWT
JWT_SECRET=your_jwt_secret_key_here

# Firebase
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY=your_firebase_private_key
FIREBASE_CLIENT_EMAIL=your_firebase_client_email

# Email (Nodemailer)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_app_password

# Twilio
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Client URL
CLIENT_URL=http://localhost:3000
```

### 3. Cấu hình Firebase

- Tải file service account từ Firebase Console
- Đổi tên thành `firebase-service-account.json`
- Đặt file vào thư mục `backend/`

## 🚀 Chạy ứng dụng

### Chế độ development (với nodemon)

```bash
npm run dev
```

Server sẽ chạy tại `http://localhost:5000`
