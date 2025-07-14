const { User } = require('../models');

const isAdmin = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user || !user.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора' });
    }
    next();
  } catch (error) {
    console.error('Ошибка проверки прав администратора:', error);
    res.status(500).json({ error: 'Ошибка сервера при проверке прав' });
  }
};

module.exports = { isAdmin };