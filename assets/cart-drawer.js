class CartDrawer extends HTMLElement {
  // Longest delay in the open sequence plus its own duration: the last line item
  // starts at 0.60s and runs 0.25s. Keep in step with the delays in
  // snippets/cart-drawer.liquid.
  static OPENING_SEQUENCE_MS = 900;

  constructor() {
    super();

    this.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelector('#CartDrawer-Overlay').addEventListener('click', this.close.bind(this));
    this.setHeaderCartIconAccessibility();
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
