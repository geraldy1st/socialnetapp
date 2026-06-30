const User = require('../models/User');
const Post = require('../models/Post');
const Follow = require('../models/Follow');
const jwt = require('jsonwebtoken');

exports.apiGetPostsByUsername = async function(req, res) {
  try {
    let authorDoc = await User.findByUsername(req.params.username);
    let posts = await Post.findByAuthorId(authorDoc._id, 0);
    res.json(posts);
  } catch {
    res.json('Sorry, invalid user requested.');
  }
};

exports.apiMustBeLoggedIn = function(req, res, next) {
  try {
    req.apiUser = jwt.verify(req.body.token, process.env.JWTSECRET);
    next();
  } catch {
    res.json('Sorry, you must provide a valid token.');
  }
};

exports.doesUsernameExist = function(req, res) {
  User.findByUsername(req.body.username)
    .then(function() {
      res.json(true);
    })
    .catch(function() {
      res.json(false);
    });
};

exports.doesEmailExist = async function(req, res) {
  let emailBool = await User.doesEmailExist(req.body.email);
  res.json(emailBool);
};

exports.sharedProfileData = async function(req, res, next) {
  let isVisitorsProfile = false;
  let isFollowing = false;
  if (req.session.user) {
    isVisitorsProfile = req.profileUser._id.equals(req.session.user._id);
    isFollowing = await Follow.isVisitorFollowing(
      req.profileUser._id,
      req.visitorId
    );
  }

  req.isVisitorsProfile = isVisitorsProfile;
  req.isFollowing = isFollowing;
  // retrieve post, follower, and following counts
  let postCountPromise = Post.countPostsByAuthor(
    req.profileUser._id,
    req.visitorId
  );
  let followerCountPromise = Follow.countFollowersById(req.profileUser._id);
  let followingCountPromise = Follow.countFollowingById(req.profileUser._id);
  let [postCount, followerCount, followingCount] = await Promise.all([
    postCountPromise,
    followerCountPromise,
    followingCountPromise
  ]);

  req.postCount = postCount;
  req.followerCount = followerCount;
  req.followingCount = followingCount;

  next();
};

exports.mustBeLoggedIn = function(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.flash('errors', 'You must be logged in to perform that action.');
    req.session.save(function() {
      res.redirect('/');
    });
  }
};

exports.login = function(req, res) {
  let user = new User(req.body);
  user
    .login()
    .then(function(result) {
      req.session.user = {
        avatar: user.avatar,
        username: user.data.username,
        _id: user.data._id,
        theme: user.data.theme || 'light'
      };
      req.session.save(function() {
        res.redirect('/');
      });
    })
    .catch(function(e) {
      req.flash('errors', e);
      req.session.save(function() {
        res.redirect('/');
      });
    });
};

exports.apiLogin = function(req, res) {
  let user = new User(req.body);
  user
    .login()
    .then(function(result) {
      res.json(
        jwt.sign({ _id: user.data._id }, process.env.JWTSECRET, {
          expiresIn: '7d'
        })
      );
    })
    .catch(function(e) {
      res.json('Sorry, your values are not correct.');
    });
};

exports.logout = function(req, res) {
  req.session.destroy(function() {
    res.redirect('/');
  });
};

exports.viewRegisterScreen = function(req, res) {
  if (req.session.user) {
    res.redirect('/');
    return;
  }

  res.render('register', {
    title: 'Inscription',
    regErrors: req.flash('regErrors')
  });
};

exports.register = function(req, res) {
  let user = new User(req.body);
  user
    .register()
    .then(() => {
      req.session.user = {
        username: user.data.username,
        avatar: user.avatar,
        _id: user.data._id,
        theme: 'light'
      };
      req.session.save(function() {
        res.redirect('/');
      });
    })
    .catch(regErrors => {
      regErrors.forEach(function(error) {
        req.flash('regErrors', error);
      });
      req.session.save(function() {
        res.redirect('/register');
      });
    });
};

exports.home = async function(req, res, next) {
  try {
    const visitorId = req.session.user ? req.session.user._id : 0;
    let posts = await Post.getHomeFeed(visitorId);

    if (req.session.user) {
      res.render('home-dashboard', { posts: posts });
    } else {
      res.render('home-guest', { posts: posts });
    }
  } catch (err) {
    next(err);
  }
};

exports.ifUserExists = function(req, res, next) {
  User.findByUsername(req.params.username)
    .then(function(userDocument) {
      req.profileUser = userDocument;
      next();
    })
    .catch(function() {
      res.render('404');
    });
};

exports.profilePostsScreen = function(req, res) {
  // ask our post model for posts by a certain author id
  Post.findByAuthorId(req.profileUser._id, req.visitorId)
    .then(function(posts) {
      res.render('profile', {
        title: `Profile for ${req.profileUser.username}`,
        currentPage: 'posts',
        posts: posts,
        profileUsername: req.profileUser.username,
        profileAvatar: req.profileUser.avatar,
        isFollowing: req.isFollowing,
        isVisitorsProfile: req.isVisitorsProfile,
        counts: {
          postCount: req.postCount,
          followerCount: req.followerCount,
          followingCount: req.followingCount
        }
      });
    })
    .catch(function() {
      res.render('404');
    });
};

exports.profileFollowersScreen = async function(req, res) {
  try {
    let followers = await Follow.getFollowersById(req.profileUser._id);
    res.render('profile-followers', {
      currentPage: 'followers',
      followers: followers,
      profileUsername: req.profileUser.username,
      profileAvatar: req.profileUser.avatar,
      isFollowing: req.isFollowing,
      isVisitorsProfile: req.isVisitorsProfile,
      counts: {
        postCount: req.postCount,
        followerCount: req.followerCount,
        followingCount: req.followingCount
      }
    });
  } catch {
    res.render('404');
  }
};

exports.profileFollowingScreen = async function(req, res) {
  try {
    let following = await Follow.getFollowingById(req.profileUser._id);
    res.render('profile-following', {
      currentPage: 'following',
      following: following,
      profileUsername: req.profileUser.username,
      profileAvatar: req.profileUser.avatar,
      isFollowing: req.isFollowing,
      isVisitorsProfile: req.isVisitorsProfile,
      counts: {
        postCount: req.postCount,
        followerCount: req.followerCount,
        followingCount: req.followingCount
      }
    });
  } catch {
    res.render('404');
  }
};

exports.viewProfileEditScreen = async function(req, res) {
  if (!req.isVisitorsProfile) {
    req.flash('errors', 'You do not have permission to perform that action.');
    req.session.save(() => res.redirect(`/profile/${req.params.username}`));
    return;
  }

  try {
    let userDoc = await User.findById(req.session.user._id);
    let userWithAvatar = new User(userDoc, true);
    res.render('profile-edit', {
      title: 'Modifier le profil',
      profileUser: {
        username: userDoc.username,
        email: userDoc.email,
        avatar: userWithAvatar.avatar,
        hasCustomAvatar: !!userDoc.avatarUrl,
        theme: userDoc.theme || 'light'
      }
    });
  } catch {
    res.render('404');
  }
};

exports.updateProfile = function(req, res) {
  if (!req.profileUser._id.equals(req.session.user._id)) {
    req.flash('errors', 'You do not have permission to perform that action.');
    req.session.save(() => res.redirect('/'));
    return;
  }

  const avatarOptions = {};

  if (req.body.useGravatar === 'true') {
    avatarOptions.useGravatar = true;
  } else if (req.file) {
    avatarOptions.newAvatarUrl = `/uploads/avatars/${req.file.filename}`;
  }

  let user = new User(req.body);
  user
    .updateProfile(req.session.user._id, avatarOptions)
    .then(function(updatedUser) {
      req.session.user.username = updatedUser.username;
      req.session.user.avatar = updatedUser.avatar;
      req.session.user.theme = updatedUser.theme;
      req.flash('success', 'Profil mis à jour avec succès.');
      req.session.save(() => res.redirect(`/profile/${updatedUser.username}`));
    })
    .catch(function(errors) {
      if (req.file) {
        User.deleteAvatarFile(`/uploads/avatars/${req.file.filename}`);
      }

      if (Array.isArray(errors)) {
        errors.forEach(function(error) {
          req.flash('errors', error);
        });
      } else {
        req.flash('errors', 'Unable to update profile.');
      }
      req.session.save(() =>
        res.redirect(`/profile/${req.params.username}/edit`)
      );
    });
};
