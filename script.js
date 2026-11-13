/* =========================================================
   SOKO | script.js   (needs products.js loaded first)
   Demo mode: all data lives in the browser's localStorage.
   ========================================================= */
(() => {
  'use strict';

  /* ---------- Config ---------- */
  const PAGE_SIZE = 8;
  const MAX_QTY = 10;
  const FREE_SHIPPING_MIN = 3000;
  const DELIVERY_FEE = 250;

  /* ---------- Helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const money = (n) => 'KSh ' + Number(n).toLocaleString('en-KE');
  const stars = (r) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  const findProduct = (id) => PRODUCTS.find((p) => p.id === Number(id));
  const validPhone = (v) => /^(?:\+?254|0)?[17]\d{8}$/.test(v.replace(/[\s-]/g, ''));

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
    cart: store.get('soko_cart', []),
    wishlist: store.get('soko_wishlist', []),
    user: store.get('soko_user', null),
    filter: 'all',
    search: '',
    sort: 'default',
    visible: PAGE_SIZE,
    wishlistOnly: false,
    qvId: null,
    qvQty: 1
  };
  state.cart = state.cart.filter((i) => findProduct(i.id)); // drop items that no longer exist

  /* ---------- Elements ---------- */
  const overlay = $('#overlay');
  const drawer = $('#cartDrawer');
  const productGrid = $('#productGrid');
  const flashGrid = $('#flashGrid');
  const emptyState = $('#emptyState');
  const loadMoreBtn = $('#loadMoreBtn');
  const toastEl = $('#toast');

  /* =======================================================
     TOAST
     ======================================================= */
  let toastTimer;
  function toast(message, type = '') {
    toastEl.textContent = message;
    toastEl.className = `toast show ${type}`.trim();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  /* =======================================================
     DRAWER / MODALS
     ======================================================= */
  function openDrawer() {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.classList.add('show');
    document.body.classList.add('no-scroll');
  }

  function openModal(modal) {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
  }

  function closeAll() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
    $$('.modal.open').forEach((m) => {
      m.classList.remove('open');
      m.setAttribute('aria-hidden', 'true');
    });
    overlay.classList.remove('show');
    document.body.classList.remove('no-scroll');
  }

  /* =======================================================
     PRODUCT CARDS
     ======================================================= */
  function cardHTML(p, flash = false) {
    const discount = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    const wished = state.wishlist.includes(p.id);
    return `
      <article class="product-card" data-id="${p.id}" data-category="${p.category}">
        ${discount ? `<span class="product-card__tag">-${discount}%</span>` : ''}
        <button class="wish-btn ${wished ? 'active' : ''}" aria-label="Toggle wishlist" aria-pressed="${wished}">${wished ? '♥' : '♡'}</button>
         <a class="product-card__img" href="product.html?id=${p.id}"><img src="${p.image}" alt="${p.title}" loading="lazy" /></a>
        <div class="product-card__body">
          <p class="product-card__seller">by ${p.seller}</p>
                   <h3 class="product-card__title"><a href="product.html?id=${p.id}">${p.title}</a></h3>
          <div class="rating" aria-label="${p.rating} out of 5">${stars(p.rating)} <span>(${p.reviews})</span></div>
          <p class="price"><strong>${money(p.price)}</strong>${p.oldPrice ? ` <del>${money(p.oldPrice)}</del>` : ''}</p>
          ${flash
            ? `<button class="btn btn--primary btn--block add-to-cart">Add to Cart</button>`
            : `<div class="product-card__actions">
                 <button class="btn btn--primary add-to-cart">Add to Cart</button>
                 <button class="btn btn--ghost quick-view">Quick View</button>
               </div>`}
        </div>
      </article>`;
  }

  function renderFlash() {
    flashGrid.innerHTML = PRODUCTS.filter((p) => p.flash).map((p) => cardHTML(p, true)).join('');
  }

  function getVisibleList() {
    let list = state.wishlistOnly
      ? PRODUCTS.filter((p) => state.wishlist.includes(p.id))
      : [...PRODUCTS];

    if (!state.wishlistOnly && state.filter !== 'all') {
      list = list.filter((p) => p.category === state.filter);
    }
    if (state.search) {
      const q = state.search.toLowerCase();
      list = list.filter((p) => `${p.title} ${p.seller} ${p.category}`.toLowerCase().includes(q));
    }
    if (state.sort === 'price-asc') list.sort((a, b) => a.price - b.price);
    if (state.sort === 'price-desc') list.sort((a, b) => b.price - a.price);
    if (state.sort === 'rating') list.sort((a, b) => b.rating - a.rating);
    return list;
  }

  function renderProducts() {
    const list = getVisibleList();
    productGrid.innerHTML = list.slice(0, state.visible).map((p) => cardHTML(p)).join('');
    emptyState.hidden = list.length > 0;
    loadMoreBtn.hidden = state.visible >= list.length;
  }

  function syncFilterTabs() {
    $$('.filter-tab').forEach((tab) => {
      tab.classList.toggle('active', !state.wishlistOnly && tab.dataset.filter === state.filter);
    });
  }

  function setFilter(filter) {
    state.filter = filter;
    state.wishlistOnly = false;
    state.visible = PAGE_SIZE;
    const select = $('#searchCategory');
    if ([...select.options].some((o) => o.value === filter)) select.value = filter;
    syncFilterTabs();
    renderProducts();
  }

  /* =======================================================
     WISHLIST
     ======================================================= */
  function updateWishCount() {
    $('#wishlistCount').textContent = state.wishlist.length;
  }

  function syncWishButtons() {
    $$('.product-card').forEach((card) => {
      const on = state.wishlist.includes(Number(card.dataset.id));
      const btn = $('.wish-btn', card);
      btn.classList.toggle('active', on);
      btn.textContent = on ? '♥' : '♡';
      btn.setAttribute('aria-pressed', on);
    });
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
    syncWishButtons();
    if (state.wishlistOnly) renderProducts();
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
    item.qty = Math.min(item.qty, MAX_QTY);
    saveCart();
  }

  function removeFromCart(id) {
    state.cart = state.cart.filter((i) => i.id !== Number(id));
    saveCart();
  }

  function renderCart() {
    const cartItems = $('#cartItems');
    const count = state.cart.reduce((n, i) => n + i.qty, 0);
    const { subtotal, delivery } = totals();

    if (!state.cart.length) {
      cartItems.innerHTML = '<p class="empty-state" id="cartEmpty">Your cart is empty.</p>';
    } else {
      cartItems.innerHTML = state.cart.map((i) => {
        const p = findProduct(i.id);
        return `
          <div class="cart-item" data-id="${p.id}">
            <img src="${p.image}" alt="${p.title}" />
            <div class="cart-item__info">
              <h4>${p.title}</h4>
              <p class="cart-item__seller">by ${p.seller}</p>
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
    }

    $('#cartCount').textContent = count;
    $('#drawerCount').textContent = `(${count})`;
    $('#cartSubtotal').textContent = money(subtotal);
    $('#cartDelivery').textContent = subtotal === 0 ? '—' : delivery === 0 ? 'Free' : money(delivery);
    $('#checkoutBtn').disabled = state.cart.length === 0;
  }

  /* =======================================================
     QUICK VIEW
     ======================================================= */
  function openQuickView(id) {
    const p = findProduct(id);
    if (!p) return;
    state.qvId = p.id;
    state.qvQty = 1;
    $('#qvImage').src = p.image;
    $('#qvImage').alt = p.title;
    $('#qvSeller').textContent = `by ${p.seller}`;
    $('#qvTitle').textContent = p.title;
    $('#qvRating').innerHTML = `${stars(p.rating)} <span>(${p.reviews} reviews)</span>`;
    $('#qvPrice').innerHTML = `<strong>${money(p.price)}</strong>${p.oldPrice ? ` <del>${money(p.oldPrice)}</del>` : ''}`;
    $('#qvQty').textContent = 1;
    openModal($('#quickViewModal'));
  }

  $('#qvMinus').addEventListener('click', () => {
    state.qvQty = Math.max(1, state.qvQty - 1);
    $('#qvQty').textContent = state.qvQty;
  });
  $('#qvPlus').addEventListener('click', () => {
    state.qvQty = Math.min(MAX_QTY, state.qvQty + 1);
    $('#qvQty').textContent = state.qvQty;
  });
  $('#qvAddBtn').addEventListener('click', () => {
    addToCart(state.qvId, state.qvQty);
    closeAll();
  });

  /* =======================================================
     AUTH (demo only: stored in localStorage)
     ======================================================= */
  const accountBtn = $('#accountBtn');

  function updateAccountUI() {
    $('.header-action__label', accountBtn).textContent =
      state.user ? state.user.name.split(' ')[0] : 'Account';
  }

  function loginUser(user) {
    state.user = { name: user.name, email: user.email, phone: user.phone, seller: user.seller };
    store.set('soko_user', state.user);
    updateAccountUI();
  }

  function setAuthTab(tab) {
    $$('.auth-tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    $('#loginForm').hidden = tab !== 'login';
    $('#registerForm').hidden = tab !== 'register';
  }

  accountBtn.addEventListener('click', () => {
    if (state.user) {
      if (confirm(`Log out ${state.user.name}?`)) {
        state.user = null;
        store.set('soko_user', null);
        updateAccountUI();
        toast('You have been logged out');
      }
      return;
    }
    setAuthTab('login');
    openModal($('#authModal'));
  });

  $$('.auth-tab').forEach((t) => t.addEventListener('click', () => setAuthTab(t.dataset.tab)));

  $('#becomeSellerBtn').addEventListener('click', (e) => {
    e.preventDefault();
    setAuthTab('register');
    $('#regSeller').checked = true;
    openModal($('#authModal'));
  });

  $('#loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = $('#loginEmail').value.trim().toLowerCase();
    const password = $('#loginPassword').value;
    const user = store.get('soko_users', []).find((u) => u.email === email && u.password === password);
    if (!user) return toast('Wrong email or password', 'error');
    loginUser(user);
    e.target.reset();
    closeAll();
           toast(`Welcome back, ${user.name.split(' ')[0]}!`, 'success');
       if (new URLSearchParams(location.search).get('next') === 'seller') location.href = 'seller.html';
  });

  $('#registerForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const user = {
      name: $('#regName').value.trim(),
      email: $('#regEmail').value.trim().toLowerCase(),
      phone: $('#regPhone').value.trim(),
      password: $('#regPassword').value,
      seller: $('#regSeller').checked
    };
    if (!validPhone(user.phone)) return toast('Enter a valid Kenyan phone number', 'error');
    const users = store.get('soko_users', []);
    if (users.some((u) => u.email === user.email)) return toast('That email is already registered', 'error');
    users.push(user);
    store.set('soko_users', users);
    loginUser(user);
    e.target.reset();
    closeAll();
           toast(`Account created. Welcome, ${user.name.split(' ')[0]}!`, 'success');
       if (user.seller) location.href = 'seller.html';
  });

  /* =======================================================
     CHECKOUT
     ======================================================= */
  function openCheckout() {
    if (!state.cart.length) return toast('Your cart is empty', 'error');
    closeAll();

    const { subtotal, delivery, total } = totals();
    $('#summaryList').innerHTML = state.cart.map((i) => {
      const p = findProduct(i.id);
      return `<li><span>${i.qty} × ${p.title}</span><span>${money(p.price * i.qty)}</span></li>`;
    }).join('');
    $('#sumSubtotal').textContent = money(subtotal);
    $('#sumDelivery').textContent = delivery === 0 ? 'Free' : money(delivery);
    $('#sumTotal').textContent = money(total);

    if (state.user) {
      if (!$('#coName').value) $('#coName').value = state.user.name;
      if (!$('#coEmail').value) $('#coEmail').value = state.user.email;
      if (!$('#coPhone').value) $('#coPhone').value = state.user.phone;
    }
    openModal($('#checkoutModal'));
  }

  $('#checkoutBtn').addEventListener('click', openCheckout);
  $('#coPhone').addEventListener('input', (e) => e.target.classList.remove('invalid'));

  $('#checkoutForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const phone = $('#coPhone');
    if (!validPhone(phone.value)) {
      phone.classList.add('invalid');
      phone.focus();
      return toast('Enter a valid Kenyan phone number', 'error');
    }
           // Stock check for products added by sellers
       const sellerProducts = store.get('soko_seller_products', []);
       for (const i of state.cart) {
         const sp = sellerProducts.find((x) => x.id === i.id);
         if (sp && typeof sp.stock === 'number' && i.qty > sp.stock) {
           return toast(sp.stock === 0 ? `${sp.title} is out of stock` : `Only ${sp.stock} left of ${sp.title}`, 'error');
         }
       }

    const { subtotal, delivery, total } = totals();
    const order = {
      id: 'SK' + Date.now().toString().slice(-8),
      date: new Date().toISOString(),
      status: 'Processing',
      payment: $('input[name="payment"]:checked').value,
      customer: {
        name: $('#coName').value.trim(),
        phone: phone.value.trim(),
        email: $('#coEmail').value.trim(),
        county: $('#coCounty').value,
        town: $('#coTown').value.trim(),
        address: $('#coAddress').value.trim()
      },
      items: state.cart.map((i) => {
        const p = findProduct(i.id);
        return { id: p.id, title: p.title, seller: p.seller, price: p.price, qty: i.qty };
      }),
      subtotal, delivery, total
    };

    const orders = store.get('soko_orders', []);
    orders.push(order);
    store.set('soko_orders', orders);

       // Take the bought quantities off the sellers' stock
       const allSeller = store.get('soko_seller_products', []);
       order.items.forEach((it) => {
         const sp = allSeller.find((x) => x.id === it.id);
         if (sp && typeof sp.stock === 'number') sp.stock = Math.max(0, sp.stock - it.qty);
       });
       store.set('soko_seller_products', allSeller);

    state.cart = [];
    saveCart();
    e.target.reset();
    closeAll();
    toast(`Order ${order.id} placed! Total: ${money(total)}`, 'success');
  });

  /* =======================================================
     SEARCH / SORT / LOAD MORE / WISHLIST VIEW
     ======================================================= */
  function scrollToProducts() {
    $('#featured').scrollIntoView({ behavior: 'smooth' });
  }

  $('#searchForm').addEventListener('submit', (e) => {
    e.preventDefault();
    state.search = $('#searchInput').value.trim();
    state.filter = $('#searchCategory').value;
    state.wishlistOnly = false;
    state.visible = PAGE_SIZE;
    syncFilterTabs();
    renderProducts();
    scrollToProducts();
  });

  let searchTimer;
  $('#searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value.trim();
      state.visible = PAGE_SIZE;
      renderProducts();
    }, 250);
  });

  $('#sortSelect').addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderProducts();
  });

  loadMoreBtn.addEventListener('click', () => {
    state.visible += PAGE_SIZE;
    renderProducts();
  });

  $('#wishlistBtn').addEventListener('click', () => {
    if (!state.wishlist.length) {
      return toast('Your wishlist is empty. Tap the ♡ on any product.');
    }
    state.wishlistOnly = true;
    state.visible = PAGE_SIZE;
    syncFilterTabs();
    renderProducts();
    scrollToProducts();
    toast('Showing your wishlist. Pick a category to go back.');
  });

  $('#cartBtn').addEventListener('click', openDrawer);

  /* =======================================================
     GLOBAL CLICK HANDLER (event delegation)
     ======================================================= */
  document.addEventListener('click', (e) => {
    const t = e.target;

    // Add to cart
    const addBtn = t.closest('.add-to-cart');
    if (addBtn) return addToCart(addBtn.closest('.product-card').dataset.id);

    // Wishlist heart
    const wishBtn = t.closest('.wish-btn');
    if (wishBtn) return toggleWishlist(wishBtn.closest('.product-card').dataset.id);

    // Quick view (button, product image or title)
       const qvTrigger = t.closest('button.quick-view');
    if (qvTrigger) return openQuickView(qvTrigger.closest('.product-card').dataset.id);

    // Cart item controls
    const qtyBtn = t.closest('.cart-item .qty__btn');
    if (qtyBtn) {
      const id = qtyBtn.closest('.cart-item').dataset.id;
      return changeQty(id, qtyBtn.dataset.action === 'increase' ? 1 : -1);
    }
    if (t.closest('.cart-item__remove')) {
      return removeFromCart(t.closest('.cart-item').dataset.id);
    }

    // Category filters (tabs, category cards, nav links)
    const filterEl = t.closest('[data-filter]');
    if (filterEl) setFilter(filterEl.dataset.filter);

    // Close buttons, overlay and modal backdrop
    if (t.closest('[data-close]') || t === overlay || t.classList.contains('modal')) closeAll();

    // Not built yet
    if (t.closest('a[href="#track"]')) {
      e.preventDefault();
      toast('Order tracking is coming soon');
    }

    // Close mobile menu after picking a link
    if (t.closest('#mainNav a')) {
      $('#mainNav').classList.remove('open');
      $('#menuToggle').classList.remove('open');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAll();
  });

  /* =======================================================
     MOBILE MENU, BACK TO TOP, NEWSLETTER
     ======================================================= */
  $('#menuToggle').addEventListener('click', (e) => {
    const open = $('#mainNav').classList.toggle('open');
    e.currentTarget.classList.toggle('open', open);
    e.currentTarget.setAttribute('aria-expanded', open);
  });

  const backToTop = $('#backToTop');
  window.addEventListener('scroll', () => {
    backToTop.classList.toggle('show', window.scrollY > 600);
  }, { passive: true });

  $('#newsletterForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const list = store.get('soko_newsletter', []);
    list.push($('#newsletterEmail').value.trim());
    store.set('soko_newsletter', list);
    e.target.reset();
    toast('Thanks for subscribing!', 'success');
  });

  /* =======================================================
     FLASH SALE COUNTDOWN (counts down to midnight)
     ======================================================= */
  function tickCountdown() {
    const now = new Date();
    const end = new Date(now);
    end.setHours(24, 0, 0, 0);
    const diff = Math.max(0, Math.floor((end - now) / 1000));
    const pad = (n) => String(n).padStart(2, '0');
    $('#cdHours').textContent = pad(Math.floor(diff / 3600));
    $('#cdMinutes').textContent = pad(Math.floor((diff % 3600) / 60));
    $('#cdSeconds').textContent = pad(diff % 60);
  }

  /* =======================================================
     INIT
     ======================================================= */
  renderFlash();
  renderProducts();
  renderCart();
  updateWishCount();
  updateAccountUI();
  tickCountdown();
  setInterval(tickCountdown, 1000);
   $('#year').textContent = new Date().getFullYear();

  // Links coming from product.html (?q=, ?cat=, ?wishlist=1, ?checkout=1)
  const params = new URLSearchParams(location.search);
  if (params.get('q')) {
    state.search = params.get('q');
    $('#searchInput').value = state.search;
    renderProducts();
  }
  if (params.get('cat')) setFilter(params.get('cat'));
  if (params.get('wishlist') === '1' && state.wishlist.length) {
    state.wishlistOnly = true;
    syncFilterTabs();
    renderProducts();
  }
   if (params.get('auth') === 'login') { setAuthTab('login'); openModal($('#authModal')); }
  if (params.get('auth') === 'seller') { setAuthTab('register'); $('#regSeller').checked = true; openModal($('#authModal')); }
})();