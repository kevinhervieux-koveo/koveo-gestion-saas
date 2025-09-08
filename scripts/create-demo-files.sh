#!/bin/bash

# Create Demo Document Files Script
# Generates realistic text content for all document types in the Demo organization

echo "📄 Creating Demo document files..."

# Demo disclosure for all files
DEMO_DISCLOSURE="⚠️ DEMO NOTICE - FOR DEMONSTRATION PURPOSES ONLY ⚠️

This document contains fictional data created for product demonstration.
In a real environment, this would contain actual uploaded content from property managers.
All information shown is generated automatically for testing and demo purposes.

This demo showcases the document management capabilities of Koveo Gestion.

═══════════════════════════════════════════════════════════

"

# Create directories
mkdir -p uploads/demo/buildings
mkdir -p uploads/demo/residences
mkdir -p uploads/demo

# Generate sample financial documents (invoices/receipts)
echo "Creating financial documents..."

cat > "uploads/demo/invoice-17f6-2024-01-cleaning.txt" << EOF
$DEMO_DISCLOSURE

INVOICE DOCUMENT

Bill Number: 17F6-2024-01-CLEANING
Title: Cleaning - CleanPro Montreal
Vendor: CleanPro Montreal
Category: Cleaning
Total Amount: \$1,250.00
Description: Monthly cleaning service for January 2024

This invoice document would normally be uploaded by the property manager
as a PDF or image file, but for this demo we're showing it as text content.

Payment Terms: Net 30 days
Invoice Date: 12/15/2024
Due Date: 01/15/2025

Service Details:
- Deep cleaning of common areas and hallways
- Window cleaning for lobby and entrance areas

Thank you for your business!
CleanPro Montreal
EOF

cat > "uploads/demo/receipt-17f6-2024-01-utilities.txt" << EOF
$DEMO_DISCLOSURE

RECEIPT DOCUMENT

Bill Number: 17F6-2024-01-UTILITIES
Title: Utilities - Hydro-Quebec
Vendor: Hydro-Quebec
Category: Utilities
Total Amount: \$850.00
Description: Monthly utilities service for January 2024

Payment Amount: \$850.00
Payment Date: 01/10/2025
Payment Method: Electronic Transfer
Reference Number: PAY-HQ8A9B2C

This payment has been processed successfully.
Building Management Office
EOF

# Generate sample building documents
echo "Creating building documents..."

# Insurance certificate
cat > "uploads/demo/buildings/bfee4e0b-aa89-44b8-b3b2-0419bab47897/insurance-4647-meggie-pass-building-2.txt" << EOF
$DEMO_DISCLOSURE

INSURANCE CERTIFICATE

Building: 4647 Meggie Pass Building 2
Document Date: 01/05/2025

Policy Number: INS-MTL2024001
Insurance Company: Allstate Insurance
Coverage Type: Commercial Property Insurance
Coverage Amount: \$2,500,000
Policy Period: 01/01/2024 to 12/31/2024

Coverage Details:
- Property Damage: Covered
- Liability: Covered  
- Natural Disasters: Covered
- Equipment Breakdown: Covered

Contact Information:
Agent: Marie Dubois
Phone: (514) 555-0123
Email: marie.dubois@allstate.ca
EOF

# Building permit
cat > "uploads/demo/buildings/5fd273e9-328f-4e31-98f0-8e82526c79e8/permits-4804-stuart-gateway-building-1.txt" << EOF
$DEMO_DISCLOSURE

BUILDING PERMIT

Building: 4804 Stuart Gateway Building 1
Document Date: 11/20/2024

Permit Number: PER-MTL24567
Permit Type: HVAC Installation
Issue Date: 11/01/2024
Expiry Date: 11/01/2025
Contractor: Montreal HVAC Services

Work Description:
Installation of new energy-efficient heating and cooling system 
for the main lobby and common areas. Includes ductwork modifications 
and thermostat upgrades.

Inspection Schedule:
- Initial Inspection: 11/15/2024
- Progress Inspection: 12/01/2024
- Final Inspection: 12/15/2024

Approved by: City Planning Department
Permit Fee: \$450
EOF

# Meeting minutes
cat > "uploads/demo/buildings/ad5ed375-3319-46bc-8093-c4341174bebd/meeting_minutes-64671-green-close-building-4.txt" << EOF
$DEMO_DISCLOSURE

BOARD MEETING MINUTES

Building: 64671 Green Close Building 4
Document Date: 12/08/2024

Meeting Date: 12/05/2024
Meeting Time: 19:00
Location: 64671 Green Close Building 4 Community Room

Attendees:
- Pierre Gagnon (Board President)
- Marie Dubois (Treasurer)  
- Jean Tremblay (Secretary)
- Sophie Martin (Property Manager)

Agenda Items:
1. Budget Review - Discussed 2025 budget allocation for maintenance and improvements
2. Maintenance Updates - Review of completed HVAC repairs and upcoming elevator maintenance
3. New Policies - Implementation of visitor parking regulations

Action Items:
- Schedule elevator maintenance inspection for January 2025
- Distribute new parking policy to all residents by December 15th

Next Meeting: January 10, 2025
EOF

# Service contract
cat > "uploads/demo/buildings/17f65eef-a91f-4268-82ec-91727b9fe7f8/contracts-7393-abernathy-green-building-5.txt" << EOF
$DEMO_DISCLOSURE

SERVICE CONTRACT

Building: 7393 Abernathy Green Building 5
Document Date: 10/01/2024

Contract Number: CON-MTL24890
Service Provider: Montreal Landscaping Services
Service Type: Landscaping
Contract Period: 04/01/2024 to 10/31/2024
Monthly Cost: \$1,200

Service Details:
Comprehensive landscaping services including lawn maintenance, 
flower bed care, seasonal planting, and snow removal during 
winter months. Services provided weekly during growing season.

Contact Information:
Manager: Claude Morin
Phone: (514) 555-7890
Emergency Contact: (514) 555-7891

Terms and Conditions:
- Services provided weekly from April to October
- Emergency snow removal within 24 hours of snowfall exceeding 5cm
EOF

# Generate sample residence documents
echo "Creating residence documents..."

# Lease agreement
cat > "uploads/demo/residences/lease-331.txt" << EOF
$DEMO_DISCLOSURE

LEASE AGREEMENT

Unit: 331
Building: 4647 Meggie Pass Building 2
Address: 4647 Meggie Pass, Montreal, QC

Tenant Information:
- Unit Number: 331
- Lease Start Date: 09/01/2024
- Lease End Date: 08/31/2025
- Monthly Rent: \$1,800
- Security Deposit: \$1,800

Terms and Conditions:
- Tenant responsible for utilities (electricity, internet, cable)
- No pets allowed without prior written consent from landlord

Landlord: 4647 Meggie Pass Building 2 Management
Tenant Signature: ____________________
Date: 08/25/2024
EOF

# Inspection report
cat > "uploads/demo/residences/inspection-331.txt" << EOF
$DEMO_DISCLOSURE

INSPECTION REPORT

Unit: 331
Building: 4647 Meggie Pass Building 2
Address: 4647 Meggie Pass, Montreal, QC

Inspection Date: 01/15/2025
Inspector: Michel Côté

Inspection Results:
✓ Electrical systems - Good condition
✓ Plumbing - Good condition  
✓ Heating/Cooling - Good condition
⚠ Minor paint touch-up needed in bedroom
✓ Windows and doors - Good condition
✓ Smoke detectors - Working properly

Overall Rating: Good

Notes:
Unit is well-maintained overall. Minor cosmetic work needed 
in the master bedroom where there are small scuff marks on 
the wall near the door. All major systems functioning properly.

Inspector Signature: ____________________
EOF

# Maintenance log
cat > "uploads/demo/residences/maintenance-331.txt" << EOF
$DEMO_DISCLOSURE

MAINTENANCE LOG

Maintenance History for Unit 331:

12/10/2024 - HVAC maintenance
Status: Completed
Cost: \$150

01/05/2025 - Light fixture repair
Status: In Progress
Estimated Cost: \$75

Next Scheduled Maintenance: 06/15/2025
EOF

echo "✅ Created sample Demo document files"
echo "📁 Files created in uploads/ directory structure"
echo ""
echo "Sample files created:"
echo "- Financial documents (invoices/receipts)"
echo "- Building documents (insurance, permits, meeting minutes, contracts)"
echo "- Residence documents (leases, inspections, maintenance logs)"
echo ""
echo "🔥 Now creating ALL remaining files programmatically..."