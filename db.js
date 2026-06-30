const dotenv = require('dotenv');
dotenv.config();
const mongodb = require('mongodb');

mongodb.connect(
  process.env.CONNECTIONSTRING,
  { useNewUrlParser: true, useUnifiedTopology: true },
  async function(err, client) {
    if (err) {
      console.error('MongoDB connection error:', err);
      process.exit(1);
    }

    try {
      await client.db().collection('posts').createIndex({ body: 'text' });
      await client
        .db()
        .collection('likes')
        .createIndex({ postId: 1, userId: 1 }, { unique: true });
      await client
        .db()
        .collection('comments')
        .createIndex({ postId: 1, createdDate: 1 });
      await client
        .db()
        .collection('conversations')
        .createIndex({ participants: 1 });
      await client
        .db()
        .collection('messages')
        .createIndex({ conversationId: 1, createdDate: 1 });
    } catch (indexErr) {
      if (indexErr.code !== 85 && indexErr.code !== 86) {
        console.warn('Text index setup:', indexErr.message);
      }
    }

    module.exports = client;
    const app = require('./app');
    app.listen(process.env.PORT);
  }
);