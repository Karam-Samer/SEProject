// ============================================
// tracking.js — Delivery Tracking Engine
// ============================================

const DELIVERY_STAGES = [
    { key: 'ordered',     label: 'Order Placed',      icon: 'fa-clipboard-check', dayOffset: 0 },
    { key: 'processing',  label: 'Processing',        icon: 'fa-gears',           dayOffset: 1 },
    { key: 'packed',      label: 'Packed',             icon: 'fa-box-open',        dayOffset: 3 },
    { key: 'shipped',     label: 'Shipped',            icon: 'fa-truck-fast',      dayOffset: 5 },
    { key: 'outdelivery', label: 'Out for Delivery',   icon: 'fa-truck-ramp-box',  dayOffset: 8 },
    { key: 'delivered',   label: 'Delivered',           icon: 'fa-circle-check',    dayOffset: 10 }
];

function getDeliveryTracking() {
    const tracking = localStorage.getItem('subbox_tracking');
    return tracking ? JSON.parse(tracking) : null;
}

function initDeliveryTracking() {
    const sub = getCurrentSubscription();
    if (!sub) return null;

    const existing = getDeliveryTracking();
    if (existing) return existing;

    const baseDate = new Date();
    const stages = DELIVERY_STAGES.map(stage => ({
        ...stage,
        date: addDays(baseDate, stage.dayOffset).toISOString(),
        completed: false
    }));

    // First stage is always completed
    stages[0].completed = true;

    const tracking = {
        trackingId: 'SBX-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
        stages,
        createdAt: baseDate.toISOString(),
        estimatedDelivery: stages[stages.length - 1].date
    };

    localStorage.setItem('subbox_tracking', JSON.stringify(tracking));
    return tracking;
}

function getCurrentTrackingStage() {
    const tracking = getDeliveryTracking();
    if (!tracking) return -1;

    const now = new Date();
    let currentStage = 0;

    tracking.stages.forEach((stage, idx) => {
        if (new Date(stage.date) <= now) {
            currentStage = idx;
            stage.completed = true;
        }
    });

    // Save updated completion states
    localStorage.setItem('subbox_tracking', JSON.stringify(tracking));
    return currentStage;
}

function simulateTrackingProgress() {
    const tracking = getDeliveryTracking();
    if (!tracking) return;

    // Find next incomplete stage
    const nextIdx = tracking.stages.findIndex(s => !s.completed);
    if (nextIdx === -1) return; // All complete

    tracking.stages[nextIdx].completed = true;
    tracking.stages[nextIdx].date = new Date().toISOString();

    localStorage.setItem('subbox_tracking', JSON.stringify(tracking));
    return tracking;
}

function resetTracking() {
    localStorage.removeItem('subbox_tracking');
}

function getEstimatedDelivery() {
    const tracking = getDeliveryTracking();
    if (!tracking) return null;
    return new Date(tracking.estimatedDelivery);
}

function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
}

function formatTrackingDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
