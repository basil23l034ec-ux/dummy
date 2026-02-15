# Smart Trolley Promotion System - How It Works

## 🎯 Overview

The system now has TWO types of promotions that work differently:

### 1. **Spin Wheel** (One-Time per Session)
- **When it appears**: ONCE when a customer first picks up/activates their trolley
- **Frequency**: Only shown ONCE per shopping session
- **Behavior**: 
  - Customer sees it immediately when they start shopping
  - After they spin or dismiss it, it won't appear again for that customer
  - Uses `sessionStorage` to track if already shown
  - When customer completes checkout or resets their session, they can see it again next time

### 2. **Banner Ads** (30-Minute Rotation)
- **When it appears**: Rotates every 30 minutes
- **Frequency**: Changes automatically every 30 minutes
- **Behavior**:
  - If you have 3 banner ads, they rotate: Ad1 → Ad2 → Ad3 → Ad1 (repeat)
  - Displays for 10 seconds each time
  - Fair rotation ensures all active banners get shown

---

## 🔄 How It Works

### **Customer Experience:**

#### **First Time Visitor (New Session)**
1. Customer opens `http://localhost:5000/customer-frontend/`
2. **→ Spin Wheel appears immediately** (if one is active)
3. Customer spins and wins a discount
4. Spin wheel dismissed
5. **→ Banner ads start rotating every 30 minutes**
6. Customer shops, adds items, checks out

#### **Returning During Same Session**
1. Customer continues shopping
2. **→ Spin wheel DOES NOT appear again**
3. **→ Only banner ads rotate every 30 minutes**

#### **New Session (After Reset/Checkout)**
1. Customer clears session (checkout complete or manually reset)
2. Returns to site
3. **→ Spin wheel appears again** (fresh session)

---

## 🛠️ Technical Implementation

### **Frontend (`customer-frontend/static/js/main.js`)**
```javascript
// Tracks if spin wheel was shown this session
let spinWheelShownThisSession = false;

async function checkPromo() {
    // 1. Check for Spin Wheel (Priority)
    if (promo.type === 'spin_wheel' && !spinWheelShownThisSession) {
        const hasSeenSpinWheel = sessionStorage.getItem('spin_wheel_shown');
        
        if (!hasSeenSpinWheel) {
            // First time - show it!
            sessionStorage.setItem('spin_wheel_shown', 'true');
            spinWheelShownThisSession = true;
            showSpinWheel(promo.title, promo.content);
        }
        return;
    }

    // 2. Handle Banner Rotation
    if (promo.type === 'banner') {
        showBannerPromo(promo.title, promo.content.image);
    }
}
```

### **Backend (`backend/db.py`)**
```python
def get_current_promotion():
    # Priority 1: Return spin wheel if exists
    if spin_wheels:
        return spin_wheels_sorted[0]  # Customer side handles once-per-session
    
    # Priority 2: Rotate banners every 30 minutes
    if banners:
        idx = int(time.time() // 1800) % len(banners)
        return banners_sorted[idx]
```

---

## 📋 How to Use

### **Step 1: Create a Spin Wheel Campaign**
1. Go to **Worker Dashboard** → **Spin Wheel** (sidebar)
2. Enter title: e.g., "Welcome Bonus"
3. Enter prizes (comma-separated): `50% OFF, 25% OFF, Free Coffee, 10% OFF, Try Again`
4. Click **"Launch Campaign"**

### **Step 2: Create Multiple Banner Ads**
1. Go to **Worker Dashboard** → **Design Mode**
2. Click **"AI Generate"**
3. Enter prompts for different ads:
   - "Summer sale on fruits" → Deploy
   - "Weekend tech deals" → Deploy
   - "Fresh bakery items" → Deploy
4. All deployed ads will rotate every 30 minutes

### **Step 3: Test Customer Experience**

#### **Test 1: First Visit (Spin Wheel)**
1. Go to `http://localhost:5000/customer-frontend/`
2. **✅ Spin wheel appears immediately**
3. Spin and win discount
4. Close the modal

#### **Test 2: Same Session (No Spin Wheel)**
1. Refresh the page (F5)
2. **✅ Spin wheel does NOT appear**
3. **✅ Banner ad appears instead**

#### **Test 3: New Session (Spin Wheel Again)**
1. Hover over the **Dev Tools** flask icon (bottom-right)
2. Click **"🔄 Reset Session (New Customer)"**
3. **✅ Spin wheel appears again!**

---

## 🧪 Testing Tools

### **Reset Session Button**
- Located in the **RFID Simulation Panel** (flask icon, bottom-right)
- Clears `sessionStorage` and `localStorage`
- Simulates a new customer picking up a trolley
- Reloads the page

### **Active Promotions Panel (Worker Dashboard)**
- Shows all active promotions (spin wheels and banners)
- Live countdown timer showing time until next banner rotation
- Delete button to remove unwanted promotions

---

## 💡 Example Scenario

### **Store Setup:**
- **1 Spin Wheel**: "Spin to Win!" with prizes: 50% OFF, 25% OFF, Free Item
- **3 Banner Ads**:
  - Ad 1: "Summer Fruits Sale"
  - Ad 2: "Tech Gadgets Offer"
  - Ad 3: "Fresh Bakery Items"

### **Customer Journey:**

**Time: 10:00 AM - Customer arrives**
- Opens customer app
- **→ "Spin to Win!" wheel appears**
- Spins and wins "25% OFF"
- Starts shopping

**Time: 10:05 AM - Same session**
- Continues shopping, adds items
- **→ "Summer Fruits Sale" banner displays (for 10 seconds)**
- Adds fruits to cart

**Time: 10:30 AM - Same session**
- Still shopping
- **→ Banner rotates to "Tech Gadgets Offer" (30 minutes passed)**

**Time: 10:35 AM - Checkout**
- Proceeds to payment
- 25% discount is applied
- Completes purchase and leaves

**Time: 2:00 PM - Customer returns (new session)**
- Opens customer app again
- **→ "Spin to Win!" wheel appears again!**
- New chance to win

---

## 🎨 Visual Indicators

### **Worker Dashboard - Active Promotions**

**Spin Wheel:**
- 🧡 Orange border and background
- 🎯 "SPIN WHEEL" badge
- Shows prizes: "50% OFF, 25% OFF, Free Coffee..."

**Banner Ad:**
- 🔵 Blue icon background
- 📸 "BANNER" badge
- Shows "Banner Ad Campaign"

**Rotation Timer:**
- 🟢 Green pill showing countdown: `14:23`
- Updates every second
- Shows time until next banner rotation

---

## 🔧 Configuration

### **Rotation Interval:**
Located in `backend/db.py` and `worker.js`:
```python
intervalTime = 1800  # 30 minutes in seconds (1800)
```

To change to 15 minutes:
```python
intervalTime = 900  # 15 minutes
```

To change to 1 hour:
```python
intervalTime = 3600  # 60 minutes
```

---

## 📊 Summary

| Feature | Spin Wheel | Banner Ads |
|---------|-----------|------------|
| **Frequency** | Once per session | Every 30 minutes |
| **Trigger** | First page load | Time-based rotation |
| **Storage** | `sessionStorage` | Backend rotation |
| **Reset** | New session/checkout | Continuous rotation |
| **Purpose** | Engage new customers | Promote products |

---

## ✅ Completed Features

- ✅ Spin wheel appears ONCE per customer session
- ✅ Banner ads rotate every 30 minutes
- ✅ Smart promotion priority (spin wheel > banners)
- ✅ Session tracking with `sessionStorage`
- ✅ Fair rotation for multiple banner ads
- ✅ Live countdown timer in worker dashboard
- ✅ Visual distinction between promotion types
- ✅ Reset session button for testing
- ✅ Discount integration with checkout
- ✅ Timestamp tracking for ad rotation
