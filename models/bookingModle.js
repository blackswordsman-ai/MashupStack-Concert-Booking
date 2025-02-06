const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  concertId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Concert',  // assuming you have a Concert model
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',  // assuming you have a User model
    required: true
  },
  numberOfTickets: {
    type: Number,
    required: true,
    min: 1,
    max: 3
  },
  totalAmount: {
    type: Number,
    required: true
  },
  bookingDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['confirmed', 'pending', 'cancelled'],
    default: 'pending'
  }
});

// ✅ Correct way to define and export Booking model
const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;
