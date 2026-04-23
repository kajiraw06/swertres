const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Bet = sequelize.define('Bet', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  draw_date: { type: DataTypes.DATEONLY, allowNull: false },
  draw_time: { type: DataTypes.ENUM('2PM', '5PM', '9PM'), allowNull: false },
  numbers: { type: DataTypes.STRING(10), allowNull: false },       // "1-2-3"
  bet_type: { type: DataTypes.ENUM('straight', 'rambolito'), defaultValue: 'straight' },
  amount: { type: DataTypes.DECIMAL(10, 2), allowNull: false },    // min ₱10
  status: { type: DataTypes.ENUM('pending', 'won', 'lost', 'cancelled'), defaultValue: 'pending' },
  prize_amount: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0.00 },
}, {
  tableName: 'bets',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Bet;
