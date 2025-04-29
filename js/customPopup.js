// customPopup.js
export class CustomPopup {
    constructor(options = {}) {
        this.options = {
            maxWidth: '350px',
            ...options
        };
        this.container = null;
        this.isOpen = false;
        this.isMobile = window.innerWidth <= 768;
    }

    create() {
        // Create the popup container
        this.container = document.createElement('div');
        this.container.className = 'custom-popup';
        // Initial style will be set in applyStyle()

        // Add close button
        const closeButton = document.createElement('button');
        closeButton.className = 'custom-popup-close';
        closeButton.innerHTML = '×';
        closeButton.style.cssText = `
            position: absolute;
            top: 12px;
            right: 12px;
            background: none;
            border: none;
            font-size: 24px;
            color: #5d6d7e;
            cursor: pointer;
            padding: 4px;
            line-height: 1;
            z-index: 1;
        `;
        closeButton.onclick = () => this.close();

        // Add content container
        const content = document.createElement('div');
        content.className = 'custom-popup-content';
        content.style.cssText = `
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
        `;

        this.container.appendChild(closeButton);
        this.container.appendChild(content);
        document.body.appendChild(this.container);

        // Add overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'custom-popup-overlay';
        this.overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            opacity: 0;
            transition: opacity 0.3s ease;
            z-index: 999;
            pointer-events: none;
        `;
        document.body.appendChild(this.overlay);

        // Add event listener for window resize
        window.addEventListener('resize', () => {
            const wasMobile = this.isMobile;
            this.isMobile = window.innerWidth <= 768;
            if (wasMobile !== this.isMobile && this.isOpen) {
                this.close();
                this.open();
            }
        });
    }

    applyStyle() {
        this.isMobile = window.innerWidth <= 768;
        this.container.style.cssText = `
            position: fixed;
            background: #f0f4f8;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            transition: all 0.3s ease;
            max-width: ${this.options.maxWidth};
            width: 100%;
            ${this.isMobile ? `
                bottom: -100%;
                left: 0;
                right: 0;
                border-radius: 16px 16px 0 0;
                max-height: 80vh;
                overflow-y: auto;
            ` : `
                top: 50%;
                left: -100%;
                transform: translateY(-50%);
                max-height: 90vh;
                overflow-y: auto;
                margin-left: 20px;
            `}
        `;
    }

    setHTML(html) {
        if (!this.container) {
            this.create();
        }
        const content = this.container.querySelector('.custom-popup-content');
        content.innerHTML = html;
    }

    open() {
        if (!this.container) {
            this.create();
        }
        this.applyStyle(); // Always apply the correct style
        this.isOpen = true;
        this.container.style.display = 'block';
        this.overlay.style.display = 'block';
        // Trigger reflow
        this.container.offsetHeight;
        if (this.isMobile) {
            this.container.style.bottom = '0';
        } else {
            this.container.style.left = '0';
        }
        this.overlay.style.opacity = '1';
        this.overlay.style.pointerEvents = 'auto';
    }

    close() {
        if (!this.container) return;
        
        this.isOpen = false;
        
        if (this.isMobile) {
            this.container.style.bottom = '-100%';
        } else {
            this.container.style.left = '-100%';
        }
        
        this.overlay.style.opacity = '0';
        this.overlay.style.pointerEvents = 'none';
        
        // Remove after animation
        setTimeout(() => {
            this.container.style.display = 'none';
            this.overlay.style.display = 'none';
        }, 300);
    }

    remove() {
        if (this.container) {
            this.container.remove();
            this.overlay.remove();
            this.container = null;
            this.overlay = null;
        }
    }
} 