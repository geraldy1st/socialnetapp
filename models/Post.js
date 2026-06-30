const postsCollection = require('../db')
  .db()
  .collection('posts');
const followsCollection = require('../db')
  .db()
  .collection('follows');
const ObjectID = require('mongodb').ObjectID;
const User = require('./User');
const Follow = require('./Follow');
const { deletePostMedia } = require('../utils/processPostMedia');
const sanitizeHTML = require('sanitize-html');

const PUBLIC_VISIBILITY = { $or: [{ visibility: 'public' }, { visibility: { $exists: false } }] };

let Post = function(data, userid, requestedPostId) {
  this.data = data;
  this.errors = [];
  this.userid = userid;
  this.requestedPostId = requestedPostId;
  this.media = null;
  this.removeMedia = false;
};

Post.prototype.parseVisibility = function() {
  return this.data.visibility === 'private' ? 'private' : 'public';
};

Post.prototype.cleanUp = function() {
  if (typeof this.data.body != 'string') {
    this.data.body = '';
  }

  this.data = {
    body: sanitizeHTML(this.data.body.trim(), {
      allowedTags: [],
      allowedAttributes: {}
    }),
    visibility: this.parseVisibility(),
    createdDate: new Date(),
    author: ObjectID(this.userid)
  };

  if (this.media && this.media.length) {
    this.data.media = this.media;
  }
};

Post.prototype.cleanUpForUpdate = function() {
  if (typeof this.data.body != 'string') {
    this.data.body = '';
  }

  this.data = {
    body: sanitizeHTML(this.data.body.trim(), {
      allowedTags: [],
      allowedAttributes: {}
    }),
    visibility: this.parseVisibility()
  };
};

Post.prototype.validate = function() {
  const hasBody = this.data.body && this.data.body.trim() !== '';
  const hasMedia = this.media && this.media.length;

  if (!hasBody && !hasMedia) {
    this.errors.push(
      'Vous devez ajouter une légende ou un média (image/vidéo).'
    );
  }
};

Post.prototype.create = function() {
  return new Promise((resolve, reject) => {
    this.cleanUp();
    this.validate();
    if (!this.errors.length) {
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
        let status = await this.actuallyUpdate(post);
        resolve(status);
      } else {
        reject();
      }
    } catch {
      reject();
    }
  });
};

Post.prototype.actuallyUpdate = function(existingPost) {
  return new Promise(async (resolve, reject) => {
    this.cleanUpForUpdate();

    if (this.media && this.media.length) {
      this.data.media = this.media;
    } else if (!this.removeMedia && existingPost.media) {
      this.data.media = existingPost.media;
    }

    this.media = this.data.media || null;
    this.validate();

    if (!this.errors.length) {
      const updateFields = {
        body: this.data.body,
        visibility: this.data.visibility
      };

      if (this.media && this.media.length) {
        updateFields.media = this.media;
        if (existingPost.media) {
          deletePostMedia(existingPost.media);
        }
      } else if (this.removeMedia) {
        updateFields.media = [];
        if (existingPost.media) {
          deletePostMedia(existingPost.media);
        }
      }

      await postsCollection.findOneAndUpdate(
        { _id: new ObjectID(this.requestedPostId) },
        { $set: updateFields }
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

Post.decoratePosts = function(posts, visitorId) {
  const visitorObjectId =
    visitorId && visitorId !== 0 ? new ObjectID(visitorId) : null;

  return posts.map(function(post) {
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

    post.likeCount = post.likeDocs ? post.likeDocs.length : 0;
    post.isLikedByVisitor = false;

    if (visitorObjectId && post.likeDocs && post.likeDocs.length) {
      post.isLikedByVisitor = post.likeDocs.some(function(like) {
        return like.userId.equals(visitorObjectId);
      });
    }

    if (!post.media) {
      post.media = [];
    }

    delete post.likeDocs;
    return post;
  });
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
          $lookup: {
            from: 'likes',
            localField: '_id',
            foreignField: 'postId',
            as: 'likeDocs'
          }
        },
        {
          $project: {
            title: 1,
            body: 1,
            media: 1,
            visibility: 1,
            createdDate: 1,
            authorId: '$author',
            likeDocs: 1,
            author: { $arrayElemAt: ['$authorDocument', 0] }
          }
        }
      ]);

      let posts = await postsCollection.aggregate(aggOperations).toArray();
      posts = Post.decoratePosts(posts, visitorId);
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
        if (post.media && post.media.length) {
          deletePostMedia(post.media);
        }
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
                  { body: { $regex: escaped, $options: 'i' } },
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
  let followedUsers = await followsCollection
    .find({ authorId: new ObjectID(id) })
    .toArray();
  followedUsers = followedUsers.map(function(followDoc) {
    return followDoc.followedId;
  });
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