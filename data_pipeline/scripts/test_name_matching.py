import pandas as pd
from cleanup_data import load_authors, identify_authors

# Test the matching logic directly from our main cleanup script
if __name__ == "__main__":
    authors = load_authors('../raw/combined_authors.csv')
    
    # List of name arrays exactly as they could look from Google Scholar JSON
    test_cases = [
        (["Dany Laksono", "Trias Aditya"], {11, 22}), 
        (["G Brent Hall, SUBARYONO"], {1}), 
        (["Harintaka Subaryono"], {1, 3}), 
        (["Priyono Nugroho Djurdjani"], {4, 5}), 
        (["Diyono, Yulaikhah"], {8, 13}),
        (["Purnama B. Santosa, Diyono"], {13, 16}),
    ]
    
    name_to_id = {a['name']: a['id'] for a in authors}
    print("Name to ID mapping for check:")
    check_names = ["Subaryono", "Harintaka", "Prijono Nugroho Djodjomartono", "Djurdjani Wardaya", "Dany Puguh Laksono", "Trias Aditya Kurniawan M", "Diyono", "Yulaikhah", "Purnama Budi Santosa"]
    for name in check_names:
        print(f"- {name}: {name_to_id.get(name)}")
    
    print("\nRunning Tests...")
    all_passed = True
    for strings, expected in test_cases:
        found = identify_authors(strings, authors)
        result = "✅ PASS" if found == expected else f"❌ FAIL (Expected {expected})"
        if found != expected: all_passed = False
        print(f"Input: {strings}\n  -> Found: {found} {result}\n")
        
    if all_passed:
        print("🎉 All tests passed successfully!")
    else:
        print("⚠️ Some tests failed.")
