const Like = require('../models/Like');
const Notification = require('../models/Notification');
const { emitBadgeCounts } = require('../utils/badgeNotifier');
const postsCollection = require('../db')
  .db()
  .collection('posts');
const ObjectID = require('mongodb').ObjectID;

exports.toggle = function(req, res) {
  Like.toggle(req.params.id, req.session.user._id)
    .then(async function(result) {
      const io = req.app.get('io');
      if (io) {
        io.emit('likeUpdate', {
          postId: req.params.id,
          liked: result.liked,
          count: result.count
        });
      }

      if (result.liked) {
        try {
          const post = await postsCollection.findOne(
            { _id: new ObjectID(req.params.id) },
            { projection: { author: 1 } }
          );

          if (post && !post.author.equals(req.session.user._id)) {
            await Notification.create({
              type: 'like',
              recipientId: post.author,
              actorId: req.session.user._id,
              postId: req.params.id
            });
            await emitBadgeCounts(io, post.author.toString());
          }
        } catch {}
      }

      res.json(result);
    })
    .catch(function() {
      res.status(400).json({ error: 'Unable to toggle like.' });
    });
};