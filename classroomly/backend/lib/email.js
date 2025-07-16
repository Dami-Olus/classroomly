const sgMail = require('@sendgrid/mail');

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;

/**
 * Send an email using SendGrid
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - HTML content
 * @returns {Promise<void>}
 */
async function sendEmail(to, subject, html) {
  // Temporarily disable email sending for development
  console.log('Email would be sent:', { to, subject, html });
  
  // Uncomment the following lines when you have SendGrid set up:
  // const msg = {
  //   to,
  //   from: FROM_EMAIL,
  //   subject,
  //   html
  // };
  // await sgMail.send(msg);
}

module.exports = {
  sendEmail
}; 