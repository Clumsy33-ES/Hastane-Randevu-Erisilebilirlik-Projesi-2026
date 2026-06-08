import urllib.request
import json

def test_endpoint(url, description):
    try:
        req = urllib.request.Request(url, headers={"X-User-Role": "admin"})
        res = urllib.request.urlopen(req)
        data = json.loads(res.read().decode('utf-8'))
        doc_ids = {item.get('doctor_id') for item in data}
        hosp_ids = {item.get('hospital_id') for item in data}
        print(f"[SUCCESS] {description}: returned {len(data)} items.")
        print(f"  Distinct doctor IDs in result: {doc_ids}")
        print(f"  Distinct hospital IDs in result: {hosp_ids}")
    except Exception as e:
        print(f"[FAIL] {description}: {e}")

def main():
    print("Starting API tests for slot filtering...")
    # Test 1: No filters
    test_endpoint("http://127.0.0.1:8000/admin/slots", "No filters")
    
    # Test 2: Filter by doctor_id=1
    test_endpoint("http://127.0.0.1:8000/admin/slots?doctor_id=1", "Filter by doctor_id=1")
    
    # Test 3: Filter by hospital_id=1
    test_endpoint("http://127.0.0.1:8000/admin/slots?hospital_id=1", "Filter by hospital_id=1")

if __name__ == "__main__":
    main()
