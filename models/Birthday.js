// models/Birthday.js
const mongoose = require('mongoose');

const birthdaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  date: {
    type: Date,
    required: [true, 'Birth date is required']
  },
  relationship: {
    type: String,
    default: '',
    trim: true
  },
  notes: {
    type: String,
    default: '',
    trim: true
  },
  image: {
    type: String,
    default: null
  },
  notifyBefore: {
    type: Number,
    default: 7,
    min: [0, 'Notify before cannot be negative'],
    max: [365, 'Notify before cannot exceed 365 days']
  },
  allowNotifications: {
    type: Boolean,
    default: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }
}, {
  timestamps: true
});

// Add index for better query performance
birthdaySchema.index({ user: 1, date: 1 });
birthdaySchema.index({ user: 1, name: 1 });

// Virtual for image URL
birthdaySchema.virtual('imageUrl').get(function() {
  if (!this.image) return null;
  return `/uploads/${this.image}`;
});

// Ensure virtuals are included in JSON and Object
birthdaySchema.set('toJSON', { virtuals: true });
birthdaySchema.set('toObject', { virtuals: true });

const Birthday = mongoose.model('Birthday', birthdaySchema);

module.exports = Birthday;