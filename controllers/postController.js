const Post = require('../models/Post');
const sendgrid = require('@sendgrid/mail');
sendgrid.setApiKey(process.env.SENDGRIDAPIKEY);

exports.viewCreateScreen = function(req, res) {
  res.render('create-post');
};

exports.create = function(req, res) {
  let post = new Post(req.body, req.session.user._id);
  post
    .create()
    .then(function(newId) {
      sendgrid.send({
        to: 'geraldy1st@gmail.com',
        from: 'donotreply@socialnetapp.com',
        subject: 'Congrats on creating a New post',
        text: 'You did a great job of creating a post',
        html: `<!doctype html>
        <html>
        
        <head>
          <meta charset="utf-8">
          <title>test title email</title>
        </head>
        
        <body>
          <div class="container" style="width: 100%;min-width: 700px;background-color: #e8ecf0;font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size: 17px;font-weight: 200;letter-spacing: 0.03em;line-height: 26px;padding: 40px 0 100px 0;">
            <div class="center" style="width: 700px;margin: 0 auto;">
              <div class="header" style="color: #9dc1d0;height: 268px;padding: 132px 70px 0 70px;background: url(https://cdn.mxpnl.com/cache/c9fd0293c449e2bd921e027f69dc2093/images/email/invite_header.png) no-repeat;background-color: #003a66;">
                <div class="content" style="max-width: 370px;"><b style="font-weight: 500;color: white;">
                Hello! Really Good Emails invited you to check out their analytics project
              </b> and we’re excited to have you join their team. To get started, just click the link below to dive into the team’s data:</div>
                <a class="cta" href="#"
                  style="font-weight: 500;text-decoration: none;color: #0084bd;">
                  <img src="https://cdn.mxpnl.com/cache/78ae9d749ebad628c14c0f03426f7ba8/images/email/invite_button.png" alt="Accept invite &amp; get data-driven ⟶" border="0" style="margin-top: 42px;font-size: 20px;color: white;">
                </a>
              </div>
              <div class="body" style="color: #62707d;margin: 0 auto;padding: 50px 70px 70px 70px;background-color: white;">
                <div class="content" style="margin-bottom: 20px;"><b style="font-weight: 500;">
                Never heard of Mixpanel?
              </b> Mixpanel helps you learn how people use your app with mobile &amp; web analytics. Instead of tracking page views, you can measure and see how people are actually using your app by tracking actions. You can learn more about Mixpanel by
                  <a href="https://mixpanel.com/engagement/" border="0" style="font-weight: 500;text-decoration: none;color: #0084bd;">touring our features</a>.</div>
                <div class="signoff">Enjoy!
                  <br>
                  <br>- The Mixpanel team</div>
                <div class="postscript" style="margin-top: 30px;border-top: 3px solid #e8ecf0;padding-top: 30px;font-size: 15px;line-height: 24px;font-style: italic;">PS: If you ever need help, word on the street is our customer support is legendary. Test them by emailing them at
                  <a href="mailto:support@mixpanel.com" border="0" style="font-weight: 500;text-decoration: none;color: #0084bd;">support@mixpanel.com</a>, we dare you!</div>
              </div>
              <div class="footer" style="-webkit-text-size-adjust: none;-ms-text-size-adjust: none;font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;font-size: 12px;font-weight: 400;padding-top: 24px;text-align: center;line-height: 16px;color: #a9b4c3;white-space: nowrap;">This email was sent to
                <a href="#" style="text-decoration: none;font-weight: 400;color: #a9b4c3;" border="0">xxxxxxx@xxxxx.com</a> regarding your Mixpanel account
                <br>by Mixpanel, Inc, 405 Howard St., Floor 2, San Francisco CA 94105.
                <a href="#" border="0" style="-webkit-text-size-adjust: none;-ms-text-size-adjust: none;font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;font-weight: 400;text-decoration: underline;color: #a9b4c3;">Unsubscribe</a>
              </div>
            </div>
          </div>
        
        </body>
        
        </html>`
      });
      req.flash('success', 'New post successfully created.');
      req.session.save(() => res.redirect(`/post/${newId}`));
    })
    .catch(function(errors) {
      errors.forEach(error => req.flash('errors', error));
      req.session.save(() => res.redirect('/create-post'));
    });
};

exports.apiCreate = function(req, res) {
  let post = new Post(req.body, req.apiUser._id);
  post
    .create()
    .then(function(newId) {
      res.json('Congrats.');
    })
    .catch(function(errors) {
      res.json(errors);
    });
};

exports.viewSingle = async function(req, res) {
  try {
    let post = await Post.findSingleById(req.params.id, req.visitorId);
    res.render('single-post-screen', { post: post, title: post.title });
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

exports.edit = function(req, res) {
  let post = new Post(req.body, req.visitorId, req.params.id);
  post
    .update()
    .then(status => {
      // the post was successfully updated in the database
      // or user did have permission, but there were validation errors
      if (status == 'success') {
        // post was updated in db
        req.flash('success', 'Post successfully updated.');
        req.session.save(function() {
          res.redirect(`/post/${req.params.id}/edit`);
        });
      } else {
        post.errors.forEach(function(error) {
          req.flash('errors', error);
        });
        req.session.save(function() {
          res.redirect(`/post/${req.params.id}/edit`);
        });
      }
    })
    .catch(() => {
      // a post with the requested id doesn't exist
      // or if the current visitor is not the owner of the requested post
      req.flash('errors', 'You do not have permission to perform that action.');
      req.session.save(function() {
        res.redirect('/');
      });
    });
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
      req.json('Success');
    })
    .catch(() => {
      req.json('You do not have permission to perform that action.');
    });
};

exports.search = function(req, res) {
  Post.search(req.body.searchTerm)
    .then(posts => {
      res.json(posts);
    })
    .catch(() => {
      res.json([]);
    });
};
