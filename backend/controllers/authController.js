const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../config/supabase');

const signToken = (user) =>
  jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });

const signRefreshToken = (user) =>
  jwt.sign({ id: user.id, type: 'refresh' }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });

exports.register = async (req, res) => {
  try {
    const { name, username, phone, password, email } = req.body;
    const { data: existingUser } = await supabase.from('users').select('id').eq('username', username).maybeSingle();
    if (existingUser) return res.status(409).json({ message: 'Username is already taken.' });

    if (phone) {
      const { data: existingPhone } = await supabase.from('users').select('id').eq('phone', phone).maybeSingle();
      if (existingPhone) return res.status(409).json({ message: 'Phone number already registered.' });
    }

    const hashed = await bcrypt.hash(password, 12);
    const { data: user, error } = await supabase
      .from('users')
      .insert({ name, username, phone: phone || null, email: email || null, password: hashed })
      .select('id, name, username, phone, role, balance')
      .single();

    if (error) { console.error('Register error:', error); return res.status(500).json({ message: 'Registration failed.' }); }

    return res.status(201).json({
      message: 'Registration successful.',
      token: signToken(user),
      refresh_token: signRefreshToken(user),
      user: { ...user, balance: parseFloat(user.balance) },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ message: 'Registration failed.' });
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const { data: user } = await supabase.from('users').select('*').eq('username', username).single();
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid username or password.' });
    }
    if (!user.is_active) {
      return res.status(403).json({ message: 'Account is disabled. Contact admin.' });
    }
    return res.json({
      message: 'Login successful.',
      token: signToken(user),
      refresh_token: signRefreshToken(user),
      user: { id: user.id, name: user.name, username: user.username, phone: user.phone, role: user.role, balance: parseFloat(user.balance) },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ message: 'Login failed.' });
  }
};

exports.getMe = (req, res) => {
  const u = req.user;
  return res.json({ id: u.id, name: u.name, username: u.username, phone: u.phone, email: u.email, role: u.role, balance: parseFloat(u.balance) });
};

exports.refreshToken = async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ message: 'Refresh token required.' });
    let payload;
    try {
      payload = jwt.verify(refresh_token, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: 'Invalid or expired refresh token.' });
    }
    if (payload.type !== 'refresh') return res.status(401).json({ message: 'Invalid token type.' });
    const { data: user } = await supabase
      .from('users')
      .select('id, name, username, phone, role, balance, is_active')
      .eq('id', payload.id)
      .single();
    if (!user || !user.is_active) return res.status(401).json({ message: 'Account not found or disabled.' });
    return res.json({
      token: signToken(user),
      refresh_token: signRefreshToken(user),
      user: { id: user.id, name: user.name, username: user.username, phone: user.phone, role: user.role, balance: parseFloat(user.balance) },
    });
  } catch (err) {
    console.error('Refresh token error:', err);
    return res.status(500).json({ message: 'Token refresh failed.' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { username, name, new_password } = req.body;
    // Find user by username
    const { data: user } = await supabase.from('users').select('id, name, is_active').eq('username', username).maybeSingle();
    if (!user) return res.status(404).json({ message: 'No account found with that username.' });
    if (!user.is_active) return res.status(403).json({ message: 'Account is disabled. Contact admin.' });
    // Verify name matches (case-insensitive, trimmed)
    if (user.name.trim().toLowerCase() !== name.trim().toLowerCase())
      return res.status(400).json({ message: 'Name does not match our records.' });
    const hashed = await bcrypt.hash(new_password, 12);
    const { error } = await supabase.from('users').update({ password: hashed }).eq('id', user.id);
    if (error) return res.status(500).json({ message: 'Failed to reset password.' });
    return res.json({ message: 'Password reset successfully. You may now log in.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ message: 'Failed to reset password.' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;
    const { data: user } = await supabase.from('users').select('password').eq('id', userId).single();
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const match = await bcrypt.compare(current_password, user.password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect.' });
    const hashed = await bcrypt.hash(new_password, 12);
    const { error } = await supabase.from('users').update({ password: hashed }).eq('id', userId);
    if (error) return res.status(500).json({ message: 'Failed to update password.' });
    return res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ message: 'Failed to change password.' });
  }
};
