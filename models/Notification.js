// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['birthday', 'reminder', 'system', 'update'],
    default: 'system'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  birthdayId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Birthday'
  },
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

// Index for faster queries
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);