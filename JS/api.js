// ============================================
// api.js — DummyJSON API Layer with Cache
// ============================================

const API_BASE = 'https://dummyjson.com';
const apiCache = new Map();

// Theme → category mappings
const THEME_CATEGORIES = {
    'beauty': ['beauty', 'fragrances', 'skin-care'],
    'tech': ['smartphones', 'laptops', 'tablets', 'mobile-accessories'],
    'home': ['furniture', 'home-decoration', 'kitchen-accessories', 'groceries'],
    'fashion': ['mens-shirts', 'mens-shoes', 'womens-dresses', 'womens-bags', 'sunglasses', 'womens-jewellery', 'womens-watches', 'mens-watches', 'tops']
};

const THEME_META = {
    'beauty': { icon: 'fa-spa', label: 'Beauty & Self-Care', color: '#ff6b9d' },
    'tech': { icon: 'fa-microchip', label: 'Tech & Gadgets', color: '#6c63ff' },
    'home': { icon: 'fa-couch', label: 'Home & Living', color: '#2ecf8a' },
    'fashion': { icon: 'fa-shirt', label: 'Fashion & Style', color: '#ff8c42' }
};

async function apiFetch(url) {
    if (apiCache.has(url)) return apiCache.get(url);
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data = await res.json();
        apiCache.set(url, data);
        return data;
    } catch (err) {
        console.error('API Fetch Error:', err);
        return null;
    }
}

async function fetchProductsByCategory(category, limit = 10, skip = 0) {
    const url = `${API_BASE}/products/category/${category}?limit=${limit}&skip=${skip}`;
    return await apiFetch(url);
}

async function fetchAllProducts(limit = 20, skip = 0) {
    const url = `${API_BASE}/products?limit=${limit}&skip=${skip}`;
    return await apiFetch(url);
}

async function searchProducts(query) {
    const url = `${API_BASE}/products/search?q=${encodeURIComponent(query)}`;
    return await apiFetch(url);
}

async function fetchSingleProduct(id) {
    const url = `${API_BASE}/products/${id}`;
    return await apiFetch(url);
}

// Fetch products for an entire theme (merges multiple categories)
async function fetchThemeProducts(themeName, limitPerCategory = 8) {
    const categories = THEME_CATEGORIES[themeName];
    if (!categories) return [];

    const promises = categories.map(cat => fetchProductsByCategory(cat, limitPerCategory));
    const results = await Promise.all(promises);

    let allProducts = [];
    results.forEach(res => {
        if (res && res.products) {
            allProducts = allProducts.concat(res.products);
        }
    });
    return allProducts;
}

// Normalize a DummyJSON product into our app's shape
function normalizeProduct(p) {
    return {
        id: p.id,
        title: p.title,
        description: p.description,
        price: p.price,
        discountPercentage: p.discountPercentage || 0,
        discountedPrice: (p.price * (1 - (p.discountPercentage || 0) / 100)).toFixed(2),
        rating: p.rating,
        stock: p.stock,
        brand: p.brand || 'Unknown',
        category: p.category,
        thumbnail: p.thumbnail,
        images: p.images || [p.thumbnail],
        tags: p.tags || [],
        availabilityStatus: p.availabilityStatus || 'In Stock'
    };
}
