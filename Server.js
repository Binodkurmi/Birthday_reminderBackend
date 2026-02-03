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

// -------------------- CORS Setup (Dynamic) --------------------
// Production origins
const productionOrigins = [
  'https://birthday-reminder38.netlify.app', // production frontend
  'https://birthdarreminder.netlify.app'     // if you have another
];

// Dynamic CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, server-to-server)
    if (!origin) {
      console.log('✅ No origin - allowing request');
      return callback(null, true);
    }
    
    // Check if it's a production origin
    if (productionOrigins.includes(origin)) {
      console.log(`✅ Production origin allowed: ${origin}`);
      return callback(null, true);
    }
    
    // Check if it's a localhost/development origin
    const isLocalhost = origin.includes('localhost') || 
                       origin.includes('127.0.0.1') || 
                       origin.includes('0.0.0.0') ||
                       origin.includes('::1');
    
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         process.env.NODE_ENV === undefined;
    
    if (isLocalhost && isDevelopment) {
      console.log(`✅ Localhost origin allowed (${process.env.NODE_ENV || 'development'}): ${origin}`);
      return callback(null, true);
    }
    
    // Block the request
    console.log(`❌ CORS blocked for origin: ${origin}`);
    console.log(`ℹ️  Production origins: ${productionOrigins.join(', ')}`);
    console.log(`ℹ️  Environment: ${process.env.NODE_ENV || 'development'}`);
    callback(new Error(`CORS not allowed for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Origin', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// -------------------- Security Middleware --------------------
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per window
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// -------------------- Body Parsing --------------------
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// -------------------- Static Files --------------------
// Ensure uploads directory exists
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log(`📁 Created uploads directory: ${uploadsDir}`);
}

// Serve static files
app.use('/api/uploads', express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
    // Add CORS headers for images
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// -------------------- Debug Routes --------------------
app.get('/api/debug-uploads', (req, res) => {
  if (!fs.existsSync(uploadsDir)) {
    return res.json({ 
      error: 'Uploads folder not found', 
      path: uploadsDir,
      message: 'Create an uploads folder in your project root'
    });
  }

  const files = fs.readdirSync(uploadsDir);
  res.json({
    message: 'Uploads folder contents',
    path: uploadsDir,
    count: files.length,
    files: files.slice(0, 20),
    corsInfo: {
      allowedOrigins: productionOrigins,
      localhostAllowed: true,
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// CORS test endpoint
app.get('/api/cors-test', (req, res) => {
  res.json({
    message: 'CORS is working! 🎉',
    origin: req.headers.origin || 'No origin header',
    allowed: true,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
    info: 'This endpoint tests if CORS is properly configured'
  });
});

// -------------------- Request Logging Middleware --------------------
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log(`   Origin: ${req.headers.origin || 'No origin'}`);
  console.log(`   User-Agent: ${req.headers['user-agent']?.substring(0, 50)}...`);
  next();
});

// -------------------- Database Connection --------------------
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
})
.then(() => {
  console.log('✅ MongoDB connected successfully');
  
  // Start birthday notification scheduler
  const { scheduleBirthdayChecks } = require('./services/birthdayService');
  scheduleBirthdayChecks();
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  console.log('ℹ️  Attempting to reconnect in 5 seconds...');
  
  // Try to reconnect
  setTimeout(() => {
    mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  }, 5000);
});

// -------------------- Routes --------------------
app.use('/api/auth', authRoutes);
app.use('/api/birthdays', birthdayRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  const dbStatus = mongoose.connection.readyState;
  const dbStatusText = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  }[dbStatus] || 'unknown';

  res.status(200).json({
    status: 'healthy',
    message: '🎂 Birthday Reminder API is running!',
    timestamp: new Date().toISOString(),
    database: {
      status: dbStatusText,
      connected: dbStatus === 1
    },
    cors: {
      allowedOrigins: productionOrigins,
      localhostAllowed: process.env.NODE_ENV !== 'production',
      environment: process.env.NODE_ENV || 'development'
    },
    server: {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      nodeVersion: process.version
    }
  });
});

// Welcome route
app.get('/', (req, res) => {
  res.json({
    message: '🎉 Welcome to Birthday Reminder Backend API!',
    version: '1.0.0',
    documentation: 'API endpoints are available under /api',
    endpoints: {
      auth: '/api/auth',
      birthdays: '/api/birthdays',
      notifications: '/api/notifications',
      health: '/api/health',
      debug: '/api/debug-uploads',
      corsTest: '/api/cors-test'
    },
    corsInfo: {
      productionOrigins: productionOrigins,
      development: 'All localhost origins are allowed in development',
      environment: process.env.NODE_ENV || 'development'
    }
  });
});

// -------------------- Error Handling Middleware --------------------
app.use((err, req, res, next) => {
  console.error('🔥 Error Stack:', err.stack);
  console.error('📝 Error Details:', {
    message: err.message,
    path: req.path,
    method: req.method,
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });

  // CORS errors
  if (err.message.includes('CORS not allowed')) {
    return res.status(403).json({ 
      error: 'CORS Error',
      message: err.message,
      details: {
        yourOrigin: req.headers.origin,
        allowedProductionOrigins: productionOrigins,
        environment: process.env.NODE_ENV || 'development',
        tip: 'In development, all localhost origins are allowed. In production, only specified origins.'
      },
      timestamp: new Date().toISOString()
    });
  }

  // Multer errors
  if (err instanceof multer.MulterError) {
    const errorMessages = {
      'LIMIT_FILE_SIZE': 'File size too large. Maximum size is 5MB.',
      'LIMIT_FILE_COUNT': 'Too many files uploaded.',
      'LIMIT_FIELD_KEY': 'Field name too long.',
      'LIMIT_FIELD_VALUE': 'Field value too long.',
      'LIMIT_FIELD_COUNT': 'Too many fields.',
      'LIMIT_UNEXPECTED_FILE': 'Unexpected field in file upload.'
    };
    
    return res.status(400).json({
      error: 'File Upload Error',
      message: errorMessages[err.code] || 'File upload error',
      code: err.code,
      timestamp: new Date().toISOString()
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      message: err.message,
      details: err.errors,
      timestamp: new Date().toISOString()
    });
  }

  // MongoDB duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({
      error: 'Duplicate Entry',
      message: 'A record with this information already exists',
      field: Object.keys(err.keyPattern)[0],
      timestamp: new Date().toISOString()
    });
  }

  // Default error
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong!' : err.message,
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// -------------------- 404 Handler --------------------
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route Not Found',
    message: `The requested route ${req.originalUrl} does not exist`,
    method: req.method,
    availableEndpoints: {
      root: '/',
      auth: '/api/auth/*',
      birthdays: '/api/birthdays/*',
      notifications: '/api/notifications/*',
      health: '/api/health',
      debug: '/api/debug-uploads',
      corsTest: '/api/cors-test'
    },
    timestamp: new Date().toISOString()
  });
});

// -------------------- Start Server --------------------
const PORT = process.env.PORT || 5000;

// Handle server errors
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`
============================================================
🚀  Server is running on port ${PORT}
🌍  Environment: ${process.env.NODE_ENV || 'development'}
============================================================
📊  CORS Configuration:
    ✅ Production origins: ${productionOrigins.join(', ')}
    ✅ Localhost origins: Allowed in development
    ✅ Environment: ${process.env.NODE_ENV || 'development'}
============================================================
🗄️  Database: ${mongoose.connection.readyState === 1 ? 'Connected ✅' : 'Disconnected ❌'}
📁  Uploads directory: ${uploadsDir}
🔗  Health check: http://localhost:${PORT}/api/health
🔗  CORS test: http://localhost:${PORT}/api/cors-test
============================================================
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('MongoDB connection closed');
      process.exit(0);
    });
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️  Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥  Uncaught Exception:', error);
  process.exit(1);
});

module.exports = app;