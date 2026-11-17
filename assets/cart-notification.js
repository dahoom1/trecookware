class CartNotification extends HTMLElement {
  // How long the pop-down stays up before dismissing itself. Long enough to
  // read the product name and reach the buttons, short enough not to linger.
  static AUTO_DISMISS_MS = 4500;

  constructor() {
    super();

    this.notification = document.getElementById('cart-notification');
    this.header = document.querySelector('sticky-header');
    this.onBodyClick = this.handleBodyClick.bind(this);

    this.notification.addEventListener('keyup', (evt) => evt.code === 'Escape' && this.close());
    this.querySelectorAll('button[type="button"]').forEach((closeButton) =>
      closeButton.addEventListener('click', this.close.bind(this))
    );

    // Someone reaching for 'View cart' or reading the pop-down should not have
    // it vanish mid-reach, so the countdown - and the bar that shows it - holds
    // while it is hovered or focused and picks up where it left off after.
    // Hover and focus are tracked apart: moving the mouse away while a keyboard
    // user is still tabbed into the buttons must not restart the clock.
    this.notification.addEventListener('mouseenter', () => {
      this.hovered = true;
      this.holdOpen();
    });
    this.notification.addEventListener('focusin', () => {
      this.focusWithin = true;
      this.holdOpen();
    });
    this.notification.addEventListener('mouseleave', () => {
      this.hovered = false;
      this.scheduleDismiss();
    });
    this.notification.addEventListener('focusout', (evt) => {
      if (this.notification.contains(evt.relatedTarget)) return;
      this.focusWithin = false;
      this.scheduleDismiss();
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

  // Every add starts the countdown from full, including a second add while the
  // pop-down is still up. The bar's animation is restarted by dropping its
  // class and forcing a reflow before putting it back; without the reflow the
  // browser sees no change and the bar stays wherever it had got to.
  // If the card is already hovered or focused when an add lands, the bar
  // restarts full but stays paused until both holds are released.
  startCountdown() {
    clearTimeout(this.dismissTimer);
    this.dismissTimer = null;
    this.remainingMs = CartNotification.AUTO_DISMISS_MS;
    this.notification.style.setProperty('--cart-toast-duration', `${CartNotification.AUTO_DISMISS_MS}ms`);
    this.notification.classList.remove('is-counting', 'is-paused');
    void this.notification.offsetWidth;
    this.notification.classList.add('is-counting');

    if (this.isHeld) {
      this.notification.classList.add('is-paused');
      return;
    }
    this.scheduleDismiss();
  }

  get isHeld() {
    return Boolean(this.hovered || this.focusWithin);
  }

  holdOpen() {
    // Banks the time already spent, so resuming carries on rather than
    // restarting. Guarded on a running timer because mouseenter and focusin can
    // both arrive for the same hold.
    if (this.dismissTimer) this.remainingMs -= Date.now() - this.countdownStartedAt;
    clearTimeout(this.dismissTimer);
    this.dismissTimer = null;
    this.notification.classList.add('is-paused');
  }

  // Resumes the countdown from wherever holdOpen() banked it. A no-op while it
  // is already running (so a second resume cannot hand it a stale remainder
  // while the bar keeps draining), while either hold is still on, and after the
  // pop-down has gone - mouseleave and focusout keep firing after close.
  scheduleDismiss() {
    if (this.dismissTimer || this.isHeld) return;
    if (!this.notification.classList.contains('active')) return;

    this.countdownStartedAt = Date.now();
    this.notification.classList.remove('is-paused');
    this.dismissTimer = setTimeout(() => this.close(), Math.max(this.remainingMs, 0));
  }

  open() {
    this.notification.classList.add('animate', 'active');

    // Deliberately no focus() or trapFocus() here. The customer is still
    // browsing - moving focus into the pop-down would interrupt exactly the way
    // opening the drawer did, and trapping it would strand keyboard users in a
    // panel that dismisses itself. announce() reads it out instead.

    document.body.addEventListener('click', this.onBodyClick);
    this.startCountdown();
  }

  // Reads the add out through the always-present live region beside the card:
  // "Added to cart!, <product>, <price>". Cleared first and set a beat later so
  // adding the same product twice still counts as new content to announce.
  announce() {
    const live = this.querySelector('#cart-notification-live');
    const product = this.querySelector('#cart-notification-product');
    if (!live || !product) return;

    const message = Array.from(product.querySelectorAll('.cart-notification-product__info p'))
      .map((line) => line.textContent.trim())
      .filter(Boolean)
      .join(', ');

    live.textContent = '';
    clearTimeout(this.announceTimer);
    this.announceTimer = setTimeout(() => {
      live.textContent = message;
    }, 100);
  }

  close() {
    clearTimeout(this.dismissTimer);
    this.dismissTimer = null;
    // Focus cannot stay inside a card that is going hidden, and browsers do not
    // reliably fire focusout when that happens, so the hold is dropped here.
    // Hover is left alone: if the card comes straight back under a resting
    // pointer, it should stay held.
    this.focusWithin = false;
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
    this.announce();
  }

  // No 'cart-notification-button' here: that section re-labels View cart as
  // "View cart (n)", and the pop-down keeps the plain label.
  getSectionsToRender() {
    return [
      {
        id: 'cart-notification-product',
        selector: `[id="cart-notification-product-${this.cartItemKey}"]`,
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
