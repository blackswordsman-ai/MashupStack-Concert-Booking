// utils/email.js
const nodemailer = require('nodemailer');

const sendOtpEmail = async (email, otp) => {
  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail', // Change if using another service
      auth: {
        user: 'your-email@gmail.com', // Your email
        pass: 'your-email-password'  // Use app password if using Gmail 2FA
      }
    });

    const mailOptions = {
      from: 'your-email@gmail.com',
      to: email,
      subject: 'Booking OTP Confirmation',
      text: `Your OTP for confirming the booking is: ${otp}`
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending OTP email:', error);
  }
};

module.exports = sendOtpEmail;
