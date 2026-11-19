/* =========================================================
   SOKO | order-utils.js
   Shared order helpers for My Orders, Track Order and Admin.
   Demo mode: orders live in the browser's localStorage.
   ========================================================= */
const SokoOrders = (() => {
  const KEY_ORDERS = 'soko_orders';
  const KEY_PRODUCTS = 'soko_seller_products';
  const COMMISSION = 0.10;     // Soko keeps 10% of each sale

  /* ---------- storage ---------- */
  const read = (key, fallback) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  };
  const write = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  };

  /* ---------- formatting ---------- */
  const money = (n) => 'KSh ' + Number(n).toLocaleString('en-KE');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtDateTime = (iso) => new Date(iso).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const statusClass = (s) => ({ Processing: 'warn', Shipped: 'info', Delivered: 'ok', Cancelled: 'bad' }[s] || 'muted');

  /* ---------- orders ---------- */
  const all = () => read(KEY_ORDERS, []);
  const saveAll = (list) => write(KEY_ORDERS, list);
  const sellerStatus = (order, seller) => (order.sellerStatus && order.sellerStatus[seller]) || 'Processing';

  // An order can hold items from several sellers. Each seller ships their own "parcel".
  function parcels(order) {
    const map = new Map();
    (order.items || []).forEach((i) => {
      if (!map.has(i.seller)) map.set(i.seller, []);
      map.get(i.seller).push(i);
    });
    return [...map].map(([seller, items]) => ({
      seller,
      items,
      subtotal: items.reduce((s, i) => s + i.price * i.qty, 0),
      status: sellerStatus(order, seller)
    }));
  }

  // One status for the whole order, worked out from its parcels
  function overall(order) {
    const statuses = parcels(order).map((p) => p.status);
    if (!statuses.length) return 'Processing';
    if (statuses.every((s) => s === 'Cancelled')) return 'Cancelled';
    const live = statuses.filter((s) => s !== 'Cancelled');
    if (live.every((s) => s === 'Delivered')) return 'Delivered';
    if (live.some((s) => s === 'Shipped' || s === 'Delivered')) return 'Shipped';
    return 'Processing';
  }

  // Can still be cancelled only while nothing has shipped
  const canCancel = (order) => parcels(order).every((p) => p.status === 'Processing');

  // Cancel every parcel, put the stock back, and note it in the order history
  function cancel(orderId, by) {
    const orders = all();
    const order = orders.find((o) => o.id === orderId);
    if (!order || !canCancel(order)) return false;
    const sellerProducts = read(KEY_PRODUCTS, []);
    const now = new Date().toISOString();
    order.sellerStatus = order.sellerStatus || {};
    order.history = order.history || [];
    parcels(order).forEach((p) => {
      order.sellerStatus[p.seller] = 'Cancelled';
      order.history.push({ seller: p.seller, status: 'Cancelled', at: now, by });
      p.items.forEach((it) => {
        const sp = sellerProducts.find((x) => x.id === it.id);
        if (sp && typeof sp.stock === 'number') sp.stock += it.qty;
      });
    });
    write(KEY_PRODUCTS, sellerProducts);
    saveAll(orders);
    return true;
  }

  /* ---------- finding orders ---------- */
  const normId = (s) => String(s || '').trim().replace(/^#/, '').toUpperCase();
  const find = (id) => all().find((o) => String(o.id).toUpperCase() === normId(id));
  const belongsTo = (order, email) => {
    const e = String(email || '').toLowerCase();
    return !!e && ((order.userEmail || '').toLowerCase() === e ||
      ((order.customer && order.customer.email) || '').toLowerCase() === e);
  };
  const phoneKey = (p) => String(p || '').replace(/\D/g, '').slice(-9);
  const phoneMatches = (order, phone) => {
    const a = phoneKey(order.customer && order.customer.phone);
    return a.length === 9 && a === phoneKey(phone);
  };
  // When did a status first happen? (only orders updated after this feature have history)
  function stepDate(order, status) {
    const h = (order.history || []).filter((x) => x.status === status).sort((a, b) => new Date(a.at) - new Date(b.at));
    return h.length ? h[0].at : null;
  }

  return {
    COMMISSION, read, write, money, esc, fmtDate, fmtDateTime, statusClass,
    all, saveAll, sellerStatus, parcels, overall, canCancel, cancel, normId, find, belongsTo, phoneMatches, stepDate
  };
})();