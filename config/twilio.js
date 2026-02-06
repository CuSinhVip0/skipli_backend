require('dotenv').config();
const twilio = require('twilio');
let twilioClient = null;

const initTwilio = () => {
    const accountsid = process.env.TWILIO_ACCOUNTSID;
    const authToken = process.env.TWILIO_AUTHTOKEN;

    if (accountsid && authToken) {
        twilioClient = twilio(process.env.TWILIO_ACCOUNTSID, process.env.TWILIO_AUTHTOKEN);
        console.log('Twilio init successfully');
    } else {
        console.log('Twilio credentials not found');
    }
};

const sendSMS = async (to, message) => {
    if (!twilioClient) {
        return { success: false, message: 'Twilio not configured' };
    }

    try {
        const result = await twilioClient.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE,
            to: to
        });
        return { success: true, sid: result.sid };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

module.exports = {
    initTwilio,
    sendSMS
};
