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
        
        // Create nearby chargers section
        const nearbySection = document.createElement('div');
        nearbySection.className = 'nearby-chargers-section';
        
        this.container.appendChild(closeButton);
        this.container.appendChild(content);
        this.container.appendChild(nearbySection);
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
            background: #f0f4f8;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            transition: all 0.3s ease;
            display: flex;
            flex-direction: column;
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
                max-height: 90vh;
                transform: translateY(100%);
                will-change: transform;
                background: white;
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
                top: ${headerHeight}px;
                left: -100%;
                bottom: 0;
                width: 400px;
                border-radius: 0;
                box-shadow: 2px 0 10px rgba(0,0,0,0.1);
            `;
            
            // Hide overlay on desktop
            this.overlay.style.cssText = `
                display: none;
            `;
        }

        // Style the content sections
        const content = this.container.querySelector('.custom-popup-content');
        content.style.cssText = `
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            flex: none;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
        `;

        const nearbySection = this.container.querySelector('.nearby-chargers-section');
        nearbySection.style.cssText = `
            padding: 20px;
            border-top: 1px solid #e0e7f0;
            background: #fff;
            flex: 1;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            ${this.isMobile ? '' : `
                margin-top: auto;
                max-height: 40%;
            `}
        `;
    }

    setHTML(html) {
        if (!this.container) {
            this.create();
        }
        const content = this.container.querySelector('.custom-popup-content');
        content.innerHTML = html;

        // Add nearby chargers section
        const nearbySection = this.container.querySelector('.nearby-chargers-section');
        nearbySection.innerHTML = `
            <h3 style="margin: 0 0 16px 0; color: #00355F; font-size: 16px;">Nearby Chargers</h3>
            <div class="nearby-chargers-list">
                Loading nearby chargers...
            </div>
        `;

        // Update nearby chargers list with actual data
        this.updateNearbyChargers();
    }

    async updateNearbyChargers() {
        const nearbyList = this.container.querySelector('.nearby-chargers-list');
        if (!nearbyList) return;

        try {
            // Get current map bounds or center point
            const map = await window.getMap();
            if (!map) return;

            const center = map.getCenter();
            const chargers = await window.getChargers(center.lat, center.lng);

            if (!chargers || chargers.length === 0) {
                nearbyList.innerHTML = '<p style="color: #5d6d7e;">No chargers found nearby.</p>';
                return;
            }

            // Sort chargers by distance and take the first 5
            const nearbyChargers = chargers.slice(0, 5);
            
            nearbyList.innerHTML = nearbyChargers.map(charger => {
                const status = charger.StatusType?.Title || 'Unknown';
                const statusColor = status === 'Operational' ? '#4CAF50' : '#f44336';
                const distance = charger.distance ? `${charger.distance.toFixed(1)} mi` : 'N/A';
                
                return `
                    <div style="
                        background: #f8f9fa;
                        border-radius: 8px;
                        padding: 12px;
                        margin-bottom: 12px;
                        cursor: pointer;
                        transition: all 0.2s ease;
                    " onclick="window.showChargerDetails(${charger.ID})">
                        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
                            <div style="font-weight: 500; color: #00355F;">${charger.AddressInfo?.Title || 'Unknown Location'}</div>
                            <div style="color: ${statusColor}; font-size: 12px;">${status}</div>
                        </div>
                        <div style="color: #5d6d7e; font-size: 13px;">${distance}</div>
                    </div>
                `;
            }).join('');

        } catch (error) {
            console.error('Error updating nearby chargers:', error);
            nearbyList.innerHTML = '<p style="color: #5d6d7e;">Error loading nearby chargers.</p>';
        }
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
            this.container.style.left = '0';
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
            this.container.style.left = '-100%';
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