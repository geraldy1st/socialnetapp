const uploadAvatar = require('./uploadAvatar');

function getProfileEditUsername(req) {
  const match = req.path.match(/^\/profile\/([^/]+)\/edit$/);
  return match ? match[1] : null;
}

module.exports = function prepareProfileEditUpload(req, res, next) {
  if (req.method !== 'POST' || !getProfileEditUsername(req)) {
    next();
    return;
  }

  uploadAvatar(req, res, function(err) {
    if (!err) {
      next();
      return;
    }

    const username = getProfileEditUsername(req);

    if (err.code === 'LIMIT_FILE_SIZE') {
      req.flash('errors', 'La photo doit faire moins de 2 Mo.');
    } else if (err.message === 'INVALID_AVATAR_TYPE') {
      req.flash(
        'errors',
        'Format non supporté. Utilisez JPG, PNG, GIF ou WebP.'
      );
    } else {
      req.flash('errors', 'Impossible de téléverser la photo de profil.');
    }

    req.session.save(function() {
      res.redirect(username ? `/profile/${username}/edit` : '/');
    });
  });
};