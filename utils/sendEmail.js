import nodemailer from "nodemailer";

const sendEmail = async (to, subject, text, html) => {
  // Create transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST, // e.g., smtp.gmail.com or smtp.sendgrid.net
    port: process.env.SMTP_PORT, // e.g., 465 (secure) or 587
    secure: process.env.SMTP_PORT == 465, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Send email
  const info = await transporter.sendMail({
    from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
    to,
    subject,
    text,
    html: html || text, // fallback if HTML is not provided
  });

  // console.log(`📧 Email sent: ${info.messageId}`);
};

export default sendEmail;
