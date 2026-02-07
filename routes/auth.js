const express = require('express');
const router = express.Router();
const { getDb } = require('../config/firebase');
const { sendSMS } = require('../config/twilio');
const otpGenerator = require('otp-generator')
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

        const db = getDb();
        // chek user instructor
        const usersDoc = await db.collection('users').doc(phoneNumber).get();
        if (!usersDoc.exists) {
            return res.status(404).json({ error: 'Phone number not found' });
        }

        const accessCode = otpGenerator.generate(6, { lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });

        // access code in Firebase
        await db.collection('access_code').doc(phoneNumber).set({
            code: accessCode,
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + expiresMinute * 60 * 1000).toISOString() // 15p
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

        // remvove access code
        await db.collection('access_code').doc(phoneNumber).delete();

        // chek user instructor
        const usersDoc = await db.collection('users').doc(phoneNumber).get();
        if (usersDoc.exists) {
            const data = usersDoc.data();
            if (data.role == 'instructor') {
                return res.json({
                    success: true,
                    userType: 'instructor',
                    userData: data
                })
            }
        }
        return res.status(404).json({ error: 'Instructor not found' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to validate access code', details: error.message });
    }
});


module.exports = router;
