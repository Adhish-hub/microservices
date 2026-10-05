const mongoose = require("mongoose")

async function connectDB(){
    try{
        await mongoose.connect(process.env.MONGO_URI);
        console.log("catalog-service connected to MongoDB");
    }catch(err){
        console.error("MongoDB connection failed:", err.message);
        process.exit(1);
    }
}

module.exports = connectDB;