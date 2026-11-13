/* =========================================================
   SOKO | products.js
   Images are loaded from the /images folder.
   ========================================================= */   /* ---------- Image fallback (works offline) ---------- */
   const FALLBACK_IMG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
     '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">' +
     '<rect width="300" height="300" fill="#f1f3f5"/>' +
     '<g fill="none" stroke="#b6bcc6" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">' +
     '<rect x="95" y="105" width="110" height="90" rx="10"/><circle cx="130" cy="136" r="9"/>' +
     '<path d="M100 188l32-30 24 22 18-16 31 28"/></g>' +
     '<text x="150" y="228" font-family="Arial,sans-serif" font-size="16" text-anchor="middle" fill="#9aa1ad">No image yet</text></svg>'
   );
   document.addEventListener('error', (e) => {
     const img = e.target;
     if (img.tagName === 'IMG' && img.dataset.fallback !== '1') {
       img.dataset.fallback = '1';
       img.src = FALLBACK_IMG;
     }
   }, true);

const PRODUCTS = [
  // ---- Regular catalogue ----
  { id: 201, title: "Anti-Theft Laptop Backpack", seller: "TechHub Kenya", category: "electronics", price: 3500, rating: 4.6, reviews: 92, image: "images/laptop-backpack.jpg" },
  { id: 202, title: "Premium Cotton T-Shirt", seller: "Urban Steps", category: "fashion", price: 1800, rating: 4.2, reviews: 143, image: "images/cotton-tshirt.jpg" },
  { id: 203, title: "Soft Cotton Bedding Set", seller: "HomeEssentials", category: "home", price: 6200, rating: 4.8, reviews: 76, image: "images/cotton-beddings.jpg" },
  { id: 204, title: "Daily Skincare Gift Set", seller: "Glow Naturals", category: "beauty", price: 2300, rating: 4.4, reviews: 61, image: "images/skincare.jpg" },
  { id: 205, title: "Match Quality Football", seller: "ProSport KE", category: "sports", price: 3200, rating: 4.5, reviews: 108, image: "images/football.jpg" },
  { id: 206, title: '6.5" Android Smartphone', seller: "GadgetZone", category: "electronics", price: 24900, rating: 4.7, reviews: 312, image: "images/android-smartphone.jpg" },
  { id: 207, title: "Classic Leather Handbag", seller: "Urban Steps", category: "fashion", price: 3900, rating: 4.3, reviews: 54, image: "images/leather-handbag.jpg" },
  { id: 208, title: "LED Desk Lamp", seller: "HomeEssentials", category: "home", price: 2750, rating: 4.1, reviews: 39, image: "images/led-desk-lamp.jpg" },
  { id: 209, title: "Non-Stick Frying Pan Set", seller: "HomeEssentials", category: "home", price: 4200, rating: 4.4, reviews: 71, image: "images/frying-pan.jpg" },
  { id: 210, title: "Lightweight Running Shoes", seller: "ProSport KE", category: "sports", price: 5400, rating: 4.6, reviews: 98, image: "images/running-shoes.jpg" },
  { id: 211, title: "Non-Slip Yoga Mat", seller: "ProSport KE", category: "sports", price: 1500, rating: 4.3, reviews: 66, image: "images/yoga-mat.jpg" },
  { id: 212, title: "Matte Lipstick Set (6 Shades)", seller: "Glow Naturals", category: "beauty", price: 1650, rating: 4.2, reviews: 45, image: "images/lipstick-set.jpg" },
  { id: 213, title: "20,000mAh Power Bank", seller: "GadgetZone", category: "electronics", price: 2800, rating: 4.5, reviews: 187, image: "images/power-bank.jpg" },
  { id: 214, title: "Classic Denim Jacket", seller: "Urban Steps", category: "fashion", price: 3600, rating: 4.4, reviews: 52, image: "images/denim-jacket.jpg" },
  { id: 215, title: "Shea Butter Body Lotion", seller: "Glow Naturals", category: "beauty", price: 950, rating: 4.7, reviews: 133, image: "images/body-lotion.jpg" },
  { id: 216, title: "Adjustable Dumbbell Set 10kg", seller: "ProSport KE", category: "sports", price: 3900, rating: 4.3, reviews: 41, image: "images/dumbells.jpg" },

  // ---- Flash sale items ----
  { id: 101, title: "Wireless Bluetooth Earbuds", seller: "TechHub Kenya", category: "electronics", price: 1950, oldPrice: 3000, rating: 4.5, reviews: 128, flash: true, image: "images/wireless-earbuds.jpg" },
  { id: 102, title: "Fitness Smartwatch", seller: "GadgetZone", category: "electronics", price: 4800, oldPrice: 6000, rating: 4.0, reviews: 86, flash: true, image: "images/fitness-smartwatch.jpg" },
  { id: 103, title: "Casual White Sneakers", seller: "Urban Steps", category: "fashion", price: 2400, oldPrice: 4000, rating: 4.9, reviews: 214, flash: true, image: "images/white-sneakers.jpg" },
  { id: 104, title: "1.5L Electric Blender", seller: "HomeEssentials", category: "home", price: 3375, oldPrice: 4500, rating: 4.0, reviews: 57, flash: true, image: "images/electric-blender.jpg" }
];

/* ---------- Seller-added products ----------
   Products added in the Seller Center are saved in the browser and
   joined to the list here (newest first), so every page sees them. */
try {
  const stripTags = (t) => String(t == null ? '' : t).replace(/[<>]/g, '').replace(/"/g, '″');
  const sellerAdded = JSON.parse(localStorage.getItem('soko_seller_products') || '[]')
    .filter((p) => p && p.active !== false)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .map((p) => ({ ...p, title: stripTags(p.title), seller: stripTags(p.seller), description: stripTags(p.description) }));
  PRODUCTS.unshift(...sellerAdded);
} catch (e) { /* ignore broken saved data */ }