const nodemailer = require('nodemailer');
require('dotenv').config();

// Create transporter using SMTP (e.g., SendGrid, Resend, Mailgun)
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.sendgrid.net',
    port: process.env.SMTP_PORT || 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER || 'apikey', // 'apikey' is literal for SendGrid
        pass: process.env.SMTP_PASS || 'your_smtp_password_here'
    }
});

const sendEmail = async (to, subject, htmlContent) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.EMAIL_FROM || '"Nexus Admin" <noreply@nexusproject.com>',
            to,
            subject,
            html: htmlContent
        });
        console.log(`[Email] Sent ${subject} to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[Email Error] Failed to send ${subject} to ${to}:`, error);
        // Return false instead of throwing to prevent crashing the main API flow
        return { success: false, error: error.message };
    }
};

const sendWelcomeEmail = async (clientEmail, clientName) => {
    const subject = "Welcome to Nexus Premium SaaS";
    const htmlContent = `
    <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #ff5500;">Welcome to Nexus, ${clientName}!</h2>
      <p>Your account has been successfully created.</p>
      <p>We are thrilled to have you on board. You can now access your Client Dashboard to upload brand assets, chat with our team, and submit your first AI Agent Brief.</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="font-size: 12px; color: #888;">This is an automated message from the Nexus Platform.</p>
    </div>
  `;
    return sendEmail(clientEmail, subject, htmlContent);
};

const sendBriefApprovedEmail = async (clientEmail, tierName) => {
    const subject = "🚀 Your AI Agent is Now Active!";
    const htmlContent = `
    <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #00ff94;">Great news!</h2>
      <p>Your recent AI Agent Brief for the <strong>${tierName}</strong> protocol has been approved by our Admin team.</p>
      <p>Your automated marketing campaigns are now being generated and will appear in your dashboard shortly.</p>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display: inline-block; padding: 10px 20px; background-color: #ff5500; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">View Dashboard</a>
    </div>
  `;
    return sendEmail(clientEmail, subject, htmlContent);
};

const sendNewMessageNotification = async (recipientEmail, senderName) => {
    if (!recipientEmail) return; // Prevents error if recipient email isn't available
    const subject = `New Message from ${senderName}`;
    const htmlContent = `
    <div style="font-family: sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
      <h3>You have a new message from ${senderName}.</h3>
      <p>Please log in to the Nexus secure portal to view and reply to this message.</p>
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display: inline-block; padding: 10px 20px; background-color: #333; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px;">Open Chat</a>
    </div>
  `;
    return sendEmail(recipientEmail, subject, htmlContent);
};

module.exports = {
    sendWelcomeEmail,
    sendBriefApprovedEmail,
    sendNewMessageNotification
};
