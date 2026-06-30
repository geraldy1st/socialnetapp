const Post = require('../models/Post');
const Comment = require('../models/Comment');
const { processPostMedia } = require('../utils/processPostMedia');
const { getPostPageTitle } = require('../utils/postDisplay');
const sendgrid = require('@sendgrid/mail');
if (process.env.SENDGRIDAPIKEY) {
  sendgrid.setApiKey(process.env.SENDGRIDAPIKEY);
}

function sendNewPostNotification() {
  if (!process.env.SENDGRIDAPIKEY) {
    return Promise.resolve();
  }

  return sendgrid.send({
    to: 'geraldy1st@gmail.com',
    from: 'donotreply@socialnetapp.com',
    subject: 'New post on SNA',
    text: 'There is news on our app go check it out!',
    html: newPostEmailHtml()
  });
}

function newPostEmailHtml() {
  return `<!doctype html><html><body><p>New post on SocialNet</p></body></html>`;
}

exports.viewCreateScreen = function(req, res) {
  res.render('create-post');
};

exports.create = async function(req, res) {
  try {
    let mediaItem = null;

    if (req.file) {
      mediaItem = await processPostMedia(req.file);
    }

    let post = new Post(req.body, req.session.user._id);
    if (mediaItem) {
      post.media = [mediaItem];
    }

    const newId = await post.create();
    await sendNewPostNotification().catch(() => {});

    req.flash('success', 'Publication créée avec succès.');
    req.session.save(() => res.redirect(`/post/${newId}`));
  } catch (errors) {
    if (req.file && req.file.path) {
      try {
        const fs = require('fs');
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      } catch {}
    }

    const errorList = Array.isArray(errors) ? errors : ['Please try again later.'];
    errorList.forEach(error => req.flash('errors', error));
    req.session.save(() => res.redirect('/create-post'));
  }
};

exports.apiCreate = function(req, res) {
  let post = new Post(req.body, req.apiUser._id);
  post
    .create()
    .then(function() {
      res.json('Congrats.');
    })
    .catch(function(errors) {
      res.json(errors);
    });
};

exports.viewSingle = async function(req, res) {
  try {
    let post = await Post.findSingleById(req.params.id, req.visitorId);
    const comments = await Comment.findByPostId(req.params.id);
    const canComment = await Post.canVisitorComment(post, req.visitorId);

    res.render('single-post-screen', {
      post: post,
      comments: comments,
      canComment: canComment,
      title: getPostPageTitle(post)
    });
  } catch {
    res.render('404');
  }
};

exports.viewEditScreen = async function(req, res) {
  try {
    let post = await Post.findSingleById(req.params.id, req.visitorId);
    if (post.isVisitorOwner) {
      res.render('edit-post', { post: post });
    } else {
      req.flash('errors', 'You do not have permission to perform that action.');
      req.session.save(() => res.redirect('/'));
    }
  } catch {
    res.render('404');
  }
};

exports.edit = async function(req, res) {
  try {
    const existingPost = await Post.findSingleById(req.params.id, req.visitorId);

    if (!existingPost.isVisitorOwner) {
      req.flash('errors', 'You do not have permission to perform that action.');
      req.session.save(() => res.redirect('/'));
      return;
    }

    let post = new Post(req.body, req.visitorId, req.params.id);

    if (req.file) {
      const mediaItem = await processPostMedia(req.file);
      post.media = [mediaItem];
    }

    if (req.body.removeMedia === 'true') {
      post.removeMedia = true;
    }

    const status = await post.actuallyUpdate(existingPost);

    if (status == 'success') {
      req.flash('success', 'Publication mise à jour.');
      req.session.save(() => res.redirect(`/post/${req.params.id}`));
    } else {
      post.errors.forEach(error => req.flash('errors', error));
      req.session.save(() => res.redirect(`/post/${req.params.id}/edit`));
    }
  } catch {
    if (req.file && req.file.path) {
      try {
        const fs = require('fs');
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      } catch {}
    }

    req.flash('errors', 'You do not have permission to perform that action.');
    req.session.save(() => res.redirect('/'));
  }
};

exports.delete = function(req, res) {
  Post.delete(req.params.id, req.visitorId)
    .then(() => {
      req.flash('success', 'Post successfully deleted.');
      req.session.save(() =>
        res.redirect(`/profile/${req.session.user.username}`)
      );
    })
    .catch(() => {
      req.flash('errors', 'You do not have permission to perform that action.');
      req.session.save(() => res.redirect('/'));
    });
};

exports.apiDelete = function(req, res) {
  Post.delete(req.params.id, req.apiUser._id)
    .then(() => {
      res.json('Success');
    })
    .catch(() => {
      res.json('You do not have permission to perform that action.');
    });
};

exports.search = function(req, res) {
  Post.search(req.body.searchTerm, req.visitorId)
    .then(posts => {
      res.json(posts);
    })
    .catch(() => {
      res.json([]);
    });
};