
import sys
import os
os.environ['PYTHONIOENCODING'] = 'utf-8'
sys.stdout.reconfigure(encoding='utf-8')

import requests
import json

BASE = 'http://localhost:8000'
RESULTS = {}

def p(label, data=None):
    if data is None:
        print(label)
    else:
        try:
            s = json.dumps(data, ensure_ascii=True, indent=2)
            print(s)
        except:
            print(repr(data))

print('='*60)
print('1. BACKEND HEALTH CHECK')
print('='*60)
try:
    r = requests.get(f'{BASE}/hospitals', timeout=5)
    print(f'GET /hospitals => {r.status_code}, count={len(r.json())}')
    RESULTS['backend_health'] = 'PASS'
except Exception as e:
    print(f'BACKEND DOWN: {e}')
    sys.exit(1)

# -------------------------------------------------------------------
print()
print('='*60)
print('2. REGISTER (correct field names)')
print('='*60)
# Check what fields the register endpoint expects
r = requests.post(f'{BASE}/auth/register', json={
    'tc_no': '55566677788',
    'full_name': 'Test Kullanici',
    'password': 'Test1234',
    'role': 'admin'  # trying to inject admin role
})
print(f'Register status: {r.status_code}')
reg_data = r.json()
p('Register response', reg_data)
user_role = reg_data.get('role', 'N/A')
print(f'>>> Role assigned by backend: {user_role}')
RESULTS['register'] = 'PASS' if r.status_code in (200, 201) else f'FAIL ({r.status_code})'
RESULTS['role_injection_blocked'] = 'PASS' if user_role == 'user' else f'FAIL - role={user_role}'

# -------------------------------------------------------------------
print()
print('='*60)
print('3. LOGIN (new user)')
print('='*60)
r = requests.post(f'{BASE}/auth/login', json={'tc_no': '55566677788', 'password': 'Test1234'})
print(f'Login status: {r.status_code}')
login_data = r.json()
user_role = login_data.get('role', 'N/A')
user_tc = login_data.get('tc_no', login_data.get('tc', ''))
print(f'>>> Role: {user_role}')
RESULTS['login_new_user'] = 'PASS' if r.status_code == 200 else f'FAIL ({r.status_code}): {login_data}'

# -------------------------------------------------------------------
print()
print('='*60)
print('4. NEW USER trying ADMIN endpoint (expect 403)')
print('='*60)
user_headers = {'x-user-role': user_role, 'x-user-tc': '55566677788'}
r = requests.get(f'{BASE}/admin/stats', headers=user_headers)
print(f'/admin/stats with user role => {r.status_code}')
RESULTS['user_blocked_from_admin'] = 'PASS' if r.status_code == 403 else f'FAIL ({r.status_code})'

# -------------------------------------------------------------------
print()
print('='*60)
print('5. NO HEADERS admin endpoint (expect 403)')
print('='*60)
r = requests.get(f'{BASE}/admin/stats')
print(f'/admin/stats no headers => {r.status_code}')
RESULTS['no_headers_blocked'] = 'PASS' if r.status_code in (401, 403) else f'FAIL ({r.status_code})'

# -------------------------------------------------------------------
print()
print('='*60)
print('6. ADMIN LOGIN + STATS')
print('='*60)
r = requests.post(f'{BASE}/auth/login', json={'tc_no': '99999999999', 'password': '1234'})
print(f'Admin login: {r.status_code}')
admin_data = r.json()
admin_role = admin_data.get('role', 'N/A')
print(f'>>> Admin role: {admin_role}')
RESULTS['admin_login'] = 'PASS' if r.status_code == 200 and admin_role == 'admin' else f'FAIL'

admin_headers = {'x-user-role': 'admin', 'x-user-tc': '99999999999'}
r = requests.get(f'{BASE}/admin/stats', headers=admin_headers)
print(f'GET /admin/stats => {r.status_code}')
if r.status_code == 200:
    stats = r.json()
    print(f"  total_appointments={stats.get('total_appointments')}")
    print(f"  total_doctors={stats.get('total_doctors')}")
    print(f"  total_hospitals={stats.get('total_hospitals')}")
RESULTS['admin_stats'] = 'PASS' if r.status_code == 200 else f'FAIL ({r.status_code})'

# -------------------------------------------------------------------
print()
print('='*60)
print('7. ADMIN APPOINTMENTS')
print('='*60)
r = requests.get(f'{BASE}/admin/appointments', headers=admin_headers)
print(f'GET /admin/appointments => {r.status_code}')
if r.status_code == 200:
    apts = r.json()
    print(f'Total: {len(apts)}')
    if apts:
        a = apts[0]
        print(f"  First: id={a.get('id')} doctor={a.get('doctor_name')} status={a.get('status')}")
RESULTS['admin_appointments'] = 'PASS' if r.status_code == 200 else f'FAIL ({r.status_code})'

# -------------------------------------------------------------------
print()
print('='*60)
print('8. APPOINTMENT BOOKING FLOW')
print('='*60)
hospitals = requests.get(f'{BASE}/hospitals').json()
branches = requests.get(f'{BASE}/branches').json()
print(f'Hospitals: {len(hospitals)}, Branches: {len(branches)}')

if hospitals and branches:
    h = hospitals[0]
    b = branches[0]
    slots_r = requests.get(f'{BASE}/appointments/slots',
                           params={'hospital_id': h['id'], 'branch_id': b['id']})
    print(f'GET /appointments/slots => {slots_r.status_code}, count={len(slots_r.json())}')
    RESULTS['slots_endpoint'] = 'PASS' if slots_r.status_code == 200 else f'FAIL ({slots_r.status_code})'
    
    slots = slots_r.json()
    if slots:
        slot = slots[0]
        # Book it
        book_r = requests.post(f'{BASE}/appointments/book', json={
            'doctor_id': slot['doctor_id'],
            'doctor_name': slot.get('doctor_name', ''),
            'date': slot['date'],
            'time': slot['time'],
            'hospital_id': h['id'],
            'hospital_name': h['name'],
            'branch_id': b['id'],
            'branch_name': b['name'],
            'patient_tc': '55566677788',
            'patient_name': 'Test Kullanici'
        })
        print(f'POST /appointments/book => {book_r.status_code}')
        book_data = book_r.json()
        apt_id = book_data.get('id') or book_data.get('appointment_id')
        print(f'Booked apt id: {apt_id}, success={book_data.get("success")}')
        RESULTS['appointment_book'] = 'PASS' if book_r.status_code in (200, 201) else f'FAIL ({book_r.status_code})'
        
        # Check active appointments
        act_r = requests.get(f'{BASE}/appointments/active',
                             headers={'x-user-tc': '55566677788', 'x-user-role': 'user'})
        print(f'GET /appointments/active => {act_r.status_code}, count={len(act_r.json()) if act_r.status_code == 200 else "ERR"}')
        RESULTS['active_appointments'] = 'PASS' if act_r.status_code == 200 else f'FAIL ({act_r.status_code})'
        
        # Cancel it
        if apt_id:
            cancel_r = requests.patch(f'{BASE}/appointments/{apt_id}/cancel',
                                      headers={'x-user-tc': '55566677788', 'x-user-role': 'user'})
            print(f'PATCH /appointments/{apt_id}/cancel => {cancel_r.status_code}')
            RESULTS['appointment_cancel'] = 'PASS' if cancel_r.status_code == 200 else f'FAIL ({cancel_r.status_code})'

# -------------------------------------------------------------------
print()
print('='*60)
print('9. NEARBY HOSPITALS (Istanbul coords)')
print('='*60)
r = requests.get(f'{BASE}/hospitals/nearby', params={'lat': 41.0082, 'lng': 28.9784})
print(f'GET /hospitals/nearby => {r.status_code}')
if r.status_code == 200:
    nearby = r.json()
    print(f'Count: {len(nearby)}')
    for h in nearby[:3]:
        print(f"  {h['name']} - {h['distance_km']} km - lat={h.get('latitude')}")
RESULTS['nearby_hospitals'] = 'PASS' if r.status_code == 200 else f'FAIL ({r.status_code})'

# -------------------------------------------------------------------
print()
print('='*60)
print('10. SLOT SEED CHECK (via admin/slots)')
print('='*60)
r = requests.get(f'{BASE}/admin/slots', headers=admin_headers)
print(f'GET /admin/slots => {r.status_code}')
if r.status_code == 200:
    all_slots = r.json()
    total = len(all_slots)
    booked = sum(1 for s in all_slots if s.get('is_booked'))
    active = sum(1 for s in all_slots if s.get('is_active'))
    print(f'Total slots: {total}, Active: {active}, Booked: {booked}')
RESULTS['slot_seed'] = 'PASS' if r.status_code == 200 and total > 0 else f'FAIL'

# -------------------------------------------------------------------
print()
print('='*60)
print('11. SWAGGER / OPENAPI')
print('='*60)
r = requests.get(f'{BASE}/openapi.json')
print(f'GET /openapi.json => {r.status_code}')
if r.status_code == 200:
    paths = list(r.json().get('paths', {}).keys())
    print(f'Endpoints ({len(paths)}):')
    for p_name in sorted(paths):
        print(f'  {p_name}')
RESULTS['swagger'] = 'PASS' if r.status_code == 200 else 'FAIL'

# -------------------------------------------------------------------
print()
print('='*60)
print('12. FAMILY PHYSICIAN ENDPOINTS')
print('='*60)
r = requests.get(f'{BASE}/family-physician/my-doctor',
                 headers={'x-user-tc': '55566677788', 'x-user-role': 'user'})
print(f'GET /family-physician/my-doctor => {r.status_code}')
RESULTS['family_physician'] = 'PASS' if r.status_code in (200, 404) else f'FAIL ({r.status_code})'

# -------------------------------------------------------------------
print()
print('='*70)
print('SUMMARY')
print('='*70)
all_pass = True
for k, v in RESULTS.items():
    icon = 'PASS' if v == 'PASS' else 'FAIL'
    if v != 'PASS':
        all_pass = False
    print(f'[{icon}] {k}: {v}')

print()
print(f'Overall: {"ALL PASS" if all_pass else "SOME FAILURES - check above"}')
