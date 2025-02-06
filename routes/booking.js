const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Concert = require('../models/concertsModel');
const Booking = require('../models/bookingModle');
const crypto = require('crypto');
const sendOtpEmail = require('../utils/email');
const { authMiddleware } = require('../middlewares/auth');  // Fixed typo in "Modle" to "Model"


router.get('/all_concerts', async (req, res) => {
  try {
    const concerts = await Concert.find(); // Fetch all concerts from the database

    if (!concerts || concerts.length === 0) {
      return res.render('all_concerts', { concerts: [], message: 'No concerts available.' });
    }

    res.render('all_concerts', { concerts, message: null });
  } catch (error) {
    console.error('Error fetching concerts:', error);
    res.status(500).send('Internal Server Error');
  }
});

router.get('/book_concert/:concertId', async (req, res) => {
  try {
    const { concertId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(concertId)) {
      return res.status(400).send('Invalid Concert ID');
    }

    const concert = await Concert.findById(concertId);
    if (!concert) {
      return res.status(404).send('Concert not found');
    }

    const userId = req.session?.userId;
    if (!userId) {
      return res.redirect('/login?error=Please log in to book a concert');
    }

    res.render('book_concert', { concert, userId, totalAmount: 0, error: req.query.error });

  } catch (error) {
    console.error('Error fetching concert:', error);
    res.status(500).send('Internal Server Error');
  }
});


router.post('/book_concert', async (req, res) => {
  const { concertId, userId, numberOfTickets } = req.body;

  try {
    console.log('Received booking request:', req.body);

    // Validate request data
    if (!concertId || !userId || !numberOfTickets) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch concert details
    const concert = await Concert.findById(concertId);
    if (!concert) {
      return res.status(404).json({ error: 'Concert not found' });
    }

    console.log('Concert found:', concert);

    // Check if enough tickets are available
    if (concert.availableTickets < numberOfTickets) {
      return res.status(400).json({ error: 'Not enough tickets available' });
    }

    // Calculate total price
    const totalPrice = concert.ticketPrice * numberOfTickets;

    // Create the booking record (Fixed: Use `concertId` instead of `concert`)
    const booking = new Booking({
      concertId,   // ✅ Fix here
      userId,
      numberOfTickets,
      totalAmount: totalPrice,
      status: 'confirmed',
      bookingDate: new Date(),
    });

    await booking.save();
    console.log('Booking saved:', booking);

    // Decrease available tickets in concert
    concert.availableTickets -= numberOfTickets;
    await concert.save();
    console.log('Available tickets updated:', concert.availableTickets);

    // Ensure directories exist
    if (!fs.existsSync('./tickets')) fs.mkdirSync('./tickets', { recursive: true });
    if (!fs.existsSync('./qr_codes')) fs.mkdirSync('./qr_codes', { recursive: true });

    // Generate PDF Ticket
    const doc = new PDFDocument();
    const pdfPath = `./tickets/ticket_${booking._id}.pdf`;
    const pdfStream = fs.createWriteStream(pdfPath);

    doc.pipe(pdfStream);
    doc.fontSize(20).text(`Booking Confirmation for ${concert.concertName}`);
    doc.fontSize(12).text(`Concert: ${concert.concertName}`);
    doc.text(`Artist: ${concert.artist}`);
    doc.text(`Venue: ${concert.venue}`);
    doc.text(`Date: ${concert.dateTime}`);
    doc.text(`Number of Tickets: ${numberOfTickets}`);
    doc.text(`Total Price: $${totalPrice}`);
    doc.end();
    console.log('PDF generated:', pdfPath);

    // Wait for PDF stream to finish
    await new Promise((resolve, reject) => {
      pdfStream.on('finish', resolve);
      pdfStream.on('error', reject);
    });

    // Generate QR Code
    const qrCodePath = `./qr_codes/qrcode_${booking._id}.png`;
    const qrCodeData = `http://example.com/booking/${booking._id}`; // Booking confirmation link

    try {
      await QRCode.toFile(qrCodePath, qrCodeData);
      console.log('QR Code generated:', qrCodePath);
    } catch (qrError) {
      console.error('QR Code generation failed:', qrError);
      return res.status(500).json({ error: 'QR Code generation failed' });
    }

    // ✅ Fix: Pass `qrCodePath` along with redirect
    return res.redirect(`/booking/booking_confirmation/${booking._id}?qrCodePath=${encodeURIComponent(qrCodePath)}`);

  } catch (error) {
    console.error('Error processing booking:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});


router.get('/booking_confirmation/:bookingId', async (req, res) => {
  try {
      console.log('Booking ID:', req.params.bookingId);

      // Populate concertId correctly
      const booking = await Booking.findById(req.params.bookingId).populate('concertId');
      if (!booking) {
          console.log('Booking not found');
          return res.status(404).send('Booking not found');
      }

      // Verify concert population
      console.log('Booking found:', booking);
      console.log('Populated Concert:', booking.concertId);

      // Ensure concertId exists before passing to the template
      if (!booking.concertId) {
          return res.status(500).send('Concert details missing in booking');
      }

      // Define file paths for QR code and PDF
      const qrCodePath = `/qr_codes/qrcode_${booking._id}.png`;  // Ensure path is accessible
      const pdfPath = `/tickets/ticket_${booking._id}.pdf`;

      res.render('booking_confirmation', {
          booking,
          concert: booking.concertId,  // ✅ Use concertId instead of concert
          totalAmount: booking.totalAmount,
          qrCodePath,
          pdfPath
      });
  } catch (error) {
      console.error('Error fetching booking confirmation:', error.message, error.stack);
      res.status(500).send('Server Error');
  }
});





router.get('/download_ticket/:bookingId', (req, res) => {
  const { bookingId } = req.params;

  // Construct the path to the ticket PDF based on the bookingId
  const pdfPath = `./tickets/ticket_${bookingId}.pdf`;

  // Check if the file exists
  if (fs.existsSync(pdfPath)) {
      // Send the PDF as a downloadable file
      res.download(pdfPath, `ticket_${bookingId}.pdf`, (err) => {
          if (err) {
              console.error('Error sending file:', err);
              res.status(500).send('Something went wrong while downloading the ticket.');
          }
      });
  } else {
      res.status(404).send('Ticket not found.');
  }
});

router.get('/download_qr_code/:bookingId', (req, res) => {
  const { bookingId } = req.params;
  const qrCodePath = `./qr_codes/qrcode_${bookingId}.png`;

  if (fs.existsSync(qrCodePath)) {
      res.download(qrCodePath, `qrcode_${bookingId}.png`, (err) => {
          if (err) {
              console.error('Error sending file:', err);
              res.status(500).send('Something went wrong while downloading the QR code.');
          }
      });
  } else {
      res.status(404).send('QR Code not found.');
  }
});


router.get('/book_concert/:concertId/:bookingId', async (req, res) => {
  try {
      const { concertId, bookingId } = req.params;

      // Fetch the concert details
      const concert = await Concert.findById(concertId);
      if (!concert) {
          return res.status(404).json({ message: 'Concert not found' });
      }

      // Fetch the booking details
      const booking = await Booking.findById(bookingId);
      if (!booking) {
          return res.status(404).json({ message: 'Booking not found' });
      }

      // Send the booking details along with the concert details to the view
      res.render('booking_confirmation', { booking, concert });

  } catch (error) {
      console.error('Error fetching booking details:', error);
      res.status(500).json({ error: 'Something went wrong. Please try again later.' });
  }
});

router.get('/view-bookings', async (req, res) => {
  try {
      const bookings = await Booking.find()
          .populate('concertId', 'concertName artist venue dateTime')
          .sort({ bookingDate: -1 });
      res.render('view-bookings', { bookings });
  } catch (error) {
      console.error('Error fetching bookings:', error);
      res.status(500).send('Error fetching bookings');
  }
});


// POST route to cancel a booking
// GET route for confirmation page
router.get('`/cancel/:id`', async (req, res) => {
  try {
      const { id } = req.params;
      
      // Add logging to debug
      console.log('GET cancel route accessed for ID:', id);

      if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).send('Invalid booking ID');
      }

      const booking = await Booking.findById(id).populate('concertId', 'concertName artist venue dateTime');

      if (!booking) {
          return res.status(404).send('Booking not found');
      }

      res.render('cancel-confirmation', { booking });

  } catch (error) {
      console.error('Error fetching booking:', error);
      res.status(500).send('Internal Server Error');
  }
});

// POST route for actual cancellation
router.post('/cancel/:id', async (req, res) => {
  try {
      const { id } = req.params;
      
      // Add logging to debug
      console.log('POST cancel route accessed for ID:', id);

      if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).send('Invalid booking ID');
      }

      const bookingId = await Booking.findByIdAndDelete(id);

      if (!bookingId) {
          return res.status(404).send('Booking not found');
      }

      res.redirect('/booking/view-bookings');
  } catch (error) {
      console.error('Error deleting booking:', error);
      res.status(500).send('Internal Server Error');
  }
});



router.post('/confirm-booking', async (req, res) => {
  try {
    const { userEmail, bookingId } = req.body; // Assuming userEmail and bookingId are in the request body

    // Generate a 6-character OTP (you can adjust length if needed)
    const otp = crypto.randomBytes(3).toString('hex'); // 6-character OTP

    // Store OTP in session and store booking ID
    req.session.otp = otp;
    req.session.bookingId = bookingId;

    // Send OTP to the user's email
    await sendOtpEmail(userEmail, otp);

    // Render OTP confirmation page
    res.render('otp-confirmation'); // Create this view for OTP input
  } catch (error) {
    console.error('Error confirming booking:', error);
    res.status(500).send('Internal Server Error');
  }
});
// controllers/bookingController.js

router.post('/verify-otp', async (req, res) => {
    try {
      const { otp } = req.body; // OTP entered by the user
  
      // Check if the OTP from the session matches the one entered by the user
      if (otp === req.session.otp) {
        // OTP is correct, proceed with confirming the booking
  
        // Find and confirm the booking
        const booking = await Booking.findById(req.session.bookingId); 
        booking.status = 'confirmed';
        await booking.save();
  
        // Redirect to the booking confirmation page or show success message
        res.render('booking-confirmed', { booking });
      } else {
        // OTP is incorrect, show error message
        res.render('otp-confirmation', { error: 'Invalid OTP. Please try again.' });
      }
    } catch (error) {
      console.error('Error verifying OTP:', error);
      res.status(500).send('Internal Server Error');
    }
  });
  
  router.post('/resend-otp', async (req, res) => {
    const { userEmail } = req.body;
    const otp = crypto.randomBytes(3).toString('hex');
    req.session.otp = otp;
    await sendOtpEmail(userEmail, otp);
    res.render('otp-confirmation', { message: 'OTP resent to your email!' });
  });
  router.get('/view-bookings', authMiddleware, async (req, res) => {
    try {
        const userId = req.user._id; // Ensure user info is in req.user (set by authMiddleware)
        const bookings = await Booking.find({ userId }).populate('concertId');
        res.render('view_my_booking', { bookings });
    } catch (error) {
        console.error('Error fetching bookings:', error);
        res.status(500).send('Internal Server Error');
    }
});


module.exports = router;
