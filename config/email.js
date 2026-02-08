require('dotenv').config();
const nodemailer = require('nodemailer');

let mailer = null;

const initEmail = () => {
    const emailUser = process.env.EMAILUSER;
    const emailPass = process.env.EMAILPASS;

    if (emailUser && emailPass) {
        mailer = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: emailUser,
                pass: emailPass
            }
        });
        console.log('Email init successfully');
    } else {
        console.log('Email credentials not found');
    }
};

const sendEmail = async (to, subject, text) => {
    if (!mailer) {
        return { success: false, message: 'Email not configured' };
    }

    try {
        const info = await mailer.sendMail({
            from: `"Skipli - <${process.env.EMAILUSER}>",`,
            to: to,
            subject: subject,
            text: text,
            html: `<div style="padding: 20px">
                        <h2>Your Access Code</h2>
                        <p>${text}</p>
                        <p style="font-size: 24px; font-weight: bold; color: #4CAF50;">${text.match(/\d{6}/)?.[0]}</p>
                    </div>`
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

const sendEmailCreateStudent = async (to, subject, text) => {
    if (!mailer) {
        return { success: false, message: 'Email not configured' };
    }

    try {
        const info = await mailer.sendMail({
            from: `"Skipli - <${process.env.EMAILUSER}>",`,
            to: to,
            subject: subject,
            text: text,
            html: `<div style="padding: 20px">
                        <h2>${text}</h2>
                        <p>Please login at: <a href="http://localhost:3000/login">http://localhost:3000/login</a> </p>
                    </div>`
        });
        return { success: true, messageId: info.messageId };
    } catch (error) {
        return { success: false, message: error.message };
    }
};

module.exports = {
    initEmail,
    sendEmail, sendEmailCreateStudent
};
