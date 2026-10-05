const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true },
    stock: { type: Number, required: true, min: 0, default: 0 },
    images: [{ type: String }], // Cloudinary URLs later — plain strings for now
  },
  { timestamps: true }, // adds createdAt/updatedAt automatically
);

 
// Indexes — these matter for a read-heavy service. Without them, MongoDB
// scans every document for these common query patterns as the catalog grows.
productSchema.index({ category: 1 });       // filtering by category
productSchema.index({ price: 1 });          // sorting/filtering by price
productSchema.index({ name: 'text' });      // basic text search on name
 
module.exports = mongoose.model('Product', productSchema);
 