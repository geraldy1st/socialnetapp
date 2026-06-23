const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const usersCollection = require('../db')
  .db()
  .collection('users');
const ObjectID = require('mongodb').ObjectID;
const validator = require('validator');
const md5 = require('md5');

let User = function(data, getAvatar) {
  this.data = data;
  this.errors = [];
  if (getAvatar == undefined) {
    getAvatar = false;
  }
  if (getAvatar) {
    this.getAvatar();
  }
};

User.prototype.cleanUp = function() {
  if (typeof this.data.username != 'string') {
    this.data.username = '';
  }
  if (typeof this.data.email != 'string') {
    this.data.email = '';
  }
  if (typeof this.data.password != 'string') {
    this.data.password = '';
  }

  // get rid of any bogus properties
  this.data = {
    username: this.data.username.trim().toLowerCase(),
    email: this.data.email.trim().toLowerCase(),
    password: this.data.password
  };
};

User.prototype.validate = function() {
  return new Promise(async (resolve, reject) => {
    if (this.data.username == '') {
      this.errors.push('You must provide a username.');
    }
    if (
      this.data.username != '' &&
      !validator.isAlphanumeric(this.data.username)
    ) {
      this.errors.push('Username can only contain letters and numbers.');
    }
    if (!validator.isEmail(this.data.email)) {
      this.errors.push('You must provide a valid email address.');
    }
    if (this.data.password == '') {
      this.errors.push('You must provide a password.');
    }
    if (this.data.password.length > 0 && this.data.password.length < 12) {
      this.errors.push('Password must be at least 12 characters.');
    }
    if (this.data.password.length > 50) {
      this.errors.push('Password cannot exceed 50 characters.');
    }
    if (this.data.username.length > 0 && this.data.username.length < 3) {
      this.errors.push('Username must be at least 3 characters.');
    }
    if (this.data.username.length > 30) {
      this.errors.push('Username cannot exceed 30 characters.');
    }

    // Only if username is valid then check to see if it's already taken
    if (
      this.data.username.length > 2 &&
      this.data.username.length < 31 &&
      validator.isAlphanumeric(this.data.username)
    ) {
      let usernameExists = await usersCollection.findOne({
        username: this.data.username
      });
      if (usernameExists) {
        this.errors.push('That username is already taken.');
      }
    }

    // Only if email is valid then check to see if it's already taken
    if (validator.isEmail(this.data.email)) {
      let emailExists = await usersCollection.findOne({
        email: this.data.email
      });
      if (emailExists) {
        this.errors.push('That email is already being used.');
      }
    }
    resolve();
  });
};

User.prototype.login = function() {
  return new Promise((resolve, reject) => {
    this.cleanUp();
    usersCollection
      .findOne({ username: this.data.username })
      .then(attemptedUser => {
        if (
          attemptedUser &&
          bcrypt.compareSync(this.data.password, attemptedUser.password)
        ) {
          this.data = attemptedUser;
          this.getAvatar();
          resolve('Congrats!');
        } else {
          reject('Invalid username / password.');
        }
      })
      .catch(function() {
        reject('Please try again later.');
      });
  });
};

User.prototype.register = function() {
  return new Promise(async (resolve, reject) => {
    // Step #1: Validate user data
    this.cleanUp();
    await this.validate();

    // Step #2: Only if there are no validation errors
    // then save the user data into a database
    if (!this.errors.length) {
      // hash user password
      let salt = bcrypt.genSaltSync(10);
      this.data.password = bcrypt.hashSync(this.data.password, salt);
      await usersCollection.insertOne(this.data);
      this.getAvatar();
      resolve();
    } else {
      reject(this.errors);
    }
  });
};

User.getGravatarUrl = function(email) {
  return `https://gravatar.com/avatar/${md5(email)}?s=128`;
};

User.prototype.getAvatar = function() {
  if (
    this.data.avatarUrl &&
    typeof this.data.avatarUrl === 'string' &&
    this.data.avatarUrl.startsWith('/uploads/avatars/')
  ) {
    this.avatar = this.data.avatarUrl;
  } else {
    this.avatar = User.getGravatarUrl(this.data.email);
  }
};

User.deleteAvatarFile = function(avatarUrl) {
  if (
    !avatarUrl ||
    typeof avatarUrl !== 'string' ||
    !avatarUrl.startsWith('/uploads/avatars/')
  ) {
    return;
  }

  const filePath = path.join(__dirname, '../public', avatarUrl);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

User.findByUsername = function(username) {
  return new Promise(function(resolve, reject) {
    if (typeof username != 'string') {
      reject();
      return;
    }
    usersCollection
      .findOne({ username: username })
      .then(function(userDoc) {
        if (userDoc) {
          userDoc = new User(userDoc, true);
          userDoc = {
            _id: userDoc.data._id,
            username: userDoc.data.username,
            avatar: userDoc.avatar
          };
          resolve(userDoc);
        } else {
          reject();
        }
      })
      .catch(function() {
        reject();
      });
  });
};

User.doesEmailExist = function(email) {
  return new Promise(async function(resolve, reject) {
    if (typeof email != 'string') {
      resolve(false);
      return;
    }

    let user = await usersCollection.findOne({ email: email });
    if (user) {
      resolve(true);
    } else {
      resolve(false);
    }
  });
};

User.findById = function(id) {
  return new Promise(async function(resolve, reject) {
    try {
      if (!ObjectID.isValid(id)) {
        reject();
        return;
      }

      let userDoc = await usersCollection.findOne({ _id: new ObjectID(id) });
      if (userDoc) {
        resolve(userDoc);
      } else {
        reject();
      }
    } catch {
      reject();
    }
  });
};

User.prototype.cleanUpProfileUpdate = function() {
  if (typeof this.data.username != 'string') {
    this.data.username = '';
  }
  if (typeof this.data.email != 'string') {
    this.data.email = '';
  }
  if (typeof this.data.password != 'string') {
    this.data.password = '';
  }

  this.data = {
    username: this.data.username.trim().toLowerCase(),
    email: this.data.email.trim().toLowerCase(),
    password: this.data.password
  };
};

User.prototype.validateProfileUpdate = function(userId) {
  return new Promise(async (resolve, reject) => {
    if (this.data.username == '') {
      this.errors.push('You must provide a username.');
    }
    if (
      this.data.username != '' &&
      !validator.isAlphanumeric(this.data.username)
    ) {
      this.errors.push('Username can only contain letters and numbers.');
    }
    if (!validator.isEmail(this.data.email)) {
      this.errors.push('You must provide a valid email address.');
    }
    if (this.data.username.length > 0 && this.data.username.length < 3) {
      this.errors.push('Username must be at least 3 characters.');
    }
    if (this.data.username.length > 30) {
      this.errors.push('Username cannot exceed 30 characters.');
    }
    if (this.data.password.length > 0 && this.data.password.length < 12) {
      this.errors.push('Password must be at least 12 characters.');
    }
    if (this.data.password.length > 50) {
      this.errors.push('Password cannot exceed 50 characters.');
    }

    if (
      this.data.username.length > 2 &&
      this.data.username.length < 31 &&
      validator.isAlphanumeric(this.data.username)
    ) {
      let usernameExists = await usersCollection.findOne({
        username: this.data.username,
        _id: { $ne: new ObjectID(userId) }
      });
      if (usernameExists) {
        this.errors.push('That username is already taken.');
      }
    }

    if (validator.isEmail(this.data.email)) {
      let emailExists = await usersCollection.findOne({
        email: this.data.email,
        _id: { $ne: new ObjectID(userId) }
      });
      if (emailExists) {
        this.errors.push('That email is already being used.');
      }
    }

    resolve();
  });
};

User.prototype.updateProfile = function(userId, avatarOptions) {
  return new Promise(async (resolve, reject) => {
    avatarOptions = avatarOptions || {};

    this.cleanUpProfileUpdate();
    await this.validateProfileUpdate(userId);

    if (this.errors.length) {
      reject(this.errors);
      return;
    }

    try {
      const currentUser = await usersCollection.findOne({
        _id: new ObjectID(userId)
      });

      if (!currentUser) {
        reject(['Unable to update profile.']);
        return;
      }

      let updateFields = {
        username: this.data.username,
        email: this.data.email
      };

      if (this.data.password.length > 0) {
        let salt = bcrypt.genSaltSync(10);
        updateFields.password = bcrypt.hashSync(this.data.password, salt);
      }

      let updateOperation = { $set: updateFields };
      const previousAvatarUrl = currentUser.avatarUrl;

      if (avatarOptions.useGravatar) {
        updateOperation.$unset = { avatarUrl: '' };
        User.deleteAvatarFile(previousAvatarUrl);
      } else if (avatarOptions.newAvatarUrl) {
        updateFields.avatarUrl = avatarOptions.newAvatarUrl;
        User.deleteAvatarFile(previousAvatarUrl);
      }

      await usersCollection.updateOne(
        { _id: new ObjectID(userId) },
        updateOperation
      );

      const updatedDoc = await usersCollection.findOne({
        _id: new ObjectID(userId)
      });

      this.data = updatedDoc;
      this.getAvatar();

      resolve({
        username: this.data.username,
        email: this.data.email,
        avatar: this.avatar
      });
    } catch {
      reject(['Unable to update profile.']);
    }
  });
};

module.exports = User;