const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: { type: DataTypes.INTEGER.UNSIGNED, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(100), allowNull: false },
  phone: { type: DataTypes.STRING(20), allowNull: false, unique: true },
  email: { type: DataTypes.STRING(150), unique: true, allowNull: true },
  password: { type: DataTypes.STRING(255), allowNull: false },
  balance: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.00 },
  role: { type: DataTypes.ENUM('bettor', 'admin'), defaultValue: 'bettor' },
  is_active: { type: DataTypes.TINYINT(1), defaultValue: 1 },
}, {
  tableName: 'users',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = User;
