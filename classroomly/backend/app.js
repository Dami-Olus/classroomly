const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

const classesRouter = require('./routes/classes');
const authRouter = require('./routes/auth');
const profileRouter = require('./routes/profile');
const bookingsRouter = require('./routes/bookings');
const availabilityRouter = require('./routes/availability');
const sessionsRouter = require('./routes/sessions');
const messagesRouter = require('./routes/messages');
const materialsRouter = require('./routes/materials');
const adminRouter = require('./routes/admin');

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Classroomly backend API!' });
});

app.use('/api/classes', classesRouter);
app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/availability', availabilityRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/materials', materialsRouter);
app.use('/api/admin', adminRouter);

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.use((error, req, res, next) => {
  // Zod validation error handling
  if (error && error.name === 'ZodError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: error.errors
    });
  }
  console.error('Global error handler:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

module.exports = app; 