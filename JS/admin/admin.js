// ============================================
// JS/admin/admin.js — Advanced Admin Engine
// ============================================

// ============ RBAC ============
const ROLES = {
    super_admin: { label: '👑 Super Admin', permissions: ['create','delete','bulk','status','audit','inventory','churn','export'] },
    manager:     { label: '🛠️ Manager',     permissions: ['create','bulk','status','inventory','churn'] },
    viewer:      { label: '👁️ Viewer',       permissions: ['audit','churn'] }
};

let currentRole = localStorage.getItem('adminRole') || 'super_admin';
function can(perm) { return ROLES[currentRole].permissions.includes(perm); }

function switchRole(role) {
    currentRole = role;
    localStorage.setItem('adminRole', role);
    applyRoleGuards();
    updateRoleBadge();
    auditLog('role_switch', `Switched to ${ROLES[role].label}`);
    renderAll();
}

function applyRoleGuards() {
    document.querySelectorAll('[data-perm]').forEach(el => {
        const perm = el.dataset.perm;
        const locked = !can(perm);
        el.classList.toggle('perm-locked', locked);
        if (el.tagName === 'BUTTON' || el.tagName === 'INPUT' || el.tagName === 'SELECT')
            el.disabled = locked;
    });
}

function updateRoleBadge() {
    const badge = document.getElementById('roleBadge');
    if (badge) badge.textContent = ROLES[currentRole].label;
    document.querySelectorAll('#roleSwitcher option').forEach(o => {
        o.selected = o.value === currentRole;
    });
}

// ============ AUDIT TRAIL ============
let auditTrail = JSON.parse(localStorage.getItem('auditTrail') || '[]');

function auditLog(action, detail, target = '—') {
    const entry = {
        id: Date.now(),
        ts: new Date().toISOString(),
        role: ROLES[currentRole].label,
        action,
        detail,
        target
    };
    auditTrail.unshift(entry);
    if (auditTrail.length > 200) auditTrail.pop();
    localStorage.setItem('auditTrail', JSON.stringify(auditTrail));
    renderAudit();
}

function renderAudit() {
    const tbody = document.getElementById('auditTbody');
    if (!tbody) return;
    const filter = document.getElementById('auditFilter')?.value || '';
    const rows = auditTrail.filter(e =>
        !filter || e.action.includes(filter) || e.detail.toLowerCase().includes(filter.toLowerCase())
    );
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty-msg">No audit entries yet.</td></tr>'; return; }
    tbody.innerHTML = rows.slice(0, 50).map(e => `
        <tr>
            <td><span class="audit-time">${new Date(e.ts).toLocaleString()}</span></td>
            <td><span class="role-pill">${e.role}</span></td>
            <td><span class="audit-action audit-${e.action.split('_')[0]}">${e.action}</span></td>
            <td>${e.detail}</td>
            <td>${e.target}</td>
        </tr>`).join('');
}

function clearAudit() {
    if (!can('export')) return;
    auditTrail = [];
    localStorage.removeItem('auditTrail');
    renderAudit();
}

function exportAudit() {
    if (!can('export')) return;
    const csv = ['Timestamp,Role,Action,Detail,Target',
        ...auditTrail.map(e => `"${e.ts}","${e.role}","${e.action}","${e.detail}","${e.target}"`)
    ].join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv,' + encodeURIComponent(csv);
    a.download = 'audit_trail.csv';
    a.click();
}

// ============ SUBSCRIPTIONS STATE ============
let subscriptions = JSON.parse(localStorage.getItem('subscriptions') || '[]');
let nextId = subscriptions.length ? Math.max(...subscriptions.map(s => s.id)) + 1 : 1;
const STATUS_FLOW = ['active', 'paused', 'churned', 'reactivated'];

function saveSubscriptions() { localStorage.setItem('subscriptions', JSON.stringify(subscriptions)); }

function escapeHtml(str) {
    return String(str || '').replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
}

// ============ SUBSCRIPTIONS CRUD ============
function createSubscription(name, plan, type) {
    if (!can('create')) return showToastAdmin('Permission denied.', 'error');
    if (!name.trim()) return showToastAdmin('Customer name required.', 'error');
    const sub = {
        id: nextId++,
        customer: name.trim(),
        basePlan: plan,
        customerType: type,
        extendFeatures: [],
        status: 'active',
        statusHistory: [{ status: 'active', ts: new Date().toISOString() }],
        createdAt: new Date().toISOString(),
        skipCount: 0,
        monthsActive: 1
    };
    ['giftWrapToggle','priorityShippingToggle','personalizedNoteToggle'].forEach(id => {
        if (document.getElementById(id)?.checked) {
            const map = { giftWrapToggle: { key:'giftWrap', name:'Premium Gift Wrap', cost:8 },
                          priorityShippingToggle: { key:'priorityShipping', name:'Priority Express Shipping', cost:12 },
                          personalizedNoteToggle: { key:'personalizedNote', name:'Handwritten Note', cost:5 } };
            sub.extendFeatures.push(map[id]);
        }
    });
    subscriptions.push(sub);
    saveSubscriptions();
    auditLog('create', `Created subscription for ${sub.customer}`, `#${sub.id}`);
    document.getElementById('customerName').value = '';
    renderAll();
    showToastAdmin(`Subscription created for ${sub.customer}!`, 'success');
}

function deleteSubscription(id) {
    if (!can('delete')) return showToastAdmin('Permission denied.', 'error');
    const sub = subscriptions.find(s => s.id === id);
    subscriptions = subscriptions.filter(s => s.id !== id);
    saveSubscriptions();
    auditLog('delete', `Cancelled subscription`, `#${id} ${sub?.customer || ''}`);
    renderAll();
}

function applyAddons(subId, opts) {
    const sub = subscriptions.find(s => s.id === subId);
    if (!sub) return;
    const available = [
        { key:'giftWrap', name:'Premium Gift Wrap', cost:8 },
        { key:'priorityShipping', name:'Priority Express Shipping', cost:12 },
        { key:'personalizedNote', name:'Handwritten Note', cost:5 }
    ];
    const existing = sub.extendFeatures.map(f => f.key);
    available.forEach(ext => {
        if (opts[ext.key] && !existing.includes(ext.key)) sub.extendFeatures.push(ext);
    });
    saveSubscriptions();
    auditLog('addon', `Applied add-ons to ${sub.customer}`, `#${subId}`);
    renderAll();
}

// ============ STATUS MACHINE ============
function transitionStatus(id, newStatus) {
    if (!can('status')) return showToastAdmin('Permission denied.', 'error');
    const sub = subscriptions.find(s => s.id === id);
    if (!sub) return;
    const old = sub.status;
    sub.status = newStatus;
    sub.statusHistory = sub.statusHistory || [];
    sub.statusHistory.push({ status: newStatus, ts: new Date().toISOString() });
    if (newStatus === 'churned') sub.skipCount = (sub.skipCount || 0) + 1;
    saveSubscriptions();
    auditLog('status_change', `${old} → ${newStatus}`, `#${id} ${sub.customer}`);
    renderAll();
    showToastAdmin(`Status updated to "${newStatus}"`, 'success');
}

function renderStatusMachine() {
    const container = document.getElementById('statusMachineList');
    if (!container) return;
    if (!subscriptions.length) { container.innerHTML = '<p class="empty-msg">No subscriptions yet.</p>'; return; }
    container.innerHTML = subscriptions.map(sub => {
        const steps = STATUS_FLOW.map(s => {
            const isActive = sub.status === s;
            const histIdx = (sub.statusHistory || []).findIndex(h => h.status === s);
            const done = histIdx !== -1;
            return `<div class="sm-step ${done ? 'done' : ''} ${isActive ? 'current' : ''}">
                <div class="sm-dot"></div>
                <div class="sm-label">${s}</div>
            </div>`;
        }).join('<div class="sm-line"></div>');
        const btns = STATUS_FLOW.filter(s => s !== sub.status).map(s =>
            `<button class="sm-btn" onclick="transitionStatus(${sub.id},'${s}')" ${!can('status') ? 'disabled' : ''}>→ ${s}</button>`
        ).join('');
        return `<div class="sm-row">
            <div class="sm-name">${escapeHtml(sub.customer)} <span class="status-badge status-${sub.status}">${sub.status}</span></div>
            <div class="sm-pipeline">${steps}</div>
            <div class="sm-actions">${btns}</div>
        </div>`;
    }).join('');
}

// ============ BULK UPDATER ============
function getSelectedIds() {
    return [...document.querySelectorAll('.bulk-check:checked')].map(el => parseInt(el.dataset.id));
}

function applyBulkAction() {
    if (!can('bulk')) return showToastAdmin('Permission denied.', 'error');
    const ids = getSelectedIds();
    if (!ids.length) return showToastAdmin('Select at least one subscription.', 'error');
    const action = document.getElementById('bulkAction')?.value;
    ids.forEach(id => {
        const sub = subscriptions.find(s => s.id === id);
        if (!sub) return;
        if (action === 'upgrade') sub.basePlan = 'Deluxe Box';
        if (action === 'downgrade') sub.basePlan = 'Starter Box';
        if (action === 'pause') transitionStatus(id, 'paused');
        if (action === 'activate') transitionStatus(id, 'active');
        if (action === 'add_giftwrap') applyAddons(id, { giftWrap: true });
    });
    saveSubscriptions();
    auditLog('bulk_update', `Bulk "${action}" on ${ids.length} subscriptions`, ids.map(i => `#${i}`).join(', '));
    renderAll();
    showToastAdmin(`Applied "${action}" to ${ids.length} subscriptions.`, 'success');
}

function toggleSelectAll(checked) {
    document.querySelectorAll('.bulk-check').forEach(el => el.checked = checked);
}

function renderBulkList() {
    const container = document.getElementById('bulkList');
    if (!container) return;
    if (!subscriptions.length) { container.innerHTML = '<p class="empty-msg">No subscriptions yet.</p>'; return; }
    container.innerHTML = `
        <table class="admin-table">
            <thead><tr>
                <th><input type="checkbox" onchange="toggleSelectAll(this.checked)"></th>
                <th>Customer</th><th>Plan</th><th>Status</th><th>Add-ons</th>
            </tr></thead>
            <tbody>
            ${subscriptions.map(sub => `
                <tr>
                    <td><input type="checkbox" class="bulk-check" data-id="${sub.id}" ${!can('bulk') ? 'disabled' : ''}></td>
                    <td>${escapeHtml(sub.customer)}</td>
                    <td>${sub.basePlan}</td>
                    <td><span class="status-badge status-${sub.status}">${sub.status}</span></td>
                    <td>${sub.extendFeatures.length ? sub.extendFeatures.map(f => f.name).join(', ') : '—'}</td>
                </tr>`).join('')}
            </tbody>
        </table>`;
}

// ============ CHURN PREDICTION ============
function churnScore(sub) {
    let score = 0;
    if (sub.status === 'paused') score += 35;
    if (sub.status === 'churned') score += 80;
    if ((sub.skipCount || 0) >= 2) score += 25;
    if (!sub.extendFeatures.length) score += 15;
    if (sub.basePlan === 'Starter Box') score += 10;
    if (sub.customerType === 'new') score += 5;
    return Math.min(score, 100);
}

function churnRisk(score) {
    if (score >= 60) return { label: 'High', cls: 'risk-high' };
    if (score >= 30) return { label: 'Medium', cls: 'risk-med' };
    return { label: 'Low', cls: 'risk-low' };
}

function renderChurn() {
    const container = document.getElementById('churnList');
    if (!container) return;
    if (!subscriptions.length) { container.innerHTML = '<p class="empty-msg">No subscriptions yet.</p>'; return; }
    const sorted = [...subscriptions].map(sub => ({ sub, score: churnScore(sub) })).sort((a,b) => b.score - a.score);
    const high = sorted.filter(x => x.score >= 60).length;
    const med  = sorted.filter(x => x.score >= 30 && x.score < 60).length;
    const low  = sorted.filter(x => x.score < 30).length;
    document.getElementById('churnHighCount').textContent = high;
    document.getElementById('churnMedCount').textContent  = med;
    document.getElementById('churnLowCount').textContent  = low;
    container.innerHTML = sorted.map(({ sub, score }) => {
        const risk = churnRisk(score);
        return `<div class="churn-row">
            <div class="churn-info">
                <span class="sub-name">${escapeHtml(sub.customer)}</span>
                <span class="sub-plan">${sub.basePlan}</span>
                <span class="status-badge status-${sub.status}">${sub.status}</span>
            </div>
            <div class="churn-bar-wrap">
                <div class="churn-bar" style="width:${score}%;background:${score>=60?'var(--danger)':score>=30?'var(--warning)':'var(--success)'}"></div>
            </div>
            <div class="churn-score ${risk.cls}">${score}% — ${risk.label} Risk</div>
        </div>`;
    }).join('');
}

// ============ INVENTORY ============
const DEFAULT_INVENTORY = [
    { id:'beauty',  name:'💄 Beauty Kit',     stock:42, threshold:10, unit:'units' },
    { id:'tech',    name:'⚡ Tech Gadget',    stock:18, threshold:15, unit:'units' },
    { id:'home',    name:'🏠 Home Essentials', stock:7,  threshold:10, unit:'units' },
    { id:'fashion', name:'👗 Fashion Item',    stock:31, threshold:12, unit:'units' },
    { id:'giftwrap',name:'🎀 Gift Wrap Sets',  stock:9,  threshold:20, unit:'packs' },
    { id:'box',     name:'📦 Shipping Boxes',  stock:55, threshold:25, unit:'units' },
];
let inventory = JSON.parse(localStorage.getItem('inventory') || JSON.stringify(DEFAULT_INVENTORY));

function saveInventory() { localStorage.setItem('inventory', JSON.stringify(inventory)); }

function updateStock(id, delta) {
    if (!can('inventory')) return showToastAdmin('Permission denied.', 'error');
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    item.stock = Math.max(0, item.stock + delta);
    saveInventory();
    auditLog('inventory', `Stock ${delta > 0 ? 'added' : 'removed'} (${Math.abs(delta)})`, item.name);
    renderInventory();
}

function restockItem(id) {
    if (!can('inventory')) return showToastAdmin('Permission denied.', 'error');
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    item.stock = item.threshold * 5;
    saveInventory();
    auditLog('restock', `Restocked to ${item.stock}`, item.name);
    renderInventory();
    showToastAdmin(`${item.name} restocked!`, 'success');
}

function renderInventory() {
    const container = document.getElementById('inventoryList');
    if (!container) return;
    let alertCount = 0;
    container.innerHTML = inventory.map(item => {
        const low = item.stock <= item.threshold;
        const critical = item.stock === 0;
        if (low) alertCount++;
        const pct = Math.min(100, Math.round((item.stock / (item.threshold * 5)) * 100));
        return `<div class="inv-row ${low ? (critical ? 'inv-critical' : 'inv-low') : ''}">
            <div class="inv-meta">
                <span class="inv-name">${item.name}</span>
                <span class="inv-count">${item.stock} ${item.unit}</span>
                ${low ? `<span class="inv-alert">${critical ? '🚨 OUT OF STOCK' : '⚠️ LOW STOCK'}</span>` : ''}
            </div>
            <div class="inv-bar-wrap">
                <div class="inv-bar" style="width:${pct}%;background:${critical?'var(--danger)':low?'var(--warning)':'var(--success)'}"></div>
            </div>
            <div class="inv-actions" data-perm="inventory">
                <button class="sm-btn" onclick="updateStock('${item.id}',-1)" ${!can('inventory')?'disabled':''}>−1</button>
                <button class="sm-btn" onclick="updateStock('${item.id}',10)" ${!can('inventory')?'disabled':''}>+10</button>
                <button class="sm-btn restock-btn" onclick="restockItem('${item.id}')" ${!can('inventory')?'disabled':''}>🔄 Restock</button>
            </div>
        </div>`;
    }).join('');
    const alertBadge = document.getElementById('invAlertBadge');
    if (alertBadge) {
        alertBadge.textContent = alertCount ? `⚠️ ${alertCount} Alert${alertCount>1?'s':''}` : '✅ All Good';
        alertBadge.className = 'inv-badge ' + (alertCount ? 'inv-badge-warn' : 'inv-badge-ok');
    }
}

// ============ MAIN STATS & LIST ============
function renderStats() {
    const total = subscriptions.length;
    document.getElementById('totalSubCount').textContent = total;
    document.getElementById('totalExtrasCount').textContent = subscriptions.reduce((a,s) => a + s.extendFeatures.length, 0);
    const premium = subscriptions.filter(s => s.extendFeatures.length > 0).length;
    document.getElementById('premiumRate').textContent = total ? Math.round(premium/total*100)+'%' : '0%';
    document.getElementById('churnRiskCount').textContent = subscriptions.filter(s => churnScore(s) >= 60).length;
}

function renderSubList() {
    const container = document.getElementById('subscriptionsListContainer');
    if (!container) return;
    if (!subscriptions.length) { container.innerHTML = '<div class="empty-msg">No subscriptions yet.</div>'; return; }
    const select = document.getElementById('extendSubscriptionSelect');
    if (select) {
        select.innerHTML = '<option value="">-- Select subscription --</option>' +
            subscriptions.map(s => `<option value="${s.id}">#${s.id} - ${escapeHtml(s.customer)} (${s.basePlan})</option>`).join('');
    }
    container.innerHTML = subscriptions.map(sub => {
        const score = churnScore(sub);
        const risk  = churnRisk(score);
        return `<div class="subscription-item">
            <div class="sub-info">
                <span class="sub-name">${escapeHtml(sub.customer)}</span>
                <span class="sub-plan">📦 ${sub.basePlan}</span>
                <span class="status-badge status-${sub.status}">${sub.status}</span>
                <span class="churn-mini ${risk.cls}">${risk.label} Risk</span>
                ${sub.extendFeatures.length ? `<span class="sub-extras">✨ ${sub.extendFeatures.map(f=>f.name).join(', ')}</span>` : ''}
            </div>
            <div class="actions">
                <button class="small-btn" onclick="deleteSubscription(${sub.id})" data-perm="delete" ${!can('delete')?'disabled':''}>🗑️</button>
            </div>
        </div>`;
    }).join('');
}

function renderAll() {
    renderStats();
    renderSubList();
    renderBulkList();
    renderStatusMachine();
    renderChurn();
    renderInventory();
    renderAudit();
    applyRoleGuards();
}

// ============ TOAST ============
function showToastAdmin(msg, type = 'info') {
    let container = document.getElementById('adminToastContainer');
    if (!container) { container = document.createElement('div'); container.id = 'adminToastContainer'; document.body.appendChild(container); }
    const t = document.createElement('div');
    t.className = `admin-toast admin-toast-${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => { t.classList.add('hiding'); setTimeout(() => t.remove(), 300); }, 3000);
}

// ============ TAB SYSTEM ============
function switchAdminTab(tab) {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + tab));
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded', () => {
    updateRoleBadge();
    applyRoleGuards();

    document.getElementById('createSubBtn')?.addEventListener('click', () =>
        createSubscription(
            document.getElementById('customerName').value,
            document.getElementById('basePlan').value,
            document.getElementById('customerType').value
        )
    );

    document.getElementById('applyExtendBtn')?.addEventListener('click', () => {
        const id = parseInt(document.getElementById('extendSubscriptionSelect').value);
        if (!id) return showToastAdmin('Select a subscription first.', 'error');
        applyAddons(id, {
            giftWrap:          document.getElementById('giftWrapToggle').checked,
            priorityShipping:  document.getElementById('priorityShippingToggle').checked,
            personalizedNote:  document.getElementById('personalizedNoteToggle').checked,
        });
        showToastAdmin('Add-ons applied!', 'success');
    });

    document.getElementById('roleSwitcher')?.addEventListener('change', e => switchRole(e.target.value));
    document.getElementById('auditFilter')?.addEventListener('input', renderAudit);
    document.getElementById('clearAuditBtn')?.addEventListener('click', clearAudit);
    document.getElementById('exportAuditBtn')?.addEventListener('click', exportAudit);
    document.getElementById('applyBulkBtn')?.addEventListener('click', applyBulkAction);

    // Demo data if empty
    if (!subscriptions.length) {
        createSubscription('Emma Watson', 'Deluxe Box', 'new');
        createSubscription('Liam Chen', 'Starter Box', 'old');
        createSubscription('Sofia Patel', 'Family Box', 'new');
        applyAddons(1, { giftWrap: true, personalizedNote: true });
        transitionStatus(2, 'paused');
    } else {
        renderAll();
    }
});
