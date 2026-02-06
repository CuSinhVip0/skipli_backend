const express = require('express');
const http = require('http');
const cors = require('cors');
require('dotenv').config();
const { initfirebase } = require('./config/firebase');
const { initTwilio } = require('./config/twilio');
const authRoutes = require('./routes/auth');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// config service 
initfirebase();
initTwilio();

//Authentication Routes
app.use('/', authRoutes);

app.get('/status', (req, res) => {
    res.json({
        status: 'Running',
        timestamp: new Date().toISOString()
    });
});


const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));