const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

async function renderMessagesScreen(req, res, options) {
  const conversations = await Conversation.findByUserId(req.session.user._id);

  res.render('messages', {
    title: 'Messages',
    conversations: conversations,
    activeConversation: options.activeConversation || null,
    otherUser: options.otherUser || null,
    messages: options.messages || [],
    activeConversationId: options.activeConversationId || null
  });
}

exports.inbox = async function(req, res, next) {
  try {
    await renderMessagesScreen(req, res, {});
  } catch (err) {
    next(err);
  }
};

exports.thread = async function(req, res, next) {
  try {
    const conversation = await Conversation.findByIdForUser(
      req.params.conversationId,
      req.session.user._id
    );
    const messages = await Message.findByConversationId(req.params.conversationId);

    await renderMessagesScreen(req, res, {
      activeConversation: conversation,
      otherUser: conversation.otherUser,
      messages: messages,
      activeConversationId: req.params.conversationId
    });
  } catch {
    req.flash('errors', 'Conversation introuvable.');
    req.session.save(function() {
      res.redirect('/messages');
    });
  }
};

exports.startWithUser = async function(req, res) {
  try {
    const targetUser = await User.findByUsername(req.params.username);

    if (targetUser._id.equals(req.session.user._id)) {
      req.flash('errors', 'Vous ne pouvez pas vous envoyer de message.');
      req.session.save(function() {
        res.redirect('/messages');
      });
      return;
    }

    const conversationId = await Conversation.findOrCreate(
      req.session.user._id,
      targetUser._id
    );

    res.redirect(`/messages/c/${conversationId}`);
  } catch {
    req.flash('errors', 'Utilisateur introuvable.');
    req.session.save(function() {
      res.redirect('/messages');
    });
  }
};

exports.searchUsers = async function(req, res) {
  try {
    const users = await User.searchForMessaging(
      req.body.searchTerm,
      req.session.user._id
    );
    res.json(users);
  } catch {
    res.json([]);
  }
};

exports.send = async function(req, res) {
  try {
    const message = new Message(
      req.body,
      req.session.user._id,
      req.params.conversationId
    );
    const saved = await message.create();

    const conversation = await Conversation.findByIdForUser(
      req.params.conversationId,
      req.session.user._id
    );

    const recipientId = conversation.otherUser._id.toString();
    const io = req.app.get('io');
    const senderProfile = {
      _id: req.session.user._id,
      username: req.session.user.username,
      avatar: req.session.user.avatar
    };

    if (io) {
      io.to(`user:${recipientId}`).emit('dmMessage', {
        conversationId: req.params.conversationId,
        message: saved,
        conversation: {
          _id: req.params.conversationId,
          otherUser: senderProfile
        }
      });
      io.to(`user:${req.session.user._id}`).emit('dmMessage', {
        conversationId: req.params.conversationId,
        message: saved
      });
    }

    res.json({ success: true, message: saved });
  } catch (errors) {
    const errorList = Array.isArray(errors)
      ? errors
      : ['Impossible d\'envoyer le message.'];
    res.status(400).json({ errors: errorList });
  }
};