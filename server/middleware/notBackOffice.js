// Middleware: blocks back office users (Corporate_Admin_Fl = 'B') from routes
// they don't need (Library, Profile, Devices).
// Back office users may only use /api/stream, /api/friends, /api/rekognition, /api/auth.
// Must be used after the auth middleware so req.user is populated.
module.exports = function (req, res, next) {
  if (req.user?.corporateAdminFl === 'B') {
    return res.status(403).json({ error: 'Not available for back office users' });
  }
  next();
};
