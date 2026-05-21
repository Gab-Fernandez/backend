import { Resend } from 'resend';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM || 'onboarding@resend.dev';

// Instantiate Resend if API Key is available
const resend = apiKey ? new Resend(apiKey) : null;

if (!resend) {
  console.log('\n⚠️  [Resend] No RESEND_API_KEY defined. Email service will run in MOCK mode (printing to console).\n');
} else {
  console.log('\n🚀  [Resend] Resend API Key detected. Email service initialized in LIVE mode.\n');
}

/**
 * Deliver email using Resend SDK, or fall back to mock terminal output if no key is defined.
 * 
 * @param {Object} options
 * @param {string|string[]} options.to - Recipient email address(es)
 * @param {string} options.subject - Email subject line
 * @param {string} options.html - HTML content
 */
export async function sendEmail({ to, subject, html }) {
  const recipients = Array.isArray(to) ? to : [to];

  if (resend) {
    try {
      console.log(`[Resend] Sending live email to: ${recipients.join(', ')}...`);
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: recipients,
        subject,
        html
      });

      if (error) {
        console.error('[Resend Error] API rejected email delivery:', error);
        throw new Error(error.message || 'API delivery rejection');
      }

      console.log(`[Resend Success] Email sent. ID: ${data.id}`);
      return data;
    } catch (err) {
      console.error(`[Resend Crash] Failed sending live email:`, err);
      // Fallback: log to console to not block local dev execution in case of Resend network/plan issues
      logMockEmail(recipients, subject, html);
      return { id: 'fallback-mock-id', warning: err.message };
    }
  } else {
    logMockEmail(recipients, subject, html);
    return { id: 'mock-id' };
  }
}

// Helper: Beautiful Console Mock email logger
function logMockEmail(to, subject, html) {
  console.log('\n' + '✉️  '.repeat(20));
  console.log(`[MOCK EMAIL SERVICE] Mock Delivery Logged`);
  console.log(`👉 To: ${to.join(', ')}`);
  console.log(`👉 From: ${fromEmail}`);
  console.log(`👉 Subject: ${subject}`);
  console.log(`👉 Message HTML:`);
  console.log('-'.repeat(60));
  console.log(html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()); // simple text preview
  console.log('-'.repeat(60));
  console.log('✉️  '.repeat(20) + '\n');
}
