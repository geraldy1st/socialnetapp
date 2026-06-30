const Like = require('../models/Like');

exports.toggle = function(req, res) {
  Like.toggle(req.params.id, req.session.user._id)
    .then(function(result) {
      res.json(result);
    })
    .catch(function() {
      res.status(400).json({ error: 'Unable to toggle like.' });
    });
};