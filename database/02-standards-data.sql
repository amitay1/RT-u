-- Scan-Master Standards Data
-- Pre-populated UT standards for offline factory deployment
-- All standards set to is_free = true for factory installations

-- AMS Standards (Aerospace Material Specifications)
INSERT INTO standards (code, name, description, version, category, is_free, is_active, metadata) VALUES
('AMS-STD-2154', 'Inspection, Ultrasonic, Wrought Metals', 'Aerospace standard for ultrasonic inspection of wrought metal products including acceptance criteria classes AAA, AA, A, B, C', 'E', 'Aerospace', true, true, '{"classes": ["AAA", "AA", "A", "B", "C"], "materials": ["aluminum", "titanium", "steel", "nickel"], "thicknessMin": 6.35, "thicknessUnit": "mm", "releaseYear": 2019}'),
('AMS-2630', 'Inspection, Ultrasonic Product Over 0.5 Inch Thick', 'Standard for ultrasonic inspection of products over 0.5 inch (12.7 mm) thick using contact or immersion methods', 'E', 'Aerospace', true, true, '{"classes": ["AA", "A1", "A", "B", "C"], "thicknessMin": 12.7, "thicknessUnit": "mm", "methods": ["contact", "immersion", "bubbler", "squirter"], "sourcePdf": "/standards/AMS_2630E.pdf"}'),
('AMS-2375', 'Control of Forgings Requiring First Article Approval', 'Aerospace process-control standard for preproduction/first-article approval and continued control of production forgings', 'F', 'Aerospace Process', true, true, '{"inspectionStandard": false, "productForm": "forgings", "recordsRetentionYears": 7, "sourcePdf": "/standards/AMS_2375F.pdf"}'),
('AMS-2631', 'Ultrasonic Inspection, Titanium and Titanium Alloy Bar, Billet and Plate', 'Standard for ultrasonic inspection of titanium bars, billets and plate products ≥0.25 inch thick', 'G', 'Aerospace', true, true, '{"classes": ["AA", "A", "A1", "B"], "material": "titanium", "forms": ["bar", "billet", "plate"], "thicknessMin": 6.4, "surfaceFinish": 250, "releaseYear": 2022}'),
('AMS-2632', 'Ultrasonic Inspection of Thin Materials', 'Standard for ultrasonic inspection of thin materials ≤0.5 inch (12.7mm) thick', 'C', 'Aerospace', true, true, '{"classes": ["AA", "A", "B", "C"], "thicknessMax": 12.7, "thicknessUnit": "mm", "frequencyRange": "5-15 MHz", "releaseYear": 2022}'),
('AMS-2628', 'Ultrasonic Immersion Inspection, Titanium Billet Premium Grade', 'Standard for immersion ultrasonic inspection of premium grade titanium billet ≥5 inches diameter', '2021A', 'Aerospace', true, true, '{"material": "titanium", "forms": ["billet"], "minDiameter": 127, "method": "immersion"}')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    category = EXCLUDED.category,
    metadata = EXCLUDED.metadata,
    is_free = true,
    is_active = true;

-- ASTM Standards
INSERT INTO standards (code, name, description, version, category, is_free, is_active, metadata) VALUES
('ASTM-E2375', 'Standard Practice for Ultrasonic Testing of Wrought Products', 'ASTM standard for ultrasonic examination of wrought products - adopted from MIL-STD-2154 with 5 acceptance classes', '2022', 'Industrial', true, true, '{"classes": ["AAA", "AA", "A", "B", "C"], "methods": ["contact", "immersion"], "techniques": ["straight beam", "angle beam"], "adoptedFrom": "MIL-STD-2154"}'),
('ASTM-E1001', 'Standard Practice for Immersed Pulse-Echo Ultrasonic Testing Using Longitudinal Waves', 'General immersion pulse-echo longitudinal-wave UT practice for discontinuity detection and relative evaluation; acceptance criteria by agreement', '2021', 'Industrial', true, true, '{"methods": ["immersion"], "techniques": ["pulse-echo", "straight beam", "longitudinal wave"], "frequenciesMHz": [2.25, 5, 10, 15], "acceptanceCriteria": "by agreement", "sourcePdf": "/standards/ASTM_E1001_21.pdf"}'),
('ASTM-E2580', 'Standard Practice for Ultrasonic Testing of Flat Panel Composites and Sandwich Core Materials Used in Aerospace Applications', 'Composite flat panel and sandwich core UT using pulse-echo or through-transmission longitudinal wave methods', '2024', 'Composite', true, true, '{"materials": ["polymer matrix composite", "sandwich core", "honeycomb"], "methods": ["pulse-echo", "through-transmission", "contact", "squirter"], "frequencyRangeMHz": [0.5, 20], "acceptanceCriteria": "by agreement", "sourcePdf": "/standards/ASTM_E2580_24.pdf"}'),
('ASTM-E2581', 'Standard Practice for Shearography of Polymer Matrix Composites and Sandwich Core Materials in Aerospace Applications', 'Composite shearography NDT reference standard using thermal, pressure, vacuum, acoustic, or vibration stressing', '2014R2023', 'Composite', true, true, '{"inspectionMethod": "shearography", "ultrasonic": false, "materials": ["polymer matrix composite", "sandwich core"], "acceptanceCriteria": "not specified", "sourcePdf": "/standards/ASTM_E2581_14R23.pdf"}'),
('ASTM-E588', 'Standard Practice for Detection of Large Inclusions in Bearing Quality Steel by the Ultrasonic Method', 'Immersion focused ultrasonic cleanliness rating for large inclusions in bearing quality steel; reports severity/counts without acceptability limits', '2003R2020', 'Industrial', true, true, '{"material": "bearing quality steel", "method": "immersion", "frequencyMHz": 10, "scanIndexMm": 1.27, "acceptanceCriteria": "not specified", "sourcePdf": "/standards/ASTM_E588_03R20.pdf"}'),
('ASTM-E127', 'Practice for Fabrication and Control of FBH Ultrasonic Standard Reference Blocks', 'Standard for fabrication of flat-bottom hole (FBH) reference blocks - FBH sizes 1/64 to 8/64 inch', '2020', 'Calibration', true, true, '{"blockType": "FBH", "fbhSizes": ["1/64", "2/64", "3/64", "4/64", "5/64", "6/64", "7/64", "8/64"], "testFrequency": 5, "testMethod": "immersion"}'),
('ASTM-E428', 'Practice for Fabrication and Control of Metal Reference Blocks (Withdrawn 2019)', 'Standard for steel and other metal reference blocks - merged into E127-19', '2019', 'Calibration', true, true, '{"blockType": "FBH", "materials": ["steel", "titanium", "nickel"], "status": "merged into E127-19"}'),
('ASTM-E317', 'Practice for Evaluating Performance Characteristics of Ultrasonic Pulse-Echo Testing Instruments', 'Standard for evaluating UT instrument performance', '2020', 'Equipment', true, true, '{"testTypes": ["linearity", "resolution", "sensitivity"]}'),
('ASTM-A388', 'Practice for Ultrasonic Examination of Steel Forgings', 'Standard for UT of heavy steel forgings with quality levels QL1-QL4', '23', 'Industrial', true, true, '{"classes": ["QL1", "QL2", "QL3", "QL4"], "material": "steel", "form": "forging", "thicknessRange": "all", "releaseYear": 2023}'),
('ASTM-E164', 'Practice for Contact Ultrasonic Testing of Weldments', 'Standard for UT of welds using contact method - thickness 0.25 to 8 inches', '2019', 'Welding', true, true, '{"classes": ["LEVEL-1", "LEVEL-2", "LEVEL-3"], "method": "contact", "application": "weldments", "thicknessRange": "6.4-203mm", "angles": [45, 60, 70]}')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    category = EXCLUDED.category,
    metadata = EXCLUDED.metadata,
    is_free = true,
    is_active = true;

-- TUV/European Standards (EN/ISO)
INSERT INTO standards (code, name, description, version, category, is_free, is_active, metadata) VALUES
('EN-12668-1', 'NDT - Characterization and verification of UT equipment - Part 1: Instruments', 'European standard for UT instrument verification', '2010', 'European', true, true, '{"focus": "instruments", "region": "EU"}'),
('EN-12668-2', 'NDT - Characterization and verification of UT equipment - Part 2: Probes', 'European standard for UT probe verification', '2010', 'European', true, true, '{"focus": "probes", "region": "EU"}'),
('EN-12668-3', 'NDT - Characterization and verification of UT equipment - Part 3: Combined equipment', 'European standard for combined UT equipment', '2013', 'European', true, true, '{"focus": "combined", "region": "EU"}'),
('EN-ISO-16810', 'NDT - Ultrasonic testing - General principles', 'General principles for ultrasonic testing - Framework standard defining UT methodology', '2024', 'European', true, true, '{"type": "framework", "region": "EU/ISO", "relatedStandards": ["EN-12668", "EN-ISO-16811", "EN-ISO-16823"], "note": "Does not define acceptance criteria"}'),
('EN-ISO-16811', 'NDT - Ultrasonic testing - Sensitivity and range setting', 'Standard for UT sensitivity and range calibration', '2014', 'European', true, true, '{"focus": "calibration", "region": "EU/ISO"}'),
('BS-EN-10228-3', 'NDT of Steel Forgings - Part 3: Ultrasonic Testing of Ferritic or Martensitic Steel Forgings', 'European standard for UT of ferritic/martensitic steel forgings with quality classes 1-4', '2016', 'European', true, true, '{"classes": ["1", "2", "3", "4"], "material": "ferritic steel", "form": "forging"}'),
('BS-EN-10228-4', 'NDT of Steel Forgings - Part 4: Ultrasonic Testing of Austenitic and Austenitic-Ferritic Stainless Steel Forgings', 'European standard for UT of austenitic stainless steel forgings with quality classes 1-3', '2016', 'European', true, true, '{"classes": ["1", "2", "3"], "material": "austenitic stainless steel", "form": "forging"}')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    category = EXCLUDED.category,
    metadata = EXCLUDED.metadata,
    is_free = true,
    is_active = true;

-- ISO Standards
INSERT INTO standards (code, name, description, version, category, is_free, is_active, metadata) VALUES
('ISO-5577', 'NDT - Ultrasonic testing - Vocabulary', 'International vocabulary for ultrasonic testing', '2017', 'International', true, true, '{"type": "vocabulary"}'),
('ISO-16823', 'NDT - Ultrasonic testing - Transmission technique', 'Standard for through-transmission UT', '2012', 'International', true, true, '{"technique": "transmission"}'),
('ISO-16826', 'NDT - Ultrasonic testing - Examination for discontinuities perpendicular to the surface', 'Standard for detecting surface-perpendicular flaws', '2012', 'International', true, true, '{"focus": "perpendicular discontinuities"}')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    category = EXCLUDED.category,
    metadata = EXCLUDED.metadata,
    is_free = true,
    is_active = true;

-- OEM Standards (Pratt & Whitney)
INSERT INTO standards (code, name, description, version, category, is_free, is_active, metadata) VALUES
('NDIP-1226', 'V2500 1st Stage HPT Disk - Immersion UT Inspection', 'Pratt & Whitney OEM-specific NDIP for V2500 engine 1st stage high pressure turbine disk (PN 2A5001). Circumferential shear wave ±45°, immersion inspection.', 'F', 'OEM', true, true, '{"oem": "Pratt & Whitney", "engine": "V2500", "component": "1st Stage HPT Disk", "partNumber": "2A5001", "method": "immersion", "technique": "circumferential shear wave"}'),
('NDIP-1227', 'V2500 2nd Stage HPT Disk - Immersion UT Inspection', 'Pratt & Whitney OEM-specific NDIP for V2500 engine 2nd stage high pressure turbine disk (PN 2A4802). Circumferential shear wave ±45°, immersion inspection.', 'D', 'OEM', true, true, '{"oem": "Pratt & Whitney", "engine": "V2500", "component": "2nd Stage HPT Disk", "partNumber": "2A4802", "method": "immersion", "technique": "circumferential shear wave"}')
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    version = EXCLUDED.version,
    category = EXCLUDED.category,
    metadata = EXCLUDED.metadata,
    is_free = true,
    is_active = true;

-- Create default "All Standards" bundle for factory deployment
INSERT INTO standard_bundles (name, description, price, discount_percent, is_active) VALUES
('Factory Complete Bundle', 'All standards included - Factory deployment license', 0.00, 100.00, true)
ON CONFLICT DO NOTHING;
