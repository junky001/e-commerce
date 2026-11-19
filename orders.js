/* =========================================================
   SOKO | orders.js   (needs products.js + order-utils.js)
   "My Orders": the logged-in shopper's order history.
   ========================================================= */
(() => {
  'use strict';

  const { money, esc, fmtDate, fmtDateTime, statusClass } = SokoOrders;
  const $ = (sel, root = document) => root.querySelector(sel);
  const MAX_QTY = 10;

  let user = null;

  const toastEl = $('#toast');
  let toastTimer;
  function toast(message, type = '') {
    toastEl.textContent = message;
    toastEl.className = `toast show ${type}`.trim();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3500);
  }

  const fallbackImg = () => (typeof FALLBACK_IMG !== 'undefined' ? FALLBACK_IMG : '');
  const imageFor = (id) => {
    const p = PRODUCTS.find((x) => x.id === id);
    return p ? p.image : fallbackImg();
  };

  function currentUser() {
    const u = SokoOrders.read('soko_user', null);
    return u && u.email ? u : null;
  }

  function myOrders() {
    return SokoOrders.all()
      .filter((o) => SokoOrders.belongsTo(o, user.email))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  /* =======================================================
     RENDER
     ======================================================= */
  function render() {
    user = currentUser();
    $('#logoutBtn').hidden = !user;
    $('#gate').hidden = !!user;
    $('#ordersPage').hidden = !user;
    if (!user) return;
    $('#whoami').textContent = `Signed in as ${user.email}`;
    renderList();
  }

  function renderList() {
    const q = $('#oSearch').value.trim().toLowerCase();
    const filter = $('#oFilter').value;
    const all = myOrders();

    const list = all.filter((o) => {
      const status = SokoOrders.overall(o);
      if (filter === 'progress' && !(status === 'Processing' || status === 'Shipped')) return false;
      if ((filter === 'Delivered' || filter === 'Cancelled') && status !== filter) return false;
      if (q) {
        const hay = `${o.id} ${(o.items || []).map((i) => i.title).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const empty = $('#ordersEmpty');
    empty.hidden = list.length > 0;
    if (!list.length) {
      empty.innerHTML = all.length
        ? '<h3>No orders match</h3><p>Try a different search or filter.</p>'
        : '<h3>No orders yet</h3><p>When you place an order it will show up here.</p><a class="btn btn--primary" href="shop.html">Start shopping</a>';
    }

    $('#ordersList').innerHTML = list.map((o) => {
      const status = SokoOrders.overall(o);
      const c = o.customer || {};
      const payment = { mpesa: 'M-Pesa', card: 'Card', cod: 'Pay on delivery' }[o.payment] || o.payment;
      const parcels = SokoOrders.parcels(o);
      return `
        <article class="order" data-order="${esc(o.id)}">
          <div class="order__head">
            <div><strong>Order #${esc(o.id)}</strong><small>${fmtDateTime(o.date)} · ${esc(payment)}</small></div>
            <div class="order__status">
              <span class="badge-pill badge-pill--${statusClass(status)}">${status}</span>
              <span class="order__total">${money(o.total)}</span>
            </div>
          </div>
          <div class="order__body">
            <div>
              <h4>Items</h4>
              ${parcels.map((p) => `
                <div class="parcel">
                  <div class="parcel__head">
                    <span>Sold by <strong>${esc(p.seller)}</strong></span>
                    <span class="badge-pill badge-pill--${statusClass(p.status)}">${p.status}</span>
                  </div>
                  ${p.items.map((i) => `
                    <div class="item-line">
                      <img src="${esc(imageFor(i.id))}" alt="" />
                      <span>${esc(i.title)}<small>${i.qty} × ${money(i.price)}</small></span>
                      <span>${money(i.price * i.qty)}</span>
                    </div>`).join('')}
                </div>`).join('')}
            </div>
            <div class="side-lines">
              <h4>Delivery</h4>
              <p><strong>${esc(c.name)}</strong></p>
              <p>${esc([c.address, c.town, c.county].filter(Boolean).join(', '))}</p>
              <div class="order__totals">
                <div><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
                <div><span>Delivery</span><span>${o.delivery ? money(o.delivery) : 'Free'}</span></div>
                <div class="net"><span>Total</span><span>${money(o.total)}</span></div>
              </div>
            </div>
          </div>
          <div class="order__foot">
            ${SokoOrders.canCancel(o) ? '<button class="btn btn--ghost btn--sm" data-action="cancel">Cancel order</button>' : ''}
            <button class="btn btn--outline btn--sm" data-action="again">Buy again</button>
            <a class="btn btn--primary btn--sm" href="track.html?id=${encodeURIComponent(o.id)}">Track order</a>
          </div>
        </article>`;
    }).join('');
  }

  /* =======================================================
     ACTIONS
     ======================================================= */
  function buyAgain(id) {
    const order = SokoOrders.find(id);
    if (!order) return;
    const cart = SokoOrders.read('soko_cart', []);
    let added = 0;
    let skipped = 0;
    (order.items || []).forEach((it) => {
      const p = PRODUCTS.find((x) => x.id === it.id);
      if (!p || p.stock === 0) { skipped++; return; }
      const cap = Math.min(MAX_QTY, typeof p.stock === 'number' ? p.stock : MAX_QTY);
      const line = cart.find((c) => c.id === it.id);
      const qty = Math.min(cap, (line ? line.qty : 0) + it.qty);
      if (line) line.qty = qty; else cart.push({ id: it.id, qty });
      added++;
    });
    if (!added) return toast('Sorry, none of these items are available right now.', 'error');
    SokoOrders.write('soko_cart', cart);
    toast(skipped ? `${added} item${added === 1 ? '' : 's'} added. ${skipped} no longer available.` : 'Items added to your cart', 'success');
    setTimeout(() => { location.href = 'index.html?checkout=1'; }, 900);
  }

  $('#ordersList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const id = btn.closest('.order').dataset.order;

    if (btn.dataset.action === 'again') return buyAgain(id);
    if (btn.dataset.action === 'cancel') {
      if (!confirm('Cancel this order? This can\'t be undone.')) return;
      if (SokoOrders.cancel(id, 'customer')) {
        renderList();
        toast(`Order #${id} cancelled`, 'success');
      } else {
        renderList();
        toast('This order can no longer be cancelled because it has already shipped.', 'error');
      }
    }
  });

  $('#oSearch').addEventListener('input', renderList);
  $('#oFilter').addEventListener('change', renderList);
  $('#logoutBtn').addEventListener('click', () => {
    SokoOrders.write('soko_user', null);
    render();
    toast('You have been logged out');
  });
  // Refresh when a seller or admin updates an order in another tab
  window.addEventListener('storage', () => { if (user) render(); });

  render();
})();