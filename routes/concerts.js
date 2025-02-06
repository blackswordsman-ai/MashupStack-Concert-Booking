var express = require('express');
var router = express.Router();
const ejs = require('ejs');
const fs = require('fs').promises;
const pdf = require('html-pdf-node');
const QRCode = require('qrcode');
const  Concert = require('../models/concertsModel'); 
const Booking =require('../models/bookingModle');
// const User =require('../models/userModel');
// Adjust the path to your 


// Route to render the concert creation form
router.get('/create_concert', (req, res) => {
    res.render('./concert/create', { error: null });
});

// Route to handle the POST request for creating a concert
router.post('/create_concert', async (req, res) => {
    try {
        const { concertName, artist, venue, dateTime, ticketPrice, availableTickets } = req.body;

        // Validate required fields
        if (!concertName || !artist || !venue || !dateTime || ticketPrice == null || availableTickets == null) {
            return res.status(400).json({ error: 'All fields are required' });
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
            return res.status(400).json({ error: errors });
        }

        // Save the concert
        await newConcert.save();
        res.redirect('/concerts/create_concert');
    } catch (error) {
        console.error('Error creating concert:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

router.get('/retrieve_concert', (req, res) => {
    Concert.find().then(data => {
      res.render('./concert/retrieve',{data:data})
    }).catch(error => {
      console.error(error);
    });
  });

  router.get('/update_concert/:id', (req, res) => {
    const concertId = req.params.id;  // Access concert ID from the URL parameter
    Concert.findById(concertId).lean()
        .then(concert => {
            if (!concert) {
                return res.status(404).send('Concert not found');
            }
            res.render('./concert/update', { concert: concert, error: null });
        })
        .catch(error => {
            console.error(error);
            res.status(500).send('Internal Server Error');
        });
});


router.post('/update_concert/:id', async (req, res) => {
    try {
        const { concertName, artist, venue, dateTime, ticketPrice, availableTickets } = req.body;

        // Validate required fields
        if (!concertName || !artist || !venue || !dateTime || ticketPrice == null || availableTickets == null) {
            const concert = await Concert.findById(req.params.id).lean(); // Fetch concert details
            return res.render('concert/update', {
                concert, // Keep existing data
                error: { message: 'All fields are required' }
            });
        }

        // Convert dateTime to proper format
        const dateTimeFormatted = new Date(dateTime);
        if (isNaN(dateTimeFormatted.getTime())) {
            const concert = await Concert.findById(req.params.id).lean();
            return res.render('concert/update', {
                concert,
                error: { message: 'Invalid date format' }
            });
        }

        // Update concert
        const updatedConcert = await Concert.findByIdAndUpdate(
            req.params.id,
            { concertName, artist, venue, dateTime: dateTimeFormatted, ticketPrice, availableTickets },
            { new: true, runValidators: true }
        );

        if (!updatedConcert) {
            return res.status(404).render('concert/update', {
                concert: null,
                error: { message: 'Concert not found' }
            });
        }

        res.redirect('/concerts/retrieve_concert');
    } catch (error) {
        console.error('Error updating concert:', error);
        res.status(500).render('concert/update', {
            error: { message: 'Internal Server Error' }
        });
    }
});


// Route to render the delete confirmation page
router.get('/delete_concert/:id', (req, res) => {
    const concertId = req.params.id;
    Concert.findById(concertId).then(concert => {
        // Render the delete confirmation page with the concert details
        res.render('./concert/delete', { concert: concert });
    }).catch(error => {
        console.error(error);
        res.status(500).send('Internal Server Error');
    });
});

// Route to handle the deletion of a concert
router.post('/delete_concert/:id', (req, res) => {
    const concertId = req.params.id;
    Concert.findByIdAndDelete(concertId)
        .then(() => {
            res.redirect('/concerts/retrieve_concert'); // Redirect to the concert list after deleting
        })
        .catch(error => {
            console.error(error);
            res.status(500).send('Internal Server Error');
        });
});

router.get('/generate-pdf/:id', async (req, res) => {
    try {
        const concertId = req.params.id;
        const concert = await Concert.findById(concertId);

        if (!concert) {
            return res.status(404).send('Concert not found');
        }

        // Generate QR code
        const concertUrl = `https://yourwebsite.com/concerts/${concert._id}`;
        const qrCodeImage = await QRCode.toDataURL(concertUrl);

        // Read and render the EJS template with concert data
        const template = await fs.readFile('./views/concert_pdf_template.ejs', 'utf8');
        const html = ejs.render(template, { concert, qrCodeImage });

        // Create PDF options
        const options = { format: 'A4' };

        // Generate PDF buffer
        const pdfBuffer = await pdf.generatePdf({ content: html }, options);

        // Set response headers and send the PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${concert.concertName}.pdf"`);
        res.send(pdfBuffer);
    } catch (error) {
        console.error('Error generating PDF:', error);
        res.status(500).send('Internal Server Error');
    }
});





module.exports = router;
