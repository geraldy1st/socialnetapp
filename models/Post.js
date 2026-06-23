const postsCollection = require('../db')
  .db()
  .collection('posts');
const followsCollection = require('../db')
  .db()
  .collection('follows');
const ObjectID = require('mongodb').ObjectID;
const User = require('./User');
const Follow = require('./Follow');
const sanitizeHTML = require('sanitize-html');

const PUBLIC_VISIBILITY = { $or: [{ visibility: 'public' }, { visibility: { $exists: false } }] };

let Post = function(data, userid, requestedPostId) {
  this.data = data;
  this.errors = [];
  this.userid = userid;
  this.requestedPostId = requestedPostId;
};

Post.prototype.parseVisibility = function() {
  return this.data.visibility === 'private' ? 'private' : 'public';
};

Post.prototype.cleanUp = function() {
  if (typeof this.data.title != 'string') {
    this.data.title = '';
  }
  if (typeof this.data.body != 'string') {
    this.data.body = '';
  }

  // get rid of any bogus properties
  this.data = {
    title: sanitizeHTML(this.data.title.trim(), {
      allowedTags: [],
      allowedAttributes: {}
    }),
    body: sanitizeHTML(this.data.body.trim(), {
      allowedTags: [],
      allowedAttributes: {}
    }),
    visibility: this.parseVisibility(),
    createdDate: new Date(),
    author: ObjectID(this.userid)
  };
};

Post.prototype.cleanUpForUpdate = function() {
  if (typeof this.data.title != 'string') {
    this.data.title = '';
  }
  if (typeof this.data.body != 'string') {
    this.data.body = '';
  }

  this.data = {
    title: sanitizeHTML(this.data.title.trim(), {
      allowedTags: [],
      allowedAttributes: {}
    }),
    body: sanitizeHTML(this.data.body.trim(), {
      allowedTags: [],
      allowedAttributes: {}
    }),
    visibility: this.parseVisibility()
  };
};

Post.prototype.validate = function() {
  if (this.data.title == '') {
    this.errors.push('You must provide a title.');
  }
  if (this.data.body == '') {
    this.errors.push('You must provide post content.');
  }
};

Post.prototype.create = function() {
  return new Promise((resolve, reject) => {
    this.cleanUp();
    this.validate();
    if (!this.errors.length) {
      // save post into database
      postsCollection
        .insertOne(this.data)
        .then(info => {
          resolve(info.ops[0]._id);
        })
        .catch(() => {
          this.errors.push('Please try again later.');
          reject(this.errors);
        });
    } else {
      reject(this.errors);
    }
  });
};

Post.prototype.update = function() {
  return new Promise(async (resolve, reject) => {
    try {
      let post = await Post.findSingleById(this.requestedPostId, this.userid);
      if (post.isVisitorOwner) {
        // actually update the db
        let status = await this.actuallyUpdate();
        resolve(status);
      } else {
        reject();
      }
    } catch {
      reject();
    }
  });
};

Post.prototype.actuallyUpdate = function() {
  return new Promise(async (resolve, reject) => {
    this.cleanUpForUpdate();
    this.validate();
    if (!this.errors.length) {
      await postsCollection.findOneAndUpdate(
        { _id: new ObjectID(this.requestedPostId) },
        {
          $set: {
            title: this.data.title,
            body: this.data.body,
            visibility: this.data.visibility
          }
        }
      );
      resolve('success');
    } else {
      resolve('failure');
    }
  });
};

Post.canVisitorViewPrivatePosts = async function(authorId, visitorId) {
  if (!visitorId || visitorId === 0) {
    return false;
  }

  if (authorId.equals(visitorId)) {
    return true;
  }

  return Follow.isVisitorFollowing(authorId, visitorId);
};

Post.getAuthorVisibilityMatch = async function(authorId, visitorId) {
  const match = { author: authorId };
  const canViewPrivate = await Post.canVisitorViewPrivatePosts(
    authorId,
    visitorId
  );

  if (!canViewPrivate) {
    match.$or = PUBLIC_VISIBILITY.$or;
  }

  return match;
};

Post.getGlobalVisibilityMatch = async function(visitorId) {
  if (!visitorId || visitorId === 0) {
    return PUBLIC_VISIBILITY;
  }

  let followedUsers = await followsCollection
    .find({ authorId: new ObjectID(visitorId) })
    .toArray();
  followedUsers = followedUsers.map(function(followDoc) {
    return followDoc.followedId;
  });

  return {
    $or: [
      ...PUBLIC_VISIBILITY.$or,
      { author: new ObjectID(visitorId) },
      { author: { $in: followedUsers }, visibility: 'private' }
    ]
  };
};

Post.assertVisitorCanView = async function(post, visitorId) {
  const visibility = post.visibility || 'public';

  if (visibility !== 'private') {
    return true;
  }

  return Post.canVisitorViewPrivatePosts(post.authorId, visitorId);
};

Post.reusablePostQuery = function(uniqueOperations, visitorId) {
  return new Promise(async function(resolve, reject) {
    try {
      let aggOperations = uniqueOperations.concat([
        {
          $lookup: {
            from: 'users',
            localField: 'author',
            foreignField: '_id',
            as: 'authorDocument'
          }
        },
        {
          $project: {
            title: 1,
            body: 1,
            visibility: 1,
            createdDate: 1,
            authorId: '$author',
            author: { $arrayElemAt: ['$authorDocument', 0] }
          }
        }
      ]);

      let posts = await postsCollection.aggregate(aggOperations).toArray();

      posts = posts.map(function(post) {
        if (visitorId && visitorId !== 0) {
          post.isVisitorOwner = post.authorId.equals(visitorId);
        } else {
          post.isVisitorOwner = false;
        }

        post.author = {
          username: post.author.username,
          avatar: new User(post.author, true).avatar
        };

        if (!post.visibility) {
          post.visibility = 'public';
        }

        return post;
      });

      resolve(posts);
    } catch (err) {
      reject(err);
    }
  });
};

Post.findSingleById = function(id, visitorId) {
  return new Promise(async function(resolve, reject) {
    if (typeof id != 'string' || !ObjectID.isValid(id)) {
      reject();
      return;
    }

    let posts = await Post.reusablePostQuery(
      [{ $match: { _id: new ObjectID(id) } }],
      visitorId
    );

    if (!posts.length) {
      reject();
      return;
    }

    const post = posts[0];
    const canView = await Post.assertVisitorCanView(post, visitorId);

    if (canView) {
      resolve(post);
    } else {
      reject();
    }
  });
};

Post.findByAuthorId = function(authorId, visitorId) {
  return new Promise(async function(resolve, reject) {
    try {
      const match = await Post.getAuthorVisibilityMatch(authorId, visitorId);
      const posts = await Post.reusablePostQuery(
        [{ $match: match }, { $sort: { createdDate: -1 } }],
        visitorId
      );
      resolve(posts);
    } catch {
      reject();
    }
  });
};

Post.delete = function(postIdToDelete, currentUserId) {
  return new Promise(async (resolve, reject) => {
    try {
      let post = await Post.findSingleById(postIdToDelete, currentUserId);
      if (post.isVisitorOwner) {
        await postsCollection.deleteOne({ _id: new ObjectID(postIdToDelete) });
        resolve();
      } else {
        reject();
      }
    } catch {
      reject();
    }
  });
};

Post.search = function(searchTerm, visitorId) {
  return new Promise(async (resolve, reject) => {
    if (typeof searchTerm != 'string') {
      reject();
      return;
    }

    const trimmed = searchTerm.trim();
    if (!trimmed) {
      resolve([]);
      return;
    }

    const safeVisitorId = visitorId === undefined ? 0 : visitorId;
    const visibilityMatch = await Post.getGlobalVisibilityMatch(safeVisitorId);

    try {
      let posts = await Post.reusablePostQuery(
        [
          {
            $match: {
              $and: [{ $text: { $search: trimmed } }, visibilityMatch]
            }
          },
          { $addFields: { score: { $meta: 'textScore' } } },
          { $sort: { score: -1 } }
        ],
        safeVisitorId
      );
      resolve(posts);
    } catch {
      try {
        const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        let posts = await Post.reusablePostQuery(
          [
            {
              $match: {
                $and: [
                  {
                    $or: [
                      { title: { $regex: escaped, $options: 'i' } },
                      { body: { $regex: escaped, $options: 'i' } }
                    ]
                  },
                  visibilityMatch
                ]
              }
            },
            { $sort: { createdDate: -1 } }
          ],
          safeVisitorId
        );
        resolve(posts);
      } catch {
        resolve([]);
      }
    }
  });
};

Post.countPostsByAuthor = function(id, visitorId) {
  return new Promise(async (resolve, reject) => {
    try {
      const match = await Post.getAuthorVisibilityMatch(id, visitorId);
      let postCount = await postsCollection.countDocuments(match);
      resolve(postCount);
    } catch {
      reject();
    }
  });
};

Post.getFeed = async function(id) {
  // create an array of the user ids that the current user follows
  let followedUsers = await followsCollection
    .find({ authorId: new ObjectID(id) })
    .toArray();
  followedUsers = followedUsers.map(function(followDoc) {
    return followDoc.followedId;
  });
  // look for posts where the author is in the above array of followed users
  return Post.reusablePostQuery([
    { $match: { author: { $in: followedUsers } } },
    { $sort: { createdDate: -1 } }
  ]);
};

Post.getHomeFeed = async function(visitorId) {
  const safeVisitorId = visitorId === undefined ? 0 : visitorId;
  const visibilityMatch = await Post.getGlobalVisibilityMatch(safeVisitorId);

  return Post.reusablePostQuery(
    [{ $match: visibilityMatch }, { $sort: { createdDate: -1 } }],
    safeVisitorId
  );
};

module.exports = Post;
