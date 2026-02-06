const firebase = require('firebase-admin');
const service = require('../firebase-service-account.json');
let db = null;

const initfirebase = () => {
    try {
        firebase.initializeApp({
            credential: firebase.credential.cert(service)
        });
        db = firebase.firestore();
        console.log('Firebase init successfully');
    } catch (error) {
        console.log("🚀 ~ initfirebase ~ error:", error)
    }
};

const getDb = () => {
    if (!db) {
        throw new Error('Firebase not init.');
    }
    return db;
};

module.exports = {
    initfirebase,
    getDb
};