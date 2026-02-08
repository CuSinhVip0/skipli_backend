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
        const db = getDb();
        const studentDoc = await db.collection('users').doc(req.user.phone).get();

        if (!studentDoc.exists) {
            return res.status(404).json({ error: 'Student not found' });
        }
        const lessonStudentFB = await db
            .collection('lesson_student')
            .where('studentPhone', '==', req.user.phone)
            .get();


        const lessons = await Promise.all(
            lessonStudentFB.docs.map(async (doc) => {
                const dataUser = doc.data();
                const lessonsFB = await db.collection('lessons').doc(doc.data().lessonId).get();
                const data = lessonsFB.data();
                return {
                    id: doc.id,
                    lessonId: data.lessonId,
                    title: data.title,
                    description: data.description,
                    assignedAt: dataUser.assignedAt,
                    completed: dataUser.completed,
                    completedAt: dataUser.completedAt,
                    isActive: data.isActive,
                    createdAt: dataUser.createdAt,
                };
            })
        );

        const final = lessons.filter(lesson => lesson.isActive);
        res.json({
            success: true,
            lessons: final,
            count: final.length
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
router.post('/markLessonDone', authenticateToken, async (req, res) => {
    try {
        const { lessonId } = req.body;

        if (!lessonId) {
            return res.status(400).json({ error: 'Phone and lessonId are required' });
        }

        const db = getDb();
        const studentFB = db.collection('users').doc(req.user.phone);
        const studentDoc = await studentFB.get();

        if (!studentDoc.exists) {
            return res.status(404).json({ error: 'Student not found' });
        }

        const updateData = {
            completed: true,
            completedAt: new Date().toISOString()
        };
        const lessonsFB = db.collection('lesson_student').doc(lessonId);
        await lessonsFB.update(updateData);

        res.json({
            success: true,
            message: 'Lesson marked as completed',
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
router.put('/editProfile', authenticateToken, async (req, res) => {
    try {
        const { name, email } = req.body;

        const db = getDb();
        const studentFB = db.collection('users').doc(req.user.phone);
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

        res.json({
            success: true,
            message: 'Profile updated successfully',
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update profile', details: error.message });
    }
});

module.exports = router;
