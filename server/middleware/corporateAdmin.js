// Middleware: requires the caller to be an Organization Admin User (OAU).
// Must be used after the auth middleware so req.user is populated.
module.exports = function (req, res, next) {
  if (!req.user.parentOrganizationId || req.user.corporateAdminFl !== 'Y') {
    return res.status(403).json({ error: 'Requires organisation admin role' });
  }
  next();
};
