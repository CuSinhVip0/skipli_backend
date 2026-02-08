require('dotenv').config();
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');
const { initfirebase } = require('./config/firebase');
const { initTwilio } = require('./config/twilio');
const { initEmail } = require('./config/email');
const authRoutes = require('./routes/auth');
const instructorRoutes = require('./routes/instructor');
const studentRoutes = require('./routes/student');
const errorHandler = require('./middleware/errorHandler');
const setupSocket = require('./socket');
const chatRoutes = require('./routes/chat');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

app.use(cors({
    origin: ['http://localhost:3000', "http://localhost:3001"],
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
app.use('/', instructorRoutes);
app.use('/', studentRoutes);
app.use('/', authRoutes);
app.use('/', chatRoutes);

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

// Setup Socket.io
setupSocket(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));