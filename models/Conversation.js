const conversationsCollection = require('../db')
  .db()
  .collection('conversations');
const messagesCollection = require('../db')
  .db()
  .collection('messages');
const ObjectID = require('mongodb').ObjectID;
const User = require('./User');

function sortedParticipants(userIdA, userIdB) {
  const a = new ObjectID(userIdA);
  const b = new ObjectID(userIdB);
  return a.toString() < b.toString() ? [a, b] : [b, a];
}

let Conversation = function() {};

Conversation.findOrCreate = function(userIdA, userIdB) {
  return new Promise(async function(resolve, reject) {
    try {
      const participants = sortedParticipants(userIdA, userIdB);

      let existing = await conversationsCollection.findOne({ participants: participants });

      if (existing) {
        resolve(existing._id);
        return;
      }

      const result = await conversationsCollection.insertOne({
        participants: participants,
        lastMessage: null,
        updatedAt: new Date(),
        createdAt: new Date()
      });

      resolve(result.ops[0]._id);
    } catch {
      reject();
    }
  });
};

Conversation.findByIdForUser = function(conversationId, userId) {
  return new Promise(async function(resolve, reject) {
    try {
      if (typeof conversationId != 'string' || !ObjectID.isValid(conversationId)) {
        reject();
        return;
      }

      const visitorObjectId = new ObjectID(userId);
      const conversation = await conversationsCollection.findOne({
        _id: new ObjectID(conversationId),
        participants: visitorObjectId
      });

      if (!conversation) {
        reject();
        return;
      }

      const otherId = conversation.participants.find(function(id) {
        return !id.equals(visitorObjectId);
      });

      const otherUser = await User.findById(otherId);
      const decorated = new User(otherUser, true);

      resolve({
        _id: conversation._id,
        otherUser: {
          _id: otherId,
          username: decorated.data.username,
          avatar: decorated.avatar
        },
        lastMessage: conversation.lastMessage,
        updatedAt: conversation.updatedAt
      });
    } catch {
      reject();
    }
  });
};

Conversation.findByUserId = function(userId) {
  return new Promise(async function(resolve, reject) {
    try {
      const visitorObjectId = new ObjectID(userId);
      let conversations = await conversationsCollection
        .find({ participants: visitorObjectId })
        .sort({ updatedAt: -1 })
        .toArray();

      conversations = await Promise.all(
        conversations.map(async function(conversation) {
          const otherId = conversation.participants.find(function(id) {
            return !id.equals(visitorObjectId);
          });

          const otherUserDoc = await User.findById(otherId);
          const decorated = new User(otherUserDoc, true);

          return {
            _id: conversation._id,
            otherUser: {
              _id: otherId,
              username: decorated.data.username,
              avatar: decorated.avatar
            },
            lastMessage: conversation.lastMessage,
            updatedAt: conversation.updatedAt
          };
        })
      );

      resolve(conversations);
    } catch {
      reject();
    }
  });
};

Conversation.updateLastMessage = function(conversationId, messageData) {
  return conversationsCollection.updateOne(
    { _id: new ObjectID(conversationId) },
    {
      $set: {
        lastMessage: messageData,
        updatedAt: new Date()
      }
    }
  );
};

Conversation.markAsRead = function(conversationId, userId) {
  const userKey = userId.toString();
  return conversationsCollection.updateOne(
    {
      _id: new ObjectID(conversationId),
      participants: new ObjectID(userId)
    },
    {
      $set: {
        [`lastReadAt.${userKey}`]: new Date()
      }
    }
  );
};

Conversation.getUnreadDmCount = function(userId) {
  return new Promise(async function(resolve, reject) {
    try {
      const visitorObjectId = new ObjectID(userId);
      const userKey = userId.toString();
      const conversations = await conversationsCollection
        .find({ participants: visitorObjectId })
        .toArray();

      let total = 0;

      for (const conversation of conversations) {
        const lastRead =
          conversation.lastReadAt && conversation.lastReadAt[userKey]
            ? conversation.lastReadAt[userKey]
            : new Date(0);

        const count = await messagesCollection.countDocuments({
          conversationId: conversation._id,
          senderId: { $ne: visitorObjectId },
          createdDate: { $gt: lastRead }
        });

        total += count;
      }

      resolve(total);
    } catch {
      resolve(0);
    }
  });
};

Conversation.isParticipant = function(conversationId, userId) {
  return new Promise(async function(resolve, reject) {
    try {
      if (typeof conversationId != 'string' || !ObjectID.isValid(conversationId)) {
        resolve(false);
        return;
      }

      const count = await conversationsCollection.countDocuments({
        _id: new ObjectID(conversationId),
        participants: new ObjectID(userId)
      });

      resolve(count > 0);
    } catch {
      resolve(false);
    }
  });
};

module.exports = Conversation;