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
      await client
        .db()
        .collection('posts')
        .createIndex({ title: 'text', body: 'text' });
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