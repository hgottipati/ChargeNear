![Uploading image.png…]()


# EV-Friendly Hosts
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
<iframe src="https://hgottipati.github.io/ev-friendly-hosts?address=123+Main+St,+Austin,+TX" width="800" height="600" frameborder="0" style="border:0;" allowfullscreen></iframe>
```

### Option 2: Embed with Current Location
Copy this iframe code into your website’s HTML:
```html
<iframe src="https://hgottipati.github.io/ev-friendly-hosts" width="800" height="600" frameborder="0" style="border:0;" allowfullscreen></iframe>
```

## License
MIT License

Copyright (c) 2025 Hareesh Gottipati

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
