// TrialHook External Script - Part 1
(() => {
  // Prevent multiple initializations
  if (window._trialHookInitialized) {
    console.warn('[TrialHook Capture] Already initialized');
    return;
  }
  window._trialHookInitialized = true;

  // The ONLY configurable variable - to be replaced by user
  const API_KEY = '{{REPLACE_WITH_YOUR_API_KEY}}';

  // Logging utility
  const logger = {
    log: (...args) => console.log('%c[TrialHook Capture]', 'color: blue; font-weight: bold;', ...args),
    warn: (...args) => console.warn('%c[TrialHook Capture]', 'color: orange; font-weight: bold;', ...args),
    error: (...args) => console.error('%c[TrialHook Capture]', 'color: red; font-weight: bold;', ...args),
    debug: (...args) => console.debug('%c[TrialHook Capture]', 'color: green; font-weight: bold;', ...args)
  };

  class EmailCapture {
    constructor() {
      this.MAX_RETRIES = 3;
      this.RETRY_DELAY_BASE = 1000;
      this.RETRY_BACKOFF_FACTOR = 2;
      
      logger.log('EmailCapture instance created', {
        maxRetries: this.MAX_RETRIES,
        baseDelay: this.RETRY_DELAY_BASE,
        backoffFactor: this.RETRY_BACKOFF_FACTOR
      });
    }

    captureEmail(email) {
      logger.log('Initiating email capture', { 
        email: this.obfuscateEmail(email),
        apiKeyProvided: !!API_KEY 
      });

      return new Promise((resolve) => {
        this.attemptCapture(email, 0)
          .then(resolve)
          .catch((error) => {
            logger.error('Capture promise catch', error);
            resolve();
          });
      });
    }

    obfuscateEmail(email) {
      return email.replace(/(.{2}).+@/, "$1...@");
    }

    attemptCapture(email, retryCount) {
      return new Promise((resolve, reject) => {
        logger.log(`Capture attempt #${retryCount + 1}`, {
          email: this.obfuscateEmail(email)
        });

        const xhr = new XMLHttpRequest();
        xhr.open('POST', 'https://hook.eu1.make.com/forch2khep3s9j4898tg2c84ekqp6o33', true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.timeout = 5000;

        xhr.onload = () => {
          logger.log('XHR onload triggered', {
            status: xhr.status,
            responseText: xhr.responseText
          });

          if (xhr.status >= 200 && xhr.status < 300) {
            logger.log('Capture successful', {
              status: xhr.status,
              response: xhr.responseText
            });
            resolve(xhr.responseText);
          } else {
            logger.warn('HTTP error during capture', {
              status: xhr.status,
              responseText: xhr.responseText
            });
            this.handleCaptureError(email, retryCount, 
              new Error(`HTTP Error: ${xhr.status}`), 
              resolve, reject
            );
          }
        };

        xhr.onerror = () => {
          logger.error('Network error during capture');
          this.handleCaptureError(email, retryCount, 
            new Error('Network Error'), 
            resolve, reject
          );
        };

        xhr.ontimeout = () => {
          logger.warn('Capture request timed out');
          this.handleCaptureError(email, retryCount, 
            new Error('Request Timeout'), 
            resolve, reject
          );
        };

        try {
          const payload = {
            email: email,
            apiKey: API_KEY
          };
          logger.log('Sending payload', { 
            email: this.obfuscateEmail(email),
            apiKeyProvided: !!API_KEY 
          });
          xhr.send(JSON.stringify(payload));
        } catch (sendError) {
          logger.error('Error sending capture request', sendError);
          this.handleCaptureError(email, retryCount, 
            sendError, 
            resolve, reject
          );
        }
      });
    }

    handleCaptureError(email, retryCount, error, resolve, reject) {
      logger.warn(`Capture attempt failed`, {
        email: this.obfuscateEmail(email),
        retryCount: retryCount,
        errorMessage: error.message
      });

      if (retryCount < this.MAX_RETRIES) {
        const delay = this.RETRY_DELAY_BASE * 
          Math.pow(this.RETRY_BACKOFF_FACTOR, retryCount);

        logger.log(`Scheduling retry`, {
          retryCount: retryCount + 1,
          delayMs: delay
        });

        setTimeout(() => {
          this.attemptCapture(email, retryCount + 1)
            .then(resolve)
            .catch(reject);
        }, delay);
      } else {
        logger.error('Max retries exceeded. Giving up on capture.', {
          email: this.obfuscateEmail(email),
          finalError: error.message
        });
        resolve();
      }
    }
  }

  function isValidEmail(email) {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
    const isValid = emailRegex.test(email);
    
    logger.log('Email Validation', {
      email: email.replace(/(.{2}).+@/, "$1...@"),
      isValid,
      reason: isValid ? 'Matches email pattern' : 'Invalid email format'
    });

    return isValid;
  }

  // Track which elements we're already watching for shadow roots
  const shadowRootWatched = new WeakSet();

  // List of element tags that might contain forms or email inputs
  const RELEVANT_ELEMENTS = new Set([
    'FORM', 'DIV', 'SECTION', 'ARTICLE', 'MAIN', 'ASIDE', 
    'HEADER', 'FOOTER', 'NAV', 'CUSTOM-ELEMENT', 'APP-ROOT'
  ]);

  function shouldObserveElement(node) {
    return node.nodeType === Node.ELEMENT_NODE && 
           (RELEVANT_ELEMENTS.has(node.tagName) || node.tagName.includes('-'));
  }

  function findEmailInput(root) {
    logger.log('Searching for email input in root');

    const emailSelectors = [
      'input[type="email"]',
      'input[name="email"]',
      'input[id*="email" i]',
      'input[placeholder*="email" i]'
    ];

    function isInputVisible(input) {
      return !input.disabled && 
             input.type !== 'hidden' &&
             input.style.display !== 'none' &&
             input.style.visibility !== 'hidden';
    }

    function traverseNode(node) {
      if (!node) return null;

      try {
        const context = node.shadowRoot || node;
        
        // First check for email inputs in this context
        for (const selector of emailSelectors) {
          const inputs = context.querySelectorAll(selector);
          for (const input of inputs) {
            if (isInputVisible(input)) {
              logger.log('Found email input:', {
                type: input.type,
                name: input.name,
                id: input.id,
                visible: true
              });
              return input;
            } else {
              logger.debug('Skipped invisible email input:', {
                type: input.type,
                name: input.name,
                id: input.id
              });
            }
          }
        }

        // Traverse all children, not just relevant ones
        const elements = Array.from(context.children || []);

        for (const el of elements) {
          if (el.shadowRoot) {
            const shadowResult = traverseNode(el);
            if (shadowResult) return shadowResult;
          }
          const result = traverseNode(el);
          if (result) return result;
        }
      } catch (error) {
        logger.error('Error finding email input:', error);
      }

      return null;
    }

    return traverseNode(root);
  }

  function findFormWithEmailInput(root) {
    logger.log('Searching for form with email input');
    
    function traverseNode(node) {
      if (!node) return null;

      try {
        // Handle shadow root content
        if (node.shadowRoot) {
          logger.log('Found shadow root, checking for form with email input');
          const result = traverseNode(node.shadowRoot);
          if (result) return result;
        }

        // If this is a form, check if it has an email input
        if (node.tagName === 'FORM') {
          const emailInput = findEmailInput(node);
          if (emailInput) {
            logger.log('Found form with email input:', {
              id: node.id,
              className: node.className
            });
            return node;
          }
        }

        // Traverse all children, not just relevant ones
        const children = Array.from(node.children || []);

        for (const child of children) {
          const result = traverseNode(child);
          if (result) return result;
        }
      } catch (error) {
        logger.error('Error traversing node:', error);
      }

      return null;
    }

    return traverseNode(root);
  }

  function findCustomForm(root) {
    logger.log('Searching for form with trialhook-form class');
    
    function traverseNode(node) {
      if (!node) return null;

      try {
        // Check node's shadow root first
        if (node.shadowRoot) {
          logger.log('Found shadow root, checking for custom form');
          const shadowResult = traverseNode(node.shadowRoot);
          if (shadowResult) return shadowResult;
        }

        // Check the node itself if it's a form
        if (node.tagName === 'FORM' && node.classList && node.classList.contains('trialhook-form')) {
          const emailInput = findEmailInput(node);
          if (emailInput) {
            logger.log('Found custom form with email input in traversal:', {
              id: node.id,
              className: node.className,
              inShadowDOM: !!node.getRootNode().host
            });
            return node;
          }
        }

        // Use querySelectorAll if available
        if (node.querySelectorAll) {
          const forms = node.querySelectorAll('form.trialhook-form');
          for (const form of forms) {
            const emailInput = findEmailInput(form);
            if (emailInput) {
              logger.log('Found custom form with email input using querySelector:', {
                id: form.id,
                className: form.className,
                inShadowDOM: !!form.getRootNode().host
              });
              return form;
            }
          }
        }

        // Traverse all children
        const children = Array.from(node.children || []);
        for (const child of children) {
          const result = traverseNode(child);
          if (result) return result;
        }
      } catch (error) {
        logger.error('Error traversing node for custom form:', error);
      }

      return null;
    }

    return traverseNode(root);
  }

  function enhanceForm(form, shouldDisableOtherForms = false) {
    if (form.getAttribute('data-trh-enhanced')) {
      logger.debug('Form already enhanced, skipping');
      return;
    }
    
    logger.log('Enhancing form:', {
      id: form.id,
      className: form.className,
      isCustom: form.classList.contains('trialhook-form')
    });

    // Find and store the email input during enhancement
    const emailInput = findEmailInput(form);
    if (!emailInput) {
      logger.error('Failed to find email input during form enhancement');
      return;
    }

    // If this is a custom form, disable any previously enhanced forms
    if (shouldDisableOtherForms) {
      const allEnhancedForms = document.querySelectorAll('form[data-trh-enhanced="true"]');
      allEnhancedForms.forEach(existingForm => {
        if (existingForm !== form) {
          logger.log('Disabling previously enhanced form:', {
            id: existingForm.id,
            className: existingForm.className
          });
          existingForm.setAttribute('data-trh-disabled', 'true');
        }
      });
    }

    form.setAttribute('data-trh-enhanced', 'true');
    const originalSubmitHandler = form.onsubmit;

    form.addEventListener('submit', function(e) {
      // Skip if this form has been disabled (because a custom form was found later)
      if (form.getAttribute('data-trh-disabled')) {
        logger.log('Skipping disabled form submission');
        return;
      }

      logger.log('Form submission intercepted', {
        formClass: form.className,
        isCustom: form.classList.contains('trialhook-form')
      });
      
      // Use the stored email input instead of searching again
      const email = emailInput.value.trim();

      logger.log('Captured email input:', {
        email: email.replace(/(.{2}).+@/, "$1...@"),
        inputElement: emailInput,
        formClass: form.className
      });

      if (isValidEmail(email)) {
        const emailCapture = new EmailCapture();
        emailCapture.captureEmail(email);
      }
      
      if (typeof originalSubmitHandler === 'function') {
        try {
          logger.log('Calling original submit handler');
          const result = originalSubmitHandler.call(form, e);
          if (result === false) {
            logger.log('Original handler prevented form submission');
            e.preventDefault();
          }
        } catch (error) {
          logger.error('Error in original submit handler:', error);
        }
      }
    }, true);
  }

  function setupShadowRootObservation(node) {
    // Only observe relevant elements
    if (!shouldObserveElement(node) || shadowRootWatched.has(node)) {
      return;
    }
    
    shadowRootWatched.add(node);
    logger.debug('Setting up shadow root observation for:', node.tagName);

    // If node already has a shadow root, set up observers immediately
    if (node.shadowRoot) {
      logger.log('Node already has shadow root, setting up observers');
      setupObservers(node.shadowRoot);
      return;
    }

    // Watch for shadow root attachment
    const observer = new MutationObserver((mutations, obs) => {
      if (node.shadowRoot) {
        logger.log('Shadow root attached to observed node, setting up observers');
        setupObservers(node.shadowRoot);
        obs.disconnect();
      }
    });

    try {
      observer.observe(node, { childList: true, subtree: false });
      logger.debug('Successfully set up shadow root observer for node:', node.tagName);
    } catch (error) {
      logger.error('Failed to setup shadow root observer for node:', error);
    }
  }

  function setupObservers(root) {
    logger.log('Setting up observers for root:', root.tagName || 'shadowRoot');

    // Initial form search - using global hasEnhancedCustomForm
    const customForm = findCustomForm(root);
    if (customForm) {
      logger.log('Found custom form during initial setup');
      enhanceForm(customForm, true);
    } else if (!hasEnhancedCustomForm()) {  // Using global function
      // Only look for regular forms if no custom form exists anywhere
      logger.log('No custom form found, falling back to regular form search');
      const formWithEmail = findFormWithEmailInput(root);
      if (formWithEmail) {
        logger.log('Found regular form during initial setup');
        enhanceForm(formWithEmail, false);
      }
    }

    // Setup shadow root observation for all relevant elements
    if (root.querySelectorAll) {
      const relevantElements = Array.from(root.querySelectorAll('*'))
        .filter(shouldObserveElement);
      relevantElements.forEach(setupShadowRootObservation);
    }

    // Create observer for DOM changes
    const observer = new MutationObserver((mutations) => {
      // If we already have an enhanced custom form, don't process any new forms
      if (hasEnhancedCustomForm()) {
        logger.debug('Enhanced custom form already exists, skipping mutation processing');
        return;
      }

      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              // Only check for custom form if we don't already have one enhanced
              if (!hasEnhancedCustomForm()) {
                const customForm = findCustomForm(node);
                if (customForm && !customForm.getAttribute('data-trh-enhanced')) {
                  logger.log('Found custom form in new mutation');
                  enhanceForm(customForm, true);
                  return;
                }
              }

              // Set up shadow root observation if relevant
              if (shouldObserveElement(node)) {
                setupShadowRootObservation(node);
              }

              // Only look for regular forms if no custom form exists anywhere
              if (!hasEnhancedCustomForm()) {
                const formWithEmail = findFormWithEmailInput(node);
                if (formWithEmail && !formWithEmail.getAttribute('data-trh-disabled')) {
                  logger.log('Found regular form in new mutation');
                  enhanceForm(formWithEmail, false);
                }
              }

              // Check for relevant elements in the new node
              if (node.querySelectorAll) {
                const relevantElements = Array.from(node.querySelectorAll('*'))
                  .filter(shouldObserveElement);
                relevantElements.forEach(setupShadowRootObservation);
              }
            }
          });
        }
      });
    });

    try {
      observer.observe(root, {
        childList: true,
        subtree: true
      });
      logger.log('Successfully set up observer for', root.tagName || 'shadowRoot');
    } catch (error) {
      logger.error('Failed to setup observer:', error);
    }
  }

  function hasEnhancedCustomForm() {
    // Check in main document first
    const enhancedForm = document.querySelector('form.trialhook-form[data-trh-enhanced="true"]');
    if (enhancedForm) {
      return true;
    }

    // Check in all shadow roots
    function checkShadowRoots(root) {
      if (!root) return false;
      
      // Check current root if it has querySelector
      if (root.querySelector) {
        const formInRoot = root.querySelector('form.trialhook-form[data-trh-enhanced="true"]');
        if (formInRoot) return true;
      }

      // Check all shadow roots in children
      const elements = root.querySelectorAll('*');
      for (const el of elements) {
        if (el.shadowRoot) {
          if (checkShadowRoots(el.shadowRoot)) return true;
        }
      }

      return false;
    }

    // Check all shadow roots in the document
    return checkShadowRoots(document.documentElement);
  }

  // Initialize when DOM is ready
  function initialize() {
    logger.log('Initializing TrialHook Capture');
    
    // Make sure the DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setupObservers(document.documentElement);
      });
    } else {
      setupObservers(document.documentElement);
    }
  }

  // Performance-optimized initialization
  if (window.requestIdleCallback) {
    logger.debug('Using requestIdleCallback for initialization');
    window.requestIdleCallback(initialize);
  } else {
    logger.debug('Falling back to setTimeout for initialization');
    setTimeout(initialize, 0);
  }

  logger.log('TrialHook Capture Script Loaded');
})();
