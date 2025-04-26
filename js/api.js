// api.js
// This file handles API requests for the ChargeNear application, including fetching charger data and address suggestions.

export async function getChargers(lat, lon, filters) {
    try {
        console.log(`Attempting to fetch chargers for lat: ${lat}, lon: ${lon}, filters:`, filters);
        
        // Increased distance parameter to show more chargers
        const distance = 100; // Increased from 50 to 100 miles
        
        // Try using direct OpenChargeMap API first
        const apiKey = 'b61c6aab-6cef-43a9-af78-215cb02d1464'; // Using the same key as the Lambda
        const ocmApiUrl = `https://api.openchargemap.io/v3/poi/?output=json&latitude=${lat}&longitude=${lon}&distance=${distance}&distanceunit=Miles&maxresults=100&key=${apiKey}`;
        
        console.log(`API Request URL: ${ocmApiUrl}`);
        
        try {
            // Try direct API call first
            const response = await fetch(ocmApiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            
            let chargers = await response.json();
            console.log(`Total chargers before filtering: ${chargers.length}`);
            
            // Log all operator names for debugging
            const operatorNames = new Set(chargers.map(charger => charger.OperatorInfo?.Title).filter(Boolean));
            console.log('Available operators:', Array.from(operatorNames));
            
            // Debug: Log Tesla charger connection types
            const teslaChargers = chargers.filter(charger => 
                charger.OperatorInfo && 
                charger.OperatorInfo.Title === 'Tesla (Tesla-only charging)'
            );
            console.log('Tesla chargers found:', teslaChargers.length);
            teslaChargers.forEach(charger => {
                console.log('Tesla charger details:', {
                    title: charger.AddressInfo?.Title,
                    connections: charger.Connections?.map(conn => ({
                        type: conn.ConnectionType?.Title,
                        level: conn.LevelID,
                        power: conn.PowerKW,
                        status: conn.StatusType?.Title,
                        quantity: conn.Quantity
                    }))
                });
            });
            
            // Apply filters
            if (Object.values(filters).some(value => value === true)) {
                const originalChargers = [...chargers];
                chargers = chargers.filter(charger => {
                    // Check if charger matches any of the selected filters
                    const isFast = filters.fastOnly && charger.Connections && charger.Connections.some(conn => conn.LevelID === 3);
                    const isLevel2 = filters.level2Only && charger.Connections && charger.Connections.some(conn => conn.LevelID === 2);
                    
                    // Check for Tesla Superchargers
                    const isTeslaSupercharger = filters.teslaSupercharger && 
                        charger.OperatorInfo && 
                        charger.OperatorInfo.Title === 'Tesla (Tesla-only charging)' &&
                        charger.Connections && 
                        charger.Connections.some(conn => 
                            conn.ConnectionType && 
                            (
                                conn.ConnectionType.Title === 'NACS / Tesla Supercharger' ||
                                conn.ConnectionType.Title === 'Tesla Supercharger' ||
                                conn.ConnectionType.Title === 'Tesla (Model S/X)' ||
                                (conn.LevelID === 3 && conn.PowerKW && conn.PowerKW >= 72)
                            )
                        );
                    
                    // Check for Tesla Destination Chargers
                    const isTeslaDestination = filters.teslaDestination && 
                        charger.OperatorInfo && 
                        charger.OperatorInfo.Title === 'Tesla (Tesla-only charging)' &&
                        charger.Connections && 
                        charger.Connections.some(conn => 
                            conn.ConnectionType && 
                            (
                                conn.ConnectionType.Title === 'Tesla Destination' ||
                                conn.ConnectionType.Title === 'Tesla (Model S/X)' ||
                                (conn.LevelID === 2 && conn.PowerKW && conn.PowerKW < 72)
                            )
                        );
                    
                    // Check network providers
                    const isChargePoint = filters.chargepointOnly && charger.OperatorInfo && charger.OperatorInfo.Title === 'ChargePoint';
                    const isElectrifyAmerica = filters.electrifyAmerica && charger.OperatorInfo && charger.OperatorInfo.Title === 'Electrify America';
                    const isEVgo = filters.evgo && charger.OperatorInfo && charger.OperatorInfo.Title === 'EVgo';
                    const isBlink = filters.blink && charger.OperatorInfo && charger.OperatorInfo.Title === 'Blink Charging';
                    
                    // Check operational status
                    const isOperational = !filters.operationalOnly || (charger.StatusType && charger.StatusType.Title === 'Operational');
                    
                    // Check power output
                    const hasHighPower = filters.highPower && charger.Connections && charger.Connections.some(conn => conn.PowerKW && conn.PowerKW >= 150);
                    const hasMediumPower = filters.mediumPower && charger.Connections && charger.Connections.some(conn => conn.PowerKW && conn.PowerKW >= 50 && conn.PowerKW < 150);
                    const hasLowPower = filters.lowPower && charger.Connections && charger.Connections.some(conn => conn.PowerKW && conn.PowerKW < 50);
                    
                    // Return true if any of the selected filters match
                    return (isFast || isLevel2 || isTeslaSupercharger || isTeslaDestination || 
                            isChargePoint || isElectrifyAmerica || isEVgo || isBlink || 
                            hasHighPower || hasMediumPower || hasLowPower) && isOperational;
                });
                
                // Log filter results
                if (filters.fastOnly) {
                    const fastCount = originalChargers.filter(charger => 
                        charger.Connections && charger.Connections.some(conn => conn.LevelID === 3)
                    ).length;
                    console.log(`Fast chargers found: ${fastCount}`);
                }
                
                if (filters.teslaSupercharger) {
                    const superchargerCount = originalChargers.filter(charger => 
                        charger.OperatorInfo && 
                        charger.OperatorInfo.Title === 'Tesla (Tesla-only charging)' &&
                        charger.Connections && 
                        charger.Connections.some(conn => 
                            conn.ConnectionType && 
                            (
                                conn.ConnectionType.Title === 'NACS / Tesla Supercharger' ||
                                conn.ConnectionType.Title === 'Tesla Supercharger' ||
                                conn.ConnectionType.Title === 'Tesla (Model S/X)' ||
                                (conn.LevelID === 3 && conn.PowerKW && conn.PowerKW >= 72)
                            )
                        )
                    ).length;
                    console.log(`Tesla Superchargers found: ${superchargerCount}`);
                }
                
                if (filters.teslaDestination) {
                    const destinationCount = originalChargers.filter(charger => 
                        charger.OperatorInfo && 
                        charger.OperatorInfo.Title === 'Tesla (Tesla-only charging)' &&
                        charger.Connections && 
                        charger.Connections.some(conn => 
                            conn.ConnectionType && 
                            (
                                conn.ConnectionType.Title === 'Tesla Destination' ||
                                conn.ConnectionType.Title === 'Tesla (Model S/X)' ||
                                (conn.LevelID === 2 && conn.PowerKW && conn.PowerKW < 72)
                            )
                        )
                    ).length;
                    console.log(`Tesla Destination Chargers found: ${destinationCount}`);
                }
                
                if (filters.chargepointOnly) {
                    const chargepointCount = originalChargers.filter(charger => 
                        charger.OperatorInfo && charger.OperatorInfo.Title === 'ChargePoint'
                    ).length;
                    console.log(`ChargePoint chargers found: ${chargepointCount}`);
                }
                
                console.log(`Final number of chargers after filters: ${chargers.length}`);
            }
            
            if (chargers.length === 0) {
                console.warn("No chargers found in this area");
            }
            
            return chargers;
        } catch (directError) {
            console.warn("Direct API call failed, trying with CORS proxy:", directError);
            
            // Fallback to CORS proxy if direct call fails
            const corsProxy = 'https://corsproxy.io/?';
            const proxyUrl = corsProxy + encodeURIComponent(ocmApiUrl);
            
            console.log(`Trying with CORS proxy: ${proxyUrl}`);
            
            const proxyResponse = await fetch(proxyUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });
            
            if (!proxyResponse.ok) {
                throw new Error(`Proxy request failed with status: ${proxyResponse.status}`);
            }
            
            let chargers = await proxyResponse.json();
            console.log(`Total chargers before filtering (proxy): ${chargers.length}`);
            
            // Log all operator names for debugging
            const operatorNames = new Set(chargers.map(charger => charger.OperatorInfo?.Title).filter(Boolean));
            console.log('Available operators (proxy):', Array.from(operatorNames));
            
            // Debug: Log Tesla charger connection types
            const proxyTeslaChargers = chargers.filter(charger => 
                charger.OperatorInfo && 
                charger.OperatorInfo.Title === 'Tesla (Tesla-only charging)'
            );
            console.log('Tesla chargers found (proxy):', proxyTeslaChargers.length);
            proxyTeslaChargers.forEach(charger => {
                console.log('Tesla charger details (proxy):', {
                    title: charger.AddressInfo?.Title,
                    connections: charger.Connections?.map(conn => ({
                        type: conn.ConnectionType?.Title,
                        level: conn.LevelID,
                        power: conn.PowerKW,
                        status: conn.StatusType?.Title,
                        quantity: conn.Quantity
                    }))
                });
            });
            
            // Apply filters
            if (Object.values(filters).some(value => value === true)) {
                const originalChargers = [...chargers];
                chargers = chargers.filter(charger => {
                    // Check if charger matches any of the selected filters
                    const isFast = filters.fastOnly && charger.Connections && charger.Connections.some(conn => conn.LevelID === 3);
                    const isLevel2 = filters.level2Only && charger.Connections && charger.Connections.some(conn => conn.LevelID === 2);
                    
                    // Check for Tesla Superchargers
                    const isTeslaSupercharger = filters.teslaSupercharger && 
                        charger.OperatorInfo && 
                        charger.OperatorInfo.Title === 'Tesla (Tesla-only charging)' &&
                        charger.Connections && 
                        charger.Connections.some(conn => 
                            conn.ConnectionType && 
                            (
                                conn.ConnectionType.Title === 'NACS / Tesla Supercharger' ||
                                conn.ConnectionType.Title === 'Tesla Supercharger' ||
                                conn.ConnectionType.Title === 'Tesla (Model S/X)' ||
                                (conn.LevelID === 3 && conn.PowerKW && conn.PowerKW >= 72)
                            )
                        );
                    
                    // Check for Tesla Destination Chargers
                    const isTeslaDestination = filters.teslaDestination && 
                        charger.OperatorInfo && 
                        charger.OperatorInfo.Title === 'Tesla (Tesla-only charging)' &&
                        charger.Connections && 
                        charger.Connections.some(conn => 
                            conn.ConnectionType && 
                            (
                                conn.ConnectionType.Title === 'Tesla Destination' ||
                                conn.ConnectionType.Title === 'Tesla (Model S/X)' ||
                                (conn.LevelID === 2 && conn.PowerKW && conn.PowerKW < 72)
                            )
                        );
                    
                    // Check network providers
                    const isChargePoint = filters.chargepointOnly && charger.OperatorInfo && charger.OperatorInfo.Title === 'ChargePoint';
                    const isElectrifyAmerica = filters.electrifyAmerica && charger.OperatorInfo && charger.OperatorInfo.Title === 'Electrify America';
                    const isEVgo = filters.evgo && charger.OperatorInfo && charger.OperatorInfo.Title === 'EVgo';
                    const isBlink = filters.blink && charger.OperatorInfo && charger.OperatorInfo.Title === 'Blink Charging';
                    
                    // Check operational status
                    const isOperational = !filters.operationalOnly || (charger.StatusType && charger.StatusType.Title === 'Operational');
                    
                    // Check power output
                    const hasHighPower = filters.highPower && charger.Connections && charger.Connections.some(conn => conn.PowerKW && conn.PowerKW >= 150);
                    const hasMediumPower = filters.mediumPower && charger.Connections && charger.Connections.some(conn => conn.PowerKW && conn.PowerKW >= 50 && conn.PowerKW < 150);
                    const hasLowPower = filters.lowPower && charger.Connections && charger.Connections.some(conn => conn.PowerKW && conn.PowerKW < 50);
                    
                    // Return true if any of the selected filters match
                    return (isFast || isLevel2 || isTeslaSupercharger || isTeslaDestination || 
                            isChargePoint || isElectrifyAmerica || isEVgo || isBlink || 
                            hasHighPower || hasMediumPower || hasLowPower) && isOperational;
                });
                
                // Log filter results
                if (filters.fastOnly) {
                    const fastCount = originalChargers.filter(charger => 
                        charger.Connections && charger.Connections.some(conn => conn.LevelID === 3)
                    ).length;
                    console.log(`Fast chargers found (proxy): ${fastCount}`);
                }
                
                if (filters.teslaSupercharger) {
                    const superchargerCount = originalChargers.filter(charger => 
                        charger.OperatorInfo && 
                        charger.OperatorInfo.Title === 'Tesla (Tesla-only charging)' &&
                        charger.Connections && 
                        charger.Connections.some(conn => 
                            conn.ConnectionType && 
                            (
                                conn.ConnectionType.Title === 'NACS / Tesla Supercharger' ||
                                conn.ConnectionType.Title === 'Tesla Supercharger' ||
                                conn.ConnectionType.Title === 'Tesla (Model S/X)' ||
                                (conn.LevelID === 3 && conn.PowerKW && conn.PowerKW >= 72)
                            )
                        )
                    ).length;
                    console.log(`Tesla Superchargers found (proxy): ${superchargerCount}`);
                }
                
                if (filters.teslaDestination) {
                    const destinationCount = originalChargers.filter(charger => 
                        charger.OperatorInfo && 
                        charger.OperatorInfo.Title === 'Tesla (Tesla-only charging)' &&
                        charger.Connections && 
                        charger.Connections.some(conn => 
                            conn.ConnectionType && 
                            (
                                conn.ConnectionType.Title === 'Tesla Destination' ||
                                conn.ConnectionType.Title === 'Tesla (Model S/X)' ||
                                (conn.LevelID === 2 && conn.PowerKW && conn.PowerKW < 72)
                            )
                        )
                    ).length;
                    console.log(`Tesla Destination Chargers found (proxy): ${destinationCount}`);
                }
                
                if (filters.chargepointOnly) {
                    const chargepointCount = originalChargers.filter(charger => 
                        charger.OperatorInfo && charger.OperatorInfo.Title === 'ChargePoint'
                    ).length;
                    console.log(`ChargePoint chargers found (proxy): ${chargepointCount}`);
                }
                
                console.log(`Final number of chargers after filters (proxy): ${chargers.length}`);
            }
            
            return chargers;
        }
    } catch (error) {
        console.error("Error fetching chargers:", error);
        throw error;
    }
}

export async function getAddressSuggestions(query) {
    try {
        if (typeof window.MAPBOX_TOKEN === 'undefined') {
            console.error("Mapbox token is not defined");
            throw new Error("Mapbox token is not defined. Please ensure config.js is loaded correctly.");
        }
        
        console.log(`Getting address suggestions for query: ${query}`);
        const response = await fetch(
            `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${window.MAPBOX_TOKEN}&autocomplete=true&limit=5`
        );
        if (!response.ok) {
            throw new Error(`Failed to fetch address suggestions: ${response.statusText}`);
        }
        const data = await response.json();
        const suggestions = data.features.map(feature => feature.place_name);
        
        return suggestions;
    } catch (error) {
        console.error("Error fetching address suggestions:", error.message);
        throw error;
    }
}