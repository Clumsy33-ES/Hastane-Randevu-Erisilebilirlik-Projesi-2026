import sys
import os
import requests
import json

os.environ['PYTHONIOENCODING'] = 'utf-8'

BASE = 'http://localhost:8000'
results = {}

def report(k, v):
    results[k] = v
    status = 'PASS' if v.startswith('PASS') else ('SKIP' if v.startswith('SKIP') else 'FAIL')
    print(f"[{status}] {k}: {v}")

print("--- STARTING TESTS ---")

try:
    # 1. Health
    r = requests.get(f"{BASE}/hospitals", timeout=5)
    report('Backend Health', 'PASS' if r.status_code == 200 else f'FAIL ({r.status_code})')

    # 2. Register
    reg_data = {
        'tc_no': '55566677788',
        'full_name': 'Test Kullanici',
        'password': 'Test1234',
        'role': 'admin' # Role injection test
    }
    r = requests.post(f"{BASE}/auth/register", json=reg_data)
    if r.status_code in (200, 201):
        report('Register', 'PASS')
    elif r.status_code == 400 and "kayıtlı kullanıcı" in r.text:
        report('Register', 'PASS (Already exists)')
    else:
        report('Register', f'FAIL ({r.status_code}) {r.text}')

    # 3. Login User
    log_data = {'tc': '55566677788', 'password': 'Test1234'}
    r = requests.post(f"{BASE}/auth/login", json=log_data)
    user_token = ""
    if r.status_code == 200:
        data = r.json()
        role = data.get("role", "N/A")
        user_token = data.get("access_token", "")
        report('Login', 'PASS' if user_token else 'FAIL (No Token)')
        report('Role Injection Blocked', 'PASS' if role == 'user' else f'FAIL (role={role})')
    else:
        report('Login', f'FAIL ({r.status_code}) {r.text}')
        
    # 3.5 Invalid password
    r = requests.post(f"{BASE}/auth/login", json={'tc': '55566677788', 'password': 'WrongPassword1'})
    report('Invalid Password 401', 'PASS' if r.status_code == 401 else f'FAIL ({r.status_code})')

    # 4. Auth headers using JWT
    user_headers = {'Authorization': f'Bearer {user_token}'}

    # 5. Admin Auth tests
    r = requests.get(f"{BASE}/admin/stats", headers=user_headers)
    report('User Access to Admin', 'PASS' if r.status_code == 403 else f'FAIL ({r.status_code})')
    
    r = requests.get(f"{BASE}/admin/stats")
    report('No Token Admin Access', 'PASS' if r.status_code == 401 else f'FAIL ({r.status_code})')

    # Login Admin
    r = requests.post(f"{BASE}/auth/login", json={'tc': '11111111111', 'password': '1234'})
    admin_token = ""
    if r.status_code == 200:
        admin_token = r.json().get("access_token", "")
        report('Admin Login', 'PASS' if admin_token else 'FAIL (No Token)')
    else:
        report('Admin Login', f'FAIL ({r.status_code})')

    admin_headers = {'Authorization': f'Bearer {admin_token}'}

    r = requests.get(f"{BASE}/admin/stats", headers=admin_headers)
    report('Admin Endpoint (stats)', 'PASS' if r.status_code == 200 else f'FAIL ({r.status_code})')

    r = requests.get(f"{BASE}/admin/appointments", headers=admin_headers)
    report('Admin Endpoint (appointments)', 'PASS' if r.status_code == 200 else f'FAIL ({r.status_code})')
    
    r = requests.get(f"{BASE}/admin/slots", headers=admin_headers)
    report('Admin Endpoint (slots)', 'PASS' if r.status_code == 200 else f'FAIL ({r.status_code})')

    # 6. Appointment flows
    hospitals = requests.get(f"{BASE}/hospitals").json()
    branches = requests.get(f"{BASE}/branches").json()
    if hospitals and branches:
        h = hospitals[0]
        b = branches[0]
        
        r = requests.get(f"{BASE}/appointments/slots", params={'hospital_id': h['id'], 'branch_id': b['id']})
        report('Appointment Search', 'PASS' if r.status_code == 200 else f'FAIL ({r.status_code})')
        slots = r.json()
        if slots:
            s = slots[0]
            book_payload = {
                "doctor_id": s["doctor_id"],
                "doctor_name": s["doctor_name"],
                "date": s["date"],
                "time": s["time"],
                "hospital_id": h["id"],
                "hospital_name": h["name"],
                "branch_id": b["id"],
                "branch_name": b["name"],
                "patient_tc": "55566677788",
                "patient_name": "Test Kullanici"
            }
            r = requests.post(f"{BASE}/appointments/book", json=book_payload, headers=user_headers)
            report('Book Appointment', 'PASS' if r.status_code in (200, 201) else f'FAIL ({r.status_code}) {r.text}')
            
            r = requests.get(f"{BASE}/appointments/active", headers=user_headers)
            report('Active Appointments', 'PASS' if r.status_code == 200 else f'FAIL ({r.status_code})')
            apts = r.json()
            if apts:
                apt_id = apts[-1]["id"]
                r = requests.patch(f"{BASE}/appointments/{apt_id}/cancel", headers=user_headers)
                report('Cancel Appointment', 'PASS' if r.status_code == 200 else f'FAIL ({r.status_code})')
        else:
            report('Appointment Search', 'SKIP (No slots)')

    r = requests.get(f"{BASE}/family-physician/me", headers=user_headers)
    report('Family Physician (me)', 'PASS' if r.status_code in (200, 404) else f'FAIL ({r.status_code})')

except Exception as e:
    print(f"Exception during tests: {e}")

print("--- END OF TESTS ---")
