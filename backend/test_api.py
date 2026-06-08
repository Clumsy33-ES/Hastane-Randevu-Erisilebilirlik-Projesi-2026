import urllib.request, json

base = 'http://localhost:8000'
h = {'x-user-role': 'admin'}

def get(url):
    req = urllib.request.Request(url, headers=h)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

# Test 1: Active doctors
d4 = get(base + '/admin/doctors?is_active=true')
print('Active doctors endpoint:', len(d4))
for doc in d4[:5]:
    print(f'  [{doc["id"]}] {doc["full_name"]} - {doc["hospital_name"]}')

# Test 2: All slots (no filter) - limit 200
d1 = get(base + '/admin/slots')
ids1 = set(s['doctor_id'] for s in d1)
print(f'\nNo filter: {len(d1)} slots, {len(ids1)} unique doctors')

# Test 3: Filter by doctor_id=1
d2 = get(base + '/admin/slots?doctor_id=1')
print(f'doctor_id=1: {len(d2)} slots', end='')
if d2:
    print(f' ({d2[0]["doctor_name"]})', end='')
print()

# Test 4: Filter by doctor_id=142 (last doctor)
d3 = get(base + '/admin/slots?doctor_id=142')
print(f'doctor_id=142: {len(d3)} slots', end='')
if d3:
    print(f' ({d3[0]["doctor_name"]})', end='')
print()

# Test 5: Filter by hospital_id=1
d5 = get(base + '/admin/slots?hospital_id=1')
ids5 = set(s['doctor_id'] for s in d5)
print(f'hospital_id=1: {len(d5)} slots, {len(ids5)} unique doctors')

print()
print('=== SUMMARY ===')
print(f'Total active doctors in system: {len(d4)}')
print(f'Slots returned w/o filter (capped 200): {len(d1)}, unique doctors shown: {len(ids1)}')
print(f'NOTE: Without filter, only 200 slots shown out of 8820 total.')
print(f'The doctor dropdown fills from /admin/doctors which returns ALL {len(d4)} active doctors!')
