// ============================================
// function.js — Rendering & UI Helpers
// ============================================

// ---- Toast Notification ----
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ---- Popup System (reusing existing pattern) ----
function openPopup(popupName) {
    let popupEle = document.querySelector(`.popup[data-popup-name="${popupName}"]`);
    if (!popupEle) return;
    document.body.style.overflow = "hidden";
    popupEle.classList.add("active");
    setTimeout(() => popupEle.classList.add("show"), 50);
}

function closePopup() {
    let currentPopup = document.querySelector(".popup.active");
    if (!currentPopup) return;
    currentPopup.classList.remove("show");
    setTimeout(() => {
        currentPopup.classList.remove("active");
        document.body.style.overflow = "auto";
    }, 500);
}

// ---- Render Star Rating ----
function renderStars(rating) {
    let html = '';
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    for (let i = 0; i < full; i++) html += '<i class="fa-solid fa-star"></i>';
    if (half) html += '<i class="fa-solid fa-star-half-stroke"></i>';
    for (let i = 0; i < empty; i++) html += '<i class="fa-regular fa-star"></i>';
    html += `<span>(${rating.toFixed(1)})</span>`;
    return html;
}

// ---- Render Product Card (Browse Grid) ----
function renderProductCard(product) {
    const p = normalizeProduct(product);
    const box = getBoxContents();
    const inBox = box.find(item => item.id === p.id);
    const hasDiscount = p.discountPercentage > 0;

    return `
    <div class="col-xl-3 col-lg-4 col-md-6 col-sm-6 mb-0">
        <div class="product-card" data-product-id="${p.id}">
            <div class="card-img-wrapper">
                ${hasDiscount ? `<span class="card-discount">-${Math.round(p.discountPercentage)}%</span>` : ''}
                <img src="${p.thumbnail}" alt="${p.title}" loading="lazy">
            </div>
            <div class="card-body">
                <div class="card-brand">${p.brand}</div>
                <h6 class="card-title">${p.title}</h6>
                <div class="card-rating">${renderStars(p.rating)}</div>
                <div class="card-price">
                    <span class="price-current">$${p.discountedPrice}</span>
                    ${hasDiscount ? `<span class="price-original">$${p.price.toFixed(2)}</span>` : ''}
                </div>
                <button class="btn-add-box ${inBox ? 'in-box' : ''}" onclick="handleAddToBox(${p.id})" data-box-btn="${p.id}">
                    <i class="fa-solid ${inBox ? 'fa-check' : 'fa-plus'}"></i>
                    ${inBox ? 'In Your Box' : 'Add to Box'}
                </button>
            </div>
        </div>
    </div>`;
}

// ---- Render Box Item Card (My Box) ----
function renderBoxItem(item) {
    const locked = isBoxLocked();
    return `
    <div class="col-xl-3 col-lg-4 col-md-6 col-sm-6">
        <div class="box-item-card" data-box-item-id="${item.id}">
            <div class="item-img">
                <img src="${item.thumbnail}" alt="${item.title}" loading="lazy">
            </div>
            <div class="item-info">
                <h6>${item.title}</h6>
                <div class="item-price">$${(item.price * (1 - (item.discountPercentage || 0) / 100)).toFixed(2)}</div>
            </div>
            ${!locked ? `
            <div class="item-actions">
                <button class="btn btn-outline-warning btn-sm" onclick="handleSwapItem(${item.id})">
                    <i class="fa-solid fa-arrows-rotate me-1"></i>Swap
                </button>
                <button class="btn btn-outline-danger btn-sm" onclick="handleRemoveFromBox(${item.id})">
                    <i class="fa-solid fa-trash me-1"></i>Remove
                </button>
            </div>` : ''}
        </div>
    </div>`;
}

// ---- Render Tracking Timeline ----
function renderTrackingTimeline(tracking) {
    if (!tracking) return '';
    const currentIdx = getCurrentTrackingStage();
    let html = '';
    tracking.stages.forEach((stage, idx) => {
        const status = stage.completed ? (idx === currentIdx ? 'active' : 'completed') : '';
        html += `
        <div class="timeline-stage">
            <div class="stage-dot ${status}">
                <i class="fa-solid ${stage.icon}"></i>
            </div>
            <div>
                <div class="stage-label ${status}">${stage.label}</div>
                <div class="stage-date">${formatTrackingDate(stage.date)}</div>
            </div>
        </div>`;
    });
    return html;
}

// ---- Render Swap Option (mini card for swap panel) ----
function renderSwapOption(product, swappingId) {
    const p = normalizeProduct(product);
    return `
    <div class="col-lg-3 col-md-4 col-sm-6">
        <div class="product-card" style="cursor:pointer" onclick="handleConfirmSwap(${swappingId}, ${p.id})">
            <div class="card-img-wrapper" style="height:120px">
                <img src="${p.thumbnail}" alt="${p.title}" loading="lazy" style="max-height:100px">
            </div>
            <div class="card-body" style="padding:12px">
                <h6 class="card-title" style="font-size:.8rem;min-height:auto">${p.title}</h6>
                <span class="price-current" style="font-size:.9rem">$${p.discountedPrice}</span>
            </div>
        </div>
    </div>`;
}

// ---- Update Box UI ----
function updateBoxUI() {
    const box = getBoxContents();
    const limit = getBoxItemLimit();
    const grid = document.getElementById('myBoxGrid');
    const emptyMsg = document.getElementById('emptyBoxMessage');

    document.getElementById('boxItemCount').textContent = box.length;
    document.getElementById('boxItemLimit').textContent = limit;
    document.getElementById('boxTotalValue').textContent = getBoxValue().toFixed(2);

    if (box.length === 0) {
        grid.innerHTML = `<div class="col-12">${emptyMsg ? emptyMsg.outerHTML : '<div class="empty-box-message"><i class="fa-solid fa-box-open"></i><h4>Your box is empty</h4></div>'}</div>`;
        return;
    }

    grid.innerHTML = box.map(item => renderBoxItem(item)).join('');

    // Update browse buttons
    document.querySelectorAll('[data-box-btn]').forEach(btn => {
        const id = parseInt(btn.dataset.boxBtn);
        const inBox = box.find(item => item.id === id);
        if (inBox) {
            btn.classList.add('in-box');
            btn.innerHTML = '<i class="fa-solid fa-check"></i> In Your Box';
        } else {
            btn.classList.remove('in-box');
            btn.innerHTML = '<i class="fa-solid fa-plus"></i> Add to Box';
        }
    });
}

// ---- Update Referral UI ----
function updateReferralUI() {
    const stats = getReferralStats();
    const codeEl = document.getElementById('myReferralCode');
    if (codeEl) codeEl.textContent = stats.code || '—';
    const countEl = document.getElementById('referralCount');
    if (countEl) countEl.textContent = stats.count;
    const earnedEl = document.getElementById('creditsEarned');
    if (earnedEl) earnedEl.textContent = stats.earned.toFixed(2);
    const availEl = document.getElementById('creditsAvailable');
    if (availEl) availEl.textContent = stats.available.toFixed(2);
}

// ---- Update Tracking UI ----
function updateTrackingUI() {
    const tracking = getDeliveryTracking();
    const noMsg = document.getElementById('noTrackingMessage');
    const timeline = document.getElementById('trackingTimeline');

    if (!tracking) {
        if (noMsg) noMsg.classList.remove('d-none');
        if (timeline) timeline.classList.add('d-none');
        return;
    }

    if (noMsg) noMsg.classList.add('d-none');
    if (timeline) timeline.classList.remove('d-none');

    document.getElementById('trackingId').textContent = tracking.trackingId;
    document.getElementById('timelineStages').innerHTML = renderTrackingTimeline(tracking);

    const est = getEstimatedDelivery();
    if (est) {
        document.getElementById('estimatedDelivery').textContent = est.toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
        });
    }
}

// ---- Update Tier Buttons (show "Subscribed" on active tier) ----
function updateTierUI() {
    const sub = getCurrentSubscription();
    document.querySelectorAll('.tier-card .btn-tier').forEach(btn => {
        const card = btn.closest('.tier-card');
        const tier = card.dataset.tier;
        if (sub && sub.tier === tier && sub.status === 'active') {
            btn.textContent = '✓ Subscribed';
            btn.classList.add('subscribed');
        } else {
            btn.textContent = 'Subscribe Now';
            btn.classList.remove('subscribed');
        }
    });
}

// ---- Cart / Wishlist helpers (adapted from old code) ----
var productCart = [];
var wishlist = [];
var popupCartBody, popupWishlistBody, wishlistCountEle, shopCountEle;

function updateLocalStorage() {
    localStorage.setItem("cart", JSON.stringify(productCart));
    localStorage.setItem("wishlist", JSON.stringify(wishlist));
}

function updateCountEles() {
    if (!wishlistCountEle || !shopCountEle) return;
    if (wishlist.length > 0) {
        wishlistCountEle.textContent = wishlist.length;
        wishlistCountEle.classList.remove("d-none");
    } else {
        wishlistCountEle.classList.add("d-none");
    }
    if (productCart.length > 0) {
        shopCountEle.textContent = productCart.length;
        shopCountEle.classList.remove("d-none");
    } else {
        shopCountEle.classList.add("d-none");
    }
}

function isShopOrWishPopupEmpty() {
    const cartEmpty = document.getElementById('cartEmptyMsg');
    const cartBuy = document.getElementById('cartBuyBtn');
    const wishEmpty = document.getElementById('wishEmptyMsg');
    const wishBuy = document.getElementById('wishBuyBtn');

    if (cartEmpty && cartBuy) {
        if (productCart.length === 0) { cartBuy.classList.add('d-none'); cartEmpty.classList.remove('d-none'); }
        else { cartEmpty.classList.add('d-none'); cartBuy.classList.remove('d-none'); }
    }
    if (wishEmpty && wishBuy) {
        if (wishlist.length === 0) { wishBuy.classList.add('d-none'); wishEmpty.classList.remove('d-none'); }
        else { wishEmpty.classList.add('d-none'); wishBuy.classList.remove('d-none'); }
    }
}
