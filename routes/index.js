var express = require('express');
var router = express.Router();
const { validateEmail, validatePassword } = require('../middlewares/validators');
const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const User = require('../models/userModel');



router.get('/signup', (req, res) => {
  res.render('signup', { message: null, error: null });
});

// ✅ Define Admin Credentials
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_PASSWORD = "Admin@123"; 

// ✅ Signup Route
router.post('/signup', async (req, res) => {
  try {
    const { email, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.render('signup', { message: 'Password and Confirm Password do not match', error: null });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.render('signup', { message: 'Email already taken', error: null });
    }

    let role = 'user';
    if (email === ADMIN_EMAIL) {
      const existingAdmin = await User.findOne({ role: 'admin' });
      if (existingAdmin) {
        return res.render('signup', { message: 'Admin account already exists', error: null });
      }
      role = 'admin';
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword, role });
    await newUser.save();

    res.redirect('/login');
  } catch (error) {
    console.error(error);
    res.render('signup', { message: null, error: { general: { message: 'Something went wrong. Please try again.' } } });
  }
});

// ✅ Login Routes
router.get('/login', (req, res) => {
  res.render('login', { email: '', errors: [], message: null, title: 'Login' });
});


router.post('/login', [validateEmail, validatePassword], async (req, res) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      // If validation fails, render the login page with errors
      return res.render('login', { errors: errors.array(), message: null });
    }

    const { email, password } = req.body;
    let foundUser;

    // ✅ Admin Login
    if (email === ADMIN_EMAIL) {
      if (password !== ADMIN_PASSWORD) {
        // Incorrect admin password
        return res.render('login', { message: 'Incorrect Admin password.', errors: [] });
      }

      // Set session for Admin
      req.session.userId = "admin";
      req.session.userEmail = ADMIN_EMAIL;
      req.session.role = "admin";

      // Redirect Admin to concert retrieval page
      return res.redirect('/concerts/retrieve_concert');
    }

    // ✅ Check if user exists
    foundUser = await User.findOne({ email });
    if (!foundUser) {
      // If user is not found, render login page with an error message
      return res.render('login', { message: 'Incorrect Email Address.', errors: [] });
    }

    // ✅ Compare passwords
    try {
      const isPasswordValid = await bcrypt.compare(password, foundUser.password);
      if (!isPasswordValid) {
        return res.render('login', { message: 'Incorrect password.', errors: [] });
      }
    } catch (bcryptError) {
      // Catch and handle bcrypt errors
      console.error('Error during password comparison:', bcryptError);
      return res.status(500).send('Internal Server Error');
    }

    // ✅ Set session for User
    req.session.userId = foundUser._id;
    req.session.userEmail = foundUser.email;
    req.session.role = "user";

    // ✅ Redirect User to booking page
    return res.redirect('/booking/all_concerts');

  } catch (error) {
    // General error handler
    console.error("Error during login:", error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
