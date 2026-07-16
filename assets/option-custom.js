(function () {
  if (window.daprdanDynamicVariantSyncInitialized) return;
  window.daprdanDynamicVariantSyncInitialized = true;

  function syncDynamicVariant(scope) {
    const root = scope || document;
    const dynamicSelects = root.querySelectorAll('[data-dynamic-matched-variant-id]');

    dynamicSelects.forEach(function (dynamicSelect) {
      const matchedVariantId = dynamicSelect.getAttribute('data-dynamic-matched-variant-id');
      const matchedOptionValue =
        dynamicSelect.value ||
        dynamicSelect.getAttribute('data-variant-option-chosen-value');

      if (!matchedVariantId) return;

      const form =
        dynamicSelect.closest('form[action*="/cart/add"]') ||
        document.querySelector('form[action*="/cart/add"]');

      if (!form) return;

      const hiddenVariantSelect = form.querySelector('[name="id"]');

      if (hiddenVariantSelect) {
        hiddenVariantSelect.value = matchedVariantId;

        Array.from(hiddenVariantSelect.options || []).forEach(function (option) {
          option.selected = option.value === matchedVariantId;
        });

        hiddenVariantSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const variantSelection = form.querySelector('variant-selection');

      if (variantSelection) {
        variantSelection.setAttribute('variant', matchedVariantId);
      }

      if (matchedOptionValue) {
        dynamicSelect.setAttribute('data-variant-option-chosen-value', matchedOptionValue);

        Array.from(dynamicSelect.options || []).forEach(function (option) {
          option.selected = option.value === matchedOptionValue;
        });

        const wrapper = dynamicSelect.closest('.options-selection__select');
        const label = wrapper
          ? wrapper.querySelector('.options-selection__select-label')
          : null;

        if (label) {
          label.setAttribute('data-variant-option-chosen-value', matchedOptionValue);
        }
      }
    });
  }

  function initDynamicVariantSync() {
    syncDynamicVariant(document);

    setTimeout(function () {
      syncDynamicVariant(document);
    }, 100);

    setTimeout(function () {
      syncDynamicVariant(document);
    }, 500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDynamicVariantSync);
  } else {
    initDynamicVariantSync();
  }

  document.addEventListener('change', function (event) {
    if (!event.target.matches('[data-dynamic-matched-variant-id]')) return;

    syncDynamicVariant(event.target.closest('form') || document);
  });
})();