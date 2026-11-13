/* =========================================================
   SOKO | shop.js   (needs products.js loaded first)
   Shop page: filters, sorting, pagination. The URL keeps the
   current filters, e.g. shop.html?cat=fashion&sort=price-asc
   ========================================================= */
(() => {
  'use strict';

  /* ---------- Config ---------- */
  const PAGE_SIZE = 12;
  const MAX_QTY = 10;
  const FREE_SHIPPING_MIN = 3000;
  const DELIVERY_FEE = 250;
  const CATEGORY_NAMES = {
    electronics: 'Electronics', fashion: 'Fashion', home: 'Home & Living',
    beauty: 'Beauty', sports: 'Sports'
  };
  const SORTS = ['default', 'price-asc', 'price-desc', 'rating', 'popular', 'discount'];

  /* ---------- Helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const money = (n) => 'KSh ' + Number(n).toLocaleString('en-KE');
  const stars = (r) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  const findProduct = (id) => PRODUCTS.find((p) => p.id === Number(id));
  const discountOf = (p) => (p.oldPrice ? 1 - p.price / p.oldPrice : 0);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem(key);
        return v ? JSON.parse(v) : fallback;
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
    }
  };

  /* ---------- State ---------- */
  const state = {
    cart: store.get('soko_cart', []).filter((i) => findProduct(i.id)),
    wishlist: store.get('soko_wishlist', []),
    user: store.get('soko_user', null)
  };

  // Current filters (read from the URL on load)
  const f = { q: '', cats: [], sellers: [], min: null, max: null, rating: 0, deals: false, wish: false, sort: 'default', page: 1 };

  const SELLERS = [...new Set(PRODUCTS.map((p) => p.seller))].sort();

  const overlay = $('#overlay');
  const drawer = $('#cartDrawer');
  const filtersEl = $('#filters');
  const toastEl = $('#toast');

  /* =======================================================
     URL <-> FILTERS
     ======================================================= */
  function readURL() {
    const p = new URLSearchParams(location.search);
    const num = (v) => (v !== null && v !== '' && !isNaN(v) && Number(v) >= 0 ? Number(v) : null);
    f.q = (p.get('q') || '').trim();
    f.cats = (p.get('cat') || '').split(',').filter((c) => CATEGORY_NAMES[c]);
    f.sellers = (p.get('seller') || '').split('|').filter((s) => SELLERS.includes(s));
    f.min = num(p.get('min'));
    f.max = num(p.get('max'));
    f.rating = [4, 4.5].includes(Number(p.get('rating'))) ? Number(p.get('rating')) : 0;
    f.deals = p.get('deals') === '1';
    f.wish = p.get('wishlist') === '1';
    f.sort = SORTS.includes(p.get('sort')) ? p.get('sort') : 'default';
    f.page = Math.max(1, parseInt(p.get('page'), 10) || 1);
  }

  function writeURL() {
    const p = new URLSearchParams();
    if (f.q) p.set('q', f.q);
    if (f.cats.length) p.set('cat', f.cats.join(','));
    if (f.sellers.length) p.set('seller', f.sellers.join('|'));
    if (f.min !== null) p.set('min', f.min);
    if (f.max !== null) p.set('max', f.max);
    if (f.rating) p.set('rating', f.rating);
    if (f.deals) p.set('deals', '1');
    if (f.wish) p.set('wishlist', '1');
    if (f.sort !== 'default') p.set('sort', f.sort);
    if (f.page > 1) p.set('page', f.page);
    const qs = p.toString();
    try { history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '')); } catch { /* file:// or sandboxed */ }
  }

  /* =======================================================
     TOAST / DRAWER / FILTER PANEL
     ======================================================= */
  let toastTimer;
  function toast(message, type = '') {
    toastEl.textContent = message;
    toastEl.className = `toast show ${type}`.trim();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  function openDrawer() {
    closePanels();
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.classList.add('show');
    document.body.classList.add('no-scroll');
  }
  function openFilters() {
    filtersEl.classList.add('open');
    overlay.classList.add('show');
    document.body.classList.add('no-scroll');
  }
  function closePanels() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    filtersEl.classList.remove('open');
    overlay.classList.remove('show');
    document.body.classList.remove('no-scroll');
  }

  /* =======================================================
     CART
     ======================================================= */
  function totals() {
    const subtotal = state.cart.reduce((sum, i) => sum + findProduct(i.id).price * i.qty, 0);
    const delivery = subtotal === 0 || subtotal >= FREE_SHIPPING_MIN ? 0 : DELIVERY_FEE;
    return { subtotal, delivery, total: subtotal + delivery };
  }

  function saveCart() {
    store.set('soko_cart', state.cart);
    renderCart();
  }

  function addToCart(id, qty = 1) {
    id = Number(id);
    const item = state.cart.find((i) => i.id === id);
    if (item) item.qty = Math.min(MAX_QTY, item.qty + qty);
    else state.cart.push({ id, qty: Math.min(MAX_QTY, qty) });
    saveCart();
    toast(`${findProduct(id).title} added to cart`, 'success');
  }

  function changeQty(id, delta) {
    const item = state.cart.find((i) => i.id === Number(id));
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) state.cart = state.cart.filter((i) => i !== item);
    else item.qty = Math.min(item.qty, MAX_QTY);
    saveCart();
  }

  function removeFromCart(id) {
    state.cart = state.cart.filter((i) => i.id !== Number(id));
    saveCart();
  }

  function renderCart() {
    const count = state.cart.reduce((n, i) => n + i.qty, 0);
    const { subtotal, delivery } = totals();

    $('#cartItems').innerHTML = !state.cart.length
      ? '<p class="empty-state">Your cart is empty.</p>'
      : state.cart.map((i) => {
          const p = findProduct(i.id);
          return `
            <div class="cart-item" data-id="${p.id}">
              <img src="${p.image}" alt="${esc(p.title)}" />
              <div class="cart-item__info">
                <h4>${esc(p.title)}</h4>
                <p class="cart-item__seller">by ${esc(p.seller)}</p>
                <p class="cart-item__price">${money(p.price * i.qty)}</p>
                <div class="qty">
                  <button class="qty__btn" data-action="decrease" aria-label="Decrease quantity">−</button>
                  <span class="qty__value">${i.qty}</span>
                  <button class="qty__btn" data-action="increase" aria-label="Increase quantity">+</button>
                </div>
              </div>
              <button class="cart-item__remove" aria-label="Remove item">🗑</button>
            </div>`;
        }).join('');

    $('#cartCount').textContent = count;
    $('#drawerCount').textContent = `(${count})`;
    $('#cartSubtotal').textContent = money(subtotal);
    $('#cartDelivery').textContent = subtotal === 0 ? '—' : delivery === 0 ? 'Free' : money(delivery);
    $('#checkoutBtn').disabled = state.cart.length === 0;
  }

  /* =======================================================
     WISHLIST
     ======================================================= */
  function updateWishCount() {
    $('#wishlistCount').textContent = state.wishlist.length;
  }

  function toggleWishlist(id) {
    id = Number(id);
    const index = state.wishlist.indexOf(id);
    if (index > -1) {
      state.wishlist.splice(index, 1);
      toast('Removed from wishlist');
    } else {
      state.wishlist.push(id);
      toast('Added to wishlist', 'success');
    }
    store.set('soko_wishlist', state.wishlist);
    updateWishCount();
    if (f.wish) return render();               // list itself depends on the wishlist
    $$('.product-card').forEach((card) => {
      const on = state.wishlist.includes(Number(card.dataset.id));
      const btn = $('.wish-btn', card);
      btn.classList.toggle('active', on);
      btn.textContent = on ? '♥' : '♡';
      btn.setAttribute('aria-pressed', on);
    });
  }

  /* =======================================================
     FILTERING + SORTING
     ======================================================= */
  function getFiltered() {
    const q = f.q.toLowerCase();
    const list = PRODUCTS.filter((p) => {
      if (f.cats.length && !f.cats.includes(p.category)) return false;
      if (f.sellers.length && !f.sellers.includes(p.seller)) return false;
      if (f.min !== null && p.price < f.min) return false;
      if (f.max !== null && p.price > f.max) return false;
      if (f.rating && p.rating < f.rating) return false;
      if (f.deals && !p.oldPrice) return false;
      if (f.wish && !state.wishlist.includes(p.id)) return false;
      if (q && !`${p.title} ${p.seller} ${CATEGORY_NAMES[p.category] || p.category}`.toLowerCase().includes(q)) return false;
      return true;
    });

    if (f.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    if (f.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    if (f.sort === 'rating') list.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
    if (f.sort === 'popular') list.sort((a, b) => b.reviews - a.reviews);
    if (f.sort === 'discount') list.sort((a, b) => discountOf(b) - discountOf(a));
    return list;
  }

  function activeFilterCount() {
    return f.cats.length + f.sellers.length + (f.min !== null || f.max !== null ? 1 : 0) +
      (f.rating ? 1 : 0) + (f.deals ? 1 : 0) + (f.wish ? 1 : 0);
  }

  /* =======================================================
     RENDERING
     ======================================================= */
  function cardHTML(p) {
    const wished = state.wishlist.includes(p.id);
    const d = p.oldPrice ? Math.round(discountOf(p) * 100) : 0;
    return `
      <article class="product-card" data-id="${p.id}">
        ${d ? `<span class="product-card__tag">-${d}%</span>` : ''}
        <button class="wish-btn ${wished ? 'active' : ''}" aria-label="Toggle wishlist" aria-pressed="${wished}">${wished ? '♥' : '♡'}</button>
        <a class="product-card__img" href="product.html?id=${p.id}"><img src="${p.image}" alt="${esc(p.title)}" loading="lazy" /></a>
        <div class="product-card__body">
          <p class="product-card__seller">by ${esc(p.seller)}</p>
          <h3 class="product-card__title"><a href="product.html?id=${p.id}">${esc(p.title)}</a></h3>
          <div class="rating" aria-label="${p.rating} out of 5">${stars(p.rating)} <span>(${p.reviews})</span></div>
          <p class="price"><strong>${money(p.price)}</strong>${p.oldPrice ? ` <del>${money(p.oldPrice)}</del>` : ''}</p>
          <button class="btn btn--primary btn--block add-to-cart">Add to Cart</button>
        </div>
      </article>`;
  }

  function renderSidebarLists() {
    $('#fCategories').innerHTML = Object.entries(CATEGORY_NAMES).map(([key, name]) => {
      const n = PRODUCTS.filter((p) => p.category === key).length;
      return `<li><label class="check"><input type="checkbox" data-cat="${key}" /> <span>${name}</span> <span class="count">${n}</span></label></li>`;
    }).join('');

    $('#fSellers').innerHTML = SELLERS.map((s) => {
      const n = PRODUCTS.filter((p) => p.seller === s).length;
      return `<li><label class="check"><input type="checkbox" data-seller="${esc(s)}" /> <span>${esc(s)}</span> <span class="count">${n}</span></label></li>`;
    }).join('');
  }

  function syncControls() {
    $$('#fCategories input').forEach((i) => { i.checked = f.cats.includes(i.dataset.cat); });
    $$('#fSellers input').forEach((i) => { i.checked = f.sellers.includes(i.dataset.seller); });
    $$('#fRating input').forEach((i) => { i.checked = Number(i.value) === f.rating; });
    $('#fMin').value = f.min ?? '';
    $('#fMax').value = f.max ?? '';
    $('#fDeals').checked = f.deals;
    $('#fWish').checked = f.wish;
    $('#sortSelect').value = f.sort;
    $('#searchInput').value = f.q;
  }

  function renderChips() {
    const chips = [];
    const add = (type, value, label) => chips.push(
      `<span class="chip">${esc(label)}<button data-chip="${type}" data-value="${esc(value)}" aria-label="Remove ${esc(label)}">✕</button></span>`
    );
    if (f.q) add('q', '', `Search: ${f.q}`);
    f.cats.forEach((c) => add('cat', c, CATEGORY_NAMES[c]));
    f.sellers.forEach((s) => add('seller', s, s));
    if (f.min !== null || f.max !== null) {
      const label = f.min !== null && f.max !== null ? `${money(f.min)} – ${money(f.max)}`
        : f.min !== null ? `From ${money(f.min)}` : `Up to ${money(f.max)}`;
      add('price', '', label);
    }
    if (f.rating) add('rating', '', `${f.rating} & up`);
    if (f.deals) add('deals', '', 'On sale');
    if (f.wish) add('wish', '', 'My wishlist');
    if (chips.length > 1) chips.push('<button class="chip chip--clear" data-chip="all">Clear all</button>');
    $('#activeChips').innerHTML = chips.join('');
  }

  function renderPagination(totalPages) {
    const nav = $('#pagination');
    if (totalPages <= 1) { nav.innerHTML = ''; return; }

    const pages = new Set([1, totalPages, f.page - 1, f.page, f.page + 1]);
    const sorted = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);

    let html = `<button data-page="${f.page - 1}" ${f.page === 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>`;
    sorted.forEach((n, i) => {
      if (i > 0 && n - sorted[i - 1] > 1) html += '<span class="dots">…</span>';
      html += `<button data-page="${n}" class="${n === f.page ? 'active' : ''}" ${n === f.page ? 'aria-current="page"' : ''}>${n}</button>`;
    });
    html += `<button data-page="${f.page + 1}" ${f.page === totalPages ? 'disabled' : ''} aria-label="Next page">›</button>`;
    nav.innerHTML = html;
  }

  function render() {
    const list = getFiltered();
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    f.page = Math.min(f.page, totalPages);
    const start = (f.page - 1) * PAGE_SIZE;
    const pageItems = list.slice(start, start + PAGE_SIZE);

    // Title and count
    $('#shopTitle').textContent = f.q ? `Results for "${f.q}"`
      : f.cats.length === 1 ? CATEGORY_NAMES[f.cats[0]]
      : f.wish ? 'My Wishlist' : 'All Products';
    document.title = `${$('#shopTitle').textContent} | Soko`;
    $('#resultCount').textContent = list.length
      ? `Showing ${start + 1}–${start + pageItems.length} of ${list.length} product${list.length === 1 ? '' : 's'}`
      : 'No products found';

    // Grid
    $('#shopGrid').innerHTML = pageItems.map(cardHTML).join('');
    $('#shopGrid').hidden = list.length === 0;
    $('#shopEmpty').hidden = list.length > 0;
    $('#applyMobile').textContent = list.length ? `Show ${list.length} result${list.length === 1 ? '' : 's'}` : 'No results';

    // Filter badge
    const n = activeFilterCount();
    $('#filterBadge').textContent = n;
    $('#filterBadge').hidden = n === 0;

    renderChips();
    renderPagination(totalPages);
    syncControls();
    writeURL();
  }

  function update(resetPage = true) {
    if (resetPage) f.page = 1;
    render();
  }

  function scrollToTop() {
    $('#shopTop').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function clearAll() {
    Object.assign(f, { q: '', cats: [], sellers: [], min: null, max: null, rating: 0, deals: false, wish: false, page: 1 });
    render();
  }

  /* =======================================================
     EVENTS
     ======================================================= */
  const toggleIn = (arr, value, on) => {
    const i = arr.indexOf(value);
    if (on && i === -1) arr.push(value);
    if (!on && i > -1) arr.splice(i, 1);
  };

  // Sidebar controls
  $('#fCategories').addEventListener('change', (e) => {
    if (e.target.dataset.cat) { toggleIn(f.cats, e.target.dataset.cat, e.target.checked); update(); }
  });
  $('#fSellers').addEventListener('change', (e) => {
    if (e.target.dataset.seller) { toggleIn(f.sellers, e.target.dataset.seller, e.target.checked); update(); }
  });
  $('#fRating').addEventListener('change', (e) => { f.rating = Number(e.target.value); update(); });
  $('#fDeals').addEventListener('change', (e) => { f.deals = e.target.checked; update(); });
  $('#fWish').addEventListener('change', (e) => {
    if (e.target.checked && !state.wishlist.length) {
      e.target.checked = false;
      return toast('Your wishlist is empty. Tap the ♡ on any product.');
    }
    f.wish = e.target.checked;
    update();
  });

  $('#priceForm').addEventListener('submit', (e) => {
    e.preventDefault();
    let min = $('#fMin').value === '' ? null : Math.max(0, Number($('#fMin').value));
    let max = $('#fMax').value === '' ? null : Math.max(0, Number($('#fMax').value));
    if (min !== null && max !== null && min > max) [min, max] = [max, min];
    f.min = min;
    f.max = max;
    update();
  });

  $('#priceQuick').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    f.min = btn.dataset.min === '' ? null : Number(btn.dataset.min);
    f.max = btn.dataset.max === '' ? null : Number(btn.dataset.max);
    update();
  });

  $('#sortSelect').addEventListener('change', (e) => { f.sort = e.target.value; update(); });
  $('#clearFilters').addEventListener('click', clearAll);
  $('#emptyClear').addEventListener('click', clearAll);

  // Active filter chips
  $('#activeChips').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-chip]');
    if (!btn) return;
    const { chip, value } = btn.dataset;
    if (chip === 'all') return clearAll();
    if (chip === 'q') f.q = '';
    if (chip === 'cat') toggleIn(f.cats, value, false);
    if (chip === 'seller') toggleIn(f.sellers, value, false);
    if (chip === 'price') { f.min = null; f.max = null; }
    if (chip === 'rating') f.rating = 0;
    if (chip === 'deals') f.deals = false;
    if (chip === 'wish') f.wish = false;
    update();
  });

  // Pagination
  $('#pagination').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-page]');
    if (!btn || btn.disabled) return;
    f.page = Number(btn.dataset.page);
    render();
    scrollToTop();
  });

  // Mobile filter panel
  $('#filterToggle').addEventListener('click', openFilters);
  $('#filtersClose').addEventListener('click', closePanels);
  $('#applyMobile').addEventListener('click', () => { closePanels(); scrollToTop(); });

  // Header
  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    f.q = $('#searchInput').value.trim();
    update();
  });
  $('#cartBtn').addEventListener('click', openDrawer);
  $('#checkoutBtn').addEventListener('click', () => {
    if (state.cart.length) location.href = 'index.html?checkout=1';
  });
  $('#wishlistBtn').addEventListener('click', () => {
    if (!state.wishlist.length) return toast('Your wishlist is empty. Tap the ♡ on any product.');
    f.wish = true;
    update();
    scrollToTop();
  });
  $('#accountBtn').addEventListener('click', () => { location.href = 'index.html'; });
  if (state.user) $('.header-action__label', $('#accountBtn')).textContent = state.user.name.split(' ')[0];

  // Cards + cart drawer (event delegation)
  document.addEventListener('click', (e) => {
    const t = e.target;

    const addBtn = t.closest('.product-card .add-to-cart');
    if (addBtn) return addToCart(addBtn.closest('.product-card').dataset.id);
    const wishBtn = t.closest('.product-card .wish-btn');
    if (wishBtn) return toggleWishlist(wishBtn.closest('.product-card').dataset.id);

    const qtyBtn = t.closest('.cart-item .qty__btn');
    if (qtyBtn) {
      return changeQty(qtyBtn.closest('.cart-item').dataset.id, qtyBtn.dataset.action === 'increase' ? 1 : -1);
    }
    if (t.closest('.cart-item__remove')) return removeFromCart(t.closest('.cart-item').dataset.id);

    if (t.closest('[data-close]') || t === overlay) closePanels();
  });

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanels(); });

  /* =======================================================
     INIT
     ======================================================= */
  readURL();
  renderSidebarLists();
  renderCart();
  updateWishCount();
  render();
  $('#year').textContent = new Date().getFullYear();
})();