const express = require('express');
const router = express.Router();
const { getDb } = require('../config/firebase');
const { authenticateToken } = require('../middleware/auth');

/**
 * GET /conversations
 * Action: Get all conversations for a user
 */
router.get('/conversations', authenticateToken, async (req, res) => {
    try {
        const db = getDb();

        const conversationsSnapshot = await db.collection('conversations')
            .where('participantIds', 'array-contains', req.user.id)
            .orderBy('updatedAt', 'desc')
            .get();

        const conversations = [];
        conversationsSnapshot.forEach(doc => {
            conversations.push({
                id: doc.id,
                ...doc.data()
            });
        });

        res.json({
            success: true,
            conversations
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get conversations', details: error.message });
    }
});

router.get('/entitiesConversations', authenticateToken, async (req, res) => {
    try {
        const db = getDb();

        const entitiesSnapshot = await db.collection('users')
            .where('isActive', '==', true)
            .get();

        const entities = [];
        entitiesSnapshot.forEach(doc => {
            const data = doc.data();
            entities.push({
                id: data.id,
                entitiesType: "object",
                name: data.name,
                type: data.role
            });
        });

        const group = await db.collection('conversations')
            .where('participantIds', 'array-contains', req.user.id)
            .where('type', '==', 'group')
            .get();
        group.forEach(doc => {
            const data = doc.data();
            entities.push({
                id: doc.id,
                entitiesType: "group",
                name: data.name,
                type: "other"
            })
        })

        res.json({
            success: true,
            entities
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get entities', details: error.message });
    }
});


// POST /conversation - Create or get 1-1 conversation
router.post('/conversation', async (req, res) => {
    try {
        const { name, participants } = req.body;

        if (!participants || participants.length !== 2) {
            return res.status(400).json({ error: 'Exactly 2 participants required for 1-1 chat' });
        }

        const db = getDb();
        const participantIds = participants.map(p => p.id).sort();
        const conversationId = `chat_${participantIds.join('_')}`;

        const conversationRef = db.collection('conversations').doc(conversationId);
        const conversationDoc = await conversationRef.get();

        if (conversationDoc.exists) {
            return res.json({
                success: true,
                conversation: {
                    id: conversationDoc.id,
                    ...conversationDoc.data()
                },
                isNew: false
            });
        }

        const conversationData = {
            type: 'direct',
            name,
            participantIds,
            participants: participants.map(p => ({
                id: p.id,
                name: p.name,
                userType: p.type
            })),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastMessage: null,
            lastSeen: {}
        };

        await conversationRef.set(conversationData);

        res.json({
            success: true,
            conversation: {
                id: conversationId,
                ...conversationData
            },
            isNew: true
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create conversation', details: error.message });
    }
});

router.post('/group', authenticateToken, async (req, res) => {
    try {
        const { name, participants } = req.body;

        if (!name || !participants || participants.length < 2) {
            return res.status(400).json({ error: 'Group name and at least 2 participants required' });
        }

        const db = getDb();
        const groupId = `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const groupData = {
            type: 'group',
            name,
            participantIds: participants.map(p => p.id),
            participants: participants.map(p => ({
                id: p.id,
                name: p.name,
                userType: p.type,
                role: p.id === req.user.id ? 'admin' : 'member'
            })),
            creatorId: req.user.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastMessage: null,
            lastSeen: {}
        };

        await db.collection('conversations').doc(groupId).set(groupData);

        res.json({
            success: true,
            group: {
                id: groupId,
                ...groupData
            }
        });
    } catch (error) {
        console.error('Error creating group:', error);
        res.status(500).json({ error: 'Failed to create group', details: error.message });
    }
});

// PUT /group/:groupId - Update group (add/remove members, rename)
router.put('/group/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;
        const { action, name, participants } = req.body;

        const db = getDb();
        const groupRef = db.collection('conversations').doc(groupId);
        const groupDoc = await groupRef.get();

        if (!groupDoc.exists) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const groupData = groupDoc.data();

        if (groupData.type !== 'group') {
            return res.status(400).json({ error: 'Not a group conversation' });
        }

        const updates = { updatedAt: new Date().toISOString() };

        switch (action) {
            case 'rename':
                if (!name) {
                    return res.status(400).json({ error: 'Group name required' });
                }
                updates.name = name;
                break;

            case 'update_members':
                if (!participants) {
                    return res.status(400).json({ error: 'Participants required' });
                }
                updates.participantIds = participants.map(p => p.id);
                updates.participants = participants.map(p => ({
                    id: p.id,
                    name: p.name,
                    userType: p.type,
                    role: p.role || 'member'
                }));
                break;

            default:
                return res.status(400).json({ error: 'Invalid action' });
        }

        await groupRef.update(updates);

        const updatedDoc = await groupRef.get();

        res.json({
            success: true,
            group: {
                id: updatedDoc.id,
                ...updatedDoc.data()
            }
        });
    } catch (error) {
        console.error('Error updating group:', error);
        res.status(500).json({ error: 'Failed to update group', details: error.message });
    }
});

router.delete('/group/:groupId', async (req, res) => {
    try {
        const { groupId } = req.params;
        const db = getDb();

        await db.collection('conversations').doc(groupId).delete();

        res.json({
            success: true,
            message: 'Group deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting group:', error);
        res.status(500).json({ error: 'Failed to delete group', details: error.message });
    }
});

module.exports = router;
