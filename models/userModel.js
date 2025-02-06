const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email field is required'],
    unique: true,
  },
  password: {
    type: String,
    required: [true, 'Password field is required'],
    minlength: [6, 'At least 6 characters required'],
  },
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user',
  },
});

// Ensure only one admin exists
userSchema.pre('save', async function (next) {
  if (this.role === 'admin') {
    const existingAdmin = await mongoose.model('User').findOne({ role: 'admin' });
    if (existingAdmin && this.email !== existingAdmin.email) {
      return next(new Error('An admin already exists'));
    }
  }
  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
