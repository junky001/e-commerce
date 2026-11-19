/* =========================================================
   SOKO | track.js   (needs products.js + order-utils.js)
   Order tracking. A shopper needs the order number AND the
   phone number used at checkout (or to be logged in as the
   person who placed the order).
   ========================================================= */
(() => {
  'use strict';

  const { money, esc, fmtDate, fmtDateTime, statusClass } = SokoOrders;
  const $ = (sel, root = document) => root.querySelector(sel);
  const VERIFIED_KEY = 'soko_track_ok';   // orders already unlocked in this browser tab

  const fallbackImg = () => (typeof FALLBACK_IMG !== 'undefined' ? FALLBACK_IMG : '');
  const imageFor = (id) => {
    const p = PRODUCTS.find((x) => x.id === id);
    return p ? p.image : fallbackImg();
  };

  const verified = () => { try { return JSON.parse(sessionStorage.getItem(VERIFIED_KEY) || '[]'); } catch { return []; } };
  const markVerified = (id) => {
    try { sessionStorage.setItem(VERIFIED_KEY, JSON.stringify([...new Set([...verified(), id])])); } catch { /* ignore */ }
  };

  /* =======================================================
     RESULT VIEW
     ======================================================= */
  function stepsHTML(order, status) {
    const idx = { Processing: 1, Shipped: 2, Delivered: 3 }[status];
    const steps = [
      { label: 'Order placed', date: order.date },
      { label: 'Processing', date: null },
      { label: 'Shipped', date: SokoOrders.stepDate(order, 'Shipped') },
      { label: 'Delivered', date: SokoOrders.stepDate(order, 'Delivered') }
    ];
    return `<ol class="steps">${steps.map((s, i) => {
      const cls = status === 'Delivered' || i < idx ? 'done' : i === idx ? 'current' : '';
      const dot = cls === 'done' ? '✓' : cls === 'current' ? '●' : i + 1;
      return `<li class="${cls}"><span class="steps__dot">${dot}</span><div><strong>${s.label}</strong><small>${s.date ? fmtDateTime(s.date) : ''}</small></div></li>`;
    }).join('')}</ol>`;
  }

  function activityHTML(order) {
    const lines = [{ at: order.date, text: 'Order placed' }];
    (order.history || []).forEach((h) => {
      const who = h.seller;
      const text = h.status === 'Shipped' ? `${who} shipped their items`
        : h.status === 'Delivered' ? `${who} items delivered`
        : h.status === 'Cancelled' ? `${who} part cancelled${h.by && h.by !== 'seller' ? ` (by ${h.by})` : ''}`
        : `${who}: ${h.status}`;
      lines.push({ at: h.at, text });
    });
    lines.sort((a, b) => new Date(b.at) - new Date(a.at));
    return `<ul class="activity">${lines.map((l) => `<li><time>${fmtDateTime(l.at)}</time><span>${esc(l.text)}</span></li>`).join('')}</ul>`;
  }

  function showOrder(order) {
    const status = SokoOrders.overall(order);
    const parcels = SokoOrders.parcels(order);
    const c = order.customer || {};
    const payment = { mpesa: 'M-Pesa', card: 'Card', cod: 'Pay on delivery' }[order.payment] || order.payment;
    const partial = status === 'Shipped' && parcels.some((p) => p.status === 'Processing');

    $('#result').innerHTML = `
      <div class="track-wrap">
        <div class="card">
          <div class="track-head">
            <div>
              <h2>Order #${esc(order.id)}</h2>
              <p>Placed ${fmtDateTime(order.date)} · ${esc(payment)} · ${money(order.total)}</p>
            </div>
            <span class="badge-pill badge-pill--${statusClass(status)}">${status}</span>
          </div>
          ${status === 'Cancelled'
            ? '<div class="banner banner--bad"><span>⛔</span><p><strong>This order was cancelled.</strong></p></div>'
            : stepsHTML(order, status)}
          ${partial ? '<div class="banner banner--info"><span>📦</span><p>Your order is on its way in more than one parcel. Some items are still being prepared by their sellers.</p></div>' : ''}
        </div>

        <div class="card">
          <h3>Your parcels</h3>
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

        <div class="two-col">
          <div class="card">
            <h3>Delivery details</h3>
            <p><strong>${esc(c.name)}</strong></p>
            <p>${esc(c.phone)}</p>
            <p>${esc([c.address, c.town, c.county].filter(Boolean).join(', '))}</p>
            <div class="order__totals">
              <div><span>Subtotal</span><span>${money(order.subtotal)}</span></div>
              <div><span>Delivery</span><span>${order.delivery ? money(order.delivery) : 'Free'}</span></div>
              <div class="net"><span>Total</span><span>${money(order.total)}</span></div>
            </div>
          </div>
          <div class="card">
            <h3>Activity</h3>
            ${activityHTML(order)}
          </div>
        </div>

        <div class="gate__actions">
          <button class="btn btn--outline" id="trackAnother">Track another order</button>
          <a class="btn btn--primary" href="orders.html">My orders</a>
        </div>
      </div>`;

    $('#lookup').hidden = true;
    $('#result').hidden = false;
    try { history.replaceState(null, '', `track.html?id=${encodeURIComponent(order.id)}`); } catch { /* file:// */ }
    document.title = `Order #${order.id} | Soko`;
    window.scrollTo({ top: 0 });
  }

  function showLookup(prefillId = '') {
    $('#result').hidden = true;
    $('#lookup').hidden = false;
    $('#trId').value = prefillId;
    $('#trPhone').value = '';
    $('#trError').hidden = true;
    try { history.replaceState(null, '', 'track.html'); } catch { /* file:// */ }
    document.title = 'Track Order | Soko';
    (prefillId ? $('#trPhone') : $('#trId')).focus();
  }

  /* =======================================================
     EVENTS
     ======================================================= */
  $('#trackForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const order = SokoOrders.find($('#trId').value);
    const err = $('#trError');
    // One message for every kind of miss, so nobody can probe which order numbers exist
    if (!order || !SokoOrders.phoneMatches(order, $('#trPhone').value)) {
      err.textContent = "We couldn't find an order with those details. Check the order number and the phone number you used at checkout.";
      err.hidden = false;
      return;
    }
    markVerified(order.id);
    showOrder(order);
  });

  document.addEventListener('click', (e) => {
    if (e.target.closest('#trackAnother')) showLookup();
  });

  /* =======================================================
     INIT: open straight away if the person already has the right to see it
     ======================================================= */
  const wanted = new URLSearchParams(location.search).get('id');
  if (wanted) {
    const order = SokoOrders.find(wanted);
    const user = SokoOrders.read('soko_user', null);
    if (order && ((user && SokoOrders.belongsTo(order, user.email)) || verified().includes(order.id))) {
      showOrder(order);
    } else {
      showLookup(wanted);
    }
  }
})();