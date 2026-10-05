function errorMiddleware(err, req, res, next){
    console.log(err);

    if(err.code === "P2002"){
        return res.status(409).json({
            message: "Reservation for this order already exists."
        })
    }

    res.status(err.status || 500).json({
        message: err.message || "Internal server error"
    });
}

module.exports = errorMiddleware;