const express = require('express');
const http = require('http');
const cors = require('cors');
require('dotenv').config();
const { initfirebase } = require('./config/firebase');
const { initTwilio } = require('./config/twilio');
const { initEmail } = require('./config/email');
const authRoutes = require('./routes/auth');
const instructorRoutes = require('./routes/instructor');
const studentRoutes = require('./routes/student');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const server = http.createServer(app);

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://yourdomain.com']
        : ['http://localhost:3000', 'http://localhost:5173', "http://localhost:3001"], // Thêm port của admin app
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// config service 
initfirebase();
initTwilio();
initEmail();

//Authentication Routes
app.use('/', authRoutes);
app.use('/', instructorRoutes);
app.use('/', studentRoutes);

app.get('/status', (req, res) => {
    res.json({
        status: 'Running',
        timestamp: new Date().toISOString()
    });
});
app.use(errorHandler);
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));