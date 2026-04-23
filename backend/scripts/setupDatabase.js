require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const bcrypt = require('bcryptjs');
const supabase = require('../config/supabase');

(async () => {
  try {
    const adminPhone = process.env.ADMIN_PHONE;
    const adminPass  = process.env.ADMIN_PASSWORD;
    const adminName  = process.env.ADMIN_NAME || 'Admin';

    if (!adminPhone || !adminPass) {
      console.warn('ADMIN_PHONE or ADMIN_PASSWORD not set in .env — skipping admin seed.');
      process.exit(0);
    }

    const { data: existing } = await supabase.from('users').select('id').eq('phone', adminPhone).maybeSingle();
    if (!existing) {
      const hashed = await bcrypt.hash(adminPass, 12);
      await supabase.from('users').insert({ name: adminName, phone: adminPhone, password: hashed, role: 'admin' });
      console.log(`✅ Admin account created: ${adminPhone}`);
    } else {
      console.log('Admin account already exists. Skipping.');
    }

    process.exit(0);
  } catch (err) {
    console.error('Setup error:', err.message);
    process.exit(1);
  }
})();
