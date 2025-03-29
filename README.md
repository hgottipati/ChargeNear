![ChargeNear Map](https://github.com/hgottipati/ChargeNear/blob/main/screenshot.jpg)


# ChargeNear
An interactive, open-source map for hotels and Airbnb hosts to display nearby EV chargers, helping attract electric vehicle-owning guests.

## Features
- Defaults to the user's current location (with permission), falls back to Austin, TX if denied.
- Filters by walking (0.5 miles) or driving (5 or 10 miles) distance, with an option for fast chargers only (Level 3/DC Fast).
- Custom markers: green for the property, blue for chargers.
- Built with Leaflet.js and the Open Charge Map API.

## Why It’s Useful
Hotels and Airbnb hosts can embed this map on their websites to:
- Showcase nearby public EV chargers, even if they don’t have on-site charging.
- Appeal to the growing number of EV drivers, boosting bookings.
- Provide a free, interactive tool that enhances guest convenience.

## How to Embed on Your Website
This tool is **free to use** and open-source! Embed it in two easy ways:

### Option 1: Embed with a Specific Address
Copy this iframe code into your website’s HTML, replacing the address with your property’s:
```html
<iframe src="https://hgottipati.github.io/ChargeNear?address=123+Main+St,+Austin,+TX" width="800" height="600" frameborder="0" style="border:0;" allowfullscreen></iframe>
```

### Option 2: Embed with Current Location
Copy this iframe code into your website’s HTML:
```html
<iframe src="https://hgottipati.github.io/ChargeNear" width="800" height="600" frameborder="0" style="border:0;" allowfullscreen></iframe>
```

### Customization Tips
- Adjust width and height in the iframe to fit your site’s layout.
- Add URL parameters for defaults:
  - ?distance=5 (or 0.5, 10) to set the search radius.
  - ?fastOnly=true to show only fast chargers.
  - Example: https://hgottipati.github.io/ChargeNear?address=123+Main+St,+Austin,+TX&distance=5&fastOnly=true.

## Setup for Developers
1. Clone the repo:
```bash
git clone https://github.com/hgottipati/ChargeNear.git
```
2. Replace the API key in script.js with your own Open Charge Map key (get one at openchargemap.org).
3. Install dependencies:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
4. Run locally:
```bash
python3 -m http.server 8000
```
5. Visit http://localhost:8000.

## Demo
Live version: https://hgottipati.github.io/ChargeNear


## License
Free to use under the MIT License—see LICENSE for details.

## Future Enhancements
- Add more charger type filters (e.g., Level 2).
- Integrate real-time availability data.
- Support custom marker uploads.