/* =========================================================
   SOKO | product.js   (needs products.js loaded first)
   Product detail page: product.html?id=201
   Shares the same localStorage keys as script.js.
   ========================================================= */
(() => {
  'use strict';

  /* ---------- Config ---------- */
  const MAX_QTY = 10;
  const FREE_SHIPPING_MIN = 3000;
  const DELIVERY_FEE = 250;
  const CATEGORY_NAMES = {
    electronics: 'Electronics', fashion: 'Fashion', home: 'Home & Living',
    beauty: 'Beauty', sports: 'Sports'
  };
  // Demo reviews shown on every product until real reviews exist
  const SAMPLE_REVIEWS = [
    { name: 'Wanjiru K.', rating: 5, text: 'Exactly as described and it arrived quickly. Very happy with it.', date: '2026-10-02' },
    { name: 'Brian O.', rating: 4, text: 'Good quality for the price. Packaging could be better but the item is great.', date: '2026-09-18' },
    { name: 'Amina S.', rating: 4, text: 'The seller responded fast and delivery was smooth. Would buy again.', date: '2026-08-29' }
  ];

  /* ---------- Helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const money = (n) => 'KSh ' + Number(n).toLocaleString('en-KE');
  const stars = (r) => '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r));
  const findProduct = (id) => PRODUCTS.find((p) => p.id === Number(id));
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
  const product = findProduct(new URLSearchParams(location.search).get('id'));
  const state = {
    cart: store.get('soko_cart', []).filter((i) => findProduct(i.id)),
    wishlist: store.get('soko_wishlist', []),
    user: store.get('soko_user', null),
    qty: 1
  };

  const overlay = $('#overlay');
  const drawer = $('#cartDrawer');
  const toastEl = $('#toast');

  /* =======================================================
     TOAST + DRAWER
     ======================================================= */
  let toastTimer;
  function toast(message, type = '') {
    toastEl.textContent = message;
    toastEl.className = `toast show ${type}`.trim();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3200);
  }

  function openDrawer() {
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden', 'false');
    overlay.classList.add('show');
    document.body.classList.add('no-scroll');
  }
  function closeDrawer() {
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden', 'true');
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

  function addToCart(id, qty = 1, silent = false) {
    id = Number(id);
    const item = state.cart.find((i) => i.id === id);
    if (item) item.qty = Math.min(MAX_QTY, item.qty + qty);
    else state.cart.push({ id, qty: Math.min(MAX_QTY, qty) });
    saveCart();
    if (!silent) toast(`${findProduct(id).title} added to cart`, 'success');
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

  function syncWishButtons() {
    if (product) {
      const on = state.wishlist.includes(product.id);
      const btn = $('#pdWish');
      btn.classList.toggle('active', on);
      btn.textContent = on ? '♥' : '♡';
      btn.setAttribute('aria-pressed', on);
    }
    $$('#relatedGrid .product-card').forEach((card) => {
      const on = state.wishlist.includes(Number(card.dataset.id));
      const btn = $('.wish-btn', card);
      btn.classList.toggle('active', on);
      btn.textContent = on ? '♥' : '♡';
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
  }

  /* =======================================================
     PRODUCT RENDERING
     ======================================================= */
  function renderProduct(p) {
    const categoryName = CATEGORY_NAMES[p.category] || 'Products';
    const discount = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    const images = p.images && p.images.length ? p.images : [p.image];
    const description = p.description ||
      `${p.title} from ${p.seller}. Every item is checked before dispatch and is covered by our 7-day return policy.`;

    document.title = `${p.title} | Soko`;
    $('meta[name="description"]').content = `Buy ${p.title} from ${p.seller} on Soko.`;

    // Breadcrumb
    $('#bcCategory').textContent = categoryName;
    
$('#bcCategory').href = `shop.html?cat=${p.category}`;
    $('#bcTitle').textContent = p.title;

    // Gallery
    const mainImg = $('#pdImage');
    mainImg.src = images[0];
    mainImg.alt = p.title;
    $('#pdThumbs').innerHTML = images.length > 1
      ? images.map((src, i) => `
          <button class="pd__thumb ${i === 0 ? 'active' : ''}" data-src="${esc(src)}" aria-label="View image ${i + 1}">
            <img src="${esc(src)}" alt="" />
          </button>`).join('')
      : '';
    if (discount) {
      $('#pdTag').textContent = `-${discount}%`;
      $('#pdTag').hidden = false;
    }

    // Info
    $('#pdSeller').textContent = `by ${p.seller}`;
    $('#pdTitle').textContent = p.title;
    $('#pdRating').innerHTML = `${stars(p.rating)} <span>${p.rating} (${p.reviews} reviews)</span>`;
    $('#pdPrice').innerHTML = `<strong>${money(p.price)}</strong>${p.oldPrice ? ` <del>${money(p.oldPrice)}</del>` : ''}`;
    if (discount) {
      $('#pdSave').textContent = `Save ${money(p.oldPrice - p.price)}`;
      $('#pdSave').hidden = false;
    }
    $('#pdShort').textContent = description.length > 160 ? description.slice(0, 157) + '…' : description;

    // Stock (optional "stock" field in products.js)
    const stockEl = $('#pdStock');
    if (p.stock === 0) {
      stockEl.textContent = 'Out of stock';
      stockEl.className = 'pd__stock out';
      ['#pdAddBtn', '#pdBuyBtn', '#pdMinus', '#pdPlus'].forEach((s) => { $(s).disabled = true; });
    } else if (p.stock && p.stock <= 5) {
      stockEl.textContent = `Only ${p.stock} left in stock`;
      stockEl.className = 'pd__stock low';
    } else {
      stockEl.textContent = '✓ In stock';
      stockEl.className = 'pd__stock';
    }

    // Delivery perk
    $('#pdDeliveryTitle').textContent = p.price >= FREE_SHIPPING_MIN ? 'Free delivery' : `Delivery from ${money(DELIVERY_FEE)}`;
    $('#pdDeliveryText').textContent = `Free on orders above ${money(FREE_SHIPPING_MIN)}`;

    // Tabs
    $('#pdDescription').textContent = description;
    const specs = {
      Seller: p.seller,
      Category: categoryName,
      'Product code': `SK-${p.id}`,
      Condition: 'New',
      ...(p.specs || {})
    };
    $('#pdSpecs').innerHTML = Object.entries(specs)
      .map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');

    // Seller box
    $('#sellerLogo').src = `https://placehold.co/96x96?text=${encodeURIComponent(p.seller.split(' ').map((w) => w[0]).join('').slice(0, 2))}`;
    $('#sellerLogo').alt = '';
    $('#sellerName').textContent = p.seller;
    const sellerProducts = PRODUCTS.filter((x) => x.seller === p.seller);
    const sellerAvg = sellerProducts.reduce((s, x) => s + x.rating, 0) / sellerProducts.length;
    $('#sellerRating').innerHTML = `${stars(sellerAvg)} <span>${sellerAvg.toFixed(1)} · ${sellerProducts.length} products</span>`;

    renderReviews();
    renderRelated(p);
  }

  function renderReviews() {
    const userReviews = store.get('soko_reviews', {})[product.id] || [];
    const all = [...userReviews, ...SAMPLE_REVIEWS];

    $('#rvScore').textContent = product.rating.toFixed(1);
    $('#rvStars').textContent = stars(product.rating);
    $('#rvCount').textContent = `${product.reviews + userReviews.length} reviews`;

    $('#reviewList').innerHTML = all.map((r, i) => `
      <li class="review">
        <div class="review__head">
          <strong>${esc(r.name)}</strong>
          <span class="rating">${stars(r.rating)}</span>
          <small>${new Date(r.date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</small>
          ${i >= userReviews.length ? '<span class="review__tag">Sample</span>' : ''}
        </div>
        <p>${esc(r.text)}</p>
      </li>`).join('');
  }

  function renderRelated(p) {
    let list = PRODUCTS.filter((x) => x.category === p.category && x.id !== p.id);
    if (list.length < 4) {
      list = list.concat(PRODUCTS.filter((x) => x.category !== p.category && x.id !== p.id));
    }
    $('#relatedGrid').innerHTML = list.slice(0, 4).map((x) => {
      const wished = state.wishlist.includes(x.id);
      const disc = x.oldPrice ? Math.round((1 - x.price / x.oldPrice) * 100) : 0;
      return `
        <article class="product-card" data-id="${x.id}">
          ${disc ? `<span class="product-card__tag">-${disc}%</span>` : ''}
          <button class="wish-btn ${wished ? 'active' : ''}" aria-label="Toggle wishlist">${wished ? '♥' : '♡'}</button>
          <a class="product-card__img" href="product.html?id=${x.id}"><img src="${x.image}" alt="${esc(x.title)}" loading="lazy" /></a>
          <div class="product-card__body">
            <p class="product-card__seller">by ${esc(x.seller)}</p>
            <h3 class="product-card__title"><a href="product.html?id=${x.id}">${esc(x.title)}</a></h3>
            <div class="rating">${stars(x.rating)} <span>(${x.reviews})</span></div>
            <p class="price"><strong>${money(x.price)}</strong>${x.oldPrice ? ` <del>${money(x.oldPrice)}</del>` : ''}</p>
            <button class="btn btn--primary btn--block add-to-cart">Add to Cart</button>
          </div>
        </article>`;
    }).join('');
  }

  /* =======================================================
     EVENTS
     ======================================================= */
  function bindProductEvents() {
    const maxQty = () => Math.min(MAX_QTY, product.stock || MAX_QTY);

    $('#pdMinus').addEventListener('click', () => {
      state.qty = Math.max(1, state.qty - 1);
      $('#pdQty').textContent = state.qty;
    });
    $('#pdPlus').addEventListener('click', () => {
      state.qty = Math.min(maxQty(), state.qty + 1);
      $('#pdQty').textContent = state.qty;
    });

    $('#pdAddBtn').addEventListener('click', () => addToCart(product.id, state.qty));
    $('#pdBuyBtn').addEventListener('click', () => {
      addToCart(product.id, state.qty, true);
      location.href = 'index.html?checkout=1';
    });
    $('#pdWish').addEventListener('click', () => toggleWishlist(product.id));

    $('#pdShare').addEventListener('click', async () => {
      const data = { title: product.title, text: `${product.title} on Soko`, url: location.href };
      try {
        if (navigator.share) await navigator.share(data);
        else {
          await navigator.clipboard.writeText(location.href);
          toast('Link copied to clipboard', 'success');
        }
      } catch { /* user cancelled the share sheet, or clipboard is blocked */ }
    });

    // Thumbnails
    $('#pdThumbs').addEventListener('click', (e) => {
      const thumb = e.target.closest('.pd__thumb');
      if (!thumb) return;
      $('#pdImage').src = thumb.dataset.src;
      $$('.pd__thumb').forEach((t) => t.classList.toggle('active', t === thumb));
    });

    // Hover zoom (desktop only)
    const wrap = $('#pdMainWrap');
    const img = $('#pdImage');
    if (window.matchMedia('(hover: hover)').matches) {
      wrap.addEventListener('mouseenter', () => wrap.classList.add('zoom'));
      wrap.addEventListener('mouseleave', () => { wrap.classList.remove('zoom'); img.style.transformOrigin = ''; });
      wrap.addEventListener('mousemove', (e) => {
        const r = wrap.getBoundingClientRect();
        img.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
      });
    }

    // Tabs
    $$('.pd-tabs__tab').forEach((tab) => tab.addEventListener('click', () => {
      $$('.pd-tabs__tab').forEach((t) => t.classList.toggle('active', t === tab));
      $$('.pd-tabs__panel').forEach((p) => { p.hidden = p.id !== `tab-${tab.dataset.tab}`; });
    }));

    // Review form
    if (state.user) $('#rvName').value = state.user.name;
    $('#reviewForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const all = store.get('soko_reviews', {});
      all[product.id] = all[product.id] || [];
      all[product.id].unshift({
        name: $('#rvName').value.trim(),
        rating: Number($('#rvRating').value),
        text: $('#rvText').value.trim(),
        date: new Date().toISOString()
      });
      store.set('soko_reviews', all);
      $('#rvText').value = '';
      renderReviews();
      toast('Thanks for your review!', 'success');
    });
  }

  function bindGlobalEvents() {
    $('#cartBtn').addEventListener('click', openDrawer);
    $('#checkoutBtn').addEventListener('click', () => {
         if (state.cart.length) location.href = 'index.html?checkout=1';
    });

    $('#wishlistBtn').addEventListener('click', () => {
      if (!state.wishlist.length) return toast('Your wishlist is empty. Tap the ♡ on any product.');
     
    location.href = 'shop.html?wishlist=1';
    });

    $('#accountBtn').addEventListener('click', () => { location.href = 'index.html'; });
    if (state.user) $('.header-action__label', $('#accountBtn')).textContent = state.user.name.split(' ')[0];

    $('#searchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = $('#searchInput').value.trim();
     location.href = `shop.html${q ? `?q=${encodeURIComponent(q)}` : ''}`;
    });

    document.addEventListener('click', (e) => {
      const t = e.target;

      // Related cards
      const addBtn = t.closest('.product-card .add-to-cart');
      if (addBtn) return addToCart(addBtn.closest('.product-card').dataset.id);
      const wishBtn = t.closest('.product-card .wish-btn');
      if (wishBtn) return toggleWishlist(wishBtn.closest('.product-card').dataset.id);

      // Cart drawer controls
      const qtyBtn = t.closest('.cart-item .qty__btn');
      if (qtyBtn) {
        return changeQty(qtyBtn.closest('.cart-item').dataset.id, qtyBtn.dataset.action === 'increase' ? 1 : -1);
      }
      if (t.closest('.cart-item__remove')) return removeFromCart(t.closest('.cart-item').dataset.id);

      if (t.closest('[data-close]') || t === overlay) closeDrawer();
    });

    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  }

  /* =======================================================
     INIT
     ======================================================= */
  renderCart();
  updateWishCount();
  bindGlobalEvents();
  $('#year').textContent = new Date().getFullYear();

  if (!product) {
    $('#pdPage').hidden = true;
    $('#notFound').hidden = false;
    document.title = 'Product not found | Soko';
    return;
  }

  renderProduct(product);
  syncWishButtons();
  bindProductEvents();
})();