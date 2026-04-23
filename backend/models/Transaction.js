const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  type: { type: DataTypes.ENUM('deposit', 'withdrawal', 'bet', 'prize', 'refund'), allowNull: false },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  balance_before: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
  balance_after: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
  reference: { type: DataTypes.STRING(100) },
  note: { type: DataTypes.STRING(255) },
}, {
  tableName: 'transactions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

module.exports = Transaction;
