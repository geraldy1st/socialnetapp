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
        to: `geraldy1st@gmail.com`,
        from: 'donotreply@socialnetapp.com',
        subject: 'New post on SNA',
        text: 'There is news on our app go check it out!',
        html: `<!doctype html>
        <html>
        
        <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="X-UA-Compatible" content="ie=edge" />
        <title>Emailing</title>
        </head>
        
        <body>
          <div class="container" style="width: 100%;
          background-color: #e8ecf0;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          font-size: 17px;
          font-weight: 200;
          letter-spacing: 0.03em;
          line-height: 26px;">
            <div class="center" style="margin: 0 auto;">
              <div class="header" style="color: #e8ecf0;
              height: 250px;
              padding: 1.5em;
              background: url(https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&h=750&w=1260)
                center no-repeat;">
                <div class="content-header" style=" height: 190px;
                background-color: rgba(22, 22, 22, 0.7);
                padding: 1.5em;
                margin: 5px auto;">
                <b style="color: #fff; font-weight: 500;
                color: #fff;">Hello! a new post in Social Net App got check it out!
              </b> and we’re excited to have you join our social App. To get started, just click the link below to dive into the newest post:</div>
              <a href="https://socialnetapp.herokuapp.com/">Social Net App</a>
                
              </div>
              <div class="body" style="color: #62707d;
              margin: 0 auto;
              padding: 1.5em;
              background-color: #fff;">
                <div class="mb" style="margin-bottom: 20px;"><b style="font-weight: 500;color: #222;">
                This is the new trendly App!
              </b> Social Net App will also helps you to learn how people use your
              app with mobile &amp; web analytics. Instead of tracking page
              views, you can measure and see how people are actually using our
              app by tracking actions. You can learn more about
              <a class="socialapp" style="font-weight: 500;text-decoration: none;color: #0084bd;" href="https://socialnetapp.herokuapp.com/"
                >Social Net App</a
              >.</div>
                <div class="signoff">Enjoy!
                  <br>
                  <br>
                  <em>- Social Net App team</em>
                  </div>


                  <div class="postscript" style="margin-top: 30px;
                  border-top: 3px solid #e8ecf0;
                  padding-top: 30px;
                  font-size: 15px;
                  line-height: 24px;
                  font-style: italic;">
                  PS: If you ever need help, word on the street is our customer
                  support is legendary. Test them by emailing them at
                  <a class="socialapp" href="mailto:geraldy.leondas@gmail.com"
                    >geraldy.leondas@gmail.com</a
                  >
                </div>

              
            </div>
          </div>
          <div
          class="footer"
          style="-webkit-text-size-adjust: none;
        -ms-text-size-adjust: none;
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        font-size: 0.7rem;
        font-weight: 400;
        text-align: center;
        color: #a9b4c3;
        white-space: nowrap;
        background-color: rgb(233, 233, 233);
        padding: 10px;
        margin-top: 30px;"
        >
          This email was sent automaticly by SNA, regarding your Social Network
          Application
          <br />Made with ❤️ in Paris
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
