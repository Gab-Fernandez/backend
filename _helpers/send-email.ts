import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function sendEmail({ to, subject, html, from }: any) {
    const emailFrom = from || process.env.EMAIL_FROM || 'onboarding@resend.dev';
    
    await resend.emails.send({
        from: emailFrom,
        to,
        subject,
        html
    });
}