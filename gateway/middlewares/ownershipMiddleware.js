function requireParamOwnership(paramName = "userId") {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Authentication required.",
      });
    }

    const requestedUserId = req.params[paramName];

    if (requestedUserId !== req.user.userId) {
      return res.status(403).json({
        message: "You do not have permission to access this resource.",
      });
    }

    next();
  };
}

module.exports = {
  requireParamOwnership,
};
