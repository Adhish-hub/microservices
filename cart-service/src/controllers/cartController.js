const { redisClient } = require("../config/redis");

const catalogService = require("../services/catalogService");

const CART_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days of inactivity before a cart expires

function cartKey(userId){
    return `cart:${userId}`;
}

async function getCart(req, res, next){
    try{
            const { userId } = req.params;
            const raw = await redisClient.get(cartKey(userId));
            const cart = raw ? JSON.parse(raw) : { items: [] };
            res.status(200).json(cart);
    }catch(err){
        next(err)
    }
}


async function addItem(req, res, next){
    try{
        const {userId} = req.params;
        const {productId, quantity} = req.body;

        if(!productId || !quantity || quantity < 1){
            return res.status(400).json({
                message: "ProductID and quantity are required."
            })
        }

        // The actual service-to-service call — ask Catalog if this product
        // is real before we let someone add it to a cart.
        const product = await catalogService.getProductById(productId);
        if(!product){
            return res.status(404).json({
                message: "Product not found."
            })
        }

        const raw = await redisClient.get(cartKey(userId));
        const cart = raw ? JSON.parse(raw) : {items: []}

        const existingItem = cart.items.find((item) => item.productId === productId);
        if(existingItem){
            existingItem.quantity += quantity;
        }else{
            // Denormalize name/price into the cart, same pattern as your
            // Order model's orderItems — avoids calling Catalog again just
            // to render the cart, and preserves the price at time of adding.
            cart.items.push({
                productId,
                name: product.name,
                price: product.price,
                quantity,
            });
        }

        await redisClient.set(cartKey(userId), JSON.stringify(cart), {EX: CART_TTL_SECONDS})

        res.status(200).json(cart)
    }catch(err){
        next(err)
    }
}


async function removeItem(req, res, next){
    try{
        const {userId, productId} = req.params;
        const raw = await redisClient.get(cartKey(userId));
        const cart = raw ? JSON.parse(raw) : {items: []};

        cart.items = cart.items.filter((item) => item.productId !== productId);

        await redisClient.set(cartKey(userId), JSON.stringify(cart), {EX: CART_TTL_SECONDS});

        res.status(200).json(cart);
    }catch(err){
        next(err)
    }
}


async function clearCart(req, res, next){
    try{
        const {userId} = req.params;
        await redisClient.del(cartKey(userId));
        res.status(200).json({
            message: "Cart cleared."
        })
    }catch(err){
        next(err)
    }
}

module.exports = {getCart, addItem, removeItem, clearCart}