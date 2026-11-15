import nodemailer from 'nodemailer';

// Plain SMTP from the environment (PF9 fleet convention, same names as the
// Flask apps): MAIL_SERVER, MAIL_PORT (587), MAIL_USE_TLS (true),
// MAIL_USERNAME, MAIL_PASSWORD, MAIL_DEFAULT_SENDER.
// Nothing here throws: an unconfigured or failing mail server is logged and
// the caller carries on, so a visitor never sees a mail error.
const DEFAULT_SENDER = 'PF9 Support <support@plainspokenfoundrynine.com>';

export function mailConfigured() {
  return Boolean(process.env.MAIL_SERVER && process.env.MAIL_PASSWORD);
}

let transport = null;

function getTransport() {
  if (transport) return transport;
  const port = Number(process.env.MAIL_PORT) || 587;
  const secure = port === 465; // implicit TLS; 587/25 upgrade with STARTTLS
  const useTls = String(process.env.MAIL_USE_TLS ?? 'true').toLowerCase() !== 'false';
  transport = nodemailer.createTransport({
    host: process.env.MAIL_SERVER,
    port,
    secure,
    requireTLS: !secure && useTls,
    ignoreTLS: !secure && !useTls,
    auth: process.env.MAIL_USERNAME
      ? { user: process.env.MAIL_USERNAME, pass: process.env.MAIL_PASSWORD }
      : undefined,
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });
  return transport;
}

// Resolves true when the server accepted the message, false otherwise.
// `what` names the mail in log lines (never the recipient's secrets).
export async function sendMail({ to, subject, text }, what = 'email') {
  if (!mailConfigured()) {
    console.warn(`[mail] ${what} not sent: mail not configured (MAIL_SERVER / MAIL_PASSWORD unset)`);
    return false;
  }
  try {
    await getTransport().sendMail({
      from: process.env.MAIL_DEFAULT_SENDER || DEFAULT_SENDER,
      to,
      subject,
      text,
    });
    return true;
  } catch (err) {
    console.error(`[mail] ${what} not sent: ${err && err.message ? err.message : err}`);
    return false;
  }
}
