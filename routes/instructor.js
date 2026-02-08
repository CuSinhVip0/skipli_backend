const express = require('express');
const router = express.Router();
const { getDb } = require('../config/firebase');
const { sendEmail, sendEmailCreateStudent } = require('../config/email');
const uuidv4 = require('uuid').v4;
const otpGenerator = require('otp-generator')

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
            .where('email', '==', email.toLowerCase())
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
            email: email.toLowerCase(),
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


/***
 * POST /assignLesson
 * Params: studentPhone, title, description
 * Action: Save under student’s lesson list
 */
router.post('/assignLesson', async (req, res) => {
    try {
        const { studentPhone, title, description } = req.body;
        if (!studentPhone || !title || !description) {
            return res.status(400).json({ error: 'Student phone, title, description are required' });
        }

        const db = getDb();

        const studentFB = await db.collection('users')
            .where('phone', 'in', studentPhone)
            .where('role', '==', 'student')
            .get();

        if (studentFB.empty) {
            return res.status(404).json({ error: 'No students found' });
        }

        const lessionID = otpGenerator.generate(8, { upperCaseAlphabets: false, specialChars: false });
        const lesson = {
            id: `${lessionID}`,
            title,
            description,
            assignedAt: new Date().toISOString(),
            completed: false,
            isActive: true,
        };

        await db.collection('lessons').doc(lessionID).set(lesson);

        studentFB.docs.forEach(async doc => {
            await db.collection('lesson_student').doc().set({
                studentPhone: doc.data().phone,
                lessonId: lessionID,
                assignedAt: new Date().toISOString(),
                completed: false
            });
        });

        res.json({
            success: true,
            message: 'Lesson assigned successfully',
            lesson
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to assign lesson', details: error.message });
    }
});

router.post('/updateLesson', async (req, res) => {
    try {
        const { studentPhone, title, description, id } = req.body;
        if (!Array.isArray(studentPhone) || !id) {
            return res.status(400).json({ error: 'Student phone, id are required' });
        }
        const db = getDb();

        const LessonFB = db.collection('lessons').doc(id)
        const LessonID = await LessonFB.get();
        if (!LessonID.exists) {
            return res.status(404).json({ error: 'Lesson not found' });
        }

        // begin update
        const updateData = {
            updatedAt: new Date().toISOString()
        };

        if (title) updateData.title = title;
        if (description) updateData.description = description;

        await LessonFB.update(updateData);

        const updatedDoc = await LessonFB.get();

        const studentPhoneFB = await db.collection('lesson_student')
            .where('studentPhone', 'in', studentPhone)
            .get();

        if (!studentPhoneFB.empty) {
            const batch = db.batch();
            studentPhoneFB.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        const insertBatch = db.batch();

        studentPhone.forEach(phone => {
            const ref = db.collection('lesson_student').doc();
            insertBatch.set(ref, {
                studentPhone: phone,
                lessonId: id,
                assignedAt: new Date().toISOString(),
                completed: false
            });
        });

        await insertBatch.commit();

        res.json({
            success: true,
            message: 'Lesson updated successfully',
            lesson: {
                ...updatedDoc.data()
            }
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to assign lesson', details: error.message });
    }
});

router.put('/editStatusLesson', async (req, res) => {
    try {
        const { id, isActive } = req.body;
        const db = getDb();
        const LessonFB = db.collection('lessons').doc(id)
        const LessonID = await LessonFB.get();
        if (!LessonID.exists) {
            return res.status(404).json({ error: 'Lesson not found' });
        }

        // begin update
        const updateData = {
            updatedAt: new Date().toISOString()
        };

        if (typeof isActive === 'boolean') updateData.isActive = isActive;

        await LessonFB.update(updateData);

        res.json({
            success: true,
            message: 'Lesson updated successfully',
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update student', details: error.message });
    }
});

router.delete('/lesson/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const db = getDb();
        const lessonFB = db.collection('lessons').doc(id);
        const lessonDoc = await lessonFB.get();

        if (!lessonDoc.exists) {
            return res.status(404).json({ error: 'Lesson not found' });
        }

        await lessonFB.delete();

        const lessonStudentFB = await db.collection('lesson_student')
            .where('lessonId', '==', id)
            .get();

        if (!lessonStudentFB.empty) {
            const batch = db.batch();
            lessonStudentFB.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
        res.json({
            success: true,
            message: 'Lesson deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete lesson', details: error.message });
    }
});
router.get('/lessons', async (req, res) => {
    try {
        const db = getDb();
        const lessonsFB = await db.collection('lessons').get();

        const lessons = await Promise.all(
            lessonsFB.docs.map(async (doc) => {
                const data = doc.data();

                const lessonStudentFB = await db
                    .collection('lesson_student')
                    .where('lessonId', '==', data.id)
                    .get();

                const studentPhone = lessonStudentFB.docs.map(lsDoc => lsDoc.data().studentPhone);

                return {
                    id: data.id,
                    title: data.title,
                    description: data.description,
                    assignedAt: data.assignedAt,
                    completed: data.completed,
                    isActive: data.isActive,
                    createdAt: data.createdAt,
                    studentPhone
                };
            })
        );

        res.json({
            success: true,
            lessons,
            count: lessons.length
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to get lessons', details: error.message });
    }

});

module.exports = router;
