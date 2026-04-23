const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const authenticate = async (req, res, next) => {
  try {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer '))
      return res.status(401).json({ message: 'No token provided.' });

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, username, phone, email, role, balance, is_active')
      .eq('id', decoded.id)
      .single();

    if (error || !user || !user.is_active)
      return res.status(401).json({ message: 'Account not found or disabled.' });

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ message: 'Admin access required.' });
  next();
};

module.exports = { authenticate, adminOnly };

