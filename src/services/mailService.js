const nodemailer = require('nodemailer');

// For development, you can use Mailtrap or any SMTP service
// Using a simple configuration that can be overriden by env vars
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.mailtrap.io',
  port: process.env.EMAIL_PORT || 2525,
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || ''
  }
});

const sendEmail = async (options) => {
  const mailOptions = {
    from: 'Snipp App <noreply@snipp.app>',
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.messageId);
    return true;
  } catch (error) {
    console.error('Email send error:', error);
    // In dev, we might not have real credentials, so we log it
    console.log('--- EMAIL CONTENT START ---');
    console.log('Subject:', options.subject);
    console.log('To:', options.email);
    console.log('Message:', options.message);
    console.log('--- EMAIL CONTENT END ---');
    return false;
  }
};

const sendVerificationEmail = async (email, token) => {
  const verifyUrl = `${process.env.APP_URL || 'http://localhost:5000'}/api/auth/verify-email?token=${token}`;
  
  return await sendEmail({
    email,
    subject: 'Verify your Snipp account',
    message: `Welcome to Snipp! Please verify your email by clicking: ${verifyUrl}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #7C3AED;">Welcome to Snipp! 🚀</h2>
        <p>Thank you for joining the ultimate dare challenge platform. Please verify your email address to get started.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyUrl}" style="background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Verify Email Address</a>
        </div>
        <p style="color: #666; font-size: 12px;">If you didn't create an account with Snipp, you can safely ignore this email.</p>
      </div>
    `
  });
};

const sendPasswordResetEmail = async (email, token) => {
  const resetUrl = `${process.env.APP_URL || 'http://localhost:5000'}/api/auth/reset-password?token=${token}`;
  
  return await sendEmail({
    email,
    subject: 'Password Reset Request - Snipp',
    message: `You requested a password reset. Please click: ${resetUrl}. This link expires in 1 hour.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #7C3AED;">Password Reset Request 🔒</h2>
        <p>You recently requested to reset your password for your Snipp account. Click the button below to proceed.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #7C3AED; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Reset My Password</a>
        </div>
        <p>This link will expire in <strong>1 hour</strong>.</p>
        <p style="color: #666; font-size: 12px;">If you did not request a password reset, please ignore this email or contact support if you have questions.</p>
      </div>
    `
  });
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail
};
