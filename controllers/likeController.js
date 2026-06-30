const Like = require('../models/Like');

exports.toggle = function(req, res) {
  Like.toggle(req.params.id, req.session.user._id)
    .then(function(result) {
      const io = req.app.get('io');
      if (io) {
        io.emit('likeUpdate', {
          postId: req.params.id,
          liked: result.liked,
          count: result.count
        });
      }
      res.json(result);
    })
    .catch(function() {
      res.status(400).json({ error: 'Unable to toggle like.' });
    });
};