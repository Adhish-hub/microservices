require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("./src/models/Product");

const sampleProducts = [
  {
    name: "Running Shoes",
    description: "Lightweight daily trainer",
    price: 79.99,
    category: "shoes",
    stock: 50,
  },
  {
    name: "Wireless Earbuds",
    description: "Noise-isolating, 20hr battery",
    price: 49.99,
    category: "electronics",
    stock: 120,
  },
  {
    name: "Yoga Mat",
    description: "Non-slip, 6mm thick",
    price: 24.99,
    category: "fitness",
    stock: 80,
  },
  {
    name: "Ceramic Mug",
    description: "350ml, dishwasher safe",
    price: 12.5,
    category: "home",
    stock: 200,
  },
  {
    name: "Backpack",
    description: "25L, water-resistant",
    price: 59.99,
    category: "bags",
    stock: 35,
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected. Seeding...");

  await Product.deleteMany({}); // clean slate each time
  await Product.insertMany(sampleProducts);

  console.log(`Inserted ${sampleProducts.length} products.`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
