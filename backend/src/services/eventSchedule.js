const db = require('../db');

function isPastDeadline(scheduledCloseAt) {
  return Boolean(scheduledCloseAt) && new Date(scheduledCloseAt).getTime() <= Date.now();
}

function isEffectivelyOpen(event) {
  return Boolean(event.is_active) && !isPastDeadline(event.scheduled_close_at);
}

// Evaluated lazily on read rather than via a background scheduler: if an
// event's deadline has passed but is_active is still 1, flip it (and clear
// the deadline) so the stored state settles to match reality with no cron.
function settleScheduledClose(event) {
  if (event.is_active && isPastDeadline(event.scheduled_close_at)) {
    db.prepare("UPDATE events SET is_active = 0, scheduled_close_at = NULL, updated_at = datetime('now') WHERE id = ?")
      .run(event.id);
    return { ...event, is_active: 0, scheduled_close_at: null };
  }
  return event;
}

module.exports = { isEffectivelyOpen, settleScheduledClose };
