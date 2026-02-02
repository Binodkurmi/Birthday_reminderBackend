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

// -------------------- CORS Setup --------------------
// Allow both localhost for dev and your Netlify frontend in production
const allowedOrigins = [
  'http://localhost:5173', // local dev
  'https://birthday-reminder38.netlify.app' // production frontend
];

// CORS middleware
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('CORS blocked for origin:', origin);
      callback(new Error('CORS not allowed for this origin'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Handle preflight requests explicitly
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.sendStatus(204);
});

// Add CORS headers to all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  next();
});

// -------------------- Body Parsing --------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// -------------------- Static Files --------------------
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// -------------------- Debug Route --------------------
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
mongoose.connect(process.env.MONGO_URI, {
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
    service: 'Birthday Reminder API',
    version: '1.0.0'
  });
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: '🎉 Birthday Reminder Backend is running!',
    timestamp: new Date().toISOString(),
    service: 'Birthday Reminder API',
    version: '1.0.0',
    endpoints: [
      '/api/auth',
      '/api/birthdays',
      '/api/notifications',
      '/api/health',
      '/api/debug-uploads',
    ],
    docs: 'Check /api/health for service status'
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

  // CORS errors
  if (err.message === 'CORS not allowed for this origin') {
    return res.status(403).json({ 
      error: 'CORS Error',
      message: 'Access from this origin is not allowed',
      allowedOrigins: allowedOrigins
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    message:
      process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong!',
    timestamp: new Date().toISOString()
  });
});

// -------------------- 404 Handler --------------------
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString()
  });
});

// -------------------- Start Server --------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`=================================`);
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📁 Static files: ${path.join(__dirname, 'uploads')}`);
  console.log(`✅ CORS allowed origins: ${allowedOrigins.join(', ')}`);
  console.log(`=================================`);
});