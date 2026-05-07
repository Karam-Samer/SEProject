// ============================================
// subscription.js — Tier & Subscription Manager
// ============================================

const TIERS = {
    starter: {
        name: 'Starter',
        price: 19.99,
        itemLimit: 3,
        icon: 'fa-box',
        features: [
            '3 curated items per box',
            'Monthly delivery',
            'Basic customization',
            'Free shipping over $50',
            'Cancel anytime'
        ],
        badge: '',
        gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    },
    premium: {
        name: 'Premium',
        price: 39.99,
        itemLimit: 6,
        icon: 'fa-gem',
        features: [
            '6 curated items per box',
            'Bi-weekly delivery option',
            'Full swap & customize',
            'Free shipping always',
            'Priority support',
            '1 free add-on per box'
        ],
        badge: 'Most Popular',
        gradient: 'linear-gradient(135deg, #6c63ff 0%, #ff6584 100%)'
    },
    elite: {
        name: 'Elite',
        price: 59.99,
        itemLimit: 10,
        icon: 'fa-crown',
        features: [
            '10 premium items per box',
            'Weekly delivery option',
            'Unlimited swaps',
            'Free express shipping',
            'Dedicated concierge',
            '3 free add-ons per box',
            'Early access to new products',
            'Exclusive member rewards'
        ],
        badge: 'Best Value',
        gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    }
};

function getCurrentSubscription() {
    const sub = localStorage.getItem('subbox_subscription');
    return sub ? JSON.parse(sub) : null;
}

function subscribeTier(tierKey) {
    const tier = TIERS[tierKey];
    if (!tier) return false;

    const subscription = {
        tier: tierKey,
        name: tier.name,
        price: tier.price,
        itemLimit: tier.itemLimit,
        status: 'active',            // active | paused | cancelled
        subscribedAt: new Date().toISOString(),
        nextDelivery: getNextDeliveryDate(),
        skippedMonths: [],
        theme: null                  // set when user picks a theme
    };

    localStorage.setItem('subbox_subscription', JSON.stringify(subscription));
    return subscription;
}

function updateSubscription(updates) {
    const sub = getCurrentSubscription();
    if (!sub) return null;
    Object.assign(sub, updates);
    localStorage.setItem('subbox_subscription', JSON.stringify(sub));
    return sub;
}

function setSubscriptionTheme(themeName) {
    return updateSubscription({ theme: themeName });
}

function getBoxItemLimit() {
    const sub = getCurrentSubscription();
    if (!sub) return 3;
    return TIERS[sub.tier]?.itemLimit || 3;
}

function skipNextDelivery() {
    const sub = getCurrentSubscription();
    if (!sub) return;
    sub.skippedMonths.push(sub.nextDelivery);
    sub.nextDelivery = getNextDeliveryDate(new Date(sub.nextDelivery));
    sub.status = 'active';
    localStorage.setItem('subbox_subscription', JSON.stringify(sub));
    return sub;
}

function pauseSubscription() {
    return updateSubscription({ status: 'paused' });
}

function resumeSubscription() {
    return updateSubscription({ status: 'active', nextDelivery: getNextDeliveryDate() });
}

function cancelSubscription() {
    return updateSubscription({ status: 'cancelled' });
}

function getNextDeliveryDate(fromDate = new Date()) {
    const d = new Date(fromDate);
    d.setMonth(d.getMonth() + 1);
    d.setDate(15);
    return d.toISOString().split('T')[0];
}

function isSubscribed() {
    const sub = getCurrentSubscription();
    return sub && sub.status === 'active';
}
