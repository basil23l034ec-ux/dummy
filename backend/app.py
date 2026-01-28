from flask import Flask, render_template, request, jsonify, send_from_directory
from datetime import datetime
import json
import os

# Adjust paths to point to the root of the project
BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
CUSTOMER_TEMPLATE_DIR = os.path.join(BASE_DIR, "customer-frontend", "templates")
ADMIN_TEMPLATE_DIR = os.path.join(BASE_DIR, "admin-frontend", "templates")

app = Flask(__name__, 
            static_folder=BASE_DIR, 
            static_url_path='')

# Mock Data
PRODUCTS = {
    "52612D5C": {"id": "52612D5C", "name": "Rice Bag 5kg", "price": 320, "stock": 50, "category": "Grains", "image": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=100&q=80"},
    "9917FEE4": {"id": "9917FEE4", "name": "Sunflower Oil 1L", "price": 180, "stock": 30, "category": "Oil", "image": "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=100&q=80"},
    "03563B38": {"id": "03563B38", "name": "Milk Packet 500ml", "price": 30, "stock": 100, "category": "Dairy", "image": "https://images.unsplash.com/photo-1550583724-125581828703?auto=format&fit=crop&w=100&q=80"},
    "B3211839": {"id": "B3211839", "name": "Bread Loaf", "price": 45, "stock": 40, "category": "Bakery", "image": "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=100&q=80"},
    "83E69038": {"id": "83E69038", "name": "Sugar 1kg", "price": 55, "stock": 60, "category": "Grains", "image": "https://images.unsplash.com/photo-1581441363689-1f3c3c414635?auto=format&fit=crop&w=100&q=80"},
    "435D1D39": {"id": "435D1D39", "name": "Tea Powder 250g", "price": 120, "stock": 25, "category": "Beverages", "image": "https://images.unsplash.com/photo-1544787210-228394c3d3e2?auto=format&fit=crop&w=100&q=80"},
    "E3F72C39": {"id": "E3F72C39", "name": "Soap Bar", "price": 38, "stock": 80, "category": "Personal Care", "image": "https://images.unsplash.com/photo-1605264964528-06403738d6dc?auto=format&fit=crop&w=100&q=80"},
    "079B3F55": {"id": "079B3F55", "name": "Biscuit Pack", "price": 25, "stock": 150, "category": "Snacks", "image": "https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=100&q=80"}
}

cart = {}
sales_history = []

@app.route('/')
def index():
    return send_from_directory(CUSTOMER_TEMPLATE_DIR, "index.html")

@app.route('/admin')
def admin():
    return send_from_directory(ADMIN_TEMPLATE_DIR, "admin.html")

# --- Customer APIs ---

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
    
    # Update stock
    for uid, item in cart.items():
        if uid in PRODUCTS:
            PRODUCTS[uid]["stock"] = max(0, PRODUCTS[uid]["stock"] - item["qty"])
    
    sales_history.append(order)
    cart = {} # Clear cart
    
    return jsonify({"status": "ok", "message": "Checkout successful", "order": order})

# --- Admin APIs ---

@app.route('/admin/data', methods=['GET'])
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
def get_inventory():
    return jsonify(PRODUCTS)

@app.route('/sales/daily', methods=['GET'])
def get_daily_sales():
    # Mocking daily sales data (last 7 days)
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
def get_monthly_sales():
    return jsonify([
        {"month": "Aug", "amount": 45000},
        {"month": "Sep", "amount": 52000},
        {"month": "Oct", "amount": 48000},
        {"month": "Nov", "amount": 61000},
        {"month": "Dec", "amount": 75000},
        {"month": "Jan", "amount": 68000}
    ])

@app.route('/chat', methods=['POST'])
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
    app.run(host='0.0.0.0', port=5000)
