function errorMiddleware(err, req, res, next){
    console.error(err);

    if(err.name === "CastError"){
      // Happens when :id in the URL isn't a valid MongoDB ObjectId
      return res.status(400).json({
        message: "Invalid product ID format."
      })
    }

    res.status(err.status || 500).json({
        message: err.message || "Internal server error."
    });
}

module.exports = errorMiddleware
