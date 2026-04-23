const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false },
  transaction_id: { type: DataTypes.INTEGER.UNSIGNED, allowNull: true },
  paymongo_id: { type: DataTypes.STRING(100), unique: true },
  amount: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  status: { type: DataTypes.ENUM('pending', 'paid', 'failed', 'expired'), defaultValue: 'pending' },
  checkout_url: { type: DataTypes.TEXT },
}, {
  tableName: 'payments',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = Payment;
