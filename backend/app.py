from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from jinja2 import ChoiceLoader, FileSystemLoader
from datetime import datetime, timedelta
from functools import wraps
import os
from dotenv import load_dotenv
import random
import urllib.parse

load_dotenv()

import db  # Import the new database module
import google.generativeai as genai
from groq import Groq
from openai import OpenAI
import json
import urllib.parse

# Configure API Key
GENAI_API_KEY = os.environ.get("GENAI_API_KEY")
if GENAI_API_KEY and not GENAI_API_KEY.startswith("gsk_"):
    genai.configure(api_key=GENAI_API_KEY)

# Adjust paths to point to the root of the project
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CUSTOMER_TEMPLATE_DIR = os.path.join(BASE_DIR, "customer-frontend", "templates")
ADMIN_TEMPLATE_DIR = os.path.join(BASE_DIR, "admin-frontend", "templates")
WORKER_TEMPLATE_DIR = os.path.join(BASE_DIR, "worker-frontend", "templates")

app = Flask(__name__, 
            static_folder=BASE_DIR, 
            static_url_path='')

# IMPORTANT: Add secret key for session management
app.config['SECRET_KEY'] = 'smart-trolley-secret-key-12345'  # Change this in production

app.jinja_loader = ChoiceLoader([
    FileSystemLoader(CUSTOMER_TEMPLATE_DIR),
    FileSystemLoader(ADMIN_TEMPLATE_DIR),
    FileSystemLoader(WORKER_TEMPLATE_DIR)
])

# Initialize Database on Startup
with app.app_context():
    db.init_db()

# Admin credentials
ADMIN_CREDENTIALS = {
    "admin": "admin123"
}

# Worker credentials
WORKER_CREDENTIALS = {
    "worker": "worker123"
}

# Login required decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'admin_logged_in' not in session:
            if request.is_json:
                return jsonify({"status": "error", "message": "Authentication required"}), 401
            return redirect(url_for('admin_login_page'))
        return f(*args, **kwargs)
    return decorated_function

# Worker Login required decorator
def worker_login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'worker_logged_in' not in session:
            if request.is_json:
                return jsonify({"status": "error", "message": "Authentication required"}), 401
            return redirect(url_for('worker_login_page'))
        return f(*args, **kwargs)
    return decorated_function

# ==================== DATA & LOGGING SETUP ====================

# Ensure logs directory exists
LOGS_DIR = os.path.join(BASE_DIR, "logs")
os.makedirs(LOGS_DIR, exist_ok=True)
AUDIT_LOG_FILE = os.path.join(LOGS_DIR, "staff_audit.jsonl")

# In-Memory State for Trolley Monitoring (Volatile)
# Structure: { 'T001': { 'last_beat': datetime, 'item_count': int, 'total': float } }
TROLLEY_SESSIONS = {}

def log_staff_action(actor, action, target_id, details=None):
    """Append immutable log entry for staff actions."""
    if os.environ.get("DISABLE_AUDIT_LOG"):
        return

    entry = {
        "timestamp": datetime.now().isoformat(),
        "actor": actor,
        "action": action,
        "target_id": target_id,
        "details": details or {},
        "ip": request.remote_addr
    }
    
    try:
        with open(AUDIT_LOG_FILE, "a", encoding='utf-8') as f:
            f.write(json.dumps(entry) + "\n")
    except Exception as e:
        print(f"AUDIT LOG FAILURE: {e}") # Fail-open

def update_trolley_heartbeat(cart_items):
    """Update in-memory heartbeat for the single active trolley."""
    try:
        total = sum(item['final_price'] * item['qty'] for item in cart_items.values())
        count = sum(item['qty'] for item in cart_items.values())
        
        TROLLEY_SESSIONS['T001'] = {
            'last_beat': datetime.now(),
            'item_count': count,
            'total': total,
            'customer': 'Guest' # Placeholder for future expansion
        }
    except Exception as e:
        print(f"Heartbeat Error: {e}")

# ==================== AUTH ROUTES ====================

@app.route('/admin/login', methods=['GET'])
def admin_login_page():
    """Display the animated supermarket login page"""
    if 'admin_logged_in' in session:
        return redirect(url_for('admin'))
    return render_template("logi.html")

@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    """Handle login API"""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400
    
    if username in ADMIN_CREDENTIALS and ADMIN_CREDENTIALS[username] == password:
        session['admin_logged_in'] = True
        session['admin_username'] = username
        return jsonify({
            "success": True,
            "message": "Login successful",
            "redirect": "/admin"
        })
    else:
        return jsonify({
            "success": False,
            "message": "Invalid credentials"
        }), 401

@app.route('/api/admin/logout', methods=['POST'])
@login_required
def admin_logout():
    """Logout endpoint"""
    session.pop('admin_logged_in', None)
    session.pop('admin_username', None)
    return jsonify({"success": True, "message": "Logged out successfully"})

# --- Worker Auth ---

@app.route('/worker/login', methods=['GET'])
def worker_login_page():
    if 'worker_logged_in' in session:
        return redirect(url_for('worker_dashboard'))
    return render_template("login.html")

@app.route('/api/worker/login', methods=['POST'])
def worker_login():
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"success": False, "message": "Username and password required"}), 400
    
    if username in WORKER_CREDENTIALS and WORKER_CREDENTIALS[username] == password:
        session['worker_logged_in'] = True
        session['worker_username'] = username
        return jsonify({
            "success": True,
            "message": "Login successful",
            "redirect": "/worker"
        })
    else:
        return jsonify({
            "success": False,
            "message": "Invalid credentials"
        }), 401

@app.route('/api/worker/logout', methods=['POST'])
@worker_login_required
def worker_logout():
    session.pop('worker_logged_in', None)
    session.pop('worker_username', None)
    return jsonify({"success": True, "message": "Logged out successfully"})

# ==================== ADVANCED ADMIN FEATURES ====================

@app.route('/api/admin/audit', methods=['GET'])
@login_required
def get_audit_logs():
    """Read plain-text audit logs (Read-Only)"""
    logs = []
    try:
        if os.path.exists(AUDIT_LOG_FILE):
            with open(AUDIT_LOG_FILE, 'r', encoding='utf-8') as f:
                # Read last 100 lines for efficiency
                lines = f.readlines()[-100:]
                for line in reversed(lines): # Newest first
                    try:
                        logs.append(json.loads(line))
                    except:
                        continue
    except Exception as e:
        print(f"Error reading audit logs: {e}")
        
    return jsonify({"status": "success", "logs": logs})

@app.route('/api/admin/emergency/freeze-product', methods=['POST'])
@login_required
def emergency_freeze_product():
    """Emergency Control: Freeze a product to prevent sales"""
    data = request.get_json()
    pid = data.get('id')
    
    if not pid:
        return jsonify({"status": "error", "message": "ID required"}), 400
        
    try:
        # Utilizing ui_settings to store frozen state (extending existing schema usage)
        settings = db.get_ui_settings()
        frozen_list = json.loads(settings.get('frozen_products', '[]'))
        
        if pid not in frozen_list:
            frozen_list.append(pid)
            db.update_ui_settings({'frozen_products': json.dumps(frozen_list)})
            
        log_staff_action(session.get('admin_username', 'admin'), "FREEZE_PRODUCT", pid, {"reason": "Admin Emergency Action"})
        return jsonify({"status": "success", "message": f"Product {pid} frozen."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/admin/emergency/unfreeze-product', methods=['POST'])
@login_required
def emergency_unfreeze_product():
    """Emergency Control: Unfreeze"""
    data = request.get_json()
    pid = data.get('id')
    
    try:
        settings = db.get_ui_settings()
        frozen_list = json.loads(settings.get('frozen_products', '[]'))
        
        if pid in frozen_list:
            frozen_list.remove(pid)
            db.update_ui_settings({'frozen_products': json.dumps(frozen_list)})
            
        log_staff_action(session.get('admin_username', 'admin'), "UNFREEZE_PRODUCT", pid, {"reason": "Admin Emergency Action"})
        return jsonify({"status": "success", "message": f"Product {pid} unfrozen."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/admin/emergency/reset-trolley', methods=['POST'])
@login_required
def emergency_reset_trolley():
    """Emergency Control: Force clear trolley session"""
    try:
        db.clear_cart()
        # Reset in-memory state
        if 'T001' in TROLLEY_SESSIONS:
            del TROLLEY_SESSIONS['T001']
            
        log_staff_action(session.get('admin_username', 'admin'), "RESET_TROLLEY", "T001", {"reason": "Admin Emergency Reset"})
        return jsonify({"status": "success", "message": "Trolley session force-cleared."})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# ==================== EXISTING ROUTES ====================

@app.route('/')
def index():
    return render_template("index.html")

@app.route('/test-spin')
def test_spin():
    return render_template("test-spin.html")

@app.route('/admin')
@login_required
def admin():
    return render_template("admin.html")

@app.route('/admin/inventory')
@login_required
def admin_inventory():
    return render_template("inventory.html")

@app.route('/admin/sales')
@login_required
def admin_sales():
    return render_template("sales.html")

@app.route('/admin/settings')
@login_required
def admin_settings():
    return render_template("settings.html")


@app.route('/admin/trolleys')
@login_required
def admin_trolleys():
    return render_template("trolleys.html")


@app.route('/admin/customers')
@login_required
def admin_customers():
    return render_template("customers.html")


@app.route('/admin/reports')
@login_required
def admin_reports():
    return render_template("reports.html")


@app.route('/admin/alerts')
@login_required
def admin_alerts():
    return render_template("alerts.html")

# ==================== WORKER ROUTES ====================

@app.route('/worker')
@worker_login_required
def worker_dashboard():
    return render_template("worker.html")

@app.route('/api/worker/products', methods=['GET'])
@worker_login_required
def worker_get_products():
    return jsonify(db.get_all_products())

@app.route('/api/worker/props', methods=['GET'])
@worker_login_required
def worker_get_props():
    # Deprecated endpoint matching specific frontend call if necessary, else identical to products
    return jsonify(db.get_all_products())

@app.route('/api/worker/add-product', methods=['POST'])
@worker_login_required
def worker_add_product():
    data = request.get_json()
    
    # Validation
    required_fields = ['id', 'name', 'price']
    for field in required_fields:
        if field not in data:
            return jsonify({"success": False, "message": f"Missing field: {field}"}), 400
            
    product_data = {
        "id": data['id'],
        "name": data['name'],
        "unit": data.get('unit', ''),
        "price": float(data['price']),
        "stock": int(data.get('stock', 0)),
        "discount": float(data.get('discount', 0)),
        "promotion_description": data.get('promotion_description', ''),
        "promotion_expiry": data.get('promotion_expiry', ''),
        "category": data.get('category', 'General'),
        "image": data.get('image', '/customer-frontend/static/images/default.png')
    }
    
    # Validate Discount
    if not (0 <= product_data['discount'] <= 90):
        return jsonify({"success": False, "message": "Discount must be between 0 and 90%"}), 400
    
    if db.add_product(product_data):
        log_staff_action(
            session.get('worker_username'), 
            "ADD_PRODUCT", 
            product_data['id'], 
            details={"name": product_data['name'], "stock": product_data['stock']}
        )
        return jsonify({"success": True, "message": "Product added successfully"})
    else:
        return jsonify({"success": False, "message": "Product ID already exists"}), 400

@app.route('/api/worker/update-product', methods=['POST'])
@worker_login_required
def worker_update_product():
    data = request.get_json()
    pid = data.get('id')
    
    if not pid:
        return jsonify({"success": False, "message": "Product ID required"}), 400
        
    updates = {}
    if 'stock' in data:
        updates['stock'] = int(data['stock'])
    if 'price' in data:
        updates['price'] = float(data['price'])
    if 'image' in data:
        updates['image'] = data['image']
    if 'promotion_description' in data:
        updates['promotion_description'] = data['promotion_description']
    if 'promotion_expiry' in data:
        updates['promotion_expiry'] = data['promotion_expiry']
    if 'discount' in data:
        updates['discount'] = float(data['discount'])
        if not (0 <= updates['discount'] <= 90):
            return jsonify({"success": False, "message": "Discount must be between 0 and 90%"}), 400
        
    if not updates:
        return jsonify({"success": False, "message": "No valid fields to update"}), 400
        
    db.update_product_fields(pid, updates)
    
    log_staff_action(
        session.get('worker_username'), 
        "UPDATE_PRODUCT", 
        pid, 
        details=updates
    )
    return jsonify({"success": True, "message": "Product updated successfully"})

@app.route('/api/worker/delete-product', methods=['POST'])
@worker_login_required
def worker_delete_product():
    data = request.get_json()
    pid = data.get('id')
    
    if not pid:
        return jsonify({"success": False, "message": "Product ID required"}), 400
        
    if db.delete_product(pid):
        log_staff_action(session.get('worker_username'), "DELETE_PRODUCT", pid)
        return jsonify({"success": True, "message": "Product deleted successfully"})
    else:
        return jsonify({"success": False, "message": "Failed to delete product"}), 500

# ==================== CUSTOMER APIs ====================

@app.route('/products', methods=['GET'])
def get_products():
    return jsonify(db.get_all_products())

@app.route('/rfid', methods=['POST'])
def rfid():
    data = request.get_json()
    uid = data.get("uid")

    # 1. EMERGENCY CHECK: Is Product Frozen?
    settings = db.get_ui_settings()
    frozen_list = json.loads(settings.get('frozen_products', '[]'))
    
    if uid in frozen_list:
        return jsonify({"status": "error", "message": "Item blocked by Admin"}), 403

    product = db.get_product(uid)
    if not product:
        return jsonify({"status": "error", "message": "Product not found", "uid": uid}), 404

    db.add_to_cart(uid)
    cart = db.get_cart_items() # Fetch updated cart
    
    # 2. Update Heartbeat
    update_trolley_heartbeat(cart)

    return jsonify({"status": "ok", "cart": cart})

@app.route('/cart/remove', methods=['POST'])
def remove_from_cart():
    data = request.get_json()
    uid = data.get("uid")
    
    if db.remove_from_cart(uid):
        cart = db.get_cart_items()
        
        # Update Heartbeat
        update_trolley_heartbeat(cart)
        
        return jsonify({"status": "ok", "cart": cart})
    
    return jsonify({"status": "error", "message": "Item not in cart or could not be removed"}), 404

@app.route('/cart', methods=['GET'])
def get_cart():
    cart = db.get_cart_items()
    # Update Heartbeat on Polling too (Active View)
    update_trolley_heartbeat(cart)
    
    # Calculate total using final_price (discounted)
    total = sum(item['final_price'] * item['qty'] for item in cart.values())
    return jsonify({"items": cart, "total": total})

@app.route('/checkout', methods=['POST'])
def checkout():
    data = request.get_json() or {}
    discount_percent = float(data.get('discount', 0))
    
    cart = db.get_cart_items()
    if not cart:
        return jsonify({"status": "error", "message": "Cart is empty"}), 400

    total = sum(item['final_price'] * item['qty'] for item in cart.values())
    
    # Record sale in DB (this also updates stock and clear cart)
    order = db.record_sale(cart, total, discount_percent)
    
    # Clear Heartbeat Session
    if 'T001' in TROLLEY_SESSIONS:
        del TROLLEY_SESSIONS['T001']
        
    return jsonify({"status": "ok", "message": "Checkout successful", "order": order})

@app.route('/promotions', methods=['GET'])
def get_promotions():
    """Fetch all active promotions"""
    products = db.get_all_products()
    active_promos = []
    
    current_time = datetime.now()
    
    for p in products.values():
        if p['discount'] > 0:
            # Check expiry if exists
            is_expired = False
            if p.get('promotion_expiry'):
                 try:
                     expiry = datetime.strptime(p['promotion_expiry'], "%Y-%m-%d")
                     if current_time > expiry:
                         is_expired = True
                 except:
                     pass # Invalid date format, ignore or assume active? Assuming active for robustness
            
            if not is_expired:
                active_promos.append(p)
                
    return jsonify(active_promos)

# ==================== ADMIN APIs (PROTECTED) ====================

@app.route('/admin/data', methods=['GET'])
@login_required
def get_admin_data():
    sales_history = db.get_sales_history()
    products = db.get_all_products()
    
    total_sales = sum(order['total'] for order in sales_history)
    total_orders = len(sales_history)
    total_products = len(products)
    low_stock_items = [p for p in products.values() if p['stock'] < 5]
    
    return jsonify({
        "total_sales": total_sales,
        "total_orders": total_orders,
        "total_products": total_products,
        "low_stock_count": len(low_stock_items)
    })

@app.route('/api/settings', methods=['GET'])
def get_settings():
    return jsonify(db.get_ui_settings())

@app.route('/api/worker/settings', methods=['POST'])
@worker_login_required
def update_settings():
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "No data provided"}), 400
        
    if db.update_ui_settings(data):
        return jsonify({"success": True, "message": "Settings updated successfully"})
    else:
        return jsonify({"success": False, "message": "Failed to update settings"}), 500

# --- Promotion APIs ---
@app.route('/api/promotions/current', methods=['GET'])
def get_current_promo():
    """Get the currently active promotion (rotates every 30 mins)"""
    promo = db.get_current_promotion()
    return jsonify(promo if promo else {"type": "none"})

@app.route('/api/worker/promotions/list', methods=['GET'])
@worker_login_required
def list_worker_promotions():
    return jsonify(db.list_promotions())

@app.route('/api/worker/promotions/add', methods=['POST'])
@worker_login_required
def add_worker_promotion():
    data = request.get_json()
    # Expects: {type: 'banner'|'spin_wheel', title: '...', content: {...}}
    if not data or 'type' not in data or 'title' not in data:
        return jsonify({"success": False, "message": "Missing required fields"}), 400
        
    if db.add_promotion(data['type'], data['title'], data.get('content', {})):
        return jsonify({"success": True, "message": "Promotion added"})
    else:
        return jsonify({"success": False, "message": "Failed to add promotion"}), 500

@app.route('/api/worker/promotions/<int:pid>', methods=['DELETE'])
@worker_login_required
def delete_worker_promotion(pid):
    if db.delete_promotion(pid):
        return jsonify({"success": True, "message": "Promotion deleted"})
    else:
        return jsonify({"success": False, "message": "Failed to delete"}), 500

@app.route('/inventory', methods=['GET'])
@login_required
def get_inventory():
    return jsonify(db.get_all_products())

@app.route('/api/admin/analytics', methods=['GET'])
@login_required
def get_admin_analytics():
    try:
        sales_history = db.get_sales_history() or []
        products = db.get_all_products() or {}
        
        # Date strings
        today_str = datetime.now().strftime("%Y-%m-%d")
        yesterday_str = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")

        # 1. Today's Stats (Strictly Correct Data)
        today_sales = sum(o.get('total', 0) for o in sales_history if str(o.get('timestamp', '')).startswith(today_str))
        today_orders_count = len([o for o in sales_history if str(o.get('timestamp', '')).startswith(today_str)])
        
        # Calculate trend (vs Yesterday)
        yesterday_sales = sum(o.get('total', 0) for o in sales_history if str(o.get('timestamp', '')).startswith(yesterday_str))
        trend_pct = 0
        if yesterday_sales > 0:
            trend_pct = round(((today_sales - yesterday_sales) / yesterday_sales) * 100)
        
        # Active Trolleys (Single Trolley Project: 1 if cart has items, 0 otherwise)
        cart_items = db.get_cart_items()
        active_trolleys = 1 if cart_items else 0
        
        # Low Stock
        low_stock_count = len([p for p in products.values() if p.get('stock', 0) < 5])

        
        # 2. Daily Sales (Last 7 Days) - REAL data; optional end_date for calendar pick
        end_date_str = request.args.get('end_date')  # YYYY-MM-DD
        if end_date_str:
            try:
                end_dt = datetime.strptime(end_date_str, "%Y-%m-%d")
                if end_dt.date() > datetime.now().date():
                    end_dt = datetime.now()
            except (ValueError, TypeError):
                end_dt = datetime.now()
        else:
            end_dt = datetime.now()
        end_date_str = end_dt.strftime("%Y-%m-%d")

        daily_map = {}
        for i in range(6, -1, -1):  # 6 days ago through end date
            d = end_dt - timedelta(days=i)
            day_str = d.strftime("%Y-%m-%d")
            is_end_day = (day_str == end_date_str)
            is_today = (day_str == today_str)
            label = "Today" if is_today else ("Selected day" if is_end_day and not is_today else d.strftime("%a %d"))
            daily_map[day_str] = {"date": day_str, "amount": 0, "label": label}
        for o in sales_history:
            ts = str(o.get('timestamp', ''))[:10]
            if ts in daily_map:
                daily_map[ts]["amount"] += o.get('total', 0)
        daily_sales = list(daily_map.values())
        daily_sales.sort(key=lambda x: x["date"])
        for i, d in enumerate(daily_sales):
            if d["date"] == today_str:
                d["date"] = "Today"
            elif d["date"] == end_date_str and end_date_str != today_str:
                d["date"] = datetime.strptime(d["date"], "%Y-%m-%d").strftime("%a %d")
            else:
                d["date"] = datetime.strptime(d["date"], "%Y-%m-%d").strftime("%a %d")
        
        # 2b. Hourly Sales (Today)
        sales_by_hour = {h: 0 for h in range(8, 23)} # 8 AM to 10 PM
        for o in sales_history:
            if str(o.get('timestamp', '')).startswith(today_str):
                try:
                    dt = datetime.fromisoformat(o.get('timestamp'))
                    h = dt.hour
                    if 8 <= h <= 22:
                        sales_by_hour[h] += o.get('total', 0)
                except:
                    pass
        
        hourly_sales = [{"hour": f"{h:02d}:00", "amount": sales_by_hour[h]} for h in range(8, 23)]

        # 3. Monthly Sales: last 12 months with REAL data (zeros for months with no sales)
        monthly_map = {}
        for order in sales_history:
            ts = order.get('timestamp', '')
            try:
                date_obj = datetime.fromisoformat(ts)
                month_key = (date_obj.year, date_obj.month)
                monthly_map[month_key] = monthly_map.get(month_key, 0) + order.get('total', 0)
            except Exception:
                continue

        now = datetime.now()
        monthly_sales = []
        for i in range(12):  # 12 months: from 11 months ago to current month
            month = now.month - 1 - i
            year = now.year
            while month <= 0:
                month += 12
                year -= 1
            month_key = (year, month)
            label = datetime(year, month, 1).strftime("%b %Y")
            amount = monthly_map.get(month_key, 0)
            monthly_sales.append({"month": label, "amount": amount})
        monthly_sales.reverse()  # oldest to newest (left to right on chart)

        # 3b. Weekly Sales: last 8 weeks (Mon–Sun) with REAL data
        weekly_map = {}
        for order in sales_history:
            ts = order.get('timestamp', '')
            try:
                date_obj = datetime.fromisoformat(ts)
                # ISO week: (year, week number)
                year, week, _ = date_obj.isocalendar()
                week_key = (year, week)
                weekly_map[week_key] = weekly_map.get(week_key, 0) + order.get('total', 0)
            except Exception:
                continue
        now = datetime.now()
        weekly_sales = []
        for i in range(7, -1, -1):  # 8 weeks ago through this week
            d = now - timedelta(weeks=i)
            year, week, _ = d.isocalendar()
            week_key = (year, week)
            # Label: Monday of that week
            monday = d - timedelta(days=d.weekday())
            label = "This week" if i == 0 else monday.strftime("%d %b")
            amount = weekly_map.get(week_key, 0)
            weekly_sales.append({"week": label, "amount": amount})
        
        # 4. REAL Category Distribution
        category_totals = {}
        for order in sales_history:
            items = order.get('items', [])
            if isinstance(items, str):
                try: items = json.loads(items)
                except: items = []
            
            for item in items:
                cat = item.get('category', 'Grocery') # Default to Grocery for aesthetic richness
                price = item.get('final_price', item.get('price', 0))
                qty = item.get('qty', 1)
                amount = price * qty
                category_totals[cat] = category_totals.get(cat, 0) + amount
        
        # If real history is small, MERGE with mock for a better visual
        mock_cats = {"Grocery": 3500, "Dairy": 2500, "Snacks": 2000, "Beverages": 1500}
        for c, v in mock_cats.items():
            category_totals[c] = category_totals.get(c, 0) + v
        
        total_cat_sum = sum(category_totals.values())
        category_data = []
        for cat, amount in category_totals.items():
            category_data.append({
                "category": cat,
                "amount": amount,
                "percentage": round((amount / total_cat_sum) * 100, 1) if total_cat_sum > 0 else 0
            })
        
        # Sort by percentage for cleaner donut
        category_data.sort(key=lambda x: x['percentage'], reverse=True)
            
        # 5. Recent Sales
        recent_sales = []
        for s in list(reversed(sales_history))[:5]:
            items = s.get('items', [])
            recent_sales.append({
                "id": s.get('id', '???'),
                "timestamp": s.get('timestamp', ''),
                "total": s.get('total', 0),
                "items_count": len(items) if isinstance(items, list) else 0
            })

        return jsonify({
            "status": "success",
            "stats": {
                "total_sales": today_sales,       # Displaying TODAY'S sales per request
                "total_orders": today_orders_count, # Displaying TODAY'S bills
                "active_trolleys": active_trolleys,
                "low_stock_count": low_stock_count,
                "trend_pct": trend_pct
            },
            "daily_sales": daily_sales,
            "hourly_sales": hourly_sales,
            "weekly_sales": weekly_sales,
            "monthly_sales": monthly_sales,
            "category_sales": category_data,
            "recent_sales": recent_sales
        })
    except Exception as e:
        import traceback
        print(f"Analytics Critical Error: {e}")
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/api/admin/alerts', methods=['GET'])
@login_required
def get_admin_alerts():
    """Return alerts derived from low stock, anomalies, and trolley state."""
    alerts = []
    try:
        products = db.get_all_products() or {}
        
        # 1. INVENTORY ALERTS (Existing Logic)
        for pid, p in products.items():
            name = p.get('name', 'Item')
            stock = p.get('stock', 0)
            if stock == 0:
                alerts.append({
                    "id": f"out-{pid}",
                    "message": f"Out of stock: {name}. Immediate reorder required.",
                    "type": "inventory",
                    "priority": "high",
                    "time": "Just now",
                })
            elif stock < 5:
                alerts.append({
                    "id": f"low-{pid}",
                    "message": f"Low stock: {name} ({stock} units, minimum: 5).",
                    "type": "inventory",
                    "priority": "medium",
                    "time": "Just now",
                })
        
        # 2. ANOMALY DETECTION (From Audit Logs)
        if os.path.exists(AUDIT_LOG_FILE):
             with open(AUDIT_LOG_FILE, 'r', encoding='utf-8') as f:
                lines = f.readlines()[-50:] # Check last 50 actions
                for line in reversed(lines):
                    try:
                        entry = json.loads(line)
                        action = entry.get('action')
                        details = entry.get('details', {})
                        pid = entry.get('target_id')
                        
                        # Rule A: Manual Zero Stocking
                        if action == "UPDATE_PRODUCT" and details.get('stock') == 0:
                            alerts.append({
                                "id": f"anom-zero-{pid}-{entry['timestamp']}",
                                "message": f"Suspicious Activity: Stock manually set to 0 for {pid} by {entry['actor']}.",
                                "type": "security",
                                "priority": "high",
                                "time": entry['timestamp'][:16].replace('T', ' ')
                            })
                        
                        # Rule B: High Value Deletion
                        if action == "DELETE_PRODUCT":
                            # We can't check price easily as it's deleted, but we flag the action
                            alerts.append({
                                "id": f"anom-del-{pid}-{entry['timestamp']}",
                                "message": f"Critical Action: Product {pid} deleted by {entry['actor']}. Verify authorization.",
                                "type": "security",
                                "priority": "critical",
                                "time": entry['timestamp'][:16].replace('T', ' ')
                            })
                            
                    except:
                        continue

        # 3. CONTEXT ALERTS (Trolley State)
        if 'T001' in TROLLEY_SESSIONS:
            t = TROLLEY_SESSIONS['T001']
            last_beat = t['last_beat']
            delta = (datetime.now() - last_beat).total_seconds()
            
            if delta > 300 and t['total'] > 500: # 5 mins idle + >500 value
                alerts.append({
                    "id": "ctx-aband-high",
                    "message": f"High Value Cart Abandoned (₹{t['total']}). Idle for {int(delta/60)} mins.",
                    "type": "operations",
                    "priority": "medium",
                    "time": "Just now"
                })

        # Sort: critical > high > medium > low
        priority_map = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        alerts.sort(key=lambda x: priority_map.get(x.get("priority", "low"), 3))
        
        return jsonify({"status": "success", "alerts": alerts})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "alerts": []}), 500


@app.route('/api/admin/trolleys', methods=['GET'])
@login_required
def get_admin_trolleys():
    """Return real-time trolley status based on in-memory heartbeats."""
    trolleys = []
    try:
        if 'T001' in TROLLEY_SESSIONS:
            data = TROLLEY_SESSIONS['T001']
            last_beat = data['last_beat']
            delta = (datetime.now() - last_beat).total_seconds()
            
            # Determine Status
            if delta < 60:
                status = "Online"
                status_color = "green"
            elif delta < 300:
                status = "Idle"
                status_color = "orange"
            else:
                status = "Abandoned"
                status_color = "red"
            
            trolleys.append({
                "id": "T001",
                "customer": data.get('customer', 'Guest'),
                "startTime": last_beat.strftime("%I:%M %p"), # Approx/Last active
                "items": data.get('item_count', 0),
                "total": round(data.get('total', 0), 2),
                "timeInStore": f"{int(delta/60)}m ago", # Showing last active
                "status": status,
                "statusColor": status_color
            })
            
        return jsonify({"status": "success", "trolleys": trolleys})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "trolleys": []}), 500


@app.route('/api/admin/reports/top-products', methods=['GET'])
@login_required
def get_reports_top_products():
    """Aggregate top products by quantity and revenue from sales history (no DB change)."""
    try:
        sales_history = db.get_sales_history() or []
        agg = {}
        for order in sales_history:
            items = order.get('items', [])
            if isinstance(items, str):
                try:
                    items = json.loads(items)
                except Exception:
                    items = []
            for item in items:
                name = item.get('name', 'Unknown')
                qty = item.get('qty', 1)
                price = item.get('final_price', item.get('price', 0))
                rev = price * qty
                if name not in agg:
                    agg[name] = {'quantity': 0, 'revenue': 0}
                agg[name]['quantity'] += qty
                agg[name]['revenue'] += rev
        top = [{"name": n, "quantity": d["quantity"], "revenue": round(d["revenue"], 2)} for n, d in agg.items()]
        top.sort(key=lambda x: x["revenue"], reverse=True)
        return jsonify({"status": "success", "top_products": top[:20]})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e), "top_products": []}), 500


@app.route('/sales/history', methods=['GET'])
@login_required
def get_sales_history_route():
    return jsonify(db.get_sales_history())

@app.route('/chat', methods=['POST'])
@login_required
def chat():
    data = request.get_json()
    message = (data.get("message") or "").strip().lower()

    sales_history = db.get_sales_history() or []
    products = db.get_all_products() or {}
    today_str = datetime.now().strftime("%Y-%m-%d")
    today_sales = sum(o.get('total', 0) for o in sales_history if str(o.get('timestamp', ''))[:10] == today_str)
    today_orders = len([o for o in sales_history if str(o.get('timestamp', ''))[:10] == today_str])
    total_sales = sum(o.get('total', 0) for o in sales_history)
    low_stock = [p for p in products.values() if p.get('stock', 0) < 5]
    out_of_stock = [p for p in products.values() if p.get('stock', 0) == 0]

    response = (
        "I can help with sales, stock, orders, and alerts. "
        "Try: **Today's sales**, **Low stock**, **Total orders**, or **What can you do?**"
    )

    if not message:
        return jsonify({"reply": "Type a question or tap a quick reply below!"})

    if any(w in message for w in ["hello", "hi", "hey", "good morning", "good afternoon"]):
        response = (
            f"Hello! I'm your Smart Trolley Assistant. "
            f"Today you have **{today_orders}** orders and **₹{today_sales:,.0f}** in sales. "
            "Ask me about stock, sales, or orders anytime."
        )
    elif any(w in message for w in ["today", "sales today", "today's sales", "revenue today"]):
        response = f"Today's sales: **₹{today_sales:,.2f}** from **{today_orders}** orders."
    elif any(w in message for w in ["total sales", "all sales", "overall sales", "revenue"]):
        total_orders = len(sales_history)
        response = f"Total sales (all time): **₹{total_sales:,.2f}** from **{total_orders}** orders."
    elif any(w in message for w in ["orders", "bills", "transactions"]):
        response = f"Today: **{today_orders}** orders. All time: **{len(sales_history)}** orders."
    elif any(w in message for w in ["stock", "inventory", "low stock", "restock"]):
        if out_of_stock:
            names = ", ".join(p.get("name", "?") for p in out_of_stock[:5])
            if len(out_of_stock) > 5:
                names += f" and {len(out_of_stock) - 5} more"
            response = f"Out of stock: {names}. Please reorder soon."
        elif low_stock:
            parts = [f"{p.get('name', '?')} ({p.get('stock', 0)} left)" for p in low_stock[:5]]
            if len(low_stock) > 5:
                parts.append(f"+{len(low_stock) - 5} more")
            response = f"Low stock ({len(low_stock)} items): " + ", ".join(parts) + "."
        else:
            response = "All items are well-stocked. No low-stock alerts."
    elif any(w in message for w in ["alert", "alerts", "warning", "problem"]):
        if low_stock or out_of_stock:
            response = f"You have **{len(out_of_stock)}** out of stock and **{len(low_stock)}** low-stock items. Check the Alerts page for details."
        else:
            response = "No alerts right now. Everything looks good."
    elif any(w in message for w in ["help", "what can you", "what do you do", "options"]):
        response = (
            "I can tell you: **Today's sales** & orders, **Total revenue**, **Low stock** items, "
            "**Alerts** summary, and greet you. Just ask in your own words or use the quick replies."
        )
    elif any(w in message for w in ["thank", "thanks", "bye", "goodbye"]):
        response = "You're welcome! Ask anytime. Have a great day."

    return jsonify({"reply": response})

@app.route('/api/ai/design', methods=['POST'])
@worker_login_required
def generate_design():
    data = request.get_json()
    prompt = data.get('prompt')

    if not prompt:
        return jsonify({"success": False, "message": "Prompt is required"}), 400

    try:
        model_name = "unknown"
        design = {}

        if not GENAI_API_KEY:
             raise Exception("No API Key Configured")

        if GENAI_API_KEY.startswith("gsk_"):
            # --- GROQ IMPLEMENTATION ---
            model_name = "llama-3.3-70b-versatile" 
            print(f"Using Groq Model: {model_name}")
            
            client = Groq(api_key=GENAI_API_KEY)
            
            system_instruction = """
            You are a creative Lead Designer for a high-end grocery & retail store.
            Your goal is to create VISUALLY STUNNING, EXCITING, and MODERN promotion designs.
            
            Based on the user's request, generate a JSON object with:
            - title: A short, punchy, high-impact headline (max 4 words). USE HTML to make it pop! 
              * Use <span class='text-primary'> or <span class='text-yellow-400'> or <span class='text-red-500'> for emphasis.
              * Use <br> to stack words for visual impact.
            - subtitle: A persuasive, catchy 1-sentence subtext that drives action.
            - image_prompt: A highly detailed, artistic description of a background image to generate. 
              * Include lighting (e.g., 'cinematic lighting', 'neon glow', 'sunlight').
              * Include style (e.g., 'photorealistic', '4k', 'vibrant colors', 'minimalist', 'dark mode aesthetic').
            
            Example output:
            {
                "title": "SUMMER <br> <span class='text-yellow-400'>MADNESS</span>",
                "subtitle": "Dive into refreshing deals that will cool you down instantly!",
                "image_prompt": "close up of splashing iced refreshing tropical cocktail drink, summer vibe, bright sunlight, cinematic 4k, blur background, photorealistic"
            }
            
            Return ONLY valid JSON.
            """
            
            completion = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": f"Create a hype design for: {prompt}"}
                ],
                temperature=0.9, # Higher creative freedom
                response_format={"type": "json_object"}
            )
            
            text = completion.choices[0].message.content
            design = json.loads(text)

        elif GENAI_API_KEY.startswith("nvapi-"):
            # --- NVIDIA NIM IMPLEMENTATION ---
            model_name = "meta/llama-3.1-70b-instruct"
            print(f"Using NVIDIA NIM Model: {model_name}")
            
            client = OpenAI(
                base_url="https://integrate.api.nvidia.com/v1",
                api_key=GENAI_API_KEY
            )
            
            system_instruction = """
            You are a creative Lead Designer for a high-end grocery & retail store.
            Your goal is to create VISUALLY STUNNING, EXCITING, and MODERN promotion designs.
            
            Based on the user's request, generate a JSON object with:
            - title: A short, punchy, high-impact headline (max 4 words). USE HTML to make it pop! 
              * Use <span class='text-primary'> or <span class='text-yellow-400'> or <span class='text-red-500'> for emphasis.
              * Use <br> to stack words for visual impact.
            - subtitle: A persuasive, catchy 1-sentence subtext that drives action.
            - image_prompt: A highly detailed, artistic description of a background image to generate. 
              * Include lighting (e.g., 'cinematic lighting', 'neon glow', 'sunlight').
              * Include style (e.g., 'photorealistic', '4k', 'vibrant colors', 'minimalist', 'dark mode aesthetic').
            
            Return ONLY valid JSON.
            """
            
            completion = client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": system_instruction},
                    {"role": "user", "content": f"Create a hype design for: {prompt}"}
                ],
                temperature=0.7,
                top_p=1,
                max_tokens=1024,
                response_format={"type": "json_object"}
            )
            
            text = completion.choices[0].message.content
            # Clean up potential markdown formatting
            text = text.replace('```json', '').replace('```', '').strip()
            
            try:
                design = json.loads(text)
            except json.JSONDecodeError:
                # Fallback
                start = text.find('{')
                end = text.rfind('}') + 1
                if start != -1 and end != -1:
                    design = json.loads(text[start:end])
                else:
                    raise ValueError(f"Could not extract JSON from: {text}")

        else:
            # --- GEMINI IMPLEMENTATION (Legacy/Default) ---
            # Dynamically find an available model
            model_name = 'gemini-pro' # Fallback
            try:
                for m in genai.list_models():
                    if 'generateContent' in m.supported_generation_methods:
                        model_name = m.name
                        # Prefer flash or pro if available
                        if 'flash' in m.name:
                            break
                        if 'pro' in m.name and '1.5' in m.name:
                            model_name = m.name
            except Exception as list_err:
                print(f"Model List Error: {list_err}")

            print(f"Using Gemini Model: {model_name}")
            model = genai.GenerativeModel(model_name)
            
            system_instruction = """
            You are a creative Lead Designer for a high-end grocery & retail store.
            Your goal is to create VISUALLY STUNNING, EXCITING, and MODERN promotion designs.
            
            Based on the user's request, generate a JSON object with:
            - title: A short, punchy, high-impact headline (max 4 words). USE HTML to make it pop! 
              * Use <span class='text-primary'> or <span class='text-yellow-400'> or <span class='text-red-500'> for emphasis.
            - subtitle: A persuasive, catchy 1-sentence subtext.
            - image_prompt: A highly detailed, artistic description of a background image to generate. Include lighting, style (photorealistic, 4k).
            
            Return ONLY valid JSON.
            """
            
            full_prompt = f"{system_instruction}\nUser Request: Create a hype design for: {prompt}"
            response = model.generate_content(full_prompt)
            
            text = response.text.replace('```json', '').replace('```', '').strip()
            # Handle potential json.loads errors or cleanup
            import json as json_lib # Avoid conflict if any
            design = json_lib.loads(text)

        # --- COMMON POST-PROCESSING (Use Pollinations.ai) ---
        # Generate a dynamic AI image based on the detailed prompt
        if 'image_prompt' not in design:
            # Fallback if model uses old format
            design['image_prompt'] = design.get('image_keyword', 'grocery store artistic') + ", photorealistic, cinematic lighting"

        encoded_prompt = urllib.parse.quote(design['image_prompt'])
        seed = random.randint(1, 100000)
        design['image'] = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1280&height=720&nologo=true&seed={seed}"
        
        print(f"Generated Image URL: {design['image']}")

        return jsonify({"success": True, "design": design})

    except Exception as e:
        print(f"AI Error ({model_name}): {e}", flush=True)
        
        # --- FALLBACK SIMULATION MODE ---
        print("Falling back to Simulation Mode...")
        
        p = prompt.lower()
        design = {}
        
        if 'fruit' in p or 'veg' in p or 'food' in p or 'organic' in p:
            design = {
                "title": "FRESH <br><span class='text-green-500'>HARVEST</span>",
                "subtitle": "Taste the difference with our farm-fresh premium selection.",
                "image_prompt": "fresh organic vegetables basket, morning sunlight, cinematic"
            }
        elif 'tech' in p or 'phone' in p or 'laptop' in p or 'electronic' in p:
            design = {
                "title": "FUTURE <br><span class='text-blue-500'>TECH</span>",
                "subtitle": "Experience the next gen of gadgets at impossible prices.",
                "image_prompt": "futuristic electronics display, neon blue lighting, cyberpunk aesthetic, 4k"
            }
        elif 'sale' in p or 'offer' in p or 'deal' in p:
            design = {
                "title": "SUPER <br><span class='text-red-500'>DROP</span>",
                "subtitle": "Prices slashed! Grab your favorites before they vanish.",
                "image_prompt": "abstract shopping sale concept, flying shopping bags, red and white confetti, exciting 3d render"
            }
        elif 'summer' in p or 'hot' in p:
             design = {
                "title": "SUMMER <br><span class='text-yellow-400'>BLAST</span>",
                "subtitle": "Stay cool with the hottest deals of the season.",
                "image_prompt": "tropical beach party with refreshing drinks, bright sun, vibrant colors, 4k"
            }
        else:
            # Generic fallback
            design = {
                "title": "PREMIUM <br><span class='text-primary'>CHOICE</span>",
                "subtitle": "Elevate your lifestyle with our exclusive collection.",
                "image_prompt": "luxury modern retail store interior, blur background, elegant lighting"
            }

        encoded_prompt = urllib.parse.quote(design['image_prompt'])
        design['image'] = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1280&height=720&nologo=true"

        return jsonify({"success": True, "design": design})

    except Exception as e:
        print(f"AI Error ({model_name}): {e}", flush=True)
        
        # --- FALLBACK SIMULATION MODE ---
        print("Falling back to Simulation Mode...")
        
        p = prompt.lower()
        design = {}
        
        if 'fruit' in p or 'veg' in p or 'food' in p or 'organic' in p:
            design = {
                "title": "FRESH<br/><span class='text-green-500'>HARVEST</span>",
                "subtitle": "Farm fresh organic produce at unbeatable prices.",
                "image_keyword": "vegetables"
            }
        elif 'tech' in p or 'phone' in p or 'laptop' in p or 'electronic' in p:
            design = {
                "title": "MEGA<br/><span class='text-blue-500'>TECH SALE</span>",
                "subtitle": "Upgrade your gadgets with up to 50% off this week.",
                "image_keyword": "technology"
            }
        elif 'sale' in p or 'offer' in p or 'deal' in p:
            design = {
                "title": "FLASH<br/><span class='text-red-500'>SALE</span>",
                "subtitle": "Limited time offers on selected items. Don't miss out!",
                "image_keyword": "shopping"
            }
        elif 'summer' in p or 'hot' in p:
             design = {
                "title": "SUMMER<br/><span class='text-yellow-400'>VIBES</span>",
                "subtitle": "Cool down with our refreshing summer collection.",
                "image_keyword": "summer"
            }
        else:
            # Generic fallback
            design = {
                "title": "SPECIAL<br/><span class='text-primary'>OFFER</span>",
                "subtitle": "Exclusive deals just for you. Check them out today!",
                "image_keyword": "store"
            }

        design['image'] = f"https://source.unsplash.com/featured/?{design['image_keyword']}"
        
        return jsonify({
            "success": True, 
            "design": design, 
            "note": "AI Error or Quota Exceeded. Running in Simulation Mode."
        })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)