// ============================================
// swap.js — Box Contents & Swap Engine
// ============================================

function getBoxContents() {
    const box = localStorage.getItem('subbox_box');
    return box ? JSON.parse(box) : [];
}

function saveBoxContents(contents) {
    localStorage.setItem('subbox_box', JSON.stringify(contents));
}

function addToBox(product) {
    const box = getBoxContents();
    const limit = getBoxItemLimit();

    if (box.length >= limit) {
        return { success: false, message: `Box is full! Your plan allows ${limit} items. Upgrade or swap an item.` };
    }

    if (box.find(item => item.id === product.id)) {
        return { success: false, message: 'This item is already in your box!' };
    }

    box.push({
        id: product.id,
        title: product.title,
        price: product.price,
        discountPercentage: product.discountPercentage || 0,
        thumbnail: product.thumbnail,
        category: product.category,
        addedAt: new Date().toISOString()
    });

    saveBoxContents(box);
    logSwapHistory('add', null, product);
    return { success: true, message: `${product.title} added to your box!` };
}

function removeFromBox(productId) {
    let box = getBoxContents();
    const removed = box.find(item => item.id === productId);
    box = box.filter(item => item.id !== productId);
    saveBoxContents(box);
    if (removed) logSwapHistory('remove', removed, null);
    return box;
}

function swapItem(oldProductId, newProduct) {
    let box = getBoxContents();
    const oldItem = box.find(item => item.id === oldProductId);
    if (!oldItem) return { success: false, message: 'Item not found in your box.' };

    if (box.find(item => item.id === newProduct.id)) {
        return { success: false, message: 'The replacement item is already in your box!' };
    }

    const idx = box.findIndex(item => item.id === oldProductId);
    box[idx] = {
        id: newProduct.id,
        title: newProduct.title,
        price: newProduct.price,
        discountPercentage: newProduct.discountPercentage || 0,
        thumbnail: newProduct.thumbnail,
        category: newProduct.category,
        addedAt: new Date().toISOString()
    };

    saveBoxContents(box);
    logSwapHistory('swap', oldItem, newProduct);
    return { success: true, message: `Swapped "${oldItem.title}" for "${newProduct.title}"!` };
}

function isBoxLocked() {
    return localStorage.getItem('subbox_box_locked') === 'true';
}

function lockBox() {
    localStorage.setItem('subbox_box_locked', 'true');
    return true;
}

function unlockBox() {
    localStorage.setItem('subbox_box_locked', 'false');
}

function getSwapHistory() {
    const history = localStorage.getItem('subbox_swap_history');
    return history ? JSON.parse(history) : [];
}

function logSwapHistory(action, oldItem, newItem) {
    const history = getSwapHistory();
    history.push({
        action,
        oldItem: oldItem ? { id: oldItem.id, title: oldItem.title } : null,
        newItem: newItem ? { id: newItem.id, title: newItem.title } : null,
        timestamp: new Date().toISOString()
    });
    // Keep last 50 entries
    if (history.length > 50) history.shift();
    localStorage.setItem('subbox_swap_history', JSON.stringify(history));
}

function getBoxValue() {
    const box = getBoxContents();
    return box.reduce((sum, item) => {
        const discounted = item.price * (1 - (item.discountPercentage || 0) / 100);
        return sum + discounted;
    }, 0);
}

function clearBox() {
    saveBoxContents([]);
    unlockBox();
}
