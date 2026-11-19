/* =========================================================
   SOKO | seller.js   (needs products.js loaded first)
   Seller dashboard. Demo mode: everything is saved in the
   browser's localStorage. A real version would use a server.
   ========================================================= */
(() => {
  'use strict';

  /* ---------- Config ---------- */
  const COMMISSION = 0.10;     // Soko keeps 10% of each sale
  const LOW_STOCK = 5;
  const MAX_IMAGES = 4;
  const MAX_IMG_SIDE = 700;    // photos are shrunk to fit browser storage
  const STATUSES = ['Processing', 'Shipped', 'Delivered', 'Cancelled'];
  const CATEGORY_NAMES = {
    electronics: 'Electronics', fashion: 'Fashion', home: 'Home & Living',
    beauty: 'Beauty', sports: 'Sports'
  };
  const K = { products: 'soko_seller_products', users: 'soko_users', user: 'soko_user', orders: 'soko_orders' };
  const PANELS = ['overview', 'products', 'orders', 'settings'];

  /* ---------- Helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const money = (n) => 'KSh ' + Number(n).toLocaleString('en-KE');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  // Seller text is shown on other pages, so keep tags and quotes out of it
  const clean = (s) => String(s ?? '').replace(/[<>]/g, '').replace(/"/g, '″').trim();
  const validPhone = (v) => /^(?:\+?254|0)?[17]\d{8}$/.test(String(v).replace(/[\s-]/g, ''));
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtDateTime = (iso) => new Date(iso).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const fallbackImg = () => (typeof FALLBACK_IMG !== 'undefined' ? FALLBACK_IMG : '');

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
    }
  };

  /* ---------- State ---------- */
  let me = null;            // the logged-in user's full record
  let editingId = null;     // product being edited (null = adding a new one)
  let formImages = [];      // photos currently in the product form (data URLs)

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
  function loadMe() {
    const session = store.get(K.user, null);
    if (!session) return null;
    return store.get(K.users, []).find((u) => u.email === session.email) || null;
  }

  function saveMe() {
    const users = store.get(K.users, []);
    const i = users.findIndex((u) => u.email === me.email);
    if (i > -1) users[i] = me;
    store.set(K.users, users);
    const session = store.get(K.user, null);
    if (session) {
      session.seller = me.seller;
      session.store = me.store;
      store.set(K.user, session);
    }
  }

  const allProducts = () => store.get(K.products, []);
  const myProducts = () => allProducts().filter((p) => p.sellerEmail === me.email);

  function saveProducts(list) {
    if (!store.set(K.products, list)) {
      toast('Your browser storage is full. Remove some photos or products and try again.', 'error');
      return false;
    }
    return true;
  }

  function nextId() {
    const ids = [...PRODUCTS.map((p) => p.id), ...allProducts().map((p) => p.id)];
    return Math.max(1000, ...ids) + 1;
  }

  const stockState = (p) => (p.stock === 0 ? 'out' : p.stock <= LOW_STOCK ? 'low' : 'ok');

  // Approval: stores and products made before approvals existed count as approved
  const productStatus = (p) => p.status || 'approved';
  const storeStatus = () => (me.store && me.store.status) || 'approved';
  const isLive = (p) => productStatus(p) === 'approved' && p.active !== false && storeStatus() === 'approved';

  function myOrders() {
    const name = me.store.name;
    return store.get(K.orders, []).map((order) => {
      const items = (order.items || []).filter((i) => i.seller === name);
      if (!items.length) return null;
      const gross = items.reduce((s, i) => s + i.price * i.qty, 0);
      const commission = Math.round(gross * COMMISSION);
      const status = (order.sellerStatus && order.sellerStatus[name]) || 'Processing';
      return { order, items, gross, commission, net: gross - commission, status };
    }).filter(Boolean).sort((a, b) => new Date(b.order.date) - new Date(a.order.date));
  }

  const statusClass = (s) => ({ Processing: 'warn', Shipped: 'info', Delivered: 'ok', Cancelled: 'bad' }[s] || 'muted');

  /* =======================================================
     SCREENS: gate / setup / dashboard
     ======================================================= */
  function show(which) {
    $('#gate').hidden = which !== 'gate';
    $('#setup').hidden = which !== 'setup';
    $('#dash').hidden = which !== 'dash';
  }

  function showGate(kind) {
    show('gate');
    if (kind === 'login') {
      $('#gateIcon').textContent = '🏪';
      $('#gateTitle').textContent = 'Sell on Soko';
      $('#gateText').textContent = 'Open your own store in minutes. Log in to your seller account, or create one to get started.';
      $('#gateActions').innerHTML = `
        <a class="btn btn--primary btn--lg" href="index.html?auth=seller&next=seller">Create seller account</a>
        <a class="btn btn--outline btn--lg" href="index.html?auth=login&next=seller">Log in</a>`;
    } else {
      $('#gateIcon').textContent = '👋';
      $('#gateTitle').textContent = `Hi ${me.name.split(' ')[0]}`;
      $('#gateText').textContent = 'Your account is a shopper account. Turn on selling to open your own store.';
      $('#gateActions').innerHTML = '<button class="btn btn--primary btn--lg" id="enableSellerBtn">Start selling</button>';
    }
  }

  function render() {
    me = loadMe();
    $('#logoutBtn').hidden = !me;
    $('#viewStore').hidden = true;
    if (!me) return showGate('login');
    if (!me.seller) return showGate('enable');
    if (!me.store) {
      show('setup');
      $('#stPhone').value = $('#stPhone').value || me.phone || '';
      return;
    }
    show('dash');
    $('#storeName').textContent = me.store.name;
    $('#storeInitial').textContent = me.store.name.charAt(0).toUpperCase();
    $('#viewStore').href = `shop.html?seller=${encodeURIComponent(me.store.name)}`;
    $('#viewStore').hidden = false;
    $('#commissionText').textContent = `${Math.round(COMMISSION * 100)}%`;
    renderAll();
    showPanel();
  }

  function renderBanner() {
    const s = storeStatus();
    const note = me.store.reviewNote ? ` Reason: ${esc(me.store.reviewNote)}` : '';
    const msg = {
      pending: ['info', '⏳', '<strong>Your store is waiting for approval.</strong> You can add products now. They go live once Soko approves your store and the products.'],
      rejected: ['bad', '⛔', `<strong>Your store application was rejected.</strong>${note} <button class="link-btn" id="resubmitStoreBtn">Resubmit for review</button>`],
      suspended: ['bad', '🚫', `<strong>Your store is suspended.</strong>${note} Your products are hidden from the shop. Please contact Soko support.`]
    }[s];
    $('#storeBanner').innerHTML = msg ? `<div class="banner banner--${msg[0]}"><span>${msg[1]}</span><p>${msg[2]}</p></div>` : '';
  }

  function renderAll() {
    renderBanner();
    renderOverview();
    renderProducts();
    renderOrders();
    renderSettings();
  }

  /* ---------- Panel routing (#overview, #products, ...) ---------- */
  function showPanel() {
    let name = location.hash.slice(1);
    if (!PANELS.includes(name)) name = 'overview';
    PANELS.forEach((p) => { $(`#panel-${p}`).hidden = p !== name; });
    $$('.dash__links a').forEach((a) => a.classList.toggle('active', a.dataset.panel === name));
  }
  window.addEventListener('hashchange', () => { if (me && me.store) showPanel(); });

  /* =======================================================
     OVERVIEW
     ======================================================= */
  function renderOverview() {
    const products = myProducts();
    const orders = myOrders();
    const live = orders.filter((o) => o.status !== 'Cancelled');
    const delivered = orders.filter((o) => o.status === 'Delivered');
    const open = orders.filter((o) => o.status === 'Processing' || o.status === 'Shipped');

    const gross = live.reduce((s, o) => s + o.gross, 0);
    const net = live.reduce((s, o) => s + o.net, 0);
    const available = delivered.reduce((s, o) => s + o.net, 0);
    const lowCount = products.filter((p) => stockState(p) === 'low').length;
    const outCount = products.filter((p) => stockState(p) === 'out').length;

    $('#stats').innerHTML = [
      { label: 'Total sales', value: money(gross), sub: `${live.length} order${live.length === 1 ? '' : 's'}`, accent: true },
      { label: 'Your earnings', value: money(net), sub: `after ${Math.round(COMMISSION * 100)}% commission` },
      { label: 'Ready for payout', value: money(available), sub: `${delivered.length} delivered` },
      { label: 'Products', value: products.length, sub: `${products.filter(isLive).length} live in shop` }
    ].map((s) => `
      <div class="stat ${s.accent ? 'stat--accent' : ''}">
        <div class="stat__label">${s.label}</div>
        <div class="stat__value">${s.value}</div>
        <div class="stat__sub">${s.sub}</div>
      </div>`).join('');

    // Nav badge: orders waiting for you
    const badge = $('#navOrders');
    badge.textContent = open.length;
    badge.hidden = open.length === 0;

    // Chart: last 7 days
    const days = [...Array(7)].map((_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return d;
    });
    const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const totals = days.map((d) => live.filter((o) => sameDay(new Date(o.order.date), d)).reduce((s, o) => s + o.gross, 0));
    const max = Math.max(...totals, 1);
    $('#chart').innerHTML = days.map((d, i) => `
      <div class="bar" title="${money(totals[i])}">
        <span class="bar__val">${totals[i] ? totals[i].toLocaleString('en-KE') : ''}</span>
        <div class="bar__fill" style="height:${(totals[i] / max) * 78}%"></div>
        <span class="bar__label">${d.toLocaleDateString('en-KE', { weekday: 'short' })}</span>
      </div>`).join('');

    // Attention list
    const items = [];
    if (open.length) items.push(`<li><span>🧾</span><span><strong>${open.length}</strong> order${open.length === 1 ? '' : 's'} to process. <a href="#orders">Open orders</a></span></li>`);
    if (outCount) items.push(`<li><span>⛔</span><span><strong>${outCount}</strong> product${outCount === 1 ? ' is' : 's are'} out of stock. <a href="#products" data-filter="out">Restock</a></span></li>`);
    if (lowCount) items.push(`<li><span>⚠️</span><span><strong>${lowCount}</strong> product${lowCount === 1 ? ' is' : 's are'} running low. <a href="#products" data-filter="low">View</a></span></li>`);
    const pendingCount = products.filter((p) => productStatus(p) === 'pending').length;
    const rejectedCount = products.filter((p) => productStatus(p) === 'rejected').length;
    if (rejectedCount) items.push(`<li><span>❌</span><span><strong>${rejectedCount}</strong> product${rejectedCount === 1 ? ' was' : 's were'} rejected. <a href="#products" data-filter="rejected">See why</a></span></li>`);
    if (pendingCount) items.push(`<li><span>⏳</span><span><strong>${pendingCount}</strong> product${pendingCount === 1 ? ' is' : 's are'} waiting for approval. <a href="#products" data-filter="pending">View</a></span></li>`);
    if (!products.length) items.push('<li><span>📦</span><span>You have no products yet. <a href="#products" data-add>Add your first product</a></span></li>');
    $('#attention').innerHTML = items.length ? items.join('') : '<li class="ok"><span>✅</span><span>All good. Nothing needs your attention.</span></li>';

    // Recent orders
    const recent = orders.slice(0, 5);
    $('#recentEmpty').hidden = recent.length > 0;
    $('#recentOrders').hidden = recent.length === 0;
    $('#recentOrders').innerHTML = recent.length ? `
      <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th class="num">Your earnings</th><th>Status</th></tr></thead>
      <tbody>${recent.map((o) => `
        <tr>
          <td><strong>#${esc(o.order.id)}</strong></td>
          <td>${fmtDate(o.order.date)}</td>
          <td>${esc(o.order.customer && o.order.customer.name)}</td>
          <td class="num">${money(o.net)}</td>
          <td><span class="badge-pill badge-pill--${statusClass(o.status)}">${o.status}</span></td>
        </tr>`).join('')}</tbody>` : '';
  }

  /* =======================================================
     PRODUCTS
     ======================================================= */
  function renderProducts() {
    const q = $('#pSearch').value.trim().toLowerCase();
    const filter = $('#pFilter').value;
    const all = myProducts();

    const list = all.filter((p) => {
      if (q && !`${p.title} ${CATEGORY_NAMES[p.category] || ''}`.toLowerCase().includes(q)) return false;
      if (filter === 'active') return isLive(p);
      if (filter === 'pending') return productStatus(p) === 'pending';
      if (filter === 'rejected') return productStatus(p) === 'rejected';
      if (filter === 'hidden') return p.active === false;
      if (filter === 'low') return stockState(p) === 'low';
      if (filter === 'out') return stockState(p) === 'out';
      return true;
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const table = $('#productsTable');
    const empty = $('#productsEmpty');
    table.hidden = list.length === 0;
    empty.hidden = list.length > 0;

    if (!list.length) {
      table.innerHTML = '';
      empty.innerHTML = all.length
        ? '<h3>No products match</h3><p>Try a different search or filter.</p>'
        : '<h3>No products yet</h3><p>Add your first product and it will show up in the shop straight away.</p><button class="btn btn--primary" data-add>+ Add product</button>';
      return;
    }

    table.innerHTML = `
      <thead><tr><th>Product</th><th>Category</th><th class="num">Price</th><th class="num">Stock</th><th>In shop</th><th></th></tr></thead>
      <tbody>${list.map((p) => {
        const st = stockState(p);
        const stockPill = st === 'out' ? '<span class="badge-pill badge-pill--bad">Out of stock</span>'
          : st === 'low' ? `<span class="badge-pill badge-pill--warn">${p.stock} left</span>`
          : `<span>${p.stock}</span>`;
        const visible = p.active !== false;
        return `
          <tr data-id="${p.id}">
            <td><div class="cell-product">
              <img src="${esc(p.image)}" alt="" />
              <div><strong>${esc(p.title)}</strong><small>SK-${p.id}</small>${productStatus(p) === 'pending' ? '<span class="badge-pill badge-pill--warn">Pending review</span>' : productStatus(p) === 'rejected' ? `<span class="badge-pill badge-pill--bad">Rejected</span>${p.reviewNote ? `<small class="reject-note">${esc(p.reviewNote)}</small>` : ''}` : ''}</div>
            </div></td>
            <td>${esc(CATEGORY_NAMES[p.category] || p.category)}</td>
            <td class="num">${money(p.price)}${p.oldPrice ? `<span class="old-price">${money(p.oldPrice)}</span>` : ''}</td>
            <td class="num">${stockPill}</td>
            <td><label class="switch" title="${visible ? 'Visible in the shop' : 'Hidden from the shop'}">
              <input type="checkbox" class="js-toggle" ${visible ? 'checked' : ''} aria-label="Show ${esc(p.title)} in the shop" /><span></span>
            </label></td>
            <td><div class="cell-actions">
              ${isLive(p) ? `<a class="mini-btn" href="product.html?id=${p.id}">View</a>` : ''}
              <button class="mini-btn" data-action="edit">Edit</button>
              <button class="mini-btn mini-btn--danger" data-action="delete">Delete</button>
            </div></td>
          </tr>`;
      }).join('')}</tbody>`;
  }

  /* ---------- Product form ---------- */
  const modal = $('#productModal');

  function openModal() {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    setTimeout(() => $('#pTitle').focus(), 50);
  }
  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
  }

  function clearErrors() {
    $$('.field-error', modal).forEach((e) => { e.hidden = true; e.textContent = ''; });
    $$('.invalid', modal).forEach((e) => e.classList.remove('invalid'));
  }
  function setError(inputId, message) {
    const err = $(`#${inputId}Error`);
    if (err) { err.textContent = message; err.hidden = false; }
    const input = $(`#${inputId}`);
    if (input) input.classList.add('invalid');
  }

  function openProductForm(product = null) {
    editingId = product ? product.id : null;
    clearErrors();
    $('#pmTitle').textContent = product ? 'Edit product' : 'Add product';
    $('#pSaveBtn').textContent = product ? 'Save changes' : 'Save product';
    $('#pTitle').value = product ? product.title : '';
    $('#pCategory').value = product ? product.category : '';
    $('#pStock').value = product ? product.stock : '';
    $('#pPrice').value = product ? product.price : '';
    $('#pOldPrice').value = product && product.oldPrice ? product.oldPrice : '';
    $('#pDesc').value = product ? product.description || '' : '';
    $('#pActive').checked = product ? product.active !== false : true;
    $('#pImages').value = '';
    formImages = product && product.images ? [...product.images] : [];
    renderImagePreview();
    openModal();
  }

  function renderImagePreview() {
    $('#imgPreview').innerHTML = formImages.map((src, i) => `
      <div class="img-thumb ${i === 0 ? 'main' : ''}" data-index="${i}">
        <img src="${src}" alt="Photo ${i + 1}" />
        ${i === 0 ? '<span class="img-thumb__main">MAIN</span>' : '<button type="button" class="img-thumb__star" data-img="main" title="Make main photo" aria-label="Make main photo">★</button>'}
        <button type="button" class="img-thumb__remove" data-img="remove" aria-label="Remove photo">✕</button>
      </div>`).join('');
  }

  function readImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('image'));
        img.onload = () => {
          const scale = Math.min(1, MAX_IMG_SIDE / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  $('#pImages').addEventListener('change', async (e) => {
    const err = $('#pImagesError');
    err.hidden = true;
    const files = [...e.target.files];
    e.target.value = '';
    const room = MAX_IMAGES - formImages.length;
    if (files.length > room) {
      err.textContent = room > 0 ? `You can add ${room} more photo${room === 1 ? '' : 's'} (max ${MAX_IMAGES}).` : `You already have ${MAX_IMAGES} photos. Remove one first.`;
      err.hidden = false;
    }
    for (const file of files.slice(0, Math.max(0, room))) {
      if (!file.type.startsWith('image/')) { err.textContent = `${file.name} is not an image.`; err.hidden = false; continue; }
      try { formImages.push(await readImage(file)); } catch { err.textContent = `Couldn't read ${file.name}.`; err.hidden = false; }
    }
    renderImagePreview();
  });

  $('#imgPreview').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-img]');
    if (!btn) return;
    const i = Number(btn.closest('.img-thumb').dataset.index);
    if (btn.dataset.img === 'remove') formImages.splice(i, 1);
    if (btn.dataset.img === 'main') formImages.unshift(formImages.splice(i, 1)[0]);
    renderImagePreview();
  });

  $('#productForm').addEventListener('submit', (e) => {
    e.preventDefault();
    clearErrors();

    const title = clean($('#pTitle').value);
    const category = $('#pCategory').value;
    const priceRaw = $('#pPrice').value;
    const oldRaw = $('#pOldPrice').value;
    const stockRaw = $('#pStock').value;
    const price = Number(priceRaw);
    const oldPrice = oldRaw === '' ? null : Number(oldRaw);
    const stock = Number(stockRaw);
    let ok = true;
    const fail = (id, msg) => { setError(id, msg); ok = false; };

    if (title.length < 3) fail('pTitle', 'Enter a product name (at least 3 characters).');
    if (!CATEGORY_NAMES[category]) fail('pCategory', 'Choose a category.');
    if (priceRaw === '' || !Number.isInteger(price) || price < 1) fail('pPrice', 'Enter a price of 1 or more (whole shillings).');
    if (oldPrice !== null && (!Number.isInteger(oldPrice) || oldPrice <= price)) fail('pOldPrice', 'The old price must be higher than the price.');
    if (stockRaw === '' || !Number.isInteger(stock) || stock < 0 || stock > 9999) fail('pStock', 'Enter a stock quantity from 0 to 9999.');
    if (!ok) { const bad = $('.invalid', modal); if (bad) bad.focus(); return; }

    const all = allProducts();
    const existing = editingId ? all.find((p) => p.id === editingId && p.sellerEmail === me.email) : null;
    const product = {
      id: existing ? existing.id : nextId(),
      title,
      seller: me.store.name,
      sellerEmail: me.email,
      category,
      price,
      stock,
      rating: existing ? existing.rating : 0,
      reviews: existing ? existing.reviews : 0,
      description: clean($('#pDesc').value),
      images: [...formImages],
      image: formImages[0] || fallbackImg(),
      active: $('#pActive').checked,
      createdAt: existing ? existing.createdAt : Date.now(),
      status: 'pending'
    };
    if (oldPrice !== null) product.oldPrice = oldPrice;
    if (existing) {
      // An approved product only goes back for review when its listing content changes
      const contentChanged = existing.title !== product.title || existing.category !== product.category ||
        (existing.description || '') !== product.description ||
        JSON.stringify(existing.images || []) !== JSON.stringify(product.images);
      product.status = productStatus(existing) === 'approved' && !contentChanged ? 'approved' : 'pending';
    }

    const next = existing ? all.map((p) => (p.id === existing.id ? product : p)) : [...all, product];
    if (!saveProducts(next)) return;

    closeModal();
    renderAll();
    toast(!existing ? 'Product submitted for review' : product.status === 'pending' ? 'Saved. Your product is back in review.' : 'Product updated', 'success');
  });

  /* ---------- Product table actions ---------- */
  $('#productsTable').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = Number(btn.closest('tr').dataset.id);
    const product = myProducts().find((p) => p.id === id);
    if (!product) return;

    if (btn.dataset.action === 'edit') return openProductForm(product);
    if (btn.dataset.action === 'delete') {
      if (!confirm(`Delete "${product.title}"? This can't be undone.`)) return;
      if (saveProducts(allProducts().filter((p) => p.id !== id))) {
        renderAll();
        toast('Product deleted');
      }
    }
  });

  $('#productsTable').addEventListener('change', (e) => {
    if (!e.target.classList.contains('js-toggle')) return;
    const id = Number(e.target.closest('tr').dataset.id);
    const all = allProducts();
    const p = all.find((x) => x.id === id && x.sellerEmail === me.email);
    if (!p) return;
    p.active = e.target.checked;
    if (saveProducts(all)) {
      renderAll();
      toast(p.active ? 'Product is now visible in the shop' : 'Product hidden from the shop');
    }
  });

  $('#pSearch').addEventListener('input', renderProducts);
  $('#pFilter').addEventListener('change', renderProducts);
  $('#addProductBtn').addEventListener('click', () => openProductForm());

  /* =======================================================
     ORDERS
     ======================================================= */
  function renderOrders() {
    const q = $('#oSearch').value.trim().toLowerCase();
    const filter = $('#oFilter').value;
    const all = myOrders();
    const list = all.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false;
      if (q && !`${o.order.id} ${(o.order.customer && o.order.customer.name) || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });

    const box = $('#ordersEmpty');
    box.hidden = list.length > 0;
    if (!list.length) {
      box.innerHTML = all.length
        ? '<h3>No orders match</h3><p>Try a different search or status.</p>'
        : '<h3>No orders yet</h3><p>When a shopper buys one of your products, the order shows up here.</p>';
    }

    $('#ordersList').innerHTML = list.map((o) => {
      const c = o.order.customer || {};
      const payment = { mpesa: 'M-Pesa', card: 'Card', cod: 'Pay on delivery' }[o.order.payment] || o.order.payment;
      return `
        <article class="order" data-order="${esc(o.order.id)}">
          <div class="order__head">
            <div><strong>Order #${esc(o.order.id)}</strong><small>${fmtDateTime(o.order.date)} · ${esc(payment)}</small></div>
            <div class="order__status">
              <span class="badge-pill badge-pill--${statusClass(o.status)}">${o.status}</span>
              <label class="visually-hidden" for="st-${esc(o.order.id)}">Update status</label>
              <select id="st-${esc(o.order.id)}" class="js-status" ${o.status === 'Cancelled' ? 'disabled' : ''}>
                ${STATUSES.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="order__body">
            <div class="order__customer">
              <h4>Deliver to</h4>
              <p><strong>${esc(c.name)}</strong></p>
              <p>${esc(c.phone)}</p>
              <p>${esc([c.address, c.town, c.county].filter(Boolean).join(', '))}</p>
            </div>
            <div>
              <h4>Your items</h4>
              <ul class="order__items">${o.items.map((i) => `<li><span>${i.qty} × ${esc(i.title)}</span><span>${money(i.price * i.qty)}</span></li>`).join('')}</ul>
              <div class="order__totals">
                <div><span>Items total</span><span>${money(o.gross)}</span></div>
                <div><span>Soko commission (${Math.round(COMMISSION * 100)}%)</span><span>− ${money(o.commission)}</span></div>
                <div class="net"><span>You earn</span><span>${money(o.net)}</span></div>
              </div>
            </div>
          </div>
        </article>`;
    }).join('');
  }

  $('#ordersList').addEventListener('change', (e) => {
    if (!e.target.classList.contains('js-status')) return;
    const orderId = e.target.closest('.order').dataset.order;
    const newStatus = e.target.value;
    const name = me.store.name;
    const orders = store.get(K.orders, []);
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    const previous = (order.sellerStatus && order.sellerStatus[name]) || 'Processing';
    if (newStatus === 'Cancelled') {
      if (!confirm('Cancel your part of this order? The stock will be returned. This can\'t be undone.')) {
        e.target.value = previous;
        return;
      }
      // Put the cancelled quantities back into stock
      const all = allProducts();
      order.items.filter((i) => i.seller === name).forEach((it) => {
        const p = all.find((x) => x.id === it.id && x.sellerEmail === me.email);
        if (p && typeof p.stock === 'number') p.stock += it.qty;
      });
      saveProducts(all);
    }

    order.sellerStatus = order.sellerStatus || {};
    order.sellerStatus[name] = newStatus;
    (order.history = order.history || []).push({ seller: name, status: newStatus, at: new Date().toISOString(), by: 'seller' });
    store.set(K.orders, orders);
    renderAll();
    toast(`Order #${orderId} marked as ${newStatus}`, 'success');
  });

  $('#oSearch').addEventListener('input', renderOrders);
  $('#oFilter').addEventListener('change', renderOrders);

  /* =======================================================
     SETTINGS + SETUP
     ======================================================= */
  function renderSettings() {
    $('#setName').value = me.store.name;
    $('#setDesc').value = me.store.description || '';
    $('#setPhone').value = me.store.payoutPhone || '';
  }

  $('#settingsForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const err = $('#setPhoneError');
    err.hidden = true;
    $('#setPhone').classList.remove('invalid');
    if (!validPhone($('#setPhone').value)) {
      err.textContent = 'Enter a valid Kenyan phone number.';
      err.hidden = false;
      $('#setPhone').classList.add('invalid');
      return;
    }
    me.store.description = clean($('#setDesc').value);
    me.store.payoutPhone = $('#setPhone').value.trim();
    saveMe();
    toast('Store settings saved', 'success');
  });

  function storeNameTaken(name) {
    const lower = name.toLowerCase();
    const inCatalogue = PRODUCTS.some((p) => p.seller.toLowerCase() === lower && p.sellerEmail !== me.email);
    const byUser = store.get(K.users, []).some((u) => u.email !== me.email && u.store && u.store.name.toLowerCase() === lower);
    return inCatalogue || byUser;
  }

  $('#setupForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const nameErr = $('#stNameError');
    const phoneErr = $('#stPhoneError');
    [nameErr, phoneErr].forEach((x) => { x.hidden = true; });
    $('#stName').classList.remove('invalid');
    $('#stPhone').classList.remove('invalid');

    const name = $('#stName').value.trim().replace(/\s+/g, ' ');
    let ok = true;
    if (!/^[\p{L}\p{N} &.'-]{3,30}$/u.test(name)) {
      nameErr.textContent = 'Use 3 to 30 letters, numbers or spaces.';
      ok = false;
    } else if (storeNameTaken(name)) {
      nameErr.textContent = 'That store name is already taken. Try another.';
      ok = false;
    }
    if (!ok) { nameErr.hidden = false; $('#stName').classList.add('invalid'); $('#stName').focus(); return; }

    if (!validPhone($('#stPhone').value)) {
      phoneErr.textContent = 'Enter a valid Kenyan phone number.';
      phoneErr.hidden = false;
      $('#stPhone').classList.add('invalid');
      return;
    }

    me.store = {
      name,
      description: clean($('#stDesc').value),
      payoutPhone: $('#stPhone').value.trim(),
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    saveMe();
    e.target.reset();
    location.hash = '#overview';
    render();
    toast(`Welcome to Soko, ${name}! Your store is waiting for approval.`, 'success');
  });

  /* =======================================================
     GLOBAL EVENTS
     ======================================================= */
  document.addEventListener('click', (e) => {
    const t = e.target;

    if (t.closest('#resubmitStoreBtn')) {
      me.store.status = 'pending';
      me.store.reviewNote = '';
      saveMe();
      renderAll();
      toast('Your store was sent back for review', 'success');
      return;
    }
    if (t.closest('#enableSellerBtn')) {
      me.seller = true;
      saveMe();
      render();
      return;
    }
    // "Add product" links inside empty states and the attention list
    if (t.closest('[data-add]')) {
      e.preventDefault();
      location.hash = '#products';
      showPanel();
      openProductForm();
      return;
    }
    // Attention list shortcuts that pre-set the product filter
    const filterLink = t.closest('a[data-filter]');
    if (filterLink) {
      $('#pFilter').value = filterLink.dataset.filter;
      renderProducts();
    }
    if (t.closest('[data-close]') || t === modal) closeModal();
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  $('#logoutBtn').addEventListener('click', () => {
    store.set(K.user, null);
    closeModal();
    render();
    toast('You have been logged out');
  });

  // Another tab changed the data (e.g. a shopper placed an order): refresh
  window.addEventListener('storage', () => { if (me && me.store) { me = loadMe(); if (me && me.store) renderAll(); } });

  /* ---------- Init ---------- */
  render();
})();