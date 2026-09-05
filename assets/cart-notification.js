class CartNotification extends HTMLElement {
  // TEMPORARY: hides the "Added" toast. Everything stays wired - quick add still
  // adds without opening the drawer, and the cart count still updates - the
  // confirmation box just never opens. Flip this back to false to restore it;
  // nothing else needs changing.
  static SUPPRESSED = true;

  // How long the toast stays up before dismissing itself. Long enough to read
  // the product name and reach the buttons, short enough not to linger.
  static AUTO_DISMISS_MS = 4000;

  constructor() {
    super();

    this.notification = document.getElementById('cart-notification');
    this.header = document.querySelector('sticky-header');
    this.onBodyClick = this.handleBodyClick.bind(this);

    this.notification.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelectorAll('button[type="button"]').forEach((closeButton) =>
      closeButton.addEventListener('click', this.close.bind(this))
    );

    // Someone reaching for 'View cart' or reading the toast should not have it
    // vanish mid-reach, so the countdown holds while it is hovered or focused
    // and restarts when they leave.
    this.notification.addEventListener('mouseenter', () => this.holdOpen());
    this.notification.addEventListener('focusin', () => this.holdOpen());
    this.notification.addEventListener('mouseleave', () => this.scheduleDismiss());
    this.notification.addEventListener('focusout', (evt) => {
      if (!this.notification.contains(evt.relatedTarget)) this.scheduleDismiss();
    });

    // 'View cart' stays a real link to /cart so it still works without JS and
    // keeps its right-click and open-in-new-tab behaviour. When the drawer is
    // available we intercept it and open that instead - the customer wanted a
    // look at the cart, not to leave the page they were browsing.
    this.viewCartButton = this.querySelector('#cart-notification-button');
    if (this.viewCartButton) {
      this.viewCartButton.addEventListener('click', this.onViewCartClick.bind(this));
    }
  }

  onViewCartClick(event) {
    // Let modified clicks (new tab, new window) fall through to the href.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

    const drawer = document.querySelector('cart-drawer');
    if (!drawer || typeof drawer.open !== 'function') return;

    event.preventDefault();
    this.close();
    // Focus returns to the cart icon rather than this toast, which is on its way
    // out and would be an invisible target by the time the drawer closes.
    drawer.open(document.querySelector('#customCartButton, #cart-icon-bubble') || undefined);
  }

  holdOpen() {
    clearTimeout(this.dismissTimer);
  }

  scheduleDismiss() {
    clearTimeout(this.dismissTimer);
    this.dismissTimer = setTimeout(() => this.close(), CartNotification.AUTO_DISMISS_MS);
  }

  // Points the caret at the cart button so the toast reads as having dropped out
  // of it. Measured on every open because the header reflows between its static,
  // fixed and hidden states, and the icon row differs across breakpoints.
  positionCaret() {
    const button = document.querySelector('#customCartButton, #cart-icon-bubble');
    if (!button) return;

    const buttonRect = button.getBoundingClientRect();
    const cardRect = this.notification.getBoundingClientRect();
    if (!cardRect.width) return;

    const centre = buttonRect.left + buttonRect.width / 2 - cardRect.left;
    // Kept clear of the rounded corners, where a caret would look detached.
    const inset = 18;
    const clamped = Math.min(Math.max(centre, inset), cardRect.width - inset);
    this.notification.style.setProperty('--cart-toast-caret', `${clamped}px`);
  }

  open() {
    if (CartNotification.SUPPRESSED) return;

    // Measured before .active lands: the card is laid out while hidden, so the
    // rect is already correct, and this avoids a caret that visibly jumps.
    this.positionCaret();
    this.notification.classList.add('animate', 'active');

    // Deliberately no focus() or trapFocus() here. The customer is still
    // browsing - moving focus into the toast would interrupt exactly the way
    // opening the drawer did, and trapping it would strand keyboard users in a
    // panel that dismisses itself. role="status" announces it instead.

    document.body.addEventListener('click', this.onBodyClick);
    this.scheduleDismiss();
  }

  close() {
    clearTimeout(this.dismissTimer);
    this.notification.classList.remove('active');
    document.body.removeEventListener('click', this.onBodyClick);
  }

  renderContents(parsedState) {
    this.cartItemKey = parsedState.key;
    this.getSectionsToRender().forEach((section) => {
      // Dawn's version assumes every target is on the page. This theme's custom
      // header renders no #cart-icon-bubble (it keeps its own #customCartCount,
      // refreshed from the cart/add fetch), so the un-guarded lookup threw before
      // the toast could open. CartDrawer.renderContents already guards this way.
      const target = document.getElementById(section.id);
      if (!target) return;

      const html = this.getSectionInnerHTML(parsedState.sections[section.id], section.selector);
      if (html !== null) target.innerHTML = html;
    });

    // This theme renders <sticky-header> as a plain wrapper and never loads
    // Dawn's header.js, so the element is present but was never upgraded and has
    // no reveal(). Calling it threw here, before open() could run - the add
    // succeeded and the count ticked up, but no toast ever appeared.
    if (this.header && typeof this.header.reveal === 'function') this.header.reveal();
    this.open();
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-notification-product',
        selector: `[id="cart-notification-product-${this.cartItemKey}"]`,
      },
      {
        id: 'cart-notification-button',
      },
      {
        id: 'cart-icon-bubble',
      },
    ];
  }

  getSectionInnerHTML(html, selector = '.shopify-section') {
    if (!html) return null;
    const node = new DOMParser().parseFromString(html, 'text/html').querySelector(selector);
    return node ? node.innerHTML : null;
  }

  handleBodyClick(evt) {
    const target = evt.target;
    if (target !== this.notification && !target.closest('cart-notification')) {
      const disclosure = target.closest('details-disclosure, header-menu');
      this.activeElement = disclosure ? disclosure.querySelector('summary') : null;
      this.close();
    }
  }

  setActiveElement(element) {
    this.activeElement = element;
  }
}

customElements.define('cart-notification', CartNotification);
