// ============================================
// referral.js — Referral Rewards System
// ============================================

const REFERRAL_CREDIT = 5.00; // $5 per successful referral

function getReferralData() {
    const data = localStorage.getItem('subbox_referral');
    return data ? JSON.parse(data) : null;
}

function initReferralSystem() {
    let data = getReferralData();
    if (data) return data;

    data = {
        myCode: generateReferralCode(),
        referralCount: 0,
        creditsEarned: 0,
        creditsUsed: 0,
        appliedCodes: [],
        referralHistory: []
    };

    localStorage.setItem('subbox_referral', JSON.stringify(data));
    return data;
}

function generateReferralCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'SUBBOX-';
    for (let i = 0; i < 5; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function applyReferralCode(code) {
    const data = getReferralData();
    if (!data) return { success: false, message: 'Please subscribe first to use referral codes.' };

    const cleanCode = code.trim().toUpperCase();

    if (cleanCode === data.myCode) {
        return { success: false, message: "You can't use your own referral code!" };
    }

    if (data.appliedCodes.includes(cleanCode)) {
        return { success: false, message: 'This code has already been applied.' };
    }

    if (!cleanCode.startsWith('SUBBOX-') || cleanCode.length !== 12) {
        return { success: false, message: 'Invalid referral code format.' };
    }

    // Simulate successful referral
    data.appliedCodes.push(cleanCode);
    data.creditsEarned += REFERRAL_CREDIT;
    data.referralHistory.push({
        code: cleanCode,
        type: 'received',
        amount: REFERRAL_CREDIT,
        date: new Date().toISOString()
    });

    localStorage.setItem('subbox_referral', JSON.stringify(data));
    return { success: true, message: `$${REFERRAL_CREDIT.toFixed(2)} credit added to your account!` };
}

function simulateIncomingReferral() {
    const data = getReferralData();
    if (!data) return;

    data.referralCount++;
    data.creditsEarned += REFERRAL_CREDIT;
    data.referralHistory.push({
        code: data.myCode,
        type: 'earned',
        amount: REFERRAL_CREDIT,
        date: new Date().toISOString()
    });

    localStorage.setItem('subbox_referral', JSON.stringify(data));
    return data;
}

function getAvailableCredits() {
    const data = getReferralData();
    if (!data) return 0;
    return data.creditsEarned - data.creditsUsed;
}

function useCredits(amount) {
    const data = getReferralData();
    if (!data) return false;

    const available = data.creditsEarned - data.creditsUsed;
    if (amount > available) return false;

    data.creditsUsed += amount;
    localStorage.setItem('subbox_referral', JSON.stringify(data));
    return true;
}

function getReferralStats() {
    const data = getReferralData();
    if (!data) return { code: '', count: 0, earned: 0, available: 0 };
    return {
        code: data.myCode,
        count: data.referralCount,
        earned: data.creditsEarned,
        available: data.creditsEarned - data.creditsUsed,
        history: data.referralHistory
    };
}
