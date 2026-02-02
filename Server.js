const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();
const multer = require('multer');

const authRoutes = require('./routes/auth');
const birthdayRoutes = require('./routes/birthdays');
const notificationRoutes = require('./routes/notifications');

const app = express();

// -------------------- Security Middleware --------------------
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
});
app.use(limiter);

// CORS configuration
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'https://birthday-reminder38.netlify.app',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// -------------------- Static Files --------------------
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Debug route to list uploads folder
app.get('/api/debug-uploads', (req, res) => {
  const fs = require('fs');
  const uploadsPath = path.join(__dirname, 'uploads');

  if (!fs.existsSync(uploadsPath)) {
    return res.json({ error: 'uploads folder not found', path: uploadsPath });
  }

  const files = fs.readdirSync(uploadsPath);
  res.json({
    message: 'Uploads folder contents',
    path: uploadsPath,
    count: files.length,
    files: files.slice(0, 20), // First 20 files
  });
});

// -------------------- Request Logging --------------------
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// -------------------- Database Connection --------------------
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('MongoDB connected successfully');

    // Start birthday notification scheduler after DB connection
    const { scheduleBirthdayChecks } = require('./services/birthdayService');
    scheduleBirthdayChecks();
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// -------------------- Routes --------------------
app.use('/api/auth', authRoutes);
app.use('/api/birthdays', birthdayRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    message: 'Server is running!',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: '🎉 Birthday Reminder Backend is running!',
    timestamp: new Date().toISOString(),
    routes: [
      '/api/auth',
      '/api/birthdays',
      '/api/notifications',
      '/api/health',
      '/api/debug-uploads',
    ],
  });
});

// -------------------- Error Handling --------------------
app.use((err, req, res, next) => {
  console.error('Error stack:', err.stack);

  // Multer errors
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        message: 'File size too large. Maximum size is 5MB.',
      });
    }
  }

  // Other file upload errors
  if (err.message === 'Only image files are allowed!') {
    return res.status(400).json({
      message: 'Only image files are allowed',
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message:
      process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!',
  });
});

// -------------------- 404 Handler --------------------
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// -------------------- Start Server --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Static files served from: ${path.join(__dirname, 'uploads')}`);
});
