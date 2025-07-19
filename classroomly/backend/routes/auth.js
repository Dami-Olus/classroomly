const express = require('express');
const { z } = require('zod');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { validateBody } = require('../middleware/validation');
const crypto = require('crypto');
const { sendEmail } = require('../lib/email');

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  userType: z.enum(['TUTOR', 'STUDENT']),
  hourlyRate: z.number().positive().optional(),
  subjects: z.array(z.string()).optional()
});

router.post('/register', validateBody(registerSchema), async (req, res) => {
  try {
    const { email, password, firstName, lastName, userType, hourlyRate, subjects } = req.validatedBody;

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Email already registered' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours
    console.log('Generated verification token:', verificationToken);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        firstName,
        lastName,
        userType,
        hourlyRate: userType === 'TUTOR' ? hourlyRate : undefined,
        subjects: userType === 'TUTOR' ? (Array.isArray(subjects) ? subjects.join(",") : (subjects || "")) : "",
        isVerified: false,
        isActive: true,
        verificationToken,
        verificationTokenExpires
      }
    });

    // Send verification email
    const verifyUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
    await sendEmail(
      user.email,
      'Verify your TutorLink account',
      `<p>Hi ${user.firstName},</p>
      <p>Thank you for registering on TutorLink. Please verify your email by clicking the link below:</p>
      <p><a href="${verifyUrl}">Verify Email</a></p>
      <p>This link will expire in 24 hours.</p>`
    );

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType
      },
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ success: false, message: 'Registration failed' });
  }
});

// Email verification endpoint
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    console.log('Verification attempt with token:', token);
    
    if (!token) {
      // Try to find a user who is already verified (for friendlier UX)
      const user = await prisma.user.findFirst({ where: { isVerified: true } });
      if (user) {
        return res.status(200).json({ success: true, message: 'Email already verified.' });
      }
      return res.status(400).json({ success: false, message: 'Verification token is required' });
    }
    
    const user = await prisma.user.findFirst({ where: { verificationToken: token } });
    console.log('User found:', user ? 'Yes' : 'No');
    
    if (!user) {
      // Try to find a user who is already verified (for friendlier UX)
      const alreadyVerified = await prisma.user.findFirst({ where: { isVerified: true, verificationToken: null } });
      if (alreadyVerified) {
        return res.status(200).json({ success: true, message: 'Email already verified.' });
      }
      // Let's also check if there are any users with verification tokens
      const allUsersWithTokens = await prisma.user.findMany({
        where: { verificationToken: { not: null } },
        select: { id: true, email: true, verificationToken: true }
      });
      console.log('All users with verification tokens:', allUsersWithTokens);
      
      return res.status(400).json({ success: false, message: 'Invalid or expired verification token' });
    }
    if (user.verificationTokenExpires && user.verificationTokenExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'Verification token has expired' });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
        verificationTokenExpires: null
      }
    });
    return res.status(200).json({ success: true, message: 'Email verified successfully. You can now log in.' });
  } catch (error) {
    console.error('Email verification error:', error);
    return res.status(500).json({ success: false, message: 'Email verification failed' });
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters')
});

router.post('/login', validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.validatedBody;

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'Account is deactivated' });
    }

    // Check if user is verified (optional, can be removed if not required)
    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Account is not verified' });
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, userType: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Login failed' });
  }
});

// Forgot password endpoint
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required' });
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // For security, do not reveal if the email exists
      return res.status(200).json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
    }
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour
    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpires }
    });
    // Send reset email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    await sendEmail(
      user.email,
      'Reset your TutorLink password',
      `<p>Hi ${user.firstName},</p>
      <p>You requested a password reset. Click the link below to set a new password:</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>This link will expire in 1 hour. If you did not request this, you can ignore this email.</p>`
    );
    return res.status(200).json({ success: true, message: 'If that email is registered, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send reset email' });
  }
});

// Reset password endpoint
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ success: false, message: 'Token and new password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
    }
    const user = await prisma.user.findFirst({ where: { resetToken: token } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
    }
    if (user.resetTokenExpires && user.resetTokenExpires < new Date()) {
      return res.status(400).json({ success: false, message: 'Reset token has expired' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpires: null
      }
    });
    return res.status(200).json({ success: true, message: 'Password has been reset. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

module.exports = router; 