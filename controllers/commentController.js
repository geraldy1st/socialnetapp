const Comment = require('../models/Comment');
const Post = require('../models/Post');

exports.create = async function(req, res) {
  try {
    const post = await Post.findSingleById(req.params.id, req.visitorId);
    const canComment = await Post.canVisitorComment(post, req.visitorId);

    if (!canComment) {
      res.status(403).json({ error: 'Vous ne pouvez pas commenter cette publication.' });
      return;
    }

    const comment = new Comment(req.body, req.session.user._id, req.params.id);
    const commentId = await comment.create();
    const comments = await Comment.findByPostId(req.params.id);
    const created = comments.find(function(item) {
      return item._id.toString() === commentId.toString();
    });

    const io = req.app.get('io');
    if (io && created) {
      io.emit('commentAdded', {
        postId: req.params.id,
        comment: {
          _id: created._id.toString(),
          body: created.body,
          createdDate: created.createdDate,
          author: created.author
        }
      });
    }

    res.json({ success: true, comment: created });
  } catch (errors) {
    const errorList = Array.isArray(errors) ? errors : ['Impossible d\'ajouter le commentaire.'];
    res.status(400).json({ errors: errorList });
  }
};