const dns = require('dns').promises;
const { isNonPublicIp } = require('is-private-ip');

const jsonHeaders = { 'Content-Type': 'application/json' };

// Picks a payload shape based on the target URL so the admin doesn't have to
// configure a template - covers the common self-hosted-friendly targets,
// with a generic JSON fallback for anything else (custom endpoints, other
// ntfy-compatible tools, etc).
function payloadFor(url, event, recording) {
  const text = `${recording.guest_name || 'Someone'} left a new message in "${event.title}".`;

  if (/hooks\.slack\.com/.test(url)) {
    return { body: JSON.stringify({ text }), headers: jsonHeaders };
  }
  if (/discord(app)?\.com\/api\/webhooks/.test(url)) {
    return { body: JSON.stringify({ content: text }), headers: jsonHeaders };
  }
  if (/ntfy\.sh/.test(url)) {
    return { body: text, headers: { Title: `Ringbook: ${event.title}` } };
  }
  return {
    body: JSON.stringify({ event: event.title, guest_name: recording.guest_name || null, message: text }),
    headers: jsonHeaders,
  };
}

// SSRF guard: admins are scoped to their own guestbooks, not to "make the
// server issue requests into its internal network," so a webhook target
// must resolve to a genuinely public address. Re-checked at send time (not
// just when the URL is saved) since DNS can change between the two moments.
async function assertSafeWebhookTarget(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http/https webhook URLs are allowed');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 literal brackets
  const { address } = await dns.lookup(hostname);
  if (isNonPublicIp(address)) {
    throw new Error('Webhook URL resolves to a private, loopback, or link-local address');
  }
}

// Fire-and-forget by design: a slow or unreachable webhook target must never
// delay or fail the guest's upload, so callers should not await this on the
// guest-facing request path.
async function sendWebhook(url, event, recording) {
  if (!url) return { ok: false, error: 'No webhook URL configured' };

  const { body, headers } = payloadFor(url, event, recording);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    await assertSafeWebhookTarget(url);
    const res = await fetch(url, {
      method: 'POST', headers, body, signal: controller.signal, redirect: 'manual',
    });
    if (!res.ok) {
      return { ok: false, error: `Webhook responded with ${res.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendWebhook, assertSafeWebhookTarget };
