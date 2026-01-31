from flask import Flask, render_template, request, jsonify, send_from_directory, session, redirect, url_for
from jinja2 import ChoiceLoader, FileSystemLoader
from datetime import datetime
from functools import wraps
import json
import os

# Adjust paths to point to the root of the project
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CUSTOMER_TEMPLATE_DIR = os.path.join(BASE_DIR, "customer-frontend", "templates")
ADMIN_TEMPLATE_DIR = os.path.join(BASE_DIR, "admin-frontend", "templates")

app = Flask(__name__, 
            static_folder=BASE_DIR, 
            static_url_path='')

# IMPORTANT: Add secret key for session management
app.config['SECRET_KEY'] = 'smart-trolley-secret-key-12345'  # Change this in production

app.jinja_loader = ChoiceLoader([
    FileSystemLoader(CUSTOMER_TEMPLATE_DIR),
    FileSystemLoader(ADMIN_TEMPLATE_DIR)
])

# Mock Data
PRODUCTS = {
    "03563B38": {"id": "03563B38", "name": "Milk Packet",    "unit": "500 ml", "price": 25,  "stock": 40, "category": "Dairy",    "image": "/customer-frontend/static/images/milk_packet.png"},
    "079B3F55": {"id": "079B3F55", "name": "Biscuit Packet", "unit": "100 g",  "price": 30,  "stock": 50, "category": "Snacks",   "image": "/customer-frontend/static/images/biscuit_packet.png"},
    "435D1D39": {"id": "435D1D39", "name": "Tea Powder",     "unit": "250 g",  "price": 160, "stock": 15, "category": "Beverages","image": "/customer-frontend/static/images/tea_powder.png"},
    "52612D5C": {"id": "52612D5C", "name": "India Gate Basmati Rice", "unit": "5 kg",   "price": 360, "stock": 12, "category": "Grains",   "image": "/customer-frontend/static/images/india_gate_rice.png"},
    "83E69038": {"id": "83E69038", "name": "Sugar",          "unit": "1 kg",   "price": 55,  "stock": 25, "category": "Grains",   "image": "/customer-frontend/static/images/sugar.png"},
    "9917FEE4": {"id": "9917FEE4", "name": "Sunflower Oil",  "unit": "1 L",    "price": 140, "stock": 20, "category": "Oil",      "image": "/customer-frontend/static/images/sunflower_oil.png"},
    "B3211839": {"id": "B3211839", "name": "Bread Loaf",     "unit": "400 g",  "price": 50,  "stock": 30, "category": "Bakery",   "image": "/customer-frontend/static/images/bread_loaf.png"},
    "E3F72C39": {"id": "E3F72C39", "name": "Aashirvaad Atta", "unit": "1 kg",   "price": 45,  "stock": 22, "category": "Grains",   "image": "/customer-frontend/static/images/aashirvaad_atta.png"}
}

cart = {}
sales_history = []

# Admin credentials
ADMIN_CREDENTIALS = {
    "admin": "admin123"
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

# ==================== AUTH ROUTES ====================

@app.route('/admin/login', methods=['GET'])
def admin_login_page():
    """Display the animated supermarket login page"""
    if 'admin_logged_in' in session:
        return redirect(url_for('admin'))
    return render_template("logi.html")  # <-- CHANGED TO logi.html

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

# ==================== EXISTING ROUTES ====================

@app.route('/')
def index():
    return render_template("index.html")

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

# ==================== CUSTOMER APIs ====================

@app.route('/products', methods=['GET'])
def get_products():
    return jsonify(PRODUCTS)

@app.route('/rfid', methods=['POST'])
def rfid():
    data = request.get_json()
    uid = data.get("uid")

    if uid not in PRODUCTS:
        return jsonify({"status": "error", "message": "Product not found", "uid": uid}), 404

    product = PRODUCTS[uid]
    
    if uid in cart:
        cart[uid]["qty"] += 1
    else:
        cart[uid] = {
            "id": uid,
            "name": product["name"],
            "unit": product.get("unit", ""),
            "price": product["price"],
            "image": product["image"],
            "qty": 1
        }

    return jsonify({"status": "ok", "cart": cart})

@app.route('/cart/remove', methods=['POST'])
def remove_from_cart():
    data = request.get_json()
    uid = data.get("uid")
    
    if uid in cart:
        if cart[uid]["qty"] > 1:
            cart[uid]["qty"] -= 1
        else:
            del cart[uid]
        return jsonify({"status": "ok", "cart": cart})
    
    return jsonify({"status": "error", "message": "Item not in cart"}), 404

@app.route('/cart', methods=['GET'])
def get_cart():
    total = sum(item['price'] * item['qty'] for item in cart.values())
    return jsonify({"items": cart, "total": total})

@app.route('/checkout', methods=['POST'])
def checkout():
    global cart
    if not cart:
        return jsonify({"status": "error", "message": "Cart is empty"}), 400

    total = sum(item['price'] * item['qty'] for item in cart.values())
    order = {
        "timestamp": datetime.now().isoformat(),
        "items": list(cart.values()),
        "total": total
    }
    
    for uid, item in cart.items():
        if uid in PRODUCTS:
            PRODUCTS[uid]["stock"] = max(0, PRODUCTS[uid]["stock"] - item["qty"])
    
    sales_history.append(order)
    cart = {}
    
    return jsonify({"status": "ok", "message": "Checkout successful", "order": order})

# ==================== ADMIN APIs (PROTECTED) ====================

@app.route('/admin/data', methods=['GET'])
@login_required
def get_admin_data():
    total_sales = sum(order['total'] for order in sales_history)
    total_orders = len(sales_history)
    total_products = len(PRODUCTS)
    low_stock_items = [p for p in PRODUCTS.values() if p['stock'] < 10]
    
    return jsonify({
        "total_sales": total_sales,
        "total_orders": total_orders,
        "total_products": total_products,
        "low_stock_count": len(low_stock_items)
    })

@app.route('/inventory', methods=['GET'])
@login_required
def get_inventory():
    return jsonify(PRODUCTS)

@app.route('/sales/daily', methods=['GET'])
@login_required
def get_daily_sales():
    return jsonify([
        {"date": "2026-01-20", "amount": 1200},
        {"date": "2026-01-21", "amount": 1500},
        {"date": "2026-01-22", "amount": 1100},
        {"date": "2026-01-23", "amount": 1800},
        {"date": "2026-01-24", "amount": 2200},
        {"date": "2026-01-25", "amount": 1900},
        {"date": "2026-01-26", "amount": sum(o['total'] for o in sales_history)}
    ])

@app.route('/sales/monthly', methods=['GET'])
@login_required
def get_monthly_sales():
    return jsonify([
        {"month": "Aug", "amount": 45000},
        {"month": "Sep", "amount": 52000},
        {"month": "Oct", "amount": 48000},
        {"month": "Nov", "amount": 61000},
        {"month": "Dec", "amount": 75000},
        {"month": "Jan", "amount": 68000}
    ])

@app.route('/sales/history', methods=['GET'])
@login_required
def get_sales_history():
    return jsonify(sales_history)

@app.route('/chat', methods=['POST'])
@login_required
def chat():
    data = request.get_json()
    message = data.get("message", "").lower()
    
    response = "I'm not sure how to help with that. Try asking about 'sales', 'stock', or 'products'."
    
    if "sales" in message:
        total_sales = sum(order['total'] for order in sales_history)
        response = f"Total sales so far are ₹{total_sales}."
    elif "stock" in message or "inventory" in message:
        low_stock = [p['name'] for p in PRODUCTS.values() if p['stock'] < 10]
        if low_stock:
            response = f"Warning: The following items are low in stock: {', '.join(low_stock)}."
        else:
            response = "All items are well-stocked."
    elif "hello" in message or "hi" in message:
        response = "Hello! I am your Smart Trolley Assistant. How can I help you today?"

    return jsonify({"reply": response})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)