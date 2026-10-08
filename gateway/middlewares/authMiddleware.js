const {verifyToken} = require("../utils/token");

function authMiddleware(req, res, next){
    const authHeader = req.headers.authorization;

    if(!authHeader || !authHeader.startsWith("Bearer")){
        return res.status(401).json({
            message: "Authentication required."
        });
    }

    const token = authHeader.split(" ")[1];

    if(!token){
        return res.status(401).json({
            message: "Authentication token is missing."
        });
    }

    try{
        const decoded = verifyToken(token);
        req.user = decoded;

        next();
    }catch(error){
        return res.status(401).json({
            message: "Invalid or expired token."
        });
    }
}

module.exports = authMiddleware;