from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import json
import os
import requests

app = Flask(__name__)
CORS(app)

DATA_FILE = 'visits.json'

def get_country_from_ip(ip_address):
    if ip_address == '127.0.0.1':
        return 'Local'
    try:
        response = requests.get(f'http://ip-api.com/json/{ip_address}')
        data = response.json()
        if data['status'] == 'success':
            return data.get('country', 'Unknown')
        return 'Unknown'
    except Exception:
        return 'Unknown'

def load_visits():
    if not os.path.exists(DATA_FILE):
        return {}
    with open(DATA_FILE, 'r') as f:
        return json.load(f)

def save_visits(data):
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=2)

@app.route('/api/visits')
def get_visits():
    return jsonify(load_visits())

@app.route('/api/visit', methods=['POST'])
def record_visit():
    ip_address = request.remote_addr
    country = get_country_from_ip(ip_address)
    
    visits = load_visits()
    
    if country in visits:
        visits[country]['visits'] += 1
    else:
        # A bit of a simplification, we don't know the flag for every country code
        # but this is a reasonable default.
        visits[country] = {'visits': 1, 'flag': '🌐'}

    save_visits(visits)
    return jsonify(success=True)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True) 