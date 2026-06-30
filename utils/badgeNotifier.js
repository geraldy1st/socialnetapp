const Conversation = require('../models/Conversation');
const Notification = require('../models/Notification');

async function getBadgeCounts(userId) {
  const [dmCount, activityCount] = await Promise.all([
    Conversation.getUnreadDmCount(userId),
    Notification.countUnread(userId)
  ]);

  return { dmCount: dmCount, activityCount: activityCount };
}

async function emitBadgeCounts(io, userId) {
  if (!io || !userId) {
    return;
  }

  const counts = await getBadgeCounts(userId);
  io.to(`user:${userId}`).emit('badgeUpdate', counts);
}

module.exports = { getBadgeCounts, emitBadgeCounts };