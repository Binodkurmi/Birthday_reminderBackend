const Birthday = require('../models/Birthday');

// Get all birthdays for a user
exports.getBirthdays = async (req, res, next) => {
  try {
    const birthdays = await Birthday.find({ user: req.user.id }).sort({ date: 1 });
    
    res.status(200).json({
      success: true,
      count: birthdays.length,
      data: birthdays
    });
  } catch (error) {
    console.error('Get birthdays error:', error);
    res.status(500).json({ error: 'Server error fetching birthdays' });
  }
};

// Get single birthday
exports.getBirthday = async (req, res, next) => {
  try {
    const birthday = await Birthday.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!birthday) {
      return res.status(404).json({ error: 'Birthday not found' });
    }

    res.status(200).json({
      success: true,
      data: birthday
    });
  } catch (error) {
    console.error('Get birthday error:', error);
    res.status(500).json({ error: 'Server error fetching birthday' });
  }
};

// Create new birthday
exports.createBirthday = async (req, res, next) => {
  try {
    // Add user to req.body
    req.body.user = req.user.id;

    const birthday = await Birthday.create(req.body);

    res.status(201).json({
      success: true,
      data: birthday
    });
  } catch (error) {
    console.error('Create birthday error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    
    res.status(500).json({ error: 'Server error creating birthday' });
  }
};

// Update birthday
exports.updateBirthday = async (req, res, next) => {
  try {
    let birthday = await Birthday.findById(req.params.id);

    if (!birthday) {
      return res.status(404).json({ error: 'Birthday not found' });
    }

    // Make sure user owns the birthday
    if (birthday.user.toString() !== req.user.id) {
      return res.status(401).json({ error: 'Not authorized to update this birthday' });
    }

    birthday = await Birthday.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    res.status(200).json({
      success: true,
      data: birthday
    });
  } catch (error) {
    console.error('Update birthday error:', error);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({ error: messages.join(', ') });
    }
    
    res.status(500).json({ error: 'Server error updating birthday' });
  }
};

// Delete birthday
exports.deleteBirthday = async (req, res, next) => {
  try {
    const birthday = await Birthday.findById(req.params.id);

    if (!birthday) {
      return res.status(404).json({ error: 'Birthday not found' });
    }

    // Make sure user owns the birthday
    if (birthday.user.toString() !== req.user.id) {
      return res.status(401).json({ error: 'Not authorized to delete this birthday' });
    }

    await Birthday.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Birthday removed successfully'
    });
  } catch (error) {
    console.error('Delete birthday error:', error);
    res.status(500).json({ error: 'Server error deleting birthday' });
  }
};

// Get upcoming birthdays
exports.getUpcomingBirthdays = async (req, res, next) => {
  try {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setMonth(today.getMonth() + 1);
    
    const birthdays = await Birthday.find({
      user: req.user.id,
      date: {
        $gte: today,
        $lte: nextMonth
      }
    }).sort({ date: 1 });
    
    res.status(200).json({
      success: true,
      count: birthdays.length,
      data: birthdays
    });
  } catch (error) {
    console.error('Get upcoming birthdays error:', error);
    res.status(500).json({ error: 'Server error fetching upcoming birthdays' });
  }
};