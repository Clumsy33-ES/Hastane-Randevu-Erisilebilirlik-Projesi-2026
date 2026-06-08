import requests

BASE = 'http://localhost:8000'

endpoints = [
    "/locations/cities",
    "/locations/districts/1",
    "/branches",
    "/hospitals",
    "/doctors",
    "/hospitals/nearby?lat=41.0&lng=29.0",
    "/appointments/slots?hospital_id=1&branch_id=1"
]

print("Testing public endpoints WITHOUT token:")
for ep in endpoints:
    url = f"{BASE}{ep}"
    try:
        r = requests.get(url, timeout=2)
        print(f"{ep:<45} -> {r.status_code}")
    except Exception as e:
        print(f"{ep:<45} -> ERROR: {e}")
