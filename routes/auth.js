const express = require('express');
const router = express.Router();
const { getDb } = require('../config/firebase');
const { sendSMS } = require('../config/twilio');
const { sendEmail } = require('../config/email');
const { authenticateToken } = require('../middleware/auth');
const otpGenerator = require('otp-generator')
const jwt = require('jsonwebtoken');

const expiresMinute = 15;
/**
 * POST /createAccessCode
 * Params: phoneNumber
 * Action: Generate 6-digit code, store in Firebase, send via Twilio
 */
router.post('/createAccessCode', async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // chek user instructor
        const db = getDb();

        const usersDoc = await db.collection('users')
            .where('phone', '==', phoneNumber)
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (usersDoc.empty) {
            return res.status(404).json({ error: 'Phone number not found' });
        }

        const accessCode = otpGenerator.generate(6, { lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });

        // access code in Firebase
        await db.collection('access_code').doc(phoneNumber).set({
            code: accessCode,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + expiresMinute * 60 * 1000).toISOString()
        });

        // send sms 
        const smsResult = await sendSMS(
            phoneNumber,
            `Your access code is: ${accessCode}. Valid for ${expiresMinute} minutes.`
        );

        if (smsResult.success) {
            res.json({
                success: true,
                message: 'Access code sent success',
            });
        } else {
            res.json({
                success: false,
                message: 'Access code saved but sms failed send',
            });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to create access code', details: error.message });
    }
});

/**
 * POST /validateAccessCode
 * Params: phoneNumber, accessCode\
 * Action: Match code in Firebase, clear code on success, return user type (instructor or student)
 */
router.post('/validateAccessCode', async (req, res) => {
    try {
        const { phoneNumber, accessCode } = req.body;

        if (!phoneNumber || !accessCode) {
            return res.status(400).json({ error: 'Phone number and access code are required' });
        }

        const db = getDb();

        // get access code
        const codeDoc = await db.collection('access_code').doc(phoneNumber).get();

        if (!codeDoc.exists) {
            return res.status(401).json({ error: 'Invalid access code' });
        }

        const codeData = codeDoc.data();

        // check valid 
        if (codeData.code !== accessCode) {
            return res.status(401).json({ error: 'Invalid access code' });
        }

        // check expired
        if (new Date() > new Date(codeData.expiresAt)) {
            await db.collection('access_code').doc(phoneNumber).delete();
            return res.status(401).json({ error: 'Access code has expired' });
        }
        // chek user instructor
        const usersDoc = await db.collection('users')
            .where('phone', '==', phoneNumber)
            .where('isActive', '==', true)
            .limit(1)
            .get();
        if (usersDoc.empty) {
            return res.status(404).json({ error: 'Instructor not found' });
        }
        const data = usersDoc.docs[0].data();
        // remvove access code
        await db.collection('access_code').doc(phoneNumber).delete();

        // Generate JWT
        const token = jwt.sign(
            data,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        // Generate refresh token
        const refreshToken = jwt.sign(
            data,
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '1d' }
        );
        return res.json({
            success: true,
            userType: 'instructor',
            userData: data,
            access: token,
            refresh: refreshToken,
        })
    } catch (error) {
        res.status(500).json({ error: 'Failed to validate access code', details: error.message });
    }
});


/**
 * (POST) LoginEmail
 * Parameters: email
 * Return: a random 6-digit access code
 * Other requirement: save this access code to the code in the database and send code to email
 */
router.post('/loginEmail', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }
        const db = getDb();
        // chek user student
        const usersDoc = await db.collection('users')
            .where('email', '==', email.toLowerCase())
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (usersDoc.empty) {
            return res.status(404).json({ error: 'Email not found' });
        }

        const accessCode = otpGenerator.generate(6, { lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });

        // access code fribase
        await db.collection('email_access_code').doc(email.toLowerCase()).set({
            code: accessCode,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + expiresMinute * 60 * 1000).toISOString()
        });

        // Send mail
        const emailResult = await sendEmail(
            email,
            'Access Code for Classroom Skipli',
            `Your access code is: ${accessCode}. Valid for ${expiresMinute} minutes.`
        );

        if (emailResult.success) {
            res.json({
                success: true,
                message: 'Access code sent to your email',
            });
        } else {
            res.json({
                success: false,
                message: 'Access code saved but email failed to send',
            });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to send access code', details: error.message });
    }
});


/**
 * (POST) ValidateAccessCode
 * Parameters: accessCode, email
 * Return: { success: true }
 * Other requirement: set the access code to empty string once validation is complete
 */
router.post('/validateAccessCodeEmail', async (req, res) => {
    try {
        const { email, accessCode } = req.body;

        if (!email || !accessCode) {
            return res.status(400).json({ error: 'Email and access code are required' });
        }

        const db = getDb();

        // get access code
        const codeDoc = await db.collection('email_access_code').doc(email.toLowerCase()).get();

        if (!codeDoc.exists) {
            return res.status(401).json({ error: 'Invalid access code' });
        }

        const codeData = codeDoc.data();

        // check valid 
        if (codeData.code !== accessCode) {
            return res.status(401).json({ error: 'Invalid access code' });
        }

        // Check expire
        if (new Date() > new Date(codeData.expiresAt)) {
            await db.collection('email_access_code').doc(email.toLowerCase()).delete();
            return res.status(401).json({ error: 'Access code has expired' });
        }

        // Then check students
        const studentDoc = await db.collection('users')
            .where('email', '==', email.toLowerCase())
            .where('isActive', '==', true)
            .limit(1)
            .get();
        if (studentDoc.empty) {
            return res.status(404).json({ error: 'Student not found' });
        }
        // chek user instructor
        const data = studentDoc.docs[0].data();
        // remvove access code
        await db.collection('email_access_code').doc(email.toLowerCase()).update({
            code: '',
            validatedAt: new Date().toISOString()
        });

        // Generate JWT
        const token = jwt.sign(
            data,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );
        // Generate refresh token
        const refreshToken = jwt.sign(
            data,
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '1d' }
        );

        return res.json({
            success: true,
            userType: 'student',
            userData: data,
            access: token,
            refresh: refreshToken,
        })
    } catch (error) {
        res.status(500).json({ error: 'Failed to validate access code', details: error.message });
    }
});

// Refresh token
router.post('/refresh-token', async (req, res, next) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({ error: 'Refresh token required' });
        }
        let decoded;
        try {
            decoded = jwt.verify(
                refreshToken,
                process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
            );
        } catch (err) {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }
        const { phone } = decoded;
        const db = getDb();
        const userDC = await db.collection('users')
            .where('email', '==', phone)
            .where('isActive', '==', true)
            .limit(1)
            .get();
        if (userDC.empty) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }

        // Generate new access token
        const token = jwt.sign(
            userDC,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN }
        );

        return res.json({
            success: true,
            access: token,
        })
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res, next) => {
    try {
        const db = getDb();
        const userDC = await db.collection('users')
            .where('phone', '==', req.user.phone)
            .where('isActive', '==', true)
            .limit(1)
            .get();
        if (userDC.empty) {
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
        return res.json({
            success: true,
            userType: 'student',
            userData: userDC.docs[0].data(),
        })
    } catch (error) {
        next(error);
    }
});

module.exports = router;
