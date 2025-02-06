const mongoose = require('mongoose');

const concertSchema = new mongoose.Schema({
    concertName: {
        type: String,
        required: [true, 'Concert name is required']
    },
    artist: {
        type: String,
        required: [true, 'Artist is required']
    },
    venue: {
        type: String,
        required: [true, 'Venue is required']
    },
    dateTime: {
        type: Date,
        required: [true, 'Date and time are required']
    },
    ticketPrice: {
        type: Number,
        required: [true, 'Ticket price is required']
    },
    availableTickets: {
        type: Number,
        required: [true, 'Available tickets are required']
    },
    qrCode: {
        type: String, // Stores a QR code as a URL or Base64 string
        default: ''   // Default empty if not generated
    }
});

const Concert = mongoose.model('Concert', concertSchema);

module.exports = Concert;  // Export the Concert model
