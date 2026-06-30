const Notification = require('../models/Notification');
const { emitBadgeCounts } = require('../utils/badgeNotifier');

exports.activityScreen = async function(req, res, next) {
  try {
    const notifications = await Notification.findByRecipient(req.session.user._id);
    await Notification.markAllRead(req.session.user._id);

    const io = req.app.get('io');
    await emitBadgeCounts(io, req.session.user._id);

    res.render('notifications', {
      title: 'Notifications',
      notifications: notifications
    });
  } catch (err) {
    next(err);
  }
};