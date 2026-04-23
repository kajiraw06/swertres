// Models are no longer used — all queries go through the Supabase client directly.
// Import from config/supabase.js instead.
const supabase = require('../config/supabase');
module.exports = { supabase };
