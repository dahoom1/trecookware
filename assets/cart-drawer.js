class CartDrawer extends HTMLElement {
  // Longest delay in the open sequence plus its own duration: the last line item
  // starts at 0.42s and runs 0.4s. Keep in step with the delays in
  // snippets/cart-drawer.liquid.
  static OPENING_SEQUENCE_MS = 850;

  // How far into the panel's 0.38s slide the free-shipping bar starts filling:
  // late enough that the bar is on screen to be seen moving.
  static SHIPPING_BAR_DELAY_MS = 150;

  constructor() {
    super();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
    // Bound here on the element itself, which survives every re-render, rather
    // than on the rows, which are replaced each time the cart changes.
    this.addEventListener('click', this.onRemoveClick.bind(this));
    this.setHeaderCartIconAccessibility();
  }

  // Lifts and fades the row the moment remove is pressed, instead of leaving it
  // sitting there until the cart round-trip returns. On success the re-render
  // replaces the row, so nothing needs undoing. cart.js has two failure paths
  // (a network error, and an inventory error it reports inline) and neither
  // re-renders, so the row would stay invisible. Both end in disableLoading(),
  // which drops `cart__items--disabled` from the items container - that is the
  // signal to bring the row back if it is still on the page. The container is
  // looked up the way cart.js looks it up: on /cart that is the page's own
  // list, even for a remove made in the drawer.
  onRemoveClick(event) {
    const removeButton = event.target.closest('cart-remove-button');
    if (!removeButton) return;

    const row = removeButton.closest('.cart-item');
    const container =
      document.getElementById('main-cart-items') || this.querySelector('#CartDrawer-CartItems');
    if (!row || !container) return;

    row.classList.add('is-removing');

    const observer = new MutationObserver(() => {
      if (container.classList.contains('cart__items--disabled')) return;
      observer.disconnect();
      if (row.isConnected) row.classList.remove('is-removing');
    });
    observer.observe(container, { attributes: true, attributeFilter: ['class'] });
  }

  setHeaderCartIconAccessibility() {
    const cartLink = document.querySelector('#cart-icon-bubble');
    if (!cartLink) return;

    cartLink.setAttribute('role', 'button');
    cartLink.setAttribute('aria-haspopup', 'dialog');
    cartLink.addEventListener('click', (event) => {
      event.preventDefault();
      this.open(cartLink);
    });
    cartLink.addEventListener('keydown', (event) => {
      if (event.code.toUpperCase() === 'SPACE') {
        event.preventDefault();
        this.open(cartLink);
      }
    });
  }

  open(triggeredBy) {
    if (triggeredBy) this.setActiveElement(triggeredBy);
    if (!this.classList.contains('active')) this.replayShippingBar();

    // The added-to-cart pop-down points at the drawer; once the drawer is open
    // it has done its job, whichever way the drawer was opened.
    const notification = document.querySelector('cart-notification');
    if (notification && typeof notification.close === 'function') notification.close();

    const cartDrawerNote = this.querySelector('[id^="Details-"] summary');
    if (cartDrawerNote && !cartDrawerNote.hasAttribute('role')) this.setSummaryAccessibility(cartDrawerNote);
    // here the animation doesn't seem to always get triggered. A timeout seem to help
    setTimeout(() => {
      this.classList.add('animate', 'active', 'is-opening');
    });

    // `is-opening` gates the staggered reveal of the cart contents so it plays on
    // open and nowhere else. Without it the rows would replay their entrance every
    // time renderContents() swaps the list in - i.e. on every quantity change.
    // The resting state is the finished state, so clearing the class simply leaves
    // the contents visible.
    clearTimeout(this.openingTimer);
    this.openingTimer = setTimeout(() => {
      this.classList.remove('is-opening');
    }, CartDrawer.OPENING_SEQUENCE_MS);

    this.addEventListener(
      'transitionend',
      () => {
        const containerToTrapFocusOn = this.classList.contains('is-empty')
          ? this.querySelector('.drawer__inner-empty')
          : document.getElementById('CartDrawer');
        const focusElement = this.querySelector('.drawer__inner') || this.querySelector('.drawer__close');
        trapFocus(containerToTrapFocusOn, focusElement);
      },
      { once: true }
    );

    document.body.classList.add('overflow-hidden');
  }

  // Plays the free-shipping bar filling up on every open, so the customer sees
  // how far this cart carries them - all the way across once it qualifies -
  // rather than a bar already sitting at its level. The fill is parked at empty
  // with transitions off, then released to its real width as the panel slides
  // in, and the stylesheet's width transition does the moving. If
  // progress-bar-v2 repaints the fill in the meantime (it refreshes the total
  // after an add), its fresher value is left to stand.
  replayShippingBar() {
    const fill = this.querySelector('.shipping-progress-fill');
    if (!fill) return;

    clearTimeout(this.shippingBarTimer);
    // A replay cut short by another leaves the fill at 0%, so the real width is
    // kept on the element until the release has happened.
    const target = fill.dataset.replayTarget || fill.style.width;
    if (!target) return;
    fill.dataset.replayTarget = target;

    fill.style.transition = 'none';
    fill.style.width = '0%';
    void fill.offsetWidth;
    fill.style.transition = '';

    this.shippingBarTimer = setTimeout(() => {
      if (fill.style.width === '0%') fill.style.width = target;
      delete fill.dataset.replayTarget;
    }, CartDrawer.SHIPPING_BAR_DELAY_MS);
  }

  close() {
    clearTimeout(this.openingTimer);
    this.classList.remove('active', 'is-opening');
    removeTrapFocus(this.activeElement);
    document.body.classList.remove('overflow-hidden');
  }

  setSummaryAccessibility(cartDrawerNote) {
    cartDrawerNote.setAttribute('role', 'button');
    cartDrawerNote.setAttribute('aria-expanded', 'false');

    if (cartDrawerNote.nextElementSibling.getAttribute('id')) {
      cartDrawerNote.setAttribute('aria-controls', cartDrawerNote.nextElementSibling.id);
    }

    cartDrawerNote.addEventListener('click', (event) => {
      event.currentTarget.setAttribute('aria-expanded', !event.currentTarget.closest('details').hasAttribute('open'));
    });

    cartDrawerNote.parentElement.addEventListener('keyup', onKeyUpEscape);
  }

  // Refreshes the drawer's markup without opening it. Split out of
  // renderContents so a quiet add can keep the closed drawer in step with the
  // cart: the customer may open it a moment later from the toast or the cart
  // icon, and it would otherwise still show the cart as it was before the add.
  updateContents(parsedState) {
    // `is-empty` lives on this element, not on .drawer__inner, and the whole
    // empty presentation hangs off it: the stylesheet hides .drawer__header,
    // collapses .drawer__inner to a centred single-row grid with no padding, and
    // keeps the empty-state warnings on screen. Dawn cleared it from
    // product-form.js via whichever element that add had targeted - but a quiet
    // add targets the notification, so after the first add from an empty cart
    // the drawer kept the class and rendered as a bare strip. Clearing it here
    // puts it on the path every render goes through. An add always leaves the
    // cart non-empty; cart.js owns the reverse when a line is removed.
    this.classList.remove('is-empty');

    const inner = this.querySelector('.drawer__inner');
    if (inner) inner.classList.remove('is-empty');
    this.productId = parsedState.id;

    this.getSectionsToRender().forEach((section) => {
      const sectionElement = section.selector
        ? document.querySelector(section.selector)
        : document.getElementById(section.id);

      if (!sectionElement) return;
      const html = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
      if (html !== null) sectionElement.innerHTML = html;
    });

    // The overlay sits inside #CartDrawer, so the replacement above discards the
    // node this listener was bound to. Rebinding is part of updating, not of
    // opening - otherwise a quiet add would leave the overlay inert.
    const overlay = this.querySelector('#CartDrawer-Overlay');
    if (overlay) overlay.addEventListener('click', this.close.bind(this));
  }

  renderContents(parsedState) {
    this.updateContents(parsedState);
    setTimeout(() => this.open());
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    if (!html) return null;
    const node = new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
    return node ? node.innerHTML : null;
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        selector: '#CartDrawer',
      },
      {
        id: 'cart-icon-bubble',
      },
    ];
  }

  getSectionDOM(html, selector = '.shopify-section') {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-drawer', CartDrawer);

class CartDrawerItems extends CartItems {
  getSectionsToRender() {
    return [
      {
        id: 'CartDrawer',
        section: 'cart-drawer',
        selector: '.drawer__inner',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
    ];
  }
}

customElements.define('cart-drawer-items', CartDrawerItems);
