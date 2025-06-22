// customPopup.js
export class CustomPopup {
    constructor(options = {}) {
        this.options = {
            maxWidth: '400px',
            ...options
        };
        this.container = null;
        this.isOpen = false;
        // Use both innerWidth and userAgent to better detect mobile
        this.isMobile = this.checkIfMobile();
    }

    checkIfMobile() {
        const width = window.innerWidth;
        const userAgent = navigator.userAgent.toLowerCase();
        const isMobileDevice = /iphone|ipad|ipod|android|webos|windows phone/i.test(userAgent);
        return width <= 768 || isMobileDevice;
    }

    create() {
        // Create the popup container
        this.container = document.createElement('div');
        this.container.className = 'custom-popup';
        
        // Add close button
        const closeButton = document.createElement('button');
        closeButton.className = 'custom-popup-close';
        closeButton.innerHTML = '×';
        closeButton.style.cssText = `
            position: absolute;
            top: 16px;
            right: 16px;
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

        // Create main content container
        const content = document.createElement('div');
        content.className = 'custom-popup-content';
        
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
            this.isMobile = this.checkIfMobile();
            if (wasMobile !== this.isMobile && this.isOpen) {
                this.close();
                this.open();
            }
        });

        // Add touch event handlers for mobile
        let startY = 0;
        let currentY = 0;
        
        this.container.addEventListener('touchstart', (e) => {
            if (!this.isMobile) return;
            startY = e.touches[0].clientY;
            this.container.style.transition = 'none';
        });

        this.container.addEventListener('touchmove', (e) => {
            if (!this.isMobile) return;
            currentY = e.touches[0].clientY;
            const deltaY = currentY - startY;
            
            if (deltaY > 0) { // Only allow dragging down
                e.preventDefault();
                this.container.style.transform = `translateY(${deltaY}px)`;
            }
        });

        this.container.addEventListener('touchend', () => {
            if (!this.isMobile) return;
            this.container.style.transition = 'all 0.3s ease';
            const deltaY = currentY - startY;
            
            if (deltaY > 100) { // If dragged down more than 100px, close
                this.close();
            } else {
                this.container.style.transform = 'translateY(0)';
            }
        });
    }

    applyStyle() {
        this.isMobile = this.checkIfMobile();
        const headerHeight = document.querySelector('.header')?.offsetHeight || 0;
        
        // Base styles for both mobile and desktop
        let baseStyles = `
            position: fixed;
            background: white;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
            max-height: 90vh;
            overflow-y: auto;
        `;

        // Mobile-specific styles
        if (this.isMobile) {
            this.container.style.cssText = `
                ${baseStyles}
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                width: 100%;
                border-radius: 16px 16px 0 0;
                transform: translateY(100%);
                will-change: transform;
            `;
            
            // Show overlay on mobile
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
        } else {
            // Desktop styles
            this.container.style.cssText = `
                ${baseStyles}
                top: ${headerHeight + 20}px;
                left: 20px;
                width: 400px;
                border-radius: 8px;
                transform: translateX(-120%);
            `;
            
            // Hide overlay on desktop
            this.overlay.style.cssText = `
                display: none;
            `;
        }

        // Style the content section
        const content = this.container.querySelector('.custom-popup-content');
        content.style.cssText = `
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
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
        this.applyStyle();
        this.isOpen = true;
        this.container.style.display = 'flex';
        
        if (this.isMobile) {
            this.overlay.style.display = 'block';
            // Force reflow
            this.container.offsetHeight;
            this.overlay.offsetHeight;
            
            requestAnimationFrame(() => {
                this.container.style.transform = 'translateY(0)';
                this.overlay.style.opacity = '1';
                this.overlay.style.pointerEvents = 'auto';
            });
        } else {
            requestAnimationFrame(() => {
                this.container.style.transform = 'translateX(0)';
            });
        }
    }

    close() {
        if (!this.container) return;
        
        this.isOpen = false;
        
        if (this.isMobile) {
            this.container.style.transform = 'translateY(100%)';
            this.overlay.style.opacity = '0';
            this.overlay.style.pointerEvents = 'none';
        } else {
            this.container.style.transform = 'translateX(-120%)';
        }
        
        setTimeout(() => {
            if (!this.isOpen) {
                this.container.style.display = 'none';
                if (this.isMobile) {
                    this.overlay.style.display = 'none';
                }
            }
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