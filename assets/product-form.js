if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton.querySelector('span');

        // Only a form that opens the drawer should advertise a dialog. Quick-add
        // confirms with the notification toast instead, so it must not.
        if (!this.isQuietAdd && document.querySelector('cart-drawer')) {
          this.submitButton.setAttribute('aria-haspopup', 'dialog');
        }

        this.hideErrors = this.dataset.hideErrors === 'true';
      }

      // A browsing add - quick-add from a product card, or an upsell button -
      // should not interrupt with the full drawer. Those confirm with the toast;
      // a deliberate add from the product page still opens the drawer.
      // Resolved live rather than cached in the constructor: quick-add forms are
      // injected into the modal after upgrade, so `closest` is only reliable here.
      get isQuietAdd() {
        return Boolean(this.closest('quick-add-modal') || this.dataset.quietAdd === 'true');
      }

      resolveCartTarget() {
        const notification = document.querySelector('cart-notification');
        const drawer = document.querySelector('cart-drawer');
        return this.isQuietAdd ? notification || drawer : drawer || notification;
      }

      onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        // Resolved here, while the form is still in the DOM. quick-add-modal.hide()
        // empties the modal and detaches this element, so by the time the response
        // comes back `closest` can no longer tell us where the add came from.
        this.cart = this.resolveCartTarget();

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        this.querySelector('.loading__spinner').classList.remove('hidden');

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);
        if (this.cart) {
          const sectionIds = this.cart.getSectionsToRender().map((section) => section.id);

          // A quiet add leaves the drawer closed, but the customer can open it a
          // moment later from the toast's View cart or from the cart icon. Its
          // sections ride along in this same request so it is already current
          // when that happens, instead of showing a pre-add cart.
          const drawer = this.isQuietAdd ? document.querySelector('cart-drawer') : null;
          this.silentDrawer = drawer && drawer !== this.cart ? drawer : null;
          if (this.silentDrawer) {
            this.silentDrawer.getSectionsToRender().forEach(({ id }) => {
              if (!sectionIds.includes(id)) sectionIds.push(id);
            });
          }

          formData.append('sections', sectionIds);
          formData.append('sections_url', window.location.pathname);
          this.cart.setActiveElement(document.activeElement);
        }
        config.body = formData;

        fetch(`${routes.cart_add_url}`, config)
          .then((response) => {
            if (!response.ok && response.status === 401) {
              throw new Error('Unauthorized: Please refresh the page and try again');
            }
            return response.json();
          })
          .then((response) => {
            if (response.status) {
              publish(PUB_SUB_EVENTS.cartError, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                errors: response.errors || response.description,
                message: response.message,
              });
              this.handleErrorMessage(response.description);

              const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
              if (!soldOutMessage) return;
              this.submitButton.setAttribute('aria-disabled', true);
              this.submitButtonText.classList.add('hidden');
              soldOutMessage.classList.remove('hidden');
              this.error = true;
              return;
            } else if (!this.cart) {
              window.location = window.routes.cart_url;
              return;
            }

            const startMarker = CartPerformance.createStartingMarker('add:wait-for-subscribers');
            if (!this.error)
              publish(PUB_SUB_EVENTS.cartUpdate, {
                source: 'product-form',
                productVariantId: formData.get('id'),
                cartData: response,
              }).then(() => {
                CartPerformance.measureFromMarker('add:wait-for-subscribers', startMarker);
              });
            this.error = false;

            // Before anything can open it. Guarded on the method so an older
            // cached cart-drawer.js cannot break the add.
            if (this.silentDrawer && typeof this.silentDrawer.updateContents === 'function') {
              this.silentDrawer.updateContents(response);
            }

            const quickAddModal = this.closest('quick-add-modal');
            if (quickAddModal) {
              document.body.addEventListener(
                'modalClosed',
                () => {
                  setTimeout(() => {
                    CartPerformance.measure("add:paint-updated-sections", () => {
                      this.cart.renderContents(response);
                    });
                  });
                },
                { once: true }
              );
              quickAddModal.hide(true);
            } else {
              CartPerformance.measure("add:paint-updated-sections", () => {
                this.cart.renderContents(response);
              });
            }
          })
          .catch((e) => {
            console.error(e);
          })
          .finally(() => {
            this.submitButton.classList.remove('loading');
            if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
            if (!this.error) this.submitButton.removeAttribute('aria-disabled');
            this.querySelector('.loading__spinner').classList.add('hidden');

            CartPerformance.measureFromEvent("add:user-action", evt);
          });
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;

        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);

        if (errorMessage) {
          this.errorMessage.textContent = errorMessage;
        }
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    }
  );
}
