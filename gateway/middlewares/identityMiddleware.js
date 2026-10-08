function identityMiddleware(req, res, next){
    if(!req.user){
        return res.status(401).json({
            message: "Authentication required.",
        });
    }

    req.headers["x-user-id"] = req.user.userId;
    req.headers["x-user-role"] = req.user.role;

    next();
}

module.exports = identityMiddleware;