const notificationsCollection = require('../db')
  .db()
  .collection('notifications');
const ObjectID = require('mongodb').ObjectID;
const User = require('./User');

let Notification = function() {};

Notification.create = function(data) {
  return new Promise(async function(resolve, reject) {
    try {
      const recipientId = new ObjectID(data.recipientId);
      const actorId = new ObjectID(data.actorId);

      if (recipientId.equals(actorId)) {
        resolve(null);
        return;
      }

      const result = await notificationsCollection.insertOne({
        type: data.type,
        recipientId: recipientId,
        actorId: actorId,
        postId: new ObjectID(data.postId),
        preview: data.preview || null,
        read: false,
        createdDate: new Date()
      });

      resolve(result.ops[0]);
    } catch {
      reject();
    }
  });
};

Notification.countUnread = function(userId) {
  return new Promise(async function(resolve, reject) {
    try {
      const count = await notificationsCollection.countDocuments({
        recipientId: new ObjectID(userId),
        read: false
      });
      resolve(count);
    } catch {
      resolve(0);
    }
  });
};

Notification.markAllRead = function(userId) {
  return notificationsCollection.updateMany(
    { recipientId: new ObjectID(userId), read: false },
    { $set: { read: true } }
  );
};

Notification.findByRecipient = function(userId) {
  return new Promise(async function(resolve, reject) {
    try {
      let notifications = await notificationsCollection
        .aggregate([
          { $match: { recipientId: new ObjectID(userId) } },
          { $sort: { createdDate: -1 } },
          { $limit: 50 },
          {
            $lookup: {
              from: 'users',
              localField: 'actorId',
              foreignField: '_id',
              as: 'actorDocument'
            }
          },
          {
            $project: {
              type: 1,
              postId: 1,
              preview: 1,
              read: 1,
              createdDate: 1,
              actor: { $arrayElemAt: ['$actorDocument', 0] }
            }
          }
        ])
        .toArray();

      notifications = notifications.map(function(notification) {
        const actor = new User(notification.actor, true);
        return {
          _id: notification._id,
          type: notification.type,
          postId: notification.postId,
          preview: notification.preview,
          read: notification.read,
          createdDate: notification.createdDate,
          actor: {
            _id: notification.actor._id,
            username: actor.data.username,
            avatar: actor.avatar
          }
        };
      });

      resolve(notifications);
    } catch {
      reject();
    }
  });
};

module.exports = Notification;