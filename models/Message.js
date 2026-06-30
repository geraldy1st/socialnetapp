const messagesCollection = require('../db')
  .db()
  .collection('messages');
const ObjectID = require('mongodb').ObjectID;
const Conversation = require('./Conversation');
const User = require('./User');
const sanitizeHTML = require('sanitize-html');

let Message = function(data, senderId, conversationId) {
  this.data = data;
  this.senderId = senderId;
  this.conversationId = conversationId;
  this.errors = [];
};

Message.prototype.cleanUp = function() {
  if (typeof this.data.body != 'string') {
    this.data.body = '';
  }

  this.data = {
    body: sanitizeHTML(this.data.body.trim(), {
      allowedTags: [],
      allowedAttributes: {}
    }),
    conversationId: new ObjectID(this.conversationId),
    senderId: new ObjectID(this.senderId),
    createdDate: new Date()
  };
};

Message.prototype.validate = function() {
  if (!this.data.body || this.data.body.trim() === '') {
    this.errors.push('Le message ne peut pas être vide.');
  }

  if (this.data.body.length > 1000) {
    this.errors.push('Le message ne peut pas dépasser 1000 caractères.');
  }
};

Message.prototype.create = function() {
  return new Promise(async (resolve, reject) => {
    this.cleanUp();
    this.validate();

    if (this.errors.length) {
      reject(this.errors);
      return;
    }

    const isMember = await Conversation.isParticipant(
      this.conversationId,
      this.senderId
    );

    if (!isMember) {
      reject(['Vous ne pouvez pas envoyer de message dans cette conversation.']);
      return;
    }

    try {
      const result = await messagesCollection.insertOne(this.data);

      await Conversation.updateLastMessage(this.conversationId, {
        text: this.data.body,
        senderId: this.data.senderId,
        createdDate: this.data.createdDate
      });

      const senderDoc = await User.findById(this.senderId);
      const sender = new User(senderDoc, true);

      resolve({
        _id: result.ops[0]._id,
        body: this.data.body,
        conversationId: this.conversationId,
        senderId: this.data.senderId,
        createdDate: this.data.createdDate,
        sender: {
          _id: this.data.senderId,
          username: sender.data.username,
          avatar: sender.avatar
        }
      });
    } catch {
      reject(['Impossible d\'envoyer le message.']);
    }
  });
};

Message.findByConversationId = function(conversationId) {
  return new Promise(async function(resolve, reject) {
    try {
      if (typeof conversationId != 'string' || !ObjectID.isValid(conversationId)) {
        reject();
        return;
      }

      let messages = await messagesCollection
        .find({ conversationId: new ObjectID(conversationId) })
        .sort({ createdDate: 1 })
        .toArray();

      messages = await Promise.all(
        messages.map(async function(message) {
          const senderDoc = await User.findById(message.senderId);
          const sender = new User(senderDoc, true);

          return {
            _id: message._id,
            body: message.body,
            conversationId: message.conversationId,
            senderId: message.senderId,
            createdDate: message.createdDate,
            sender: {
              _id: message.senderId,
              username: sender.data.username,
              avatar: sender.avatar
            }
          };
        })
      );

      resolve(messages);
    } catch {
      reject();
    }
  });
};

module.exports = Message;