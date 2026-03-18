/**
 * Known disposable / temporary email domains.
 * Used to silently flag submissions for analysis without blocking the visitor.
 * Keep sorted alphabetically for easy maintenance.
 */
const DISPOSABLE_DOMAINS = new Set([
  '10minutemail.com',
  'burnermail.io',
  'dispostable.com',
  'emailondeck.com',
  'fakeinbox.com',
  'getnada.com',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'harakirimail.com',
  'inboxbear.com',
  'mailcatch.com',
  'maildrop.cc',
  'mailinator.com',
  'mailnesia.com',
  'mailsac.com',
  'mohmal.com',
  'nada.email',
  'sharklasers.com',
  'spamgourmet.com',
  'temp-mail.org',
  'tempail.com',
  'tempm.com',
  'tempmail.com',
  'tempmailo.com',
  'throwaway.email',
  'tmpmail.net',
  'tmpmail.org',
  'trashmail.com',
  'trashmail.me',
  'trashmail.net',
  'yopmail.com',
  'yopmail.fr',
]);

/**
 * Returns true if the email domain is a known disposable provider.
 */
function isDisposableEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const domain = email.toLowerCase().split('@')[1];
  return domain ? DISPOSABLE_DOMAINS.has(domain) : false;
}

/**
 * Extract domain from an email address.
 */
function getEmailDomain(email) {
  if (!email || typeof email !== 'string') return '';
  return (email.toLowerCase().split('@')[1] || '');
}

module.exports = { isDisposableEmail, getEmailDomain, DISPOSABLE_DOMAINS };
