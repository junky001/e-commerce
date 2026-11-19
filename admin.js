/* =========================================================
   SOKO | admin.js   (needs products.js + order-utils.js)
   Admin panel: approve stores and products, watch orders.

   DEMO ONLY. The login below is checked in the browser, so
   anyone who opens this file can read it. A real site must
   check admin logins on a server. Change these before you
   show the demo to anyone.
   ========================================================= */
(() => {
  'use strict';

  const ADMIN = { email: 'admin@soko.co.ke', password: 'admin123' };
  const SESSION_KEY = 'soko_admin';

  const { money, esc, fmtDate, fmtDateTime, statusClass, read, write } = SokoOrders;
  const K = { users: 'soko_users', products: 'soko_seller_products' };
  const CATEGORY_NAMES = { electronics: 'Electronics', fashion: 'Fashion', home: 'Home & Living', beauty: 'Beauty', sports: 'Sports' };
  const PANELS = ['overview', 'stores', 'products', 'orders'];
  const LABEL = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', suspended: 'Suspended' };
  const pillClass = (s) => ({ pending: 'warn', approved: 'ok', rejected: 'bad', suspended: 'bad' }[s] || 'muted');

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const fallbackImg = () => (typeof FALLBACK_IMG !== 'undefined' ? FALLBACK_IMG : '');

  const toastEl = $('#toast');
  let toastTimer;
  function toast(message, type = '') {
    toastEl.textContent = message;
    toastEl.className = `toast show ${type}`.trim();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3500);
  }

  /* =======================================================
     DATA
     ======================================================= */
  const isLoggedIn = () => sessionStorage.getItem(SESSION_KEY) === '1';
  const users = () => read(K.users, []);
  const stores = () => users().filter((u) => u.store);
  const sellerProducts = () => read(K.products, []);
  const storeStatus = (u) => u.store.status || 'approved';     // stores made before approvals count as approved
  const productStatus = (p) => p.status || 'approved';
  const storeOf = (email) => stores().find((u) => u.email === email);
  const storeLive = (email) => { const u = storeOf(email); return !!u && storeStatus(u) === 'approved'; };
  const productLive = (p) => productStatus(p) === 'approved' && p.active !== false && storeLive(p.sellerEmail);

  function updateStore(email, patch) {
    const list = users();
    const u = list.find((x) => x.email === email);
    if (!u || !u.store) return false;
    u.store = { ...u.store, ...patch, reviewedAt: new Date().toISOString() };
    return write(K.users, list);
  }

  function updateProduct(id, patch) {
    const list = sellerProducts();
    const p = list.find((x) => x.id === id);
    if (!p) return false;
    Object.assign(p, patch, { reviewedAt: new Date().toISOString() });
    return write(K.products, list);
  }

  // Money from one store's parcels, ignoring cancelled ones
  function salesOf(storeName) {
    return SokoOrders.all().reduce((sum, o) => sum + SokoOrders.parcels(o)
      .filter((p) => p.seller === storeName && p.status !== 'Cancelled')
      .reduce((s, p) => s + p.subtotal, 0), 0);
  }

  /* =======================================================
     LOGIN
     ======================================================= */
  $('#loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('#loginError');
    const ok = $('#adEmail').value.trim().toLowerCase() === ADMIN.email && $('#adPassword').value === ADMIN.password;
    if (!ok) {
      err.textContent = 'Wrong email or password.';
      err.hidden = false;
      return;
    }
    err.hidden = true;
    sessionStorage.setItem(SESSION_KEY, '1');
    e.target.reset();
    render();
  });

  $('#logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem(SESSION_KEY);
    render();
  });

  /* =======================================================
     SCREENS + ROUTING
     ======================================================= */
  function render() {
    const on = isLoggedIn();
    $('#gate').hidden = on;
    $('#dash').hidden = !on;
    $('#logoutBtn').hidden = !on;
    if (!on) return;
    renderAll();
    showPanel();
  }

  function renderAll() {
    renderOverview();
    renderStores();
    renderProducts();
    renderOrders();
  }

  function showPanel() {
    let name = location.hash.slice(1);
    if (!PANELS.includes(name)) name = 'overview';
    PANELS.forEach((p) => { $(`#panel-${p}`).hidden = p !== name; });
    $$('.dash__links a').forEach((a) => a.classList.toggle('active', a.dataset.panel === name));
  }
  window.addEventListener('hashchange', () => { if (isLoggedIn()) showPanel(); });

  /* =======================================================
     OVERVIEW
     ======================================================= */
  function renderOverview() {
    const st = stores();
    const prods = sellerProducts();
    const orders = SokoOrders.all();
    const pendingStores = st.filter((u) => storeStatus(u) === 'pending').length;
    const pendingProducts = prods.filter((p) => productStatus(p) === 'pending').length;

    let gross = 0;
    let liveOrders = 0;
    orders.forEach((o) => {
      const live = SokoOrders.parcels(o).filter((p) => p.status !== 'Cancelled');
      if (live.length) liveOrders++;
      gross += live.reduce((s, p) => s + p.subtotal, 0);
    });

    $('#stats').innerHTML = [
      { label: 'Stores waiting', value: pendingStores, sub: 'need approval', accent: pendingStores > 0 },
      { label: 'Products waiting', value: pendingProducts, sub: 'need review', accent: pendingProducts > 0 },
      { label: 'Live stores', value: st.filter((u) => storeStatus(u) === 'approved').length, sub: `${st.length} in total` },
      { label: 'Live products', value: prods.filter(productLive).length, sub: `${prods.length} submitted` },
      { label: 'Orders', value: liveOrders, sub: 'not cancelled' },
      { label: 'Total sales', value: money(gross), sub: 'across all stores' },
      { label: 'Commission earned', value: money(Math.round(gross * SokoOrders.COMMISSION)), sub: `${Math.round(SokoOrders.COMMISSION * 100)}% of sales` },
      { label: 'Registered users', value: users().length, sub: `${st.length} with a store` }
    ].map((s) => `
      <div class="stat ${s.accent ? 'stat--accent' : ''}">
        <div class="stat__label">${s.label}</div>
        <div class="stat__value">${s.value}</div>
        <div class="stat__sub">${s.sub}</div>
      </div>`).join('');

    // Sidebar badges
    const nb = (id, n) => { $(id).textContent = n; $(id).hidden = n === 0; };
    nb('#navStores', pendingStores);
    nb('#navProducts', pendingProducts);

    const items = [];
    if (pendingStores) items.push(`<li><span>🏪</span><span><strong>${pendingStores}</strong> store${pendingStores === 1 ? ' is' : 's are'} waiting for approval. <a href="#stores" data-set="sFilter:pending">Review stores</a></span></li>`);
    if (pendingProducts) items.push(`<li><span>📦</span><span><strong>${pendingProducts}</strong> product${pendingProducts === 1 ? ' is' : 's are'} waiting for review. <a href="#products" data-set="pFilter:pending">Review products</a></span></li>`);
    $('#attention').innerHTML = items.length ? items.join('') : '<li class="ok"><span>✅</span><span>You\'re all caught up. Nothing is waiting for review.</span></li>';
  }

  /* =======================================================
     STORES
     ======================================================= */
  const ORDER_RANK = { pending: 0, rejected: 1, suspended: 2, approved: 3 };

  function renderStores() {
    const q = $('#sSearch').value.trim().toLowerCase();
    const filter = $('#sFilter').value;
    const all = stores();
    const prods = sellerProducts();

    const list = all.filter((u) => {
      if (filter !== 'all' && storeStatus(u) !== filter) return false;
      return !q || `${u.store.name} ${u.name} ${u.email}`.toLowerCase().includes(q);
    }).sort((a, b) => ORDER_RANK[storeStatus(a)] - ORDER_RANK[storeStatus(b)] ||
      new Date(b.store.createdAt || 0) - new Date(a.store.createdAt || 0));

    const table = $('#storesTable');
    const empty = $('#storesEmpty');
    table.hidden = !list.length;
    empty.hidden = list.length > 0;
    if (!list.length) {
      table.innerHTML = '';
      empty.innerHTML = all.length ? '<h3>No stores match</h3><p>Try a different search or filter.</p>'
        : '<h3>No stores yet</h3><p>When someone opens a store in the Seller Center, it shows up here for approval.</p>';
      return;
    }

    table.innerHTML = `
      <thead><tr><th>Store</th><th>Owner</th><th>Applied</th><th>Status</th><th class="num">Products</th><th class="num">Sales</th><th></th></tr></thead>
      <tbody>${list.map((u) => {
        const s = storeStatus(u);
        const mine = prods.filter((p) => p.sellerEmail === u.email);
        const actions = s === 'pending' ? '<button class="mini-btn" data-act="store-approve">Approve</button><button class="mini-btn mini-btn--danger" data-act="store-reject">Reject</button>'
          : s === 'approved' ? '<button class="mini-btn mini-btn--danger" data-act="store-suspend">Suspend</button>'
          : s === 'suspended' ? '<button class="mini-btn" data-act="store-approve">Reactivate</button>'
          : '<button class="mini-btn" data-act="store-approve">Approve</button>';
        return `
          <tr data-email="${esc(u.email)}">
            <td><strong>${esc(u.store.name)}</strong><span class="cell-sub">${esc(u.store.description || '')}</span></td>
            <td>${esc(u.name)}<span class="cell-sub">${esc(u.email)} · ${esc(u.phone)}</span></td>
            <td>${u.store.createdAt ? fmtDate(u.store.createdAt) : '—'}</td>
            <td><span class="badge-pill badge-pill--${pillClass(s)}">${LABEL[s]}</span>${u.store.reviewNote && (s === 'rejected' || s === 'suspended') ? `<span class="note note--bad">${esc(u.store.reviewNote)}</span>` : ''}</td>
            <td class="num">${mine.filter(productLive).length} / ${mine.length}</td>
            <td class="num">${money(salesOf(u.store.name))}</td>
            <td><div class="cell-actions">${actions}</div></td>
          </tr>`;
      }).join('')}</tbody>`;
  }

  /* =======================================================
     PRODUCTS
     ======================================================= */
  function renderProducts() {
    const q = $('#pSearch').value.trim().toLowerCase();
    const filter = $('#pFilter').value;
    const all = sellerProducts();

    const list = all.filter((p) => {
      if (filter !== 'all' && productStatus(p) !== filter) return false;
      return !q || `${p.title} ${p.seller}`.toLowerCase().includes(q);
    }).sort((a, b) => ORDER_RANK[productStatus(a)] - ORDER_RANK[productStatus(b)] || (b.createdAt || 0) - (a.createdAt || 0));

    const table = $('#productsTable');
    const empty = $('#productsEmpty');
    table.hidden = !list.length;
    empty.hidden = list.length > 0;
    if (!list.length) {
      table.innerHTML = '';
      empty.innerHTML = all.length ? '<h3>No products match</h3><p>Try a different search or filter.</p>'
        : '<h3>No products yet</h3><p>Products sellers add in the Seller Center show up here for review.</p>';
      return;
    }

    table.innerHTML = `
      <thead><tr><th>Product</th><th>Store</th><th>Category</th><th class="num">Price</th><th class="num">Stock</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.map((p) => {
        const s = productStatus(p);
        const storeNote = s === 'approved' && !storeLive(p.sellerEmail) ? '<span class="note note--bad">Hidden: the store is not approved</span>' : '';
        const actions = `<button class="mini-btn" data-act="product-view">Review</button>` +
          (s !== 'approved' ? '<button class="mini-btn" data-act="product-approve">Approve</button>' : '') +
          (s !== 'rejected' ? '<button class="mini-btn mini-btn--danger" data-act="product-reject">' + (s === 'approved' ? 'Take down' : 'Reject') + '</button>' : '');
        return `
          <tr data-id="${p.id}">
            <td><div class="cell-product">
              <img src="${esc(p.image || fallbackImg())}" alt="" />
              <div><strong>${esc(p.title)}</strong><small>SK-${p.id} · ${p.createdAt ? fmtDate(p.createdAt) : ''}</small></div>
            </div></td>
            <td>${esc(p.seller)}</td>
            <td>${esc(CATEGORY_NAMES[p.category] || p.category)}</td>
            <td class="num">${money(p.price)}</td>
            <td class="num">${p.stock}</td>
            <td><span class="badge-pill badge-pill--${pillClass(s)}">${LABEL[s]}</span>${p.reviewNote && s === 'rejected' ? `<span class="note note--bad">${esc(p.reviewNote)}</span>` : ''}${storeNote}</td>
            <td><div class="cell-actions">${actions}</div></td>
          </tr>`;
      }).join('')}</tbody>`;
  }

  /* =======================================================
     ORDERS
     ======================================================= */
  function renderOrders() {
    const q = $('#oSearch').value.trim().toLowerCase();
    const filter = $('#oFilter').value;
    const all = SokoOrders.all().sort((a, b) => new Date(b.date) - new Date(a.date));

    const list = all.filter((o) => {
      if (filter !== 'all' && SokoOrders.overall(o) !== filter) return false;
      return !q || `${o.id} ${(o.customer && o.customer.name) || ''}`.toLowerCase().includes(q);
    });

    const table = $('#ordersTable');
    const empty = $('#ordersEmpty');
    table.hidden = !list.length;
    empty.hidden = list.length > 0;
    if (!list.length) {
      table.innerHTML = '';
      empty.innerHTML = all.length ? '<h3>No orders match</h3><p>Try a different search or status.</p>'
        : '<h3>No orders yet</h3><p>Orders from shoppers appear here.</p>';
      return;
    }

    table.innerHTML = `
      <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Stores</th><th class="num">Total</th><th>Status</th><th></th></tr></thead>
      <tbody>${list.map((o) => {
        const status = SokoOrders.overall(o);
        const c = o.customer || {};
        return `
          <tr data-order="${esc(o.id)}">
            <td><strong>#${esc(o.id)}</strong></td>
            <td>${fmtDate(o.date)}</td>
            <td>${esc(c.name)}<span class="cell-sub">${esc(c.phone)}</span></td>
            <td>${SokoOrders.parcels(o).map((p) => esc(p.seller)).join(', ')}</td>
            <td class="num">${money(o.total)}</td>
            <td><span class="badge-pill badge-pill--${statusClass(status)}">${status}</span></td>
            <td><div class="cell-actions">${SokoOrders.canCancel(o) ? '<button class="mini-btn mini-btn--danger" data-act="order-cancel">Cancel order</button>' : ''}</div></td>
          </tr>`;
      }).join('')}</tbody>`;
  }

  /* =======================================================
     MODALS
     ======================================================= */
  const reasonModal = $('#reasonModal');
  const detailModal = $('#detailModal');
  let reasonCallback = null;

  function openModal(m) { m.classList.add('open'); m.setAttribute('aria-hidden', 'false'); document.body.classList.add('no-scroll'); }
  function closeModals() {
    [reasonModal, detailModal].forEach((m) => { m.classList.remove('open'); m.setAttribute('aria-hidden', 'true'); });
    document.body.classList.remove('no-scroll');
    reasonCallback = null;
  }

  function askReason({ title, text, confirm }, callback) {
    $('#rmTitle').textContent = title;
    $('#rmText').textContent = text;
    $('#rmConfirm').textContent = confirm;
    $('#rmReason').value = '';
    $('#rmError').hidden = true;
    reasonCallback = callback;
    closeDetailOnly();
    openModal(reasonModal);
    setTimeout(() => $('#rmReason').focus(), 50);
  }
  function closeDetailOnly() { detailModal.classList.remove('open'); detailModal.setAttribute('aria-hidden', 'true'); }

  $('#reasonForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const reason = $('#rmReason').value.replace(/[<>]/g, '').trim();
    if (reason.length < 5) { $('#rmError').hidden = false; return; }
    const cb = reasonCallback;
    closeModals();
    if (cb) cb(reason);
  });

  function openProductDetail(id) {
    const p = sellerProducts().find((x) => x.id === id);
    if (!p) return;
    const s = productStatus(p);
    const images = (p.images && p.images.length ? p.images : [p.image || fallbackImg()]);
    $('#dmTitle').textContent = p.title;
    $('#dmBody').innerHTML = `
      <div class="detail">
        <div class="detail__images">${images.map((src) => `<img src="${esc(src)}" alt="" />`).join('')}</div>
        <dl>
          <dt>Status</dt><dd><span class="badge-pill badge-pill--${pillClass(s)}">${LABEL[s]}</span></dd>
          <dt>Store</dt><dd>${esc(p.seller)}</dd>
          <dt>Category</dt><dd>${esc(CATEGORY_NAMES[p.category] || p.category)}</dd>
          <dt>Price</dt><dd>${money(p.price)}${p.oldPrice ? ` <s class="cell-sub" style="display:inline">${money(p.oldPrice)}</s>` : ''}</dd>
          <dt>Stock</dt><dd>${p.stock}</dd>
          <dt>Visible</dt><dd>${p.active === false ? 'Hidden by the seller' : 'Yes'}</dd>
          <dt>Product code</dt><dd>SK-${p.id}</dd>
        </dl>
        <div class="detail__desc">${esc(p.description || 'No description.')}</div>
      </div>`;
    $('#dmActions').innerHTML = `
      <button class="btn btn--ghost" data-close>Close</button>
      ${s !== 'rejected' ? `<button class="btn btn--outline" data-act="product-reject" data-id="${p.id}">${s === 'approved' ? 'Take down' : 'Reject'}</button>` : ''}
      ${s !== 'approved' ? `<button class="btn btn--primary" data-act="product-approve" data-id="${p.id}">Approve</button>` : ''}`;
    openModal(detailModal);
  }

  /* =======================================================
     ACTIONS
     ======================================================= */
  function afterChange(message, type = 'success') {
    closeModals();
    renderAll();
    toast(message, type);
  }

  function storeAction(act, email) {
    const u = storeOf(email);
    if (!u) return;
    const name = u.store.name;
    if (act === 'store-approve') {
      if (updateStore(email, { status: 'approved', reviewNote: '' })) afterChange(`${name} is approved`);
    }
    if (act === 'store-reject') {
      askReason({ title: `Reject ${name}?`, text: 'The store stays closed. The seller can fix the problem and apply again.', confirm: 'Reject store' },
        (reason) => { if (updateStore(email, { status: 'rejected', reviewNote: reason })) afterChange(`${name} was rejected`); });
    }
    if (act === 'store-suspend') {
      askReason({ title: `Suspend ${name}?`, text: 'All of this store\'s products are hidden from the shop straight away.', confirm: 'Suspend store' },
        (reason) => { if (updateStore(email, { status: 'suspended', reviewNote: reason })) afterChange(`${name} was suspended`); });
    }
  }

  function productAction(act, id) {
    const p = sellerProducts().find((x) => x.id === id);
    if (!p) return;
    if (act === 'product-view') return openProductDetail(id);
    if (act === 'product-approve') {
      if (updateProduct(id, { status: 'approved', reviewNote: '' })) afterChange(`"${p.title}" is approved`);
    }
    if (act === 'product-reject') {
      const wasLive = productStatus(p) === 'approved';
      askReason({ title: wasLive ? `Take down "${p.title}"?` : `Reject "${p.title}"?`,
        text: wasLive ? 'It disappears from the shop straight away.' : 'The seller sees your reason and can edit and resubmit.',
        confirm: wasLive ? 'Take down' : 'Reject product' },
      (reason) => { if (updateProduct(id, { status: 'rejected', reviewNote: reason })) afterChange(`"${p.title}" was ${wasLive ? 'taken down' : 'rejected'}`); });
    }
  }

  document.addEventListener('click', (e) => {
    const t = e.target;

    const btn = t.closest('[data-act]');
    if (btn) {
      const act = btn.dataset.act;
      const row = btn.closest('tr');
      if (act.startsWith('store-')) return storeAction(act, row.dataset.email);
      if (act.startsWith('product-')) return productAction(act, Number(btn.dataset.id || (row && row.dataset.id)));
      if (act === 'order-cancel') {
        const id = row.dataset.order;
        if (!confirm(`Cancel order #${id}? The stock goes back to the sellers. This can't be undone.`)) return;
        return SokoOrders.cancel(id, 'admin') ? afterChange(`Order #${id} cancelled`) : toast('This order has already shipped and can\'t be cancelled.', 'error');
      }
    }

    // Overview links that also set a filter ("data-set" = "selectId:value")
    const setter = t.closest('[data-set]');
    if (setter) {
      const [id, value] = setter.dataset.set.split(':');
      $(`#${id}`).value = value;
      renderStores(); renderProducts();
    }

    if (t.closest('[data-close]') || t === reasonModal || t === detailModal) closeModals();
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });

  ['sSearch:input:renderStores', 'sFilter:change:renderStores', 'pSearch:input:renderProducts',
    'pFilter:change:renderProducts', 'oSearch:input:renderOrders', 'oFilter:change:renderOrders'].forEach((spec) => {
    const [id, evt, fn] = spec.split(':');
    const fns = { renderStores, renderProducts, renderOrders };
    $(`#${id}`).addEventListener(evt, fns[fn]);
  });

  // Refresh when sellers or shoppers change data in another tab
  window.addEventListener('storage', () => { if (isLoggedIn()) renderAll(); });

  render();
})();