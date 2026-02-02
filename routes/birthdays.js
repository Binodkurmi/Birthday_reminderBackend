// routes/birthdays.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs'); // Add this
const { v4: uuidv4 } = require('uuid');
const Birthday = require('../models/Birthday');
const { protect } = require('../middleware/auth');

const router = express.Router();

// ✅ FIXED: Configure multer to save directly to uploads folder (not birthday-images)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    
    // Create uploads directory if it doesn't exist
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log('✅ Created uploads directory');
    }
    
    // Save directly to uploads folder
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = uuidv4() + path.extname(file.originalname);
    cb(null, uniqueSuffix);
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// Create a new birthday
router.post('/', protect, upload.single('image'), async (req, res) => {
  try {
    const { name, date, relationship, notes, notifyBefore, allowNotifications } = req.body;
    
    // Validate required fields
    if (!name || !date) {
      return res.status(400).json({
        message: 'Name and date are required fields'
      });
    }
    
    // Create new birthday
    const birthday = new Birthday({
      name,
      date,
      relationship: relationship || '',
      notes: notes || '',
      notifyBefore: notifyBefore || 7,
      allowNotifications: allowNotifications !== 'false',
      user: req.user.id
    });
    
    // ✅ FIXED: Store only the filename, not the full path
    if (req.file) {
      birthday.image = req.file.filename; // Just the filename, not the path
      console.log(`✅ Image saved as: ${req.file.filename}`);
    }
    
    await birthday.save();
    
    res.status(201).json({
      message: 'Birthday added successfully! 🎉',
      birthday: {
        ...birthday.toObject(),
        // Include full URL for frontend
        imageUrl: req.file ? `/uploads/${req.file.filename}` : null
      }
    });
  } catch (error) {
    console.error('Error adding birthday:', error);
    
    // Return error in the format expected by the frontend
    res.status(500).json({
      message: error.message || 'Failed to add birthday'
    });
  }
});

// Get all birthdays for the authenticated user
router.get('/', protect, async (req, res) => {
  try {
    const birthdays = await Birthday.find({ user: req.user.id }).sort({ date: 1 });
    
    // Add imageUrl to each birthday for frontend
    const birthdaysWithUrls = birthdays.map(birthday => {
      const birthdayObj = birthday.toObject();
      return {
        ...birthdayObj,
        imageUrl: birthday.image ? `/uploads/${birthday.image}` : null
      };
    });
    
    res.json(birthdaysWithUrls);
  } catch (error) {
    console.error('Error fetching birthdays:', error);
    res.status(500).json({
      message: error.message || 'Server error while fetching birthdays'
    });
  }
});

// Get a specific birthday
router.get('/:id', protect, async (req, res) => {
  try {
    const birthday = await Birthday.findOne({ 
      _id: req.params.id, 
      user: req.user.id 
    });
    
    if (!birthday) {
      return res.status(404).json({
        message: 'Birthday not found'
      });
    }
    
    // Add imageUrl for frontend
    const birthdayWithUrl = birthday.toObject();
    birthdayWithUrl.imageUrl = birthday.image ? `/uploads/${birthday.image}` : null;
    
    res.json(birthdayWithUrl);
  } catch (error) {
    console.error('Error fetching birthday:', error);
    res.status(500).json({
      message: error.message || 'Server error while fetching birthday'
    });
  }
});

// Update a birthday
router.put('/:id', protect, upload.single('image'), async (req, res) => {
  try {
    const { name, date, relationship, notes, notifyBefore, allowNotifications } = req.body;
    
    const updates = {
      name,
      date,
      relationship,
      notes,
      notifyBefore,
      allowNotifications: allowNotifications !== 'false'
    };
    
    // ✅ FIXED: Store only filename, not path
    if (req.file) {
      updates.image = req.file.filename; // Just the filename
      console.log(`✅ Updated image to: ${req.file.filename}`);
    }
    
    const birthday = await Birthday.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      updates,
      { new: true, runValidators: true }
    );
    
    if (!birthday) {
      return res.status(404).json({
        message: 'Birthday not found'
      });
    }
    
    res.json({
      message: 'Birthday updated successfully',
      birthday: {
        ...birthday.toObject(),
        imageUrl: birthday.image ? `/uploads/${birthday.image}` : null
      }
    });
  } catch (error) {
    console.error('Error updating birthday:', error);
    res.status(500).json({
      message: error.message || 'Server error while updating birthday'
    });
  }
});

// Delete a birthday
router.delete('/:id', protect, async (req, res) => {
  try {
    const birthday = await Birthday.findOneAndDelete({ 
      _id: req.params.id, 
      user: req.user.id 
    });
    
    if (!birthday) {
      return res.status(404).json({
        message: 'Birthday not found'
      });
    }
    
    res.json({
      message: 'Birthday deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting birthday:', error);
    res.status(500).json({
      message: error.message || 'Server error while deleting birthday'
    });
  }
});

module.exports = router;