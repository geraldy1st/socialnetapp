const commentsCollection = require('../db')
  .db()
  .collection('comments');
const ObjectID = require('mongodb').ObjectID;
const User = require('./User');
const sanitizeHTML = require('sanitize-html');

let Comment = function(data, userId, postId) {
  this.data = data;
  this.userId = userId;
  this.postId = postId;
  this.errors = [];
};

Comment.prototype.cleanUp = function() {
  if (typeof this.data.body != 'string') {
    this.data.body = '';
  }

  this.data = {
    body: sanitizeHTML(this.data.body.trim(), {
      allowedTags: [],
      allowedAttributes: {}
    }),
    postId: new ObjectID(this.postId),
    userId: new ObjectID(this.userId),
    createdDate: new Date()
  };
};

Comment.prototype.validate = function() {
  if (!this.data.body || this.data.body.trim() === '') {
    this.errors.push('Le commentaire ne peut pas être vide.');
  }

  if (this.data.body.length > 500) {
    this.errors.push('Le commentaire ne peut pas dépasser 500 caractères.');
  }
};

Comment.prototype.create = function() {
  return new Promise((resolve, reject) => {
    this.cleanUp();
    this.validate();

    if (!this.errors.length) {
      commentsCollection
        .insertOne(this.data)
        .then(function(info) {
          resolve(info.ops[0]._id);
        })
        .catch(function() {
          reject(['Impossible d\'enregistrer le commentaire.']);
        });
    } else {
      reject(this.errors);
    }
  });
};

Comment.findByPostId = function(postId) {
  return new Promise(async function(resolve, reject) {
    try {
      if (typeof postId != 'string' || !ObjectID.isValid(postId)) {
        reject();
        return;
      }

      let comments = await commentsCollection
        .aggregate([
          { $match: { postId: new ObjectID(postId) } },
          { $sort: { createdDate: 1 } },
          {
            $lookup: {
              from: 'users',
              localField: 'userId',
              foreignField: '_id',
              as: 'authorDocument'
            }
          },
          {
            $project: {
              body: 1,
              createdDate: 1,
              userId: 1,
              author: { $arrayElemAt: ['$authorDocument', 0] }
            }
          }
        ])
        .toArray();

      comments = comments.map(function(comment) {
        return {
          _id: comment._id,
          body: comment.body,
          createdDate: comment.createdDate,
          userId: comment.userId,
          author: {
            username: comment.author.username,
            avatar: new User(comment.author, true).avatar
          }
        };
      });

      resolve(comments);
    } catch {
      reject();
    }
  });
};

module.exports = Comment;