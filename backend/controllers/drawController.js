const supabase = require('../config/supabase');
const moment = require('moment');

exports.getDraws = async (req, res) => {
  try {
    const date = req.query.date || moment().format('YYYY-MM-DD');
    const minDate = moment().subtract(5, 'days').startOf('day');
    if (moment(date).isBefore(minDate)) {
      return res.status(400).json({ message: 'Results are only available for the last 5 days.' });
    }
    const { data: rawDraws, error } = await supabase
      .from('draws').select('*').eq('draw_date', date).order('draw_time');
    if (error) return res.status(500).json({ message: 'Failed to get draws.' });

    // For today (Manila time), hide draws whose scheduled time hasn't passed yet
    const manilaToday = moment().utcOffset(8).format('YYYY-MM-DD');
    let draws = rawDraws || [];
    if (date === manilaToday) {
      const DRAW_CUTOFFS_MIN = { '2PM': 14 * 60, '5PM': 17 * 60, '9PM': 21 * 60 };
      const manilaM = moment().utcOffset(8);
      const nowMin = manilaM.hours() * 60 + manilaM.minutes();
      draws = draws.filter(d => {
        const cutoff = DRAW_CUTOFFS_MIN[d.draw_time];
        return cutoff !== undefined && nowMin >= cutoff;
      });
    }

    return res.json({ date, draws });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get draws.' });
  }
};

exports.getRecentDraws = async (req, res) => {
  try {
    const sevenDaysAgo = moment().subtract(7, 'days').format('YYYY-MM-DD');
    const { data: rawDraws, error } = await supabase
      .from('draws').select('*')
      .gte('draw_date', sevenDaysAgo)
      .order('draw_date', { ascending: false })
      .order('draw_time', { ascending: false });
    if (error) return res.status(500).json({ message: 'Failed to get recent draws.' });

    // Filter out today's draws that haven't happened yet (Manila time)
    const manilaToday = moment().utcOffset(8).format('YYYY-MM-DD');
    const DRAW_CUTOFFS_MIN = { '2PM': 14 * 60, '5PM': 17 * 60, '9PM': 21 * 60 };
    const manilaM = moment().utcOffset(8);
    const nowMin = manilaM.hours() * 60 + manilaM.minutes();
    const draws = (rawDraws || []).filter(d => {
      if (d.draw_date !== manilaToday) return true;
      const cutoff = DRAW_CUTOFFS_MIN[d.draw_time];
      return cutoff !== undefined && nowMin >= cutoff;
    });

    return res.json({ draws });
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get recent draws.' });
  }
};
