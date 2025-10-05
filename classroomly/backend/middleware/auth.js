const jwt = require('jsonwebtoken');
const supabase = require('../lib/supabase');

/**
 * Middleware to authenticate user and attach user info to request
 */
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.substring(7);

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('JWT error:', jwtError.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }

    const userId = decoded.id;

    // Get user from Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, first_name, last_name, user_type, is_verified, is_active')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Supabase error fetching user:', error.message);
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Account has been deactivated'
      });
    }

    if (!user.is_verified) {
      return res.status(403).json({
        success: false,
        message: 'Account not verified'
      });
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      userType: user.user_type
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

/**
 * Middleware to check user role
 */
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication required' 
      });
    }
    
    if (!allowedRoles.includes(req.user.userType)) {
      return res.status(403).json({ 
        success: false, 
        message: 'Insufficient permissions' 
      });
    }
    
    next();
  };
};

const requireTutor = requireRole(['tutor']);
const requireStudent = requireRole(['student']);
const requireAdmin = requireRole(['admin']);

// Optional: Allow multiple roles
const requireTutorOrAdmin = requireRole(['tutor', 'admin']);

module.exports = {
  authenticateUser,
  requireTutor,
  requireStudent,
  requireAdmin,
  requireRole, // Export for custom role checks
  requireTutorOrAdmin
};