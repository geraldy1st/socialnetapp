const uploadPostMedia = require('./uploadPostMedia');

function isPostCreateRoute(req) {
  return req.method === 'POST' && req.path === '/create-post';
}

function isPostEditRoute(req) {
  return req.method === 'POST' && /^\/post\/[^/]+\/edit$/.test(req.path);
}

module.exports = function preparePostUpload(req, res, next) {
  if (!isPostCreateRoute(req) && !isPostEditRoute(req)) {
    next();
    return;
  }

  uploadPostMedia(req, res, function(err) {
    if (!err) {
      next();
      return;
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
      req.flash('errors', 'Le fichier doit faire moins de 15 Mo.');
    } else if (err.message === 'INVALID_MEDIA_TYPE') {
      req.flash(
        'errors',
        'Format non supporté. Images (JPG, PNG, GIF, WebP) ou vidéos (MP4, WebM).'
      );
    } else {
      req.flash('errors', 'Impossible de téléverser le média.');
    }

    const redirectTo = isPostCreateRoute(req)
      ? '/create-post'
      : req.get('Referer') || '/';

    req.session.save(function() {
      res.redirect(redirectTo);
    });
  });
};