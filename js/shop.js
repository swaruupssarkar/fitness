/* ─── Shop ─ Affiliate products + super admin CMS ───────────── */
const Shop = (() => {
  const ADMIN_EMAIL = 'swaruupssarkar@gmail.com';
  const DEFAULT_CATEGORIES = ['Protein', 'Equipment', 'Recovery', 'Accessories'];
  const DEFAULT_PRODUCT_IMG = 'img/logo-clean.png';

  const state = {
    products: [],
    categories: [...DEFAULT_CATEGORIES],
    activeCategory: 'All',
    publicSearch: '',
    featuredIndex: 0,
    search: '',
    statusFilter: 'All',
    editingId: null,
    selectedFile: null,
  };

  function isAdmin() {
    const user = Auth.getUser();
    return !!(user && (user.email || '').toLowerCase() === ADMIN_EMAIL);
  }

  function db() { return Auth.getDb(); }
  function productsCol() { return db().collection('shop_products'); }
  function categoriesDoc() { return db().collection('shop_settings').doc('categories'); }

  function now() { return Date.now(); }
  function cleanUrl(url) { return String(url || '').trim(); }
  function cleanCategoryName(value) {
    return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 34);
  }
  function uniqueCategories(categories) {
    const seen = new Set();
    const clean = [];
    categories.forEach(cat => {
      const name = cleanCategoryName(cat);
      const key = name.toLowerCase();
      if (name && !seen.has(key)) {
        seen.add(key);
        clean.push(name);
      }
    });
    return clean;
  }
  function shopCategories() {
    const categories = uniqueCategories(state.categories);
    return categories.length ? categories : [...DEFAULT_CATEGORIES];
  }
  function defaultCategory() {
    return shopCategories()[0] || 'Protein';
  }
  function formatPriceLabel(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^₹\s*/.test(raw)) return raw.replace(/^₹\s*/, '₹');
    if (/^rs\.?\s*/i.test(raw)) return raw.replace(/^rs\.?\s*/i, '₹');
    if (/^\d+(\.\d+)?$/.test(raw)) return `₹${raw}`;
    if (raw.startsWith('$')) return `₹${raw.slice(1)}`;
    return raw;
  }
  function isHttpsUrl(url) {
    try { return new URL(url).protocol === 'https:'; }
    catch { return false; }
  }

  function normalizeProduct(p) {
    return {
      id: p.id || '',
      title: p.title || p.name || '',
      category: cleanCategoryName(p.category) || defaultCategory(),
      description: p.description || '',
      imageUrl: p.imageUrl || '',
      imagePath: p.imagePath || '',
      affiliateUrl: p.affiliateUrl || p.buyLink || '',
      priceLabel: formatPriceLabel(p.priceLabel),
      offerLabel: p.offerLabel || '',
      badgeLabel: p.badgeLabel || '',
      status: p.status === 'draft' ? 'draft' : 'published',
      featured: !!p.featured,
      sortOrder: Number.isFinite(+p.sortOrder) ? +p.sortOrder : 100,
      clickCount: Number.isFinite(+p.clickCount) ? +p.clickCount : 0,
      createdAt: p.createdAt || now(),
      updatedAt: p.updatedAt || p.createdAt || now(),
    };
  }

  function sortProducts(products) {
    return [...products].sort((a, b) => {
      if (a.featured !== b.featured) return a.featured ? -1 : 1;
      if ((a.sortOrder || 100) !== (b.sortOrder || 100)) return (a.sortOrder || 100) - (b.sortOrder || 100);
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  async function getCategories() {
    try {
      const doc = await categoriesDoc().get();
      const items = doc.exists ? uniqueCategories(doc.data().items || []) : [];
      return items.length ? items : [...DEFAULT_CATEGORIES];
    } catch (e) {
      console.warn('Shop: getCategories failed', e);
      return [...DEFAULT_CATEGORIES];
    }
  }

  async function saveCategories(categories) {
    if (!isAdmin()) throw new Error('Admin access required.');
    const clean = uniqueCategories(categories);
    if (!clean.length) throw new Error('Keep at least one category.');
    await categoriesDoc().set({ items: clean, updatedAt: now() }, { merge: true });
    state.categories = clean;
    if (state.activeCategory !== 'All' && !clean.includes(state.activeCategory)) {
      state.activeCategory = 'All';
    }
    return clean;
  }

  async function addCategory(name) {
    const clean = cleanCategoryName(name);
    if (!clean) throw new Error('Category name is required.');
    const exists = shopCategories().some(cat => cat.toLowerCase() === clean.toLowerCase());
    if (exists) throw new Error('Category already exists.');
    return saveCategories([...shopCategories(), clean]);
  }

  async function deleteCategory(name) {
    const target = cleanCategoryName(name);
    const next = shopCategories().filter(cat => cat.toLowerCase() !== target.toLowerCase());
    if (next.length === shopCategories().length) throw new Error('Category not found.');
    return saveCategories(next);
  }

  async function getProducts() {
    try {
      const col = productsCol();
      const snap = isAdmin()
        ? await col.get()
        : await col.where('status', '==', 'published').get();
      return sortProducts(snap.docs.map(d => normalizeProduct({ ...d.data(), id: d.id })));
    } catch (e) {
      console.error('Shop: getProducts failed', e);
      return [];
    }
  }

  async function saveProduct(product) {
    if (!isAdmin()) throw new Error('Admin access required.');
    const current = product.id ? state.products.find(p => p.id === product.id) : null;
    const payload = normalizeProduct({
      ...current,
      ...product,
      imagePath: '',
      createdAt: current?.createdAt || now(),
      updatedAt: now(),
    });
    const { id: _id, ...firestorePayload } = payload;

    if (product.id) {
      await productsCol().doc(product.id).set(firestorePayload, { merge: true });
      return product.id;
    }
    const doc = await productsCol().add(firestorePayload);
    return doc.id;
  }

  async function deleteProduct(id) {
    if (!isAdmin()) throw new Error('Admin access required.');
    await productsCol().doc(id).delete();
  }

  async function trackClick(id) {
    try {
      await productsCol().doc(id).set({
        clickCount: firebase.firestore.FieldValue.increment(1),
        lastClickedAt: now(),
      }, { merge: true });
    } catch (e) {
      console.warn('Shop: click tracking skipped', e);
    }
  }

  function filteredPublicProducts() {
    const q = state.publicSearch.trim().toLowerCase();
    return state.products.filter(p => {
      if (p.status !== 'published') return false;
      if (state.activeCategory !== 'All' && p.category !== state.activeCategory) return false;
      if (q) {
        const haystack = [p.title, p.category, p.description, p.priceLabel, p.offerLabel, p.badgeLabel]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }

  function filteredAdminProducts() {
    const q = state.search.trim().toLowerCase();
    return state.products.filter(p => {
      const matchesSearch = !q || [p.title, p.category, p.description].join(' ').toLowerCase().includes(q);
      const matchesStatus = state.statusFilter === 'All' || p.status === state.statusFilter.toLowerCase();
      return matchesSearch && matchesStatus;
    });
  }

  function productImage(p) {
    return p.imageUrl || DEFAULT_PRODUCT_IMG;
  }

  function icon(name) {
    const icons = {
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
      external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>',
      upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8 12 3 7 8"/><path d="M12 3v12"/></svg>',
      search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>',
      box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/></svg>',
      draft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>',
      edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
      eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
      trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
      plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
      x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    };
    return icons[name] || '';
  }

  async function render() {
    const el = document.getElementById('view-shop');
    if (!el) return;
    el.innerHTML = `<div class="shop-loading">Loading...</div>`;
    state.categories = await getCategories();
    state.products = await getProducts();
    if (state.activeCategory !== 'All' && !shopCategories().includes(state.activeCategory)) {
      state.activeCategory = 'All';
    }
    el.classList.toggle('shop-admin-view', isAdmin());
    el.innerHTML = isAdmin() ? renderAdmin() : renderPublicShop();
    bindEvents(el);
    syncPreview();
  }

  function renderPublicShop() {
    return `
      <div class="shop-shell">
        <div class="shop-disclosure">
          <span class="shop-disclosure-icon">${icon('info')}</span>
          <span>FitTrack may earn a commission on qualifying purchases through affiliate partners. This helps support the app at no extra cost to you.</span>
        </div>

        <label class="shop-public-search" for="shop-public-search">
          <span>${icon('search')}</span>
          <input type="search" id="shop-public-search" class="input" placeholder="Search protein, equipment, recovery gear..." value="${esc(state.publicSearch)}" autocomplete="off">
        </label>

        <div class="shop-category-tabs" role="tablist" aria-label="Product categories">
          ${['All', ...shopCategories()].map(cat => `
            <button class="shop-category-tab${state.activeCategory === cat ? ' active' : ''}" data-category="${esc(cat)}" type="button">${esc(cat)}</button>
          `).join('')}
        </div>

        <div id="shop-public-results">
          ${renderPublicResults()}
        </div>
      </div>`;
  }

  function renderPublicResults() {
    const products = filteredPublicProducts();
    if (state.featuredIndex >= products.length) state.featuredIndex = 0;
    if (state.featuredIndex < 0) state.featuredIndex = Math.max(products.length - 1, 0);
    const featured = products[state.featuredIndex] || null;
    const title = state.publicSearch.trim()
      ? `Search Results (${products.length})`
      : 'All Products';
    return `
      ${featured ? renderFeatured(featured) : ''}
      <div class="shop-section-title">${esc(title)}</div>
      ${products.length ? `
        <div class="shop-grid">
          ${products.map(renderProductCard).join('')}
        </div>` : renderEmptyPublic()}`;
  }

  function renderFeatured(p) {
    return `
      <section class="shop-featured" aria-label="Featured product">
        <div class="shop-section-title">Featured</div>
        <div class="shop-featured-card">
          <button class="shop-featured-arrow" type="button" data-featured-dir="-1" aria-label="Previous featured product">‹</button>
          <div class="shop-featured-media">
            <img src="${esc(productImage(p))}" alt="${esc(p.title)}" loading="lazy">
          </div>
          <div class="shop-featured-info">
            <div class="shop-card-topline">
              <h2>${esc(p.title)}</h2>
              ${p.badgeLabel ? `<span class="shop-badge">${esc(p.badgeLabel)}</span>` : ''}
            </div>
            ${p.description ? `<p>${esc(p.description)}</p>` : ''}
            <div class="shop-price-row">
              ${p.priceLabel ? `<strong>${esc(p.priceLabel)}</strong>` : ''}
              ${p.offerLabel ? `<span class="shop-offer">${esc(p.offerLabel)}</span>` : ''}
            </div>
            ${renderBuyButton(p)}
          </div>
          <button class="shop-featured-arrow" type="button" data-featured-dir="1" aria-label="Next featured product">›</button>
        </div>
      </section>`;
  }

  function renderProductCard(p) {
    return `
      <article class="shop-card${p.imageUrl ? '' : ' shop-card--no-img'}">
        <div class="shop-card-media">
          ${p.badgeLabel ? `<span class="shop-badge">${esc(p.badgeLabel)}</span>` : ''}
          <img class="shop-card-img" src="${esc(productImage(p))}" alt="${esc(p.title)}" loading="lazy">
        </div>
        <div class="shop-card-body">
          <h3 class="shop-card-name">${esc(p.title)}</h3>
          ${p.description ? `<p class="shop-card-desc">${esc(p.description)}</p>` : ''}
          <div class="shop-price-row">
            ${p.priceLabel ? `<strong>${esc(p.priceLabel)}</strong>` : ''}
            ${p.offerLabel ? `<span class="shop-offer">${esc(p.offerLabel)}</span>` : ''}
          </div>
          ${renderBuyButton(p)}
        </div>
      </article>`;
  }

  function renderBuyButton(p) {
    const href = isHttpsUrl(p.affiliateUrl) ? p.affiliateUrl : '#';
    return `<a href="${esc(href)}" data-click-product="${esc(p.id)}" target="_blank" rel="sponsored noopener noreferrer" class="btn btn-primary shop-buy-btn">Buy Now ${icon('external')}</a>`;
  }

  function renderEmptyPublic() {
    const query = state.publicSearch.trim();
    return `
      <div class="empty-state shop-empty">
        <p>${query ? `No products found for "${esc(query)}".` : 'No products are published in this category yet.'}</p>
      </div>`;
  }

  function renderAdmin() {
    const products = filteredAdminProducts();
    const editing = state.editingId ? state.products.find(p => p.id === state.editingId) : null;
    return `
      <div class="shop-admin-shell">
        <div class="view-header shop-admin-heading">
          <div>
            <h1>Shop Admin <span class="admin-badge">Admin</span></h1>
            <p class="subtitle">Manage affiliate products for the FitTrack Shop.</p>
          </div>
        </div>

        <div class="shop-admin-stats">
          ${renderStat('Published', state.products.filter(p => p.status === 'published').length, 'Products live on shop', 'box')}
          ${renderStat('Drafts', state.products.filter(p => p.status === 'draft').length, 'Not published', 'draft')}
        </div>

        ${renderCategoryManager()}

        <div class="shop-admin-layout">
          ${renderAdminForm(editing)}
          ${renderLivePreview(editing)}
        </div>

        <div class="shop-admin-products">
          <div class="shop-admin-products-head">
            <h2>Products</h2>
            <div class="shop-admin-filters">
              <input type="search" id="shop-search" class="input" placeholder="Search products..." value="${esc(state.search)}">
              <select id="shop-status-filter" class="select">
                ${['All', 'Published', 'Draft'].map(s => `<option value="${s}" ${state.statusFilter === s ? 'selected' : ''}>${s} Status</option>`).join('')}
              </select>
              <button class="btn btn-primary btn-sm" id="shop-new-product">${icon('plus')} Add Product</button>
            </div>
          </div>
          ${products.length ? renderAdminTable(products) : '<div class="empty-state"><p>No matching products.</p></div>'}
        </div>
      </div>`;
  }

  function renderCategoryManager() {
    const categories = shopCategories();
    return `
      <section class="shop-admin-panel shop-category-manager">
        <div class="shop-panel-title">
          <div>
            <h2>Categories</h2>
            <p class="shop-category-help">Add or delete shop filters. Products keep their saved category until you edit them.</p>
          </div>
        </div>
        <form class="shop-category-form" id="shop-category-form">
          <input type="text" id="shop-new-category" class="input" placeholder="Add category, e.g. Supplements" maxlength="34" autocomplete="off">
          <button type="submit" class="btn btn-primary btn-sm">${icon('plus')} Add Category</button>
        </form>
        <div class="shop-category-list">
          ${categories.map(cat => `
            <span class="shop-category-chip">
              ${esc(cat)}
              <button type="button" data-delete-category="${esc(cat)}" title="Delete ${esc(cat)}">${icon('trash')}</button>
            </span>
          `).join('')}
        </div>
      </section>`;
  }

  function renderStat(label, value, hint, iconName) {
    return `
      <div class="shop-stat-card">
        <div class="shop-stat-icon">${icon(iconName)}</div>
        <div>
          <span>${esc(label)}</span>
          <strong>${esc(value)}</strong>
          <small>${esc(hint)}</small>
        </div>
      </div>`;
  }

  function renderAdminForm(product) {
    const p = product || normalizeProduct({});
    const categories = uniqueCategories([...shopCategories(), p.category]);
    return `
      <form class="shop-admin-panel shop-editor" id="shop-product-form">
        <div class="shop-panel-title">
          <h2>${product ? 'Edit Product' : 'Add Product'}</h2>
          ${product ? `<button type="button" class="btn btn-ghost btn-sm" id="shop-cancel-edit">${icon('x')} Cancel</button>` : ''}
        </div>
        <input type="hidden" id="shop-product-id" value="${esc(p.id)}">

        <label class="shop-field">Title
          <input type="text" id="shop-title" class="input" value="${esc(p.title)}" placeholder="Optimum Nutrition Gold Standard 100% Whey">
        </label>

        <div class="shop-form-grid">
          <label class="shop-field">Category
            <select id="shop-category" class="select">
              ${categories.map(cat => `<option value="${esc(cat)}" ${p.category === cat ? 'selected' : ''}>${esc(cat)}</option>`).join('')}
            </select>
          </label>
          <label class="shop-field">Sort Order
            <input type="number" id="shop-sort" class="input" value="${esc(p.sortOrder)}" min="0" step="1">
          </label>
        </div>

        <div class="shop-form-grid">
          <label class="shop-field">Image Upload
            <label class="shop-upload-drop" for="shop-image-file">
              <span>${icon('upload')}</span>
              <strong id="shop-upload-label">Preview an image before saving</strong>
              <small>Uploads are preview-only. Paste an Image URL to save across devices.</small>
            </label>
            <input type="file" id="shop-image-file" accept="image/png,image/jpeg,image/webp" hidden>
          </label>
          <label class="shop-field">Image URL
            <input type="url" id="shop-image-url" class="input" value="${esc(p.imageUrl)}" placeholder="https://...">
          </label>
        </div>

        <label class="shop-field">Description
          <textarea id="shop-description" class="input shop-textarea" rows="4" placeholder="Short product description">${esc(p.description)}</textarea>
        </label>

        <label class="shop-field">Affiliate Link
          <input type="url" id="shop-affiliate-url" class="input" value="${esc(p.affiliateUrl)}" placeholder="https://www.amazon.com/...">
        </label>

        <div class="shop-form-grid shop-form-grid-compact">
          <label class="shop-field">Price / Offer Label
            <input type="text" id="shop-price" class="input" value="${esc(p.priceLabel)}" placeholder="₹4,199">
          </label>
          <label class="shop-field">Offer Badge
            <input type="text" id="shop-offer" class="input" value="${esc(p.offerLabel)}" placeholder="15% off">
          </label>
          <label class="shop-field">Card Badge
            <input type="text" id="shop-badge" class="input" value="${esc(p.badgeLabel)}" placeholder="Top pick">
          </label>
        </div>

        <div class="shop-admin-controls">
          <div class="shop-segment" role="radiogroup" aria-label="Product status">
            <button type="button" class="shop-status-btn${p.status === 'draft' ? ' active' : ''}" data-status-value="draft">Draft</button>
            <button type="button" class="shop-status-btn${p.status === 'published' ? ' active' : ''}" data-status-value="published">Published</button>
            <input type="hidden" id="shop-status" value="${esc(p.status)}">
          </div>
          <label class="shop-toggle">
            <input type="checkbox" id="shop-featured" ${p.featured ? 'checked' : ''}>
            <span></span>
            Featured
          </label>
        </div>

        <button type="submit" class="btn btn-primary shop-save-btn" id="shop-save-product">Save Product</button>
      </form>`;
  }

  function readFormProduct() {
    return {
      id: document.getElementById('shop-product-id')?.value || '',
      title: document.getElementById('shop-title')?.value.trim() || '',
      category: document.getElementById('shop-category')?.value || defaultCategory(),
      description: document.getElementById('shop-description')?.value.trim() || '',
      imageUrl: cleanUrl(document.getElementById('shop-image-url')?.value),
      affiliateUrl: cleanUrl(document.getElementById('shop-affiliate-url')?.value),
      priceLabel: document.getElementById('shop-price')?.value.trim() || '',
      offerLabel: document.getElementById('shop-offer')?.value.trim() || '',
      badgeLabel: document.getElementById('shop-badge')?.value.trim() || '',
      status: document.getElementById('shop-status')?.value || 'published',
      featured: !!document.getElementById('shop-featured')?.checked,
      sortOrder: parseInt(document.getElementById('shop-sort')?.value || '100', 10),
    };
  }

  function renderLivePreview(product) {
    const p = product || normalizeProduct({
      title: 'Optimum Nutrition Gold Standard 100% Whey',
      category: 'Protein',
      description: '24g premium whey protein for muscle support and recovery.',
      imageUrl: '',
      affiliateUrl: 'https://example.com',
      priceLabel: '₹4,199',
      offerLabel: '15% off',
      badgeLabel: 'Top pick',
      status: 'published',
      featured: true,
    });
    return `
      <aside class="shop-admin-panel shop-preview-panel">
        <h2>Live Preview</h2>
        <div id="shop-live-preview">${renderPreviewCard(p)}</div>
        <p class="shop-preview-note">This is how the product will appear on the public Shop page.</p>
      </aside>`;
  }

  function renderPreviewCard(p) {
    return `
      <article class="shop-card shop-preview-card">
        <div class="shop-card-media">
          ${p.badgeLabel ? `<span class="shop-badge">${esc(p.badgeLabel)}</span>` : ''}
          <img class="shop-card-img" src="${esc(productImage(p))}" alt="${esc(p.title || 'Product preview')}" loading="lazy">
        </div>
        <div class="shop-card-body">
          <h3 class="shop-card-name">${esc(p.title || 'Product title')}</h3>
          ${p.description ? `<p class="shop-card-desc">${esc(p.description)}</p>` : ''}
          <div class="shop-price-row">
            ${p.priceLabel ? `<strong>${esc(p.priceLabel)}</strong>` : ''}
            ${p.offerLabel ? `<span class="shop-offer">${esc(p.offerLabel)}</span>` : ''}
          </div>
          <button type="button" class="btn btn-primary shop-buy-btn">Buy Now ${icon('external')}</button>
        </div>
      </article>`;
  }

  function renderAdminTable(products) {
    return `
      <div class="shop-table-wrap">
        <table class="shop-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Status</th>
              <th>Featured</th>
              <th>Price / Offer</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${products.map(p => `
              <tr>
                <td data-label="Product">
                  <div class="shop-table-product">
                    <img src="${esc(productImage(p))}" alt="${esc(p.title)}" loading="lazy">
                    <span>${esc(p.title)}</span>
                  </div>
                </td>
                <td data-label="Category">${esc(p.category)}</td>
                <td data-label="Status"><span class="shop-status-pill ${p.status}">${esc(p.status)}</span></td>
                <td data-label="Featured">${p.featured ? '<span class="shop-check">✓</span>' : '<span class="shop-muted">—</span>'}</td>
                <td data-label="Price / Offer">
                  <strong>${esc(p.priceLabel || '—')}</strong>
                  ${p.offerLabel ? `<small>${esc(p.offerLabel)}</small>` : ''}
                </td>
                <td data-label="Actions">
                  <div class="shop-row-actions">
                    <button type="button" class="shop-icon-btn" data-edit-product="${esc(p.id)}" title="Edit" aria-label="Edit ${esc(p.title)}">${icon('edit')}<span class="shop-action-label">Edit</span></button>
                    <button type="button" class="shop-icon-btn danger" data-delete-product="${esc(p.id)}" title="Delete" aria-label="Delete ${esc(p.title)}">${icon('trash')}<span class="shop-action-label">Delete</span></button>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function bindEvents(el) {
    el.querySelectorAll('.shop-category-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        state.activeCategory = btn.dataset.category;
        state.featuredIndex = 0;
        el.querySelectorAll('.shop-category-tab').forEach(tab => {
          tab.classList.toggle('active', tab === btn);
        });
        refreshPublicResults();
      });
    });

    el.querySelector('#shop-public-search')?.addEventListener('input', (e) => {
      state.publicSearch = e.target.value;
      state.featuredIndex = 0;
      refreshPublicResults();
    });

    bindPublicProductEvents(el);

    if (!isAdmin()) return;

    el.querySelector('#shop-category-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = document.getElementById('shop-new-category');
      const name = input?.value || '';
      try {
        await addCategory(name);
        App.toast('Category added.');
        state.editingId = null;
        await render();
      } catch (err) {
        App.toast('Failed to add category: ' + (err.message || err.code || 'error'), 'error');
      }
    });

    el.querySelectorAll('[data-delete-category]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const category = btn.dataset.deleteCategory;
        if (!confirm(`Delete "${category}" category? Products in this category will still exist, but the filter will be removed.`)) return;
        try {
          await deleteCategory(category);
          App.toast('Category deleted.');
          await render();
        } catch (err) {
          App.toast('Failed to delete category: ' + (err.message || err.code || 'error'), 'error');
        }
      });
    });

    const form = el.querySelector('#shop-product-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const product = readFormProduct();
      if (!product.title) { App.toast('Product title is required.', 'error'); return; }
      if (!product.affiliateUrl || !isHttpsUrl(product.affiliateUrl)) {
        App.toast('Enter a valid https affiliate link.', 'error');
        return;
      }
      if (product.imageUrl && !isHttpsUrl(product.imageUrl)) {
        App.toast('Image URL must start with https://', 'error');
        return;
      }
      if (state.selectedFile && !product.imageUrl) {
        App.toast('Image upload is preview-only. Paste an https Image URL to save the image across devices.', 'error');
        return;
      }

      const saveBtn = document.getElementById('shop-save-product');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      try {
        await saveProduct(product);
        App.toast(product.id ? 'Product updated.' : 'Product added.');
        state.editingId = null;
        state.selectedFile = null;
        await render();
      } catch (err) {
        console.error(err);
        App.toast('Failed to save product: ' + (err.message || err.code || 'error'), 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Product';
      }
    });

    el.querySelector('#shop-image-file')?.addEventListener('change', (e) => {
      state.selectedFile = e.target.files?.[0] || null;
      const label = document.getElementById('shop-upload-label');
      if (label && state.selectedFile) label.textContent = state.selectedFile.name;
      syncPreview();
    });

    el.querySelectorAll('#shop-title, #shop-category, #shop-description, #shop-image-url, #shop-affiliate-url, #shop-price, #shop-offer, #shop-badge, #shop-sort, #shop-featured').forEach(input => {
      input.addEventListener('input', syncPreview);
      input.addEventListener('change', syncPreview);
    });

    el.querySelectorAll('.shop-status-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('shop-status').value = btn.dataset.statusValue;
        el.querySelectorAll('.shop-status-btn').forEach(b => b.classList.toggle('active', b === btn));
        syncPreview();
      });
    });

    el.querySelector('#shop-cancel-edit')?.addEventListener('click', async () => {
      state.editingId = null;
      state.selectedFile = null;
      await render();
    });

    el.querySelector('#shop-new-product')?.addEventListener('click', async () => {
      state.editingId = null;
      state.selectedFile = null;
      await render();
      focusProductEditor();
    });

    el.querySelector('#shop-search')?.addEventListener('input', (e) => {
      state.search = e.target.value;
      refreshAdminList();
    });

    el.querySelector('#shop-status-filter')?.addEventListener('change', (e) => {
      state.statusFilter = e.target.value;
      refreshAdminList();
    });

    bindAdminTableEvents(el);
  }

  function bindAdminTableEvents(root) {
    root.querySelectorAll('[data-edit-product]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await openProductEditor(btn.dataset.editProduct);
      });
    });

    root.querySelectorAll('[data-delete-product]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await removeProductFromAdmin(btn.dataset.deleteProduct, btn);
      });
    });
  }

  function handleDocumentActionClick(e) {
    const target = e.target instanceof Element ? e.target : e.target?.parentElement;
    const editBtn = target?.closest?.('[data-edit-product]');
    const deleteBtn = target?.closest?.('[data-delete-product]');
    const actionBtn = editBtn || deleteBtn;
    if (!actionBtn) return;

    const shopView = document.getElementById('view-shop');
    if (!shopView || !shopView.contains(actionBtn) || !isAdmin()) return;

    e.preventDefault();
    e.stopPropagation();
    if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();

    if (editBtn) {
      openProductEditor(editBtn.dataset.editProduct);
      return;
    }
    removeProductFromAdmin(deleteBtn.dataset.deleteProduct, deleteBtn);
  }

  async function openProductEditor(id) {
    if (!id) return;
    state.editingId = id;
    state.selectedFile = null;
    App.toast('Opening product editor...');
    await render();
    focusProductEditor();
  }

  async function removeProductFromAdmin(id, button) {
    const product = state.products.find(p => p.id === id);
    const label = product?.title ? `"${product.title}"` : 'this product';
    if (!id || !confirm(`Delete ${label}?`)) return;
    if (button) button.disabled = true;
    try {
      await deleteProduct(id);
      state.products = state.products.filter(p => p.id !== id);
      if (state.editingId === id) state.editingId = null;
      App.toast('Product deleted.');
      await render();
    } catch (err) {
      console.error(err);
      App.toast('Failed to delete product: ' + (err.message || err.code || 'error'), 'error');
      if (button) button.disabled = false;
    }
  }

  function focusProductEditor() {
    const form = document.getElementById('shop-product-form');
    if (!form) return;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => document.getElementById('shop-title')?.focus({ preventScroll: true }), 180);
  }

  function syncPreview() {
    const target = document.getElementById('shop-live-preview');
    if (!target || !document.getElementById('shop-product-form')) return;
    const p = normalizeProduct(readFormProduct());
    if (state.selectedFile) p.imageUrl = URL.createObjectURL(state.selectedFile);
    target.innerHTML = renderPreviewCard(p);
  }

  function refreshAdminList() {
    const wrap = document.querySelector('.shop-admin-products');
    if (!wrap) return;
    const products = filteredAdminProducts();
    const head = wrap.querySelector('.shop-admin-products-head');
    wrap.innerHTML = '';
    wrap.appendChild(head);
    const holder = document.createElement('div');
    holder.innerHTML = products.length ? renderAdminTable(products) : '<div class="empty-state"><p>No matching products.</p></div>';
    wrap.appendChild(holder);
    bindAdminTableEvents(holder);
  }

  function refreshPublicResults() {
    const results = document.getElementById('shop-public-results');
    if (!results) return;
    results.innerHTML = renderPublicResults();
    bindPublicProductEvents(results);
  }

  function bindPublicProductEvents(root) {
    root.querySelectorAll('[data-click-product]').forEach(link => {
      link.addEventListener('click', () => {
        const id = link.dataset.clickProduct;
        if (id) trackClick(id);
      });
    });

    root.querySelectorAll('[data-featured-dir]').forEach(btn => {
      btn.addEventListener('click', () => {
        const products = filteredPublicProducts();
        if (!products.length) return;
        const dir = parseInt(btn.dataset.featuredDir || '1', 10);
        state.featuredIndex = (state.featuredIndex + dir + products.length) % products.length;
        refreshPublicResults();
      });
    });
  }

  document.addEventListener('click', handleDocumentActionClick, true);

  return { render, isAdmin };
})();
