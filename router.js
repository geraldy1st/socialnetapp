const express = require('express');
const router = express.Router();
const userController = require('./controllers/userController');
const postController = require('./controllers/postController');
const followController = require('./controllers/followController');
const likeController = require('./controllers/likeController');
const commentController = require('./controllers/commentController');
const messageController = require('./controllers/messageController');
const notificationController = require('./controllers/notificationController');

// user related routes
router.get('/', userController.home);
router.get('/register', userController.viewRegisterScreen);
router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/logout', userController.logout);
router.post('/doesUsernameExist', userController.doesUsernameExist);
router.post('/doesEmailExist', userController.doesEmailExist);

// profile related routes
router.get(
  '/profile/:username',
  userController.ifUserExists,
  userController.sharedProfileData,
  userController.profilePostsScreen
);
router.get(
  '/profile/:username/followers',
  userController.ifUserExists,
  userController.sharedProfileData,
  userController.profileFollowersScreen
);
router.get(
  '/profile/:username/following',
  userController.ifUserExists,
  userController.sharedProfileData,
  userController.profileFollowingScreen
);
router.get(
  '/profile/:username/edit',
  userController.mustBeLoggedIn,
  userController.ifUserExists,
  userController.sharedProfileData,
  userController.viewProfileEditScreen
);
router.post(
  '/profile/:username/edit',
  userController.mustBeLoggedIn,
  userController.ifUserExists,
  userController.updateProfile
);

// post related routes
router.get(
  '/create-post',
  userController.mustBeLoggedIn,
  postController.viewCreateScreen
);
router.post(
  '/create-post',
  userController.mustBeLoggedIn,
  postController.create
);
router.get('/post/:id', postController.viewSingle);
router.get(
  '/post/:id/edit',
  userController.mustBeLoggedIn,
  postController.viewEditScreen
);
router.post(
  '/post/:id/edit',
  userController.mustBeLoggedIn,
  postController.edit
);
router.post(
  '/post/:id/delete',
  userController.mustBeLoggedIn,
  postController.delete
);
router.post('/search', postController.search);
router.post(
  '/post/:id/like',
  userController.mustBeLoggedIn,
  likeController.toggle
);
router.post(
  '/post/:id/comment',
  userController.mustBeLoggedIn,
  commentController.create
);

// notification routes
router.get(
  '/notifications',
  userController.mustBeLoggedIn,
  notificationController.activityScreen
);

// messaging routes
router.get(
  '/messages',
  userController.mustBeLoggedIn,
  messageController.inbox
);
router.get(
  '/messages/c/:conversationId',
  userController.mustBeLoggedIn,
  messageController.thread
);
router.get(
  '/messages/with/:username',
  userController.mustBeLoggedIn,
  messageController.startWithUser
);
router.post(
  '/messages/search-users',
  userController.mustBeLoggedIn,
  messageController.searchUsers
);
router.post(
  '/messages/c/:conversationId/send',
  userController.mustBeLoggedIn,
  messageController.send
);
router.post(
  '/messages/c/:conversationId/read',
  userController.mustBeLoggedIn,
  messageController.markRead
);

// follow related routes
router.post(
  '/addFollow/:username',
  userController.mustBeLoggedIn,
  followController.addFollow
);
router.post(
  '/removeFollow/:username',
  userController.mustBeLoggedIn,
  followController.removeFollow
);

module.exports = router;