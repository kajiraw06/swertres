const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Draw = sequelize.define('Draw', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  draw_date: { type: DataTypes.DATEONLY, allowNull: false },
  draw_time: { type: DataTypes.ENUM('2PM', '5PM', '9PM'), allowNull: false },
  winning_numbers: { type: DataTypes.STRING(10), allowNull: false },
  jackpot: { type: DataTypes.DECIMAL(10, 2), defaultValue: 4500.00 },
  winners_count: { type: DataTypes.INTEGER.UNSIGNED, defaultValue: 0 },
  fetched_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  tableName: 'draws',
  timestamps: false,
  indexes: [{ unique: true, fields: ['draw_date', 'draw_time'] }],
});

module.exports = Draw;
