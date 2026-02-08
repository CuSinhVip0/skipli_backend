const express = require('express');
const router = express.Router();
const { getDb } = require('../config/firebase');
const { sendEmail, sendEmailCreateStudent } = require('../config/email');

const uuidv4 = require('uuid').v4;

/**
 * POST /addStudent
 * Params: name, phone, email
 * Action: Add new student to Firebase
 */
router.post('/addStudent', async (req, res) => {
    try {
        const { name, phone, email } = req.body;

        if (!name || !phone || !email) {
            return res.status(400).json({ error: 'Name, phone, email are required' });
        }

        const db = getDb();

        const phoneQuery = db.collection('users')
            .where('phone', '==', phone)
            .limit(1)
            .get();

        const emailQuery = db.collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();

        const [phoneSnap, emailSnap] = await Promise.all([phoneQuery, emailQuery]);
        if (!phoneSnap.empty) {
            return res.status(404).json({ error: 'Phone number already exists' });
        } else if (!emailSnap.empty) {
            return res.status(404).json({ error: 'Email already exists' });
        }

        const studentData = {
            id: uuidv4(),
            name,
            phone,
            email,
            createdAt: new Date().toISOString(),
            role: 'student',
            isActive: true,
        };

        //add student
        await db.collection('users').doc(phone).set(studentData);

        // Send mail
        try {
            await sendEmailCreateStudent(
                email,
                `Welcome to Classroom Skipli`, `${name}! Your account has been successfully created.`
            );

        } catch (error) {
        }
        res.json({
            success: true,
            message: 'Student added successfully',
            student: studentData
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to add student', details: error.message });
    }
});

/**
 * GET /students
 * Return list of all students with basic info
 */
router.get('/students', async (req, res) => {
    try {
        const db = getDb();
        const studentsFB = await db.collection('users').where('role', '==', 'student').get();
        const students = [];
        studentsFB.forEach(doc => {
            const data = doc.data();
            students.push({
                id: data.id,
                phone: data.phone,
                name: data.name,
                email: data.email,
                createdAt: data.createdAt,
                isActive: data.isActive,
            });
        });

        res.json({
            success: true,
            students,
            count: students.length
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get students', details: error.message });
    }
});

/**
 * PUT / editStudentsssssss
 * Update student data
 */
router.put('/editStudent/:phone', async (req, res) => {
    try {
        const phone = req.params.phone;
        const { name, email } = req.body;
        const db = getDb();
        const studentFB = db.collection('users').doc(phone);
        const studentDoc = await studentFB.get();

        if (!studentDoc.exists) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const emailQuery = await db.collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();

        if (!emailQuery.empty) {
            return res.status(404).json({ error: 'Email is exists' });
        }

        // begin update
        const updateData = {
            updatedAt: new Date().toISOString()
        };

        if (name) updateData.name = name;
        if (email) updateData.email = email;

        await studentFB.update(updateData);
        const updatedDoc = await studentFB.get();

        res.json({
            success: true,
            message: 'Student updated successfully',
            student: {
                ...updatedDoc.data()
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update student', details: error.message });
    }
});


/**
 * PUT / editStatusStudent
 * Update student data
 */
router.put('/editStatusStudent/:phone', async (req, res) => {
    try {
        const phone = req.params.phone;
        const { id, isActive } = req.body;
        const db = getDb();
        const studentFB = db.collection('users').doc(phone);
        const studentDoc = await studentFB.get();

        if (!studentDoc.exists) {
            return res.status(404).json({ error: 'Student not found' });
        }
        // begin update
        const updateData = {
            updatedAt: new Date().toISOString()
        };

        if (typeof isActive === 'boolean') updateData.isActive = isActive;

        await studentFB.update(updateData);
        const updatedDoc = await studentFB.get();

        res.json({
            success: true,
            message: 'Student updated successfully',
            student: {
                ...updatedDoc.data()
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update student', details: error.message });
    }
});

/**
 * DELETE /student
 * Remove student from Firebase
 */
router.delete('/student/:phone', async (req, res) => {
    try {
        const { phone } = req.params;
        const db = getDb();
        const studentFB = db.collection('users').doc(phone);
        const studentDoc = await studentFB.get();

        if (!studentDoc.exists) {
            return res.status(404).json({ error: 'Student not found' });
        }

        await studentFB.delete();

        res.json({
            success: true,
            message: 'Student deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete student', details: error.message });
    }
});

module.exports = router;
