const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo')(session);
const flash = require('connect-flash');
const markdown = require('marked');
const csrf = require('csurf');
const app = express();
const sanitizeHTML = require('sanitize-html');

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use('/api', require('./router-api'));

let sessionOptions = session({
  secret: 'JavaScript is sooooooooo coool',
  store: new MongoStore({ client: require('./db') }),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24, httpOnly: true }
});

app.use(sessionOptions);
app.use(flash());

app.use(async function(req, res, next) {
  // make our markdown function available from within ejs templates
  res.locals.filterUserHTML = function(content) {
    return sanitizeHTML(markdown(content), {
      allowedTags: [
        'p',
        'br',
        'ul',
        'ol',
        'li',
        'strong',
        'bold',
        'i',
        'em',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6'
      ],
      allowedAttributes: {}
    });
  };

  // make all error and success flash messages available from all templates
  res.locals.errors = req.flash('errors');
  res.locals.success = req.flash('success');

  // make current user id available on the req object
  if (req.session.user) {
    req.visitorId = req.session.user._id;
  } else {
    req.visitorId = 0;
  }

  // make user session data available from within view templates
  res.locals.user = req.session.user;

  res.locals.theme =
    req.session.user && req.session.user.theme === 'dark' ? 'dark' : 'light';

  const postDisplay = require('./utils/postDisplay');
  res.locals.getPostExcerpt = postDisplay.getPostExcerpt;
  res.locals.getPostPageTitle = postDisplay.getPostPageTitle;

  res.locals.unreadDmCount = 0;
  res.locals.unreadActivityCount = 0;

  if (req.session.user) {
    try {
      const { getBadgeCounts } = require('./utils/badgeNotifier');
      const counts = await getBadgeCounts(req.session.user._id);
      res.locals.unreadDmCount = counts.dmCount;
      res.locals.unreadActivityCount = counts.activityCount;
    } catch {}
  }

  next();
});

const router = require('./router');

app.use(express.static('public'));
app.set('views', 'views');
app.set('view engine', 'ejs');

// Parse multipart uploads before CSRF so _csrf is available in req.body
app.use(require('./middleware/prepareProfileEditUpload'));
app.use(require('./middleware/preparePostUpload'));

app.use(csrf());

app.use(function(req, res, next) {
  res.locals.csrfToken = req.csrfToken();
  next();
});

app.use('/', router);

app.use(function(err, req, res, next) {
  if (err) {
    if (err.code == 'EBADCSRFTOKEN') {
      req.flash(
        'errors',
        'Session expirée ou formulaire invalide. Veuillez réessayer.'
      );
      const redirectTo = req.get('Referer') || '/';
      req.session.save(() => res.redirect(redirectTo));
    } else {
      res.render('404');
    }
  }
});

const server = require('http').createServer(app);

const io = require('socket.io')(server);
app.set('io', io);

io.use(function(socket, next) {
  sessionOptions(socket.request, socket.request.res, next);
});

io.on('connection', function(socket) {
  if (socket.request.session.user) {
    const userId = socket.request.session.user._id;
    socket.join(`user:${userId}`);
  }
});

module.exports = server;