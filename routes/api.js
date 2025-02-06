var express = require('express');
var router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const { body, validationResult } = require('express-validator');
const  Concert = require('../models/concertsModel'); 
const User = require('../models/userModel');
const Booking=require('../models/bookingModle')




router.get('/simpleapi', (req,res) => {
    res.status(200).send({'text': 'Hello world, This is your first api call'})
})

const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;



router.post('/signupapi', async (req, res) => {
    try {
      const { email, password, confirmPassword } = req.body;
  
      // Check if password and confirmPassword match
      if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Password and Confirm Password do not match' });
      }
  
      // Check if email already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ error: 'Email already taken' });
      }
  
      // Check if the email belongs to the admin
      let role = 'user';
      if (email === ADMIN_EMAIL) {
        const existingAdmin = await User.findOne({ role: 'admin' });
        if (existingAdmin) {
          return res.status(400).json({ error: 'Admin account already exists' });
        }
        role = 'admin';
      }
  
      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Create and save the new user
      const newUser = new User({ email, password: hashedPassword, role });
      await newUser.save();
  
      // Respond with success message
      res.status(201).json({ message: 'User signed up successfully' });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Something went wrong. Please try again.' });
    }
  });


  router.post('/loginapi', [
    body('email').isEmail().withMessage('Invalid email address'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ], async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
  
      const { email, password } = req.body;
  
      // ✅ Admin Login
      if (email === ADMIN_EMAIL) {
        if (password !== ADMIN_PASSWORD) {
          return res.status(401).json({ message: 'Incorrect Admin password.' });
        }
        const token = jwt.sign({ email, role: 'admin' }, SECRET_KEY, { expiresIn: '1h' });
        return res.json({ message: 'Admin login successful', token, role: 'admin' });
      }
  
      // ✅ User Login
      const foundUser = await User.findOne({ email });
      if (!foundUser) {
        return res.status(401).json({ message: 'Incorrect Email Address.' });
      }
  
      const isPasswordValid = await bcrypt.compare(password, foundUser.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Incorrect password.' });
      }
  
      // ✅ Generate JWT Token
      const token = jwt.sign({ userId: foundUser._id, email, role: 'user' }, SECRET_KEY, { expiresIn: '1h' });
  
      res.json({ message: 'Login successful', token, role: 'user' });
    } catch (error) {
      console.error('Error during login:', error);
      res.status(500).json({ message: 'Internal Server Error' });
    }
  });
  

router.post('/create_concert_api', async (req, res) => {
    try {
        const { concertName, artist, venue, dateTime, ticketPrice, availableTickets } = req.body;

        // Validate required fields
        if (!concertName || !artist || !venue || !dateTime || ticketPrice == null || availableTickets == null) {
            return res.status(400).json({ 
                error: {
                    concertName: !concertName ? 'Concert name is required' : undefined,
                    artist: !artist ? 'Artist is required' : undefined,
                    venue: !venue ? 'Venue is required' : undefined,
                    dateTime: !dateTime ? 'Date and time are required' : undefined,
                    ticketPrice: ticketPrice == null ? 'Ticket price is required' : undefined,
                    availableTickets: availableTickets == null ? 'Available tickets are required' : undefined
                } 
            });
        }

        // Create a new concert document using the correct model name
        const newConcert = new Concert({
            concertName,
            artist,
            venue,
            dateTime,
            ticketPrice,
            availableTickets
        });

        // Validate schema before saving
        const validationError = newConcert.validateSync();
        if (validationError) {
            const errors = Object.values(validationError.errors).map(err => err.message);
            return res.status(400).json({ errors });
        }

        // Save the concert
        await newConcert.save();
        res.status(201).json({ message: 'Concert created successfully' });
    } catch (error) {
        console.error('Error creating concert:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/retrieve_concert_api', (req, res) => {
    Concert.find()
        .then(data => {
            res.status(200).json({ concerts: data });
        })
        .catch(error => {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        });
});
router.put('/update_concert_api/:id', async (req, res) => {
    try {
        const { concertName, artist, venue, dateTime, ticketPrice, availableTickets } = req.body;

        // Validate required fields
        if (!concertName || !artist || !venue || !dateTime || ticketPrice == null || availableTickets == null) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Convert dateTime to proper format
        const dateTimeFormatted = new Date(dateTime);
        if (isNaN(dateTimeFormatted.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }

        // Update concert
        const updatedConcert = await Concert.findByIdAndUpdate(
            req.params.id,
            { concertName, artist, venue, dateTime: dateTimeFormatted, ticketPrice, availableTickets },
            { new: true, runValidators: true }
        );

        if (!updatedConcert) {
            return res.status(404).json({ error: 'Concert not found' });
        }

        res.status(200).json({ message: 'Concert updated successfully', concert: updatedConcert });
    } catch (error) {
        console.error('Error updating concert:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.delete('/delete_concert_api/:id', (req, res) => {
    const concertId = req.params.id;

    Concert.findByIdAndDelete(concertId)
        .then(deletedConcert => {
            if (!deletedConcert) {
                return res.status(404).json({ error: 'Concert not found' });
            }
            res.status(200).json({ message: 'Concert deleted successfully' });
        })
        .catch(error => {
            console.error(error);
            res.status(500).json({ error: 'Internal Server Error' });
        });
});

// booking


router.post('/book_concert_api', async (req, res) => {
  const { concertId, userId, numberOfTickets } = req.body;
  

  try {
    console.log('Received booking request:', req.body);

    // ✅ Validate request data
    if (!concertId || !userId || !numberOfTickets) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // ✅ Fetch concert details
    const concert = await Concert.findById(concertId);
    if (!concert) {
      return res.status(404).json({ error: 'Concert not found' });
    }

    console.log('Concert found:', concert);

    // ✅ Check ticket availability
    if (concert.availableTickets < numberOfTickets) {
      return res.status(400).json({ error: 'Not enough tickets available' });
    }

    // ✅ Calculate total price
    const totalPrice = concert.ticketPrice * numberOfTickets;

    // ✅ Create booking record
    const booking = new Booking({
      concertId,
      userId,
      numberOfTickets,
      totalAmount: totalPrice,
      status: 'confirmed',
      bookingDate: new Date(),
    });

    await booking.save();
    console.log('Booking saved:', booking);

    // ✅ Update concert ticket availability
    concert.availableTickets -= numberOfTickets;
    await concert.save();
    console.log('Available tickets updated:', concert.availableTickets);

    // ✅ Ensure directories exist
    if (!fs.existsSync('./tickets')) fs.mkdirSync('./tickets', { recursive: true });
    if (!fs.existsSync('./qr_codes')) fs.mkdirSync('./qr_codes', { recursive: true });

    // ✅ Generate PDF Ticket
    const doc = new PDFDocument();
    const pdfPath = `./tickets/ticket_${booking._id}.pdf`;
    const pdfStream = fs.createWriteStream(pdfPath);

    doc.pipe(pdfStream);
    doc.fontSize(20).text(`Booking Confirmation for ${concert.concertName}`, { align: 'center' });
    doc.fontSize(12).text(`Concert: ${concert.concertName}`);
    doc.text(`Artist: ${concert.artist}`);
    doc.text(`Venue: ${concert.venue}`);
    doc.text(`Date: ${concert.dateTime}`);
    doc.text(`Number of Tickets: ${numberOfTickets}`);
    doc.text(`Total Price: $${totalPrice}`);
    doc.text(`Booking ID: ${booking._id}`);
    doc.end();
    console.log('PDF generated:', pdfPath);

    // ✅ Wait for PDF stream to finish
    await new Promise((resolve, reject) => {
      pdfStream.on('finish', resolve);
      pdfStream.on('error', reject);
    });

    // ✅ Generate QR Code
    const qrCodePath = `./qr_codes/qrcode_${booking._id}.png`;
    const qrCodeData = `http://example.com/booking/${booking._id}`; // Booking confirmation link

    await QRCode.toFile(qrCodePath, qrCodeData);
    console.log('QR Code generated:', qrCodePath);

    // ✅ Send Response
    return res.status(201).json({
      success: true,
      message: 'Booking confirmed!',
      bookingId: booking._id,
      concert: concert.concertName,
      totalAmount: totalPrice,
      numberOfTickets,
      qrCodePath,
      ticketPdfPath: pdfPath,
      confirmationLink: `http://example.com/booking/${booking._id}`
    });

  } catch (error) {
    console.error('Error processing booking:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});


module.exports = router;