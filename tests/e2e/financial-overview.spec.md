# Financial Overview End-to-End Test Specification

## Purpose
This document outlines manual and automated E2E test scenarios for the Financial Overview page to ensure it works correctly in production.

## Test Environment Setup
- **Browser**: Chrome, Firefox, Safari
- **User Roles**: Admin, Manager, Resident
- **Test Data**: At least 2 buildings, 2 projects (1 with planned date, 1 with financial year only)

---

## Test Scenarios

### 1. Page Load and Initialization
**Objective**: Verify the page loads correctly with default settings

**Steps**:
1. Navigate to `/dashboard/overview`
2. Wait for page to fully load

**Expected Results**:
- ✅ Page displays "Financial Overview" header
- ✅ Building dropdown is populated
- ✅ First building is selected by default
- ✅ Filter shows "Displaying: 12 months"
- ✅ Filter shows "View: Monthly"
- ✅ Current fiscal year is selected
- ✅ Chart displays with data
- ✅ Project Management section is visible

---

### 2. Building Selection
**Objective**: Verify changing buildings updates all data

**Steps**:
1. Note the current building name in the chart title
2. Select a different building from dropdown
3. Wait for data to reload

**Expected Results**:
- ✅ Chart title updates to new building name
- ✅ Chart data refreshes
- ✅ Projects list updates to show new building's projects
- ✅ Loading indicator appears during refresh

---

### 3. Time Period Filters
**Objective**: Verify all time period options work correctly

**Test Cases**:

#### 3a. 12 Months
1. Select "12 months" from Future Projections
2. **Expected**: Chart shows 12 data points, "Displaying: 12 months", "View: Monthly"

#### 3b. 24 Months
1. Select "24 months"
2. **Expected**: Chart shows 24 data points, "Displaying: 24 months", "View: Monthly"

#### 3c. 3 Years
1. Select "3 years"
2. **Expected**: Chart shows 36 data points, "Displaying: 3 years", "View: Yearly"

#### 3d. 5 Years
1. Select "5 years"
2. **Expected**: Chart shows 60 data points, "Displaying: 5 years", "View: Yearly"

#### 3e. 10 Years
1. Select "10 years"
2. **Expected**: Chart shows 120 data points, "Displaying: 10 years", "View: Yearly"

#### 3f. 25 Years
1. Select "25 years"
2. **Expected**: Chart shows 300 data points, "Displaying: 25 years", "View: Yearly"

---

### 4. Fiscal Year Selection
**Objective**: Verify changing fiscal year updates forecast correctly

**Steps**:
1. Note current fiscal year
2. Select previous year
3. Observe chart updates
4. Select next year
5. Observe chart updates

**Expected Results**:
- ✅ Chart data starts from selected fiscal year
- ✅ X-axis labels show correct years
- ✅ API request includes correct startYear parameter

---

### 5. Project Management
**Objective**: Verify project inclusion/exclusion affects forecast

**Steps**:
1. Note the chart's Investment line values
2. Locate a project with plannedStartDate (e.g., "Fenêtres" on Jun 30, 2026)
3. Toggle the "Include" switch OFF
4. Wait for chart to refresh
5. Note the Investment line values again
6. Toggle the switch back ON
7. Wait for chart to refresh

**Expected Results**:
- ✅ When toggled OFF: Investment line shows $0 in project's month
- ✅ When toggled ON: Investment line shows project cost (e.g., $80,000)
- ✅ Balance line adjusts accordingly
- ✅ Status indicator may change color if balance crosses thresholds

---

### 6. Chart Data Visibility Toggles
**Objective**: Verify toggling data series on/off works

**Steps**:
1. Click the Balance toggle (eye icon)
2. Observe chart
3. Click Balance toggle again
4. Repeat for Revenue, Spending, Investments, Minimum Requirement

**Expected Results**:
- ✅ Clicked series disappears from chart
- ✅ "X of 5 series visible" count updates
- ✅ Legend shows eye-off icon when hidden
- ✅ Chart rescales Y-axis appropriately

---

### 7. X-Axis Fiscal Year Labels
**Objective**: Verify only fiscal year start months show labels

**Steps**:
1. Check building's financial year start (e.g., January, April)
2. Select "3 years" to see multiple years
3. Observe X-axis labels

**Expected Results**:
- ✅ Only fiscal year start months have labels (e.g., "Jan 2025", "Jan 2026", "Jan 2027")
- ✅ All other months have no labels but are still plotted
- ✅ No label overlap or clutter

---

### 8. Tooltip Display
**Objective**: Verify tooltips show correct data

**Steps**:
1. Hover over any data point on the chart
2. Observe tooltip

**Expected Results**:
- ✅ Tooltip shows month and year (e.g., "Jan 2025")
- ✅ All visible data series values are shown
- ✅ Values are formatted with currency ($X,XXX.XX)
- ✅ Colors match chart lines

---

### 9. Project Date Calculation
**Objective**: Verify projects appear in correct month

**Test Data Needed**:
- Project A: plannedStartDate = "2026-06-30", cost = $80,000
- Project B: financialYear = 2027, no plannedStartDate, cost = $50,000

**Steps**:
1. Ensure both projects are included
2. Select "3 years" to cover 2025-2027
3. Observe Investment line

**Expected Results**:
- ✅ Project A shows $80,000 spike in June 2026
- ✅ Project B shows $50,000 spike in January 2027
- ✅ Other months show $0 for investments (unless other projects exist)

---

### 10. Multiple Projects Same Month
**Objective**: Verify multiple projects aggregate correctly

**Test Data Needed**:
- Project 1: June 2026, $80,000
- Project 2: June 2026, $50,000

**Steps**:
1. Ensure both projects are included
2. View June 2026 data point

**Expected Results**:
- ✅ Investment line shows $130,000 in June 2026
- ✅ Tooltip displays total: $130,000
- ✅ Balance decreases by $130,000 (plus operating costs)

---

### 11. Error Handling
**Objective**: Verify graceful error handling

**Test Cases**:

#### 11a. No Buildings
1. Test with user who has no assigned buildings
2. **Expected**: "No buildings assigned" message

#### 11b. No Projects
1. Test with building that has no projects
2. **Expected**: "No projects found for current financial year and future periods" message

#### 11c. Network Error
1. Simulate network disconnection
2. Attempt to change filters
3. **Expected**: Error message, retry option

---

### 12. Performance
**Objective**: Verify page performs well with large datasets

**Test Data**:
- Building with 100+ projects
- 25-year forecast (300 months)

**Steps**:
1. Select building with many projects
2. Select "25 years" forecast
3. Observe loading time and responsiveness

**Expected Results**:
- ✅ Page loads within 3 seconds
- ✅ Chart renders without lag
- ✅ Interactions remain smooth
- ✅ No browser console errors

---

### 13. Mobile Responsiveness
**Objective**: Verify page works on mobile devices

**Steps**:
1. Open page on mobile browser (or resize browser to mobile size)
2. Test all filters
3. Test project toggles
4. Test chart interaction

**Expected Results**:
- ✅ All elements are readable
- ✅ Filters are accessible
- ✅ Chart is scrollable if needed
- ✅ Touch interactions work smoothly

---

### 14. Browser Compatibility
**Objective**: Verify cross-browser compatibility

**Browsers to Test**:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

**Expected Results**:
- ✅ Consistent appearance across all browsers
- ✅ All functionality works identically
- ✅ No console errors

---

## Regression Tests

### After Any Code Changes
Run these quick smoke tests:

1. ✅ Page loads without errors
2. ✅ Default shows 12 months, current fiscal year
3. ✅ Changing building updates data
4. ✅ Toggling project affects chart
5. ✅ X-axis shows only fiscal year labels
6. ✅ Tooltips show month + year

---

## Automated Test Checklist

These scenarios should be covered by automated tests:

- ✅ API returns correct forecast length for all period options
- ✅ API accepts projectIds parameter
- ✅ API includes project costs in correct months
- ✅ Forecast calculations are mathematically correct
- ✅ Period length conversions (years to months)
- ✅ Fiscal year start month extraction
- ✅ Project cost fallback logic (totalBudget → estimatedCost → 0)
- ✅ Project date matching (plannedStartDate vs financialYear)

---

## Known Edge Cases to Test

1. **Project on fiscal year boundary**: Project planned for Jan 1 when fiscal year starts Jan 1
2. **Project in past**: Project with plannedStartDate before current date
3. **Very large project cost**: Project costing more than annual budget
4. **Decimal costs**: Project with cost like $79,999.99
5. **Missing project dates**: Project with neither plannedStartDate nor financialYear
6. **Leap year calculations**: Forecast spanning Feb 29
7. **Year-end rollover**: Forecast starting in December and spanning into next year

---

## Success Criteria

All tests pass with:
- ✅ 0 console errors
- ✅ 0 visual glitches
- ✅ <3 second load time
- ✅ Correct mathematical calculations
- ✅ Consistent behavior across browsers
- ✅ Accessible to screen readers
- ✅ Mobile-friendly interface
