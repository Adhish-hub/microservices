const Product = require("../models/Product");

async function createProduct(req, res, next){
    try{
        const {name, description, price, category, stock, images} = req.body;

        if(!name || price === undefined || !category){
            return res.status(400).json({
                message: "Name, price and category are required"
            })
        }

        const product = await Product.create({ name, description, price, category, stock, images })

        res.status(201).json(product)
    }catch(err){
        next(err)
    }
}

async function getProducts(req, res, next) {
    try{
        // Pagination params — always provide sane defaults, never trust the
        // client to send valid numbers.


        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.min(parseInt(req.query.limit) || 20, 100) //cap is at 100
        const skip = (page - 1) * limit

        // Build a filter object dynamically from whichever query params
        // were actually provided — this is the standard pattern for
        // "optional filters" in a list endpoint.

        const filter = {};

        if(req.query.category) filter.category = req.query.category;
        if(req.query.minPrice || req.query.maxPrice){
            filter.price = {};
            if(req.query.minPrice) filter.price.$gte = Number(req.query.minPrice);
            if(req.query.maxPrice) filter.price.$lte = Number(req.query.maxPrice);
        }

        const [products, total] = await Promise.all([
            Product.find(filter).skip(skip).limit(limit).sort({ createdAt: -1 }),
            Product.countDocuments(filter),
        ]);

        res.status(200).json({
            products,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total/limit),
            },
        });
    }catch(err){
        next(err)
    }
}


async function getProductById(req, res, next){
    try{
        const product = await Product.findById(req.params.id);
        if(!product){
            return res.status(404).json({
                message: "Product not found."
            })
        }
        res.status(200).json(product);
    }catch(err){
        next(err)
    }
}

async function updateProduct(req, res, next){
    try{
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            req.body,
            {
                new: true,
                runValidators: true
            }
        )

        if(!product){
            return res.status(404).json({
                message: "Product not found."
            })
        }

        res.status(200).json(product);
    }catch(err){
        next(err)
    }
}

async function deleteProduct(req, res, next){
    try{
        const product = await Product.findByIdAndDelete(req.params.id);

        if(!product){
            return res.status(404).json({
                message: "Product not found."
            })
        }

        res.status(200).json({
            message: "Product deleted successfully."
        })
    }catch(err){
        next(err)
    }
}

module.exports = {createProduct, getProducts, getProductById, updateProduct, deleteProduct};