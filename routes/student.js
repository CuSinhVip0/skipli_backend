const express = require('express');
const router = express.Router();
const { getDb } = require('../config/firebase');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /myLessons?phone=xxx
 * Return all assigned lessons
 */
router.get('/myLessons', authenticateToken, async (req, res) => {
    try {
        const { phone } = req.query;
        console.log("🚀 ~ phone:", req.user)

        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required as query parameter' });
        }

        const db = getDb();
        const studentDoc = await db.collection('users').doc(phone).get();

        if (!studentDoc.exists) {
            return res.status(404).json({ error: 'Student not found' });
        }
        const lessonStudentFB = await db
            .collection('lesson_student')
            .where('studentPhone', '==', studentDoc.data().phone)
            .get();


        const lessons = await Promise.all(
            lessonStudentFB.docs.map(async (doc) => {
                const lessonsFB = await db.collection('lessons').doc(doc.data().lessonId).get();
                const data = lessonsFB.data();

                return {
                    id: data.id,
                    title: data.title,
                    description: data.description,
                    assignedAt: data.assignedAt,
                    completed: data.completed,
                    isActive: data.isActive,
                    createdAt: data.createdAt,
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

/***
 * POST /markLessonDone
 * Params: phone, lessonId
 * Mark lesson as completed in Firebase
 */
router.post('/markLessonDone', async (req, res) => {
    try {
        const { phone, lessonId } = req.body;

        if (!phone || !lessonId) {
            return res.status(400).json({ error: 'Phone and lessonId are required' });
        }

        const db = getDb();
        const studentFB = db.collection('students').doc(phone);
        const studentDoc = await studentFB.get();

        if (!studentDoc.exists) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const studentData = studentDoc.data();
        const lessons = studentData.lessons || [];

        const lessonIndex = lessons.findIndex(l => l.id === lessonId);

        if (lessonIndex === -1) {
            return res.status(404).json({ error: 'Lesson not found' });
        }

        lessons[lessonIndex].completed = true;
        lessons[lessonIndex].completedAt = new Date().toISOString();

        await studentFB.update({ lessons });

        res.json({
            success: true,
            message: 'Lesson marked as completed',
            lesson: lessons[lessonIndex]
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to mark lesson as done', details: error.message });
    }
});

/**
 * PUT /editProfile
 * Params: phone, name, email
 * Update student profile
 */
router.put('/editProfile', async (req, res) => {
    try {
        const { phone, name, email } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        const db = getDb();
        const studentFB = db.collection('students').doc(phone);
        const studentDoc = await studentFB.get();

        if (!studentDoc.exists) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const updateData = {
            updatedAt: new Date().toISOString()
        };

        if (name) updateData.name = name;
        if (email) updateData.email = email;

        await studentFB.update(updateData);

        const updatedDoc = await studentFB.get();

        res.json({
            success: true,
            message: 'Profile updated successfully',
            student: {
                phone: updatedDoc.id,
                ...updatedDoc.data()
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update profile', details: error.message });
    }
});

module.exports = router;
