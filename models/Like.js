const likesCollection = require('../db')
  .db()
  .collection('likes');
const ObjectID = require('mongodb').ObjectID;

let Like = function(postId, userId) {
  this.postId = postId;
  this.userId = userId;
};

Like.toggle = function(postId, userId) {
  return new Promise(async function(resolve, reject) {
    try {
      if (typeof postId != 'string' || !ObjectID.isValid(postId)) {
        reject();
        return;
      }

      const postObjectId = new ObjectID(postId);
      const userObjectId = new ObjectID(userId);

      const existing = await likesCollection.findOne({
        postId: postObjectId,
        userId: userObjectId
      });

      if (existing) {
        await likesCollection.deleteOne({ _id: existing._id });
        const count = await likesCollection.countDocuments({
          postId: postObjectId
        });
        resolve({ liked: false, count: count });
      } else {
        await likesCollection.insertOne({
          postId: postObjectId,
          userId: userObjectId,
          createdDate: new Date()
        });
        const count = await likesCollection.countDocuments({
          postId: postObjectId
        });
        resolve({ liked: true, count: count });
      }
    } catch {
      reject();
    }
  });
};

module.exports = Like;