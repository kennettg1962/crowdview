// Middleware: requires corporateAdminFl === 'O' (CrowdView operations staff)
module.exports = function (req, res, next) {
  if (req.user.corporateAdminFl !== 'O') {
    return res.status(403).json({ error: 'Requires operations role' });
  }
  next();
};
