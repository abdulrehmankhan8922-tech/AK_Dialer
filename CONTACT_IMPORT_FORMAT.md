# Contact Import Format Guide

## ✅ **CORRECT EXCEL FORMAT**

### **Required Columns:**

| Customer | PhoneNumber |
|----------|-------------|
| John Doe | 923458263614 |
| Jane Smith | 923455772655 |
| Ali Khan | 923045566303 |

### **OR Alternative Column Names:**

| Name | Phone |
|------|-------|
| John Doe | 923458263614 |
| Jane Smith | 923455772655 |

---

## 📋 **Column Name Options**

### **Phone Column** (Required):
- ✅ `PhoneNumber` (your current format)
- ✅ `Phone`
- ✅ `Mobile`
- ✅ `Cell`
- ✅ `Tel`
- ✅ `Telephone`
- ✅ `BusinessPhone`

### **Name Column** (Optional):
- ✅ `Customer` (your current format) ← **NOW SUPPORTED!**
- ✅ `Name`
- ✅ `ContactName`
- ✅ `FullName`
- ✅ `BusinessName`
- ✅ `CompanyName`

---

## ⚠️ **IMPORTANT: Phone Number Format**

### **Problem Fixed:**
- ❌ **Before**: Phone numbers showed as `923458263614.0` (with decimal)
- ✅ **Now**: Phone numbers will be `923458263614` (clean, no decimal)

### **How to Format Phone Numbers in Excel:**

#### **Method 1: Format as Text (Recommended)**
1. Select the phone number column
2. Right-click → **Format Cells**
3. Choose **Text** category
4. Click **OK**
5. Enter phone numbers (they'll stay as text, no `.0`)

#### **Method 2: Use Apostrophe**
- Type phone numbers with apostrophe: `'923458263614`
- Excel will treat it as text

#### **Method 3: Import as Numbers (Now Fixed)**
- You can now import numbers directly
- The system will automatically remove `.0` suffix
- Example: `923458263614.0` → becomes `923458263614`

---

## 📊 **Example Excel File**

### **Format 1: Customer + PhoneNumber (Your Format)**
```
| Customer    | PhoneNumber  |
|-------------|--------------|
| John Doe    | 923458263614 |
| Jane Smith  | 923455772655 |
| Ali Khan    | 923045566303 |
```

### **Format 2: Name + Phone**
```
| Name        | Phone        |
|-------------|--------------|
| John Doe    | 923458263614 |
| Jane Smith  | 923455772655 |
| Ali Khan    | 923045566303 |
```

### **Format 3: With More Columns**
```
| Customer    | PhoneNumber  | Email              | City     |
|-------------|--------------|--------------------|----------|
| John Doe    | 923458263614 | john@example.com   | Karachi  |
| Jane Smith  | 923455772655 | jane@example.com   | Lahore   |
| Ali Khan    | 923045566303 | ali@example.com    | Islamabad|
```

---

## 🔧 **Step-by-Step Instructions**

### **1. Create Excel File:**
- Open Microsoft Excel or Google Sheets
- Create two columns: **Customer** and **PhoneNumber**

### **2. Format Phone Column as Text:**
1. Select the entire **PhoneNumber** column
2. Right-click → **Format Cells**
3. Select **Text** category
4. Click **OK**

### **3. Enter Data:**
- Column 1: Customer names (e.g., "John Doe")
- Column 2: Phone numbers (e.g., "923458263614")
- **No spaces, dashes, or special characters in phone numbers**

### **4. Save File:**
- Save as **.xlsx** or **.xls** format
- Example: `contacts.xlsx`

### **5. Upload:**
- Go to dialer page
- Select campaign
- Click "Import Contacts"
- Choose your Excel file
- Upload

---

## ✅ **What's Fixed:**

1. ✅ **Phone numbers with `.0` suffix** → Now automatically removed
2. ✅ **"Customer" column name** → Now recognized as name column
3. ✅ **Numeric phone numbers** → Properly converted to text

---

## 📝 **Best Practices:**

1. **Format phone column as TEXT** before entering data
2. **Use consistent column names**: `Customer` and `PhoneNumber`
3. **No spaces in phone numbers**: `923458263614` ✅ (not `923 458 263 614`)
4. **No dashes**: `923458263614` ✅ (not `923-458-263-614`)
5. **No country code prefix if not needed**: Use local format if your trunk requires it
6. **One phone per row**: Don't put multiple numbers in one cell

---

## 🧪 **Test Your Format:**

1. Create a test file with 3-5 contacts
2. Use format: `Customer` | `PhoneNumber`
3. Format phone column as **Text**
4. Upload and check if:
   - ✅ Names appear correctly
   - ✅ Phone numbers have no `.0`
   - ✅ All contacts imported successfully

---

## ❌ **Common Mistakes to Avoid:**

1. ❌ Leaving phone column as **General/Number** format → Causes `.0` suffix
2. ❌ Using wrong column names → System won't recognize them
3. ❌ Spaces in phone numbers → May cause dialing issues
4. ❌ Empty rows → Will be skipped
5. ❌ Duplicate phone numbers → Will be skipped (one per campaign)

---

## 📞 **Your Current Format (Now Fixed):**

```
| Customer | PhoneNumber |
|----------|-------------|
| John     | 923458263614|
| Jane     | 923455772655|
```

**This format will now work correctly!**
- ✅ "Customer" column recognized
- ✅ Phone numbers without `.0`
- ✅ Names will be imported

---

**Need Help?** If you still see `.0` in phone numbers, format the phone column as **Text** in Excel before uploading.
