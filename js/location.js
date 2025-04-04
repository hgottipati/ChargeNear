// location.js
export const currentLocationCoords = { lat: null, lon: null };

export async function getCurrentLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            console.error("Geolocation not supported by this browser");
            reject(new Error("Geolocation is not supported by this browser."));
            return;
        }

        console.log("Requesting current location...");
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                console.log(`Location fetched successfully: lat=${lat}, lon=${lon}`);
                resolve({ lat, lon });
            },
            (error) => {
                console.error("Geolocation error:", error.message, "Code:", error.code);
                // Provide more specific error messages based on the code
                let errorMessage = "Couldn’t get your location.";
                if (error.code === 1) {
                    errorMessage = "Location access denied by user.";
                } else if (error.code === 2) {
                    errorMessage = "Unable to determine your location. Please ensure location services are enabled on your device.";
                } else if (error.code === 3) {
                    errorMessage = "Location request timed out. Please check your network connection.";
                }
                reject(new Error(errorMessage));
            },
            { timeout: 30000, enableHighAccuracy: true, maximumAge: 0 }
        );
    });
}