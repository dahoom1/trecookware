// Mega Menu Functionality
class MegaMenu {
  constructor() {
    this.megaTriggers = document.querySelectorAll('[data-mega-trigger]');
    this.megaMenus = document.querySelectorAll('[data-mega-menu]');
    this.mobileToggle = document.querySelectorAll('[data-mobile-toggle]');
    this.mobileDrawer = document.querySelector('[data-mobile-drawer]');
    this.header = document.querySelector('[data-header]');
    
    this.init();
  }

  init() {
    // Desktop mega menu events
    this.megaTriggers.forEach(trigger => {
      trigger.addEventListener('mouseenter', this.handleMegaMenuOpen.bind(this));
      trigger.addEventListener('focus', this.handleMegaMenuOpen.bind(this));
      trigger.addEventListener('mouseleave', this.handleMegaMenuClose.bind(this));
      trigger.addEventListener('blur', this.handleMegaMenuClose.bind(this));
    });

    // Mobile menu events
    this.mobileToggle.forEach(toggle => {
      toggle.addEventListener('click', this.handleMobileToggle.bind(this));
    });

    // Close mega menus when clicking outside
    document.addEventListener('click', this.handleClickOutside.bind(this));
    
    // Close mobile menu on escape key
    document.addEventListener('keydown', this.handleKeydown.bind(this));
  }

  handleMegaMenuOpen(event) {
    const trigger = event.currentTarget;
    const menuName = trigger.dataset.megaTrigger;
    const menu = document.querySelector(`[data-mega-menu="${menuName}"]`);
    
    // Close all other menus
    this.closeAllMegaMenus();
    
    // Open current menu
    this.openMegaMenu(trigger, menu);
  }

  handleMegaMenuClose(event) {
    const trigger = event.currentTarget;
    const menuName = trigger.dataset.megaTrigger;
    const menu = document.querySelector(`[data-mega-menu="${menuName}"]`);
    
    // Use setTimeout to allow for click events to register
    setTimeout(() => {
      if (!menu.matches(':hover') && !trigger.matches(':hover')) {
        this.closeMegaMenu(trigger, menu);
      }
    }, 100);
  }

  openMegaMenu(trigger, menu) {
    trigger.setAttribute('aria-expanded', 'true');
    menu.setAttribute('aria-hidden', 'false');
    trigger.classList.add('is-open');
  }

  closeMegaMenu(trigger, menu) {
    trigger.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-hidden', 'true');
    trigger.classList.remove('is-open');
  }

  closeAllMegaMenus() {
    this.megaTriggers.forEach(trigger => {
      const menuName = trigger.dataset.megaTrigger;
      const menu = document.querySelector(`[data-mega-menu="${menuName}"]`);
      this.closeMegaMenu(trigger, menu);
    });
  }

  handleClickOutside(event) {
    if (!this.header.contains(event.target)) {
      this.closeAllMegaMenus();
    }
  }

  handleMobileToggle() {
    const isHidden = this.mobileDrawer.getAttribute('aria-hidden') === 'true';
    this.mobileDrawer.setAttribute('aria-hidden', !isHidden);
    document.body.style.overflow = isHidden ? 'hidden' : '';
  }

  handleKeydown(event) {
    if (event.key === 'Escape') {
      this.mobileDrawer.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new MegaMenu();
});

// Re-initialize for Shopify theme editor
if (typeof Shopify !== 'undefined') {
  document.addEventListener('shopify:section:load', () => {
    new MegaMenu();
  });
}