const { getDb } = require('./config/firebase');

const setupSocket = (io) => {
    io.on('connection', (socket) => {
        // joinchat room
        socket.on('join_room', async (data) => {
            try {
                const { roomId, userId, userName } = data;
                socket.join(roomId);

                console.log(`${userName} (${userId}) joined room: ${roomId}`);

                const db = getDb();
                try {
                    const conversationFB = db.collection('conversations').doc(roomId);
                    const conversationDoc = await conversationFB.get();

                    if (conversationDoc.exists) {
                        await conversationFB.update({
                            [`lastSeen.${userId}`]: new Date().toISOString()
                        });
                    }
                } catch (err) {
                    console.log('Could not update lastSeen:', err.message);
                }

                socket.to(roomId).emit('user_joined', {
                    userId,
                    userName,
                    message: `${userName} joined the chat`
                });

                socket.emit('room_joined', {
                    roomId,
                    message: 'Successfully joined the chat room'
                });
            } catch (error) {
                socket.emit('error', { message: 'Failed to join room' });
            }
        });

        // send  message
        socket.on('send_message', async (data) => {
            try {
                const { roomId, userId, userName, message, userType } = data;
                const db = getDb();

                const messageData = {
                    roomId,
                    userId,
                    userName,
                    userType: userType || 'student',
                    message,
                    timestamp: new Date().toISOString()
                };

                const messageFB = await db.collection('messages').add(messageData);
                messageData.id = messageFB.id;

                try {
                    const conversationFB = db.collection('conversations').doc(roomId);
                    await conversationFB.update({
                        lastMessage: {
                            text: message,
                            senderId: userId,
                            senderName: userName,
                            timestamp: messageData.timestamp
                        },
                        updatedAt: messageData.timestamp
                    });
                } catch (err) {
                    console.log('Could not update conversation:', err.message);
                }

                io.to(roomId).emit('receive_message', messageData);
            } catch (error) {
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        socket.on('leave_room', (data) => {
            const { roomId, userName } = data;
            socket.leave(roomId);

            socket.to(roomId).emit('user_left', {
                userName,
                message: `${userName} left the chat`
            });
        });

        socket.on('get_history', async (data) => {
            try {
                const { roomId, limit = 50 } = data;
                const db = getDb();

                const messagesSnapshot = await db.collection('messages')
                    .where('roomId', '==', roomId)
                    .orderBy('timestamp', 'desc')
                    .limit(limit)
                    .get();

                const messages = [];
                messagesSnapshot.forEach(doc => {
                    messages.push({ id: doc.id, ...doc.data() });
                });

                messages.reverse();

                socket.emit('chat_history', { roomId, messages });
            } catch (error) {
                socket.emit('error', { message: 'Failed to load chat history' });
            }
        });

        socket.on('typing', (data) => {
            const { roomId, userName, isTyping } = data;
            socket.to(roomId).emit('user_typing', { userName, isTyping });
        });

        socket.on('disconnect', () => {
        });
    });

    console.log('Socket.io initialized successfully');
};

module.exports = setupSocket;
