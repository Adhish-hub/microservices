const jwt = require("jsonwebtoken");

function verifyToken(token){
    const secret = process.env.JWT_SECRET;

    if(!secret){
        throw new Error("JWT_sECRET is not configured.")
    }

    return jwt.verify(token, secret);
}

module.exports = {verifyToken};