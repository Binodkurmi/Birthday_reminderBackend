// services/notificationService.js
const Notification = require('../models/Notification');

// Create a new notification
const createNotification = async (userId, message, type = 'system', metadata = {}, birthdayId = null) => {
  try {
    const notification = new Notification({
      userId,
      message,
      type,
      metadata,
      birthdayId
    });

    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
};

// Create birthday reminder notifications
const createBirthdayReminder = async (userId, birthday, daysUntil) => {
  let message;
  
  if (daysUntil === 0) {
    message = `🎉 Today is ${birthday.name}'s birthday!`;
  } else if (daysUntil === 1) {
    message = `⏰ Tomorrow is ${birthday.name}'s birthday`;
  } else {
    message = `📅 ${birthday.name}'s birthday is in ${daysUntil} days`;
  }

  return createNotification(
    userId,
    message,
    'birthday',
    { daysUntil: daysUntil.toString() },
    birthday._id
  );
};

// Get unread notification count for a user
const getUnreadCount = async (userId) => {
  return Notification.countDocuments({ userId, isRead: false });
};

module.exports = {
  createNotification,
  createBirthdayReminder,
  getUnreadCount
};