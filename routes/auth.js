const express = require('express');
const router = express.Router();
const { getDb } = require('../config/firebase');
const { sendSMS } = require('../config/twilio');
const { sendEmail } = require('../config/email');
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
            .where('role', '==', 'instructor')
            .limit(1)
            .get();
        if (usersDoc.empty) {
            return res.status(404).json({ error: 'Instructor not found' });
        }
        const data = usersDoc.docs[0].data();
        // remvove access code
        await db.collection('access_code').doc(phoneNumber).delete();

        return res.json({
            success: true,
            userType: 'instructor',
            userData: data
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
            .where('email', '==', email)
            .where('role', '==', 'student')
            .where('isActive', '==', true)
            .limit(1)
            .get();

        if (usersDoc.empty) {
            return res.status(404).json({ error: 'Email not found' });
        }

        const accessCode = otpGenerator.generate(6, { lowerCaseAlphabets: false, upperCaseAlphabets: false, specialChars: false });

        // access code fribase
        await db.collection('email_access_code').doc(email).set({
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
        const codeDoc = await db.collection('email_access_code').doc(email).get();

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
            await db.collection('email_access_code').doc(email).delete();
            return res.status(401).json({ error: 'Access code has expired' });
        }

        // Then check students
        const studentDoc = await db.collection('users')
            .where('email', '==', email)
            .where('role', '==', 'student')
            .where('isActive', '==', true)
            .limit(1)
            .get();
        if (studentDoc.empty) {
            return res.status(404).json({ error: 'Student not found' });
        }
        // chek user instructor
        const data = studentDoc.docs[0].data();
        // remvove access code
        await db.collection('email_access_code').doc(email).update({
            code: '',
            validatedAt: new Date().toISOString()
        });
        return res.json({
            success: true,
            userType: 'student',
            userData: data
        })
    } catch (error) {
        res.status(500).json({ error: 'Failed to validate access code', details: error.message });
    }
});


module.exports = router;
