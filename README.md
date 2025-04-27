<p align="center">
  <a href="https://chargenear.org">
    <h2>
      <strong>ChargeNear.org</strong>
    </h2>
  </a>
</p>

[![ChargeNear](https://img.shields.io/badge/Visit-ChargeNear.org-blue?logo=electric-vehicle&logoColor=white)](https://chargenear.org)


![ChargeNear Map](https://github.com/hgottipati/ChargeNear/blob/main/docs/screenshot.png)


# ChargeNear
An interactive, open-source map for hotels and Airbnb hosts to display nearby EV chargers, helping attract electric vehicle-owning guests.

## Features
- Defaults to the user's current location (with permission), falls back to Austin, TX if denied.
- Advanced filtering options:
  - Charger Types: Level 2 and Level 3 (DC Fast) chargers
  - Network Providers: Tesla Superchargers, Tesla Destination, ChargePoint, Electrify America, EVgo, Blink, Volta, Shell Recharge, EV Connect, and SemaConnect
  - Charger Status: Operational only
  - Power Output: High power (150kW+), Medium power (50-150kW), Low power (<50kW)
- Custom markers with color coding:
  - Green for operational chargers
  - Light orange for high-power chargers
  - Brown for non-operational chargers
- Built with Mapbox GL JS and the Open Charge Map API.
- Responsive design that works well on both desktop and mobile devices.

## Why It's Useful
Hotels and Airbnb hosts can embed this map on their websites to:
- Showcase nearby public EV chargers, even if they don't have on-site charging.
- Appeal to the growing number of EV drivers, boosting bookings.
- Provide a free, interactive tool that enhances guest convenience.
- Allow guests to filter chargers based on their specific needs (e.g., Tesla Superchargers, high-power chargers).

## How to Embed on Your Website
This tool is **free to use** and open-source! Embed it in two easy ways:

### Option 1: Embed with a Specific Address
Copy this iframe code into your website's HTML, replacing the address with your property's:
```html
<iframe src="https://Chargenear.org/?address=123+Main+St,+Austin,+TX" width="800" height="600" frameborder="0" style="border:0;" allowfullscreen></iframe>
```

### Option 2: Embed with Current Location
Copy this iframe code into your website's HTML:
```html
<iframe src="https://Chargenear.org" width="800" height="600" frameborder="0" style="border:0;" allowfullscreen></iframe>
```

### Customization Tips
- Adjust width and height in the iframe to fit your site's layout.
- Add URL parameters for defaults:
  - ?address=123+Main+St,+Austin,+TX to set a specific address
  - ?fastOnly=true to show only fast chargers
  - Example: https://chargenear.org?address=123+Main+St,+Austin,+TX&fastOnly=true

### Architecture Diagram
<img src="https://github.com/hgottipati/ChargeNear/blob/main/docs/chargenear_architecture.png" alt="ChargeNear Architecture" width="600">

## Setup for Developers
1. Clone the repo:
```bash
git clone https://github.com/hgottipati/ChargeNear.git
```
2. Replace the Mapbox token in index.html with your own (get one at mapbox.com).
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
* Production version: https://chargenear.org 

## License
Free to use under the MIT License—see LICENSE for details.

## Future Enhancements
- Add real-time availability data
- Support custom marker uploads
- Add more detailed charger information
- Implement user preferences saving
