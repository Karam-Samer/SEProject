// ============================================
// index.js — Main App (jQuery-powered)
// ============================================

let currentTheme = 'beauty';
let currentProducts = [];
let swappingItemId = null;

// ---- DOM Ready ----
$(function () {
    // Init WOW.js (Animate.css scroll triggers)
    new WOW({ animateClass: 'animate__animated', offset: 80 }).init();

    // Headline.js initializes automatically on document ready

    // Cache popup elements
    popupCartBody = $('#popupCartBody');
    popupWishlistBody = $('#popupWishlistBody');
    wishlistCountEle = $('.count-w')[0];
    shopCountEle = $('.count-s')[0];

    // Load cart/wishlist from localStorage
    productCart = JSON.parse(localStorage.getItem('cart')) || [];
    wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
    updateCountEles();
    isShopOrWishPopupEmpty();

    // Init referral system
    initReferralSystem();
    updateReferralUI();

    // Init subscription & box & tracking UI
    updateTierUI();
    updateBoxUI();
    updateTrackingUI();

    // Load default theme products
    loadThemeProducts(currentTheme);

    // ---- Loading screen ----
    $('body').css('overflow', 'hidden');
    setTimeout(() => {
        $('#LoadingPage').addClass('hide');
        $('body').css('overflow', 'auto');
    }, 800);

    // ---- Nav scroll effect ----
    const $nav = $('nav.navbar');
    const navH = $nav.outerHeight();

    $(window).on('scroll', function () {
        const scrollY = $(this).scrollTop();
        $nav.toggleClass('scrolled', scrollY > navH / 2);

        // Active section highlighting
        $('nav .nav-link').each(function () {
            const href = $(this).attr('href');
            if (!href || !href.startsWith('#')) return;
            const $sec = $(href);
            if (!$sec.length) return;
            const top = $sec.offset().top - navH - 50;
            if (scrollY >= top && scrollY < top + $sec.outerHeight()) {
                $('nav .nav-link.active').removeClass('active');
                $(this).addClass('active');
            }
        });
    });

    // ---- Smooth scroll nav links ----
    $('nav').on('click', '.nav-link', function (e) {
        e.preventDefault();
        const $sec = $($(this).attr('href'));
        if (!$sec.length) return;
        $('nav .nav-link.active').removeClass('active');
        $(this).addClass('active');
        $('html, body').animate({ scrollTop: $sec.offset().top - navH }, 500);
    });

    // ---- Popup box stop propagation ----
    $('.popup .box').on('click', function (e) { e.stopPropagation(); });

    // ---- Theme Tabs ----
    $('#themeTabs').on('click', '.nav-link', function () {
        $('#themeTabs .nav-link.active').removeClass('active');
        $(this).addClass('active');
        currentTheme = $(this).data('theme');
        loadThemeProducts(currentTheme);
    });

    // ---- Search ----
    $('#searchForm').on('submit', async function (e) {
        e.preventDefault();
        const query = $('#searchInput').val().trim();
        if (!query) { showToast('Please enter a search term.', 'warning'); return; }
        await handleSearch(query);
    });
});

// ============ PRODUCT LOADING ============

async function loadThemeProducts(theme) {
    const $grid = $('#productsGrid');
    $('#searchResultsGrid').addClass('d-none');
    $grid.removeClass('d-none');

    $grid.html(`<div class="col-12 text-center py-5">
        <div class="spinner-border text-light" role="status"></div>
        <p class="text-light mt-3">Loading ${THEME_META[theme]?.label || theme} products...</p>
    </div>`);

    const products = await fetchThemeProducts(theme, 8);
    currentProducts = products;

    if (!products || products.length === 0) {
        $grid.html('<div class="col-12 text-center py-5"><p class="text-muted">No products found.</p></div>');
        return;
    }

    $grid.html(products.map(p => renderProductCard(p)).join(''));
}

async function handleSearch(query) {
    const $grid = $('#productsGrid');

    $grid.html(`<div class="col-12 text-center py-5">
        <div class="spinner-border text-light" role="status"></div>
        <p class="text-light mt-3">Searching for "${query}"...</p>
    </div>`);

    const results = await searchProducts(query);
    if (!results || !results.products || results.products.length === 0) {
        $grid.html(`<div class="col-12 text-center py-5"><p class="text-muted">No results for "${query}".</p></div>`);
        return;
    }

    currentProducts = results.products;
    $grid.html(results.products.map(p => renderProductCard(p)).join(''));
    showToast(`Found ${results.products.length} products for "${query}"`, 'success');
}

// ============ ACTION HANDLERS ============

function handleSubscribe(tierKey) {
    const sub = getCurrentSubscription();
    if (sub && sub.tier === tierKey && sub.status === 'active') {
        showToast('You are already on this plan!', 'warning');
        return;
    }
    subscribeTier(tierKey);
    updateTierUI();
    updateBoxUI();
    showToast(`Subscribed to ${TIERS[tierKey].name} plan! 🎉`, 'success');
    setTimeout(() => $('html, body').animate({ scrollTop: $('#Browse').offset().top - 70 }, 600), 400);
}

async function handleAddToBox(productId) {
    if (!isSubscribed()) {
        showToast('Please subscribe to a plan first!', 'warning');
        $('html, body').animate({ scrollTop: $('#Plans').offset().top - 70 }, 600);
        return;
    }
    if (isBoxLocked()) {
        showToast('Your box is locked for shipping! Reset tracking to edit.', 'warning');
        return;
    }

    let product = currentProducts.find(p => p.id === productId);
    if (!product) product = await fetchSingleProduct(productId);
    if (!product) { showToast('Product not found.', 'error'); return; }

    const $btn = $(`[data-box-btn="${productId}"]`);
    const box = getBoxContents();

    if (box.find(item => item.id === productId)) {
        removeFromBox(productId);
        updateBoxUI();
        $btn.removeClass('in-box').html('<i class="fa-solid fa-plus"></i> Add to Box');
        showToast('Removed from your box.', 'info');
        return;
    }

    const result = addToBox(product);
    if (result.success) {
        showToast(result.message, 'success');
        $btn.addClass('in-box').html('<i class="fa-solid fa-check"></i> In Your Box');
    } else {
        showToast(result.message, 'error');
    }
    updateBoxUI();
}

function handleRemoveFromBox(productId) {
    if (isBoxLocked()) { showToast('Box is locked!', 'warning'); return; }
    removeFromBox(productId);
    updateBoxUI();
    showToast('Item removed from your box.', 'info');
    $(`[data-box-btn="${productId}"]`).removeClass('in-box').html('<i class="fa-solid fa-plus"></i> Add to Box');
}

async function handleSwapItem(productId) {
    if (isBoxLocked()) { showToast('Box is locked!', 'warning'); return; }
    swappingItemId = productId;
    const box = getBoxContents();
    const item = box.find(i => i.id === productId);

    $('#swapItemName').text(item ? item.title : 'Unknown');
    const $panel = $('#swapPanel').removeClass('d-none');
    const $grid = $('#swapOptionsGrid');

    $grid.html('<div class="col-12 text-center py-3"><div class="spinner-border spinner-border-sm text-light"></div></div>');

    const products = await fetchThemeProducts(currentTheme, 6);
    const boxIds = box.map(i => i.id);
    const options = products.filter(p => !boxIds.includes(p.id)).slice(0, 8);

    if (options.length === 0) {
        $grid.html('<div class="col-12"><p class="text-muted text-center">No swap options available.</p></div>');
        return;
    }
    $grid.html(options.map(p => renderSwapOption(p, productId)).join(''));
    $('html, body').animate({ scrollTop: $panel.offset().top - 80 }, 400);
}

async function handleConfirmSwap(oldId, newId) {
    let newProduct = currentProducts.find(p => p.id === newId);
    if (!newProduct) newProduct = await fetchSingleProduct(newId);
    if (!newProduct) { showToast('Product not found.', 'error'); return; }

    const result = swapItem(oldId, newProduct);
    if (result.success) {
        showToast(result.message, 'success');
        closeSwapPanel();
        updateBoxUI();
    } else {
        showToast(result.message, 'error');
    }
}

function closeSwapPanel() {
    $('#swapPanel').addClass('d-none');
    swappingItemId = null;
}

function handleSkipMonth() {
    if (!isSubscribed()) { showToast('No active subscription.', 'warning'); return; }
    skipNextDelivery();
    showToast('Next month skipped! Your next delivery has been rescheduled.', 'info');
}

function handleLockBox() {
    if (getBoxContents().length === 0) { showToast('Add items to your box first!', 'warning'); return; }
    if (isBoxLocked()) { showToast('Box is already locked!', 'info'); return; }

    lockBox();
    resetTracking();
    initDeliveryTracking();
    updateTrackingUI();
    updateBoxUI();
    showToast('Box locked! Your delivery is on its way! 🚀', 'success');
    setTimeout(() => $('html, body').animate({ scrollTop: $('#Track').offset().top - 70 }, 600), 400);
}

function handleSimulateProgress() {
    const tracking = simulateTrackingProgress();
    if (tracking) {
        updateTrackingUI();
        showToast('Delivery progressed to next stage!', 'success');
        if (tracking.stages.every(s => s.completed)) {
            showToast('🎉 Your box has been delivered! Enjoy your items!', 'success');
            setTimeout(() => { clearBox(); unlockBox(); resetTracking(); updateBoxUI(); updateTrackingUI(); }, 2000);
        }
    } else {
        showToast('All stages complete!', 'info');
    }
}

// ---- Referral Actions ----
function copyReferralCode() {
    const code = $('#myReferralCode').text();
    navigator.clipboard.writeText(code)
        .then(() => showToast('Referral code copied! 📋', 'success'))
        .catch(() => showToast('Could not copy code.', 'error'));
}

function handleApplyReferral() {
    const $input = $('#referralCodeInput');
    const $feedback = $('#referralFeedback');
    const code = $input.val().trim();
    if (!code) { showToast('Enter a referral code.', 'warning'); return; }

    const result = applyReferralCode(code);
    $feedback.text(result.message).attr('class', `referral-feedback mt-2 ${result.success ? 'success' : 'error'}`);
    if (result.success) { $input.val(''); updateReferralUI(); showToast(result.message, 'success'); }
}

function handleSimulateReferral() {
    simulateIncomingReferral();
    updateReferralUI();
    showToast('Someone used your referral code! +$5.00 credit 🎉', 'success');
}