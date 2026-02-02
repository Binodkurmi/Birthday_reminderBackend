const express = require('express');
const {
  register,
  login,
  getMe,
  updateDetails,
  updatePassword,
  logout
} = require('../controllers/authController');

const { protect } = require('../middleware/auth');
const { validateRegister, validateLogin, handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

router.post('/register', validateRegister, handleValidationErrors, register);
router.post('/login', validateLogin, handleValidationErrors, login);
router.get('/me', protect, getMe);
router.put('/updatedetails', protect, updateDetails);
router.put('/updatepassword', protect, updatePassword);
router.get('/logout', protect, logout); // Added protect middleware to logout

module.exports = router;