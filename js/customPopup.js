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
        const nearbySection = this.container.querySelector('.nearby-chargers-section');
        const chargersList = nearbySection.querySelector('.nearby-chargers-list');
        if (!chargersList) {
            console.error('Chargers list not found');
            return;
        }

        chargersList.innerHTML = '<div class="loading">Loading nearby chargers...</div>';

        let getChargersFunc;
        try {
            const api = await import('./api.js');
            getChargersFunc = api.getChargers;
        } catch (error) {
            console.error("Error importing getChargers:", error);
            chargersList.innerHTML = `
                <div class="error-message">
                    Failed to load chargers. Please try again.
                    <button onclick="updateNearbyChargers(this.closest('.nearby-section'))">Try Again</button>
                </div>`;
            return;
        }

        try {
            const chargers = await getChargersFunc();
            console.log('Fetched chargers:', chargers);

            if (!chargers || chargers.length === 0) {
                chargersList.innerHTML = `
                    <div class="no-chargers">
                        <p>No chargers found in your area.</p>
                        <button onclick="updateNearbyChargers(this.closest('.nearby-section'))">Try Again</button>
                    </div>`;
                return;
            }

            // Sort chargers by distance
            const sortedChargers = chargers.sort((a, b) => {
                const distA = a.AddressInfo?.Distance || Infinity;
                const distB = b.AddressInfo?.Distance || Infinity;
                return distA - distB;
            });

            const chargerItems = sortedChargers.map(charger => {
                const distance = charger.AddressInfo?.Distance 
                    ? `${charger.AddressInfo.Distance.toFixed(1)} miles`
                    : 'Distance unknown';
                
                const connectors = charger.Connections
                    ?.map(conn => `${conn.ConnectionType?.Title || 'Unknown'} (${conn.PowerKW || '?'}kW)`)
                    .join(', ') || 'No connector info';

                return `
                    <div class="charger-item" onclick="showChargerDetails('${charger.ID}')">
                        <div class="charger-header">
                            <h3>${charger.AddressInfo?.Title || 'Unnamed Location'}</h3>
                            <span class="distance">${distance}</span>
                        </div>
                        <div class="charger-details">
                            <p class="address">${charger.AddressInfo?.AddressLine1 || ''}</p>
                            <p class="connectors">${connectors}</p>
                        </div>
                    </div>`;
            }).join('');

            chargersList.innerHTML = chargerItems;

            // Add styles for the charger items
            const style = document.createElement('style');
            style.textContent = `
                .charger-item {
                    padding: 15px;
                    border-bottom: 1px solid #eee;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .charger-item:hover {
                    background-color: #f5f5f5;
                }
                .charger-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 8px;
                }
                .charger-header h3 {
                    margin: 0;
                    font-size: 16px;
                    color: #333;
                }
                .distance {
                    color: #666;
                    font-size: 14px;
                }
                .charger-details {
                    font-size: 14px;
                }
                .address {
                    color: #666;
                    margin: 4px 0;
                }
                .connectors {
                    color: #444;
                    margin: 4px 0;
                }
                .loading {
                    text-align: center;
                    padding: 20px;
                    color: #666;
                }
                .error-message, .no-chargers {
                    text-align: center;
                    padding: 20px;
                    color: #666;
                }
                .error-message button, .no-chargers button {
                    margin-top: 10px;
                    padding: 8px 16px;
                    background-color: #007bff;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                .error-message button:hover, .no-chargers button:hover {
                    background-color: #0056b3;
                }
            `;
            document.head.appendChild(style);

        } catch (error) {
            console.error('Error fetching chargers:', error);
            chargersList.innerHTML = `
                <div class="error-message">
                    Failed to load chargers. Please try again.
                    <button onclick="updateNearbyChargers(this.closest('.nearby-section'))">Try Again</button>
                </div>`;
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