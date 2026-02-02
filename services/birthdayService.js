// services/birthdayService.js
const Notification = require('../models/Notification');
const User = require('../models/User');
const { createBirthdayReminder } = require('./notificationService');

// Function to check for upcoming birthdays and create notifications
const checkUpcomingBirthdays = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison
    
    const users = await User.find().populate('birthdays');
    
    for (const user of users) {
      for (const birthday of user.birthdays) {
        // Create a date object for the birthday
        const birthDate = new Date(birthday.date);
        
        // Create next birthday date for this year
        const nextBirthday = new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate());
        
        // If birthday already passed this year, set to next year
        if (nextBirthday < today) {
          nextBirthday.setFullYear(today.getFullYear() + 1);
        }
        
        // Calculate days until birthday
        const daysUntil = Math.ceil((nextBirthday - today) / (1000 * 60 * 60 * 24));
        
        // Create notifications for birthdays coming up in 7, 3, 1, and 0 days
        if ([0, 1, 3, 7].includes(daysUntil)) {
          // Check if notification already exists for this reminder (within last 48 hours)
          const existingNotification = await Notification.findOne({
            userId: user._id,
            birthdayId: birthday._id,
            'metadata.daysUntil': daysUntil.toString(),
            createdAt: { $gte: new Date(Date.now() - 48 * 60 * 60 * 1000) }
          });
          
          if (!existingNotification) {
            await createBirthdayReminder(user._id, birthday, daysUntil);
          }
        }
      }
    }
    
    console.log('Birthday reminder check completed at', new Date().toISOString());
  } catch (error) {
    console.error('Error checking upcoming birthdays:', error);
  }
};

// Schedule daily birthday checks
const scheduleBirthdayChecks = () => {
  // Run once per day at 8 AM
  const now = new Date();
  const eightAM = new Date(now);
  eightAM.setHours(8, 0, 0, 0);
  
  // If it's already past 8 AM, schedule for tomorrow
  if (now > eightAM) {
    eightAM.setDate(eightAM.getDate() + 1);
  }
  
  const initialDelay = eightAM - now;
  
  console.log(`Scheduling birthday checks to run daily at 8 AM. First run in ${Math.round(initialDelay / 1000 / 60)} minutes`);
  
  setTimeout(() => {
    checkUpcomingBirthdays();
    // Then run every 24 hours
    setInterval(checkUpcomingBirthdays, 24 * 60 * 60 * 1000);
  }, initialDelay);
};

module.exports = {
  checkUpcomingBirthdays,
  scheduleBirthdayChecks
};