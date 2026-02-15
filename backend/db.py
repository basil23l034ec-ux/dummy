import sqlite3
import json
import os
from datetime import datetime

DB_FILE = os.path.join(os.path.dirname(__file__), "database.db")

DEFAULT_PRODUCTS = {
    "03563B38": {"id": "03563B38", "name": "Milk Packet",    "unit": "500 ml", "price": 25,  "stock": 40, "category": "Dairy",    "image": "/customer-frontend/static/images/milk_packet.png", "discount": 0},
    "079B3F55": {"id": "079B3F55", "name": "Biscuit Packet", "unit": "100 g",  "price": 30,  "stock": 50, "category": "Snacks",   "image": "/customer-frontend/static/images/biscuit_packet.png", "discount": 5, "promotion_description": "Snack Time Deal!"},
    "435D1D39": {"id": "435D1D39", "name": "Tea Powder",     "unit": "250 g",  "price": 160, "stock": 15, "category": "Beverages","image": "/customer-frontend/static/images/tea_powder.png", "discount": 0},
    "52612D5C": {"id": "52612D5C", "name": "India Gate Basmati Rice", "unit": "5 kg",   "price": 360, "stock": 12, "category": "Grains",   "image": "/customer-frontend/static/images/india_gate_rice.png", "discount": 10, "promotion_description": "Mega Rice Offer"},
    "83E69038": {"id": "83E69038", "name": "Sugar",          "unit": "1 kg",   "price": 55,  "stock": 25, "category": "Grains",   "image": "/customer-frontend/static/images/sugar.png", "discount": 0},
    "9917FEE4": {"id": "9917FEE4", "name": "Sunflower Oil",  "unit": "1 L",    "price": 140, "stock": 20, "category": "Oil",      "image": "/customer-frontend/static/images/sunflower_oil.png", "discount": 0},
    "B3211839": {"id": "B3211839", "name": "Bread Loaf",     "unit": "400 g",  "price": 50,  "stock": 30, "category": "Bakery",   "image": "/customer-frontend/static/images/bread_loaf.png", "discount": 0},
    "E3F72C39": {"id": "E3F72C39", "name": "Aashirvaad Atta", "unit": "1 kg",   "price": 45,  "stock": 22, "category": "Grains",   "image": "/customer-frontend/static/images/aashirvaad_atta.png", "discount": 0}
}

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    c = conn.cursor()

    # Create Tables
    c.execute('''CREATE TABLE IF NOT EXISTS products (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    unit TEXT,
                    price REAL NOT NULL,
                    stock INTEGER DEFAULT 0,
                    category TEXT,
                    image TEXT,
                    last_updated TEXT,
                    discount REAL DEFAULT 0,
                    promotion_description TEXT,
                    promotion_expiry TEXT
                )''')

    # Migration: Add last_updated column if it doesn't exist
    try:
        c.execute('ALTER TABLE products ADD COLUMN last_updated TEXT')
    except sqlite3.OperationalError:
        pass # Column already exists

    # Migration: Add discount column if it doesn't exist
    try:
        c.execute('ALTER TABLE products ADD COLUMN discount REAL DEFAULT 0')
    except sqlite3.OperationalError:
        pass # Column already exists

    c.execute('''CREATE TABLE IF NOT EXISTS cart (
                    product_id TEXT PRIMARY KEY,
                    qty INTEGER DEFAULT 1,
                    FOREIGN KEY (product_id) REFERENCES products (id)
                )''')

    c.execute('''CREATE TABLE IF NOT EXISTS sales (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    total REAL NOT NULL,
                    items TEXT NOT NULL
                )''')

    c.execute('''CREATE TABLE IF NOT EXISTS promotions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    type TEXT NOT NULL,  -- 'banner' or 'spin_wheel'
                    title TEXT NOT NULL,
                    content TEXT NOT NULL, -- JSON: message, image, discount_code, segments (for wheel)
                    active INTEGER DEFAULT 1, -- 1=Active, 0=Inactive
                    created_at TEXT,
                    last_shown TEXT  -- Track when this ad was last displayed for rotation
                )''')
    
    # Migration: Add created_at and last_shown columns if they don't exist
    try:
        c.execute('ALTER TABLE promotions ADD COLUMN created_at TEXT')
    except sqlite3.OperationalError:
        pass
    
    try:
        c.execute('ALTER TABLE promotions ADD COLUMN last_shown TEXT')
    except sqlite3.OperationalError:
        pass

    c.execute('''CREATE TABLE IF NOT EXISTS ui_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )''')

    # Seed Default Settings
    defaults = {
        "app_name": "Smart Trolley",
        "theme_bg_color": "#f9fafb",
        "theme_text_color": "#1f2937",
        "theme_nav_color": "#4f46e5",
        "theme_button_color": "#4f46e5",
        "promo_banner_text": "Welcome to Smart Trolley!",
        "promo_banner_image": "" 
    }
    
    for k, v in defaults.items():
        c.execute('INSERT OR IGNORE INTO ui_settings (key, value) VALUES (?, ?)', (k, v))

    # Seed Data if empty
    c.execute('SELECT count(*) FROM products')
    if c.fetchone()[0] == 0:
        print("Seeding database with default products...")
        curr_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        for pid, p in DEFAULT_PRODUCTS.items():
            c.execute('INSERT INTO products (id, name, unit, price, stock, category, image, last_updated, discount, promotion_description, promotion_expiry) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                      (p['id'], p['name'], p['unit'], p['price'], p['stock'], p['category'], p['image'], curr_time, p.get('discount', 0), p.get('promotion_description', ''), p.get('promotion_expiry', '')))
    
    conn.commit()
    conn.close()

# --- Product Helpers ---
def get_all_products():
    conn = get_db_connection()
    products = conn.execute('SELECT * FROM products').fetchall()
    conn.close()
    return {p['id']: dict(p) for p in products}

def get_product(pid):
    conn = get_db_connection()
    product = conn.execute('SELECT * FROM products WHERE id = ?', (pid,)).fetchone()
    conn.close()
    return dict(product) if product else None

def update_stock(pid, qty_change):
    """
    qty_change: negative to reduce stock, positive to increase
    """
    conn = get_db_connection()
    conn.execute('UPDATE products SET stock = stock + ? WHERE id = ?', (qty_change, pid))
    conn.commit()
    conn.close()

# --- Cart Helpers ---
def get_cart_items():
    conn = get_db_connection()
    query = '''
        SELECT c.product_id, c.qty, p.name, p.unit, p.price, p.image, p.discount
        FROM cart c
        JOIN products p ON c.product_id = p.id
    '''
    items = conn.execute(query).fetchall()
    conn.close()
    
    cart_dict = {}
    for item in items:
        # Calculate discounted price
        original_price = item['price']
        discount = item['discount'] or 0
        final_price = original_price * (1 - discount / 100)
        
        cart_dict[item['product_id']] = {
            "id": item['product_id'],
            "name": item['name'],
            "unit": item['unit'],
            "price": original_price,
            "discount": discount,
            "final_price": round(final_price, 2), # Use this for billing
            "image": item['image'],
            "qty": item['qty']
        }
    return cart_dict

def add_to_cart(pid):
    conn = get_db_connection()
    # Check if exists
    exists = conn.execute('SELECT 1 FROM cart WHERE product_id = ?', (pid,)).fetchone()
    
    if exists:
        conn.execute('UPDATE cart SET qty = qty + 1 WHERE product_id = ?', (pid,))
    else:
        conn.execute('INSERT INTO cart (product_id, qty) VALUES (?, 1)', (pid,))
        
    conn.commit()
    conn.close()

def remove_from_cart(pid):
    conn = get_db_connection()
    item = conn.execute('SELECT qty FROM cart WHERE product_id = ?', (pid,)).fetchone()
    
    if item:
        if item['qty'] > 1:
            conn.execute('UPDATE cart SET qty = qty - 1 WHERE product_id = ?', (pid,))
        else:
            conn.execute('DELETE FROM cart WHERE product_id = ?', (pid,))
        conn.commit()
        conn.close()
        return True
    
    conn.close()
    return False

def clear_cart():
    conn = get_db_connection()
    conn.execute('DELETE FROM cart')
    conn.commit()
    conn.close()

# --- Sales Helpers ---
def record_sale(cart_items, total_amount, discount_percent=0):
    conn = get_db_connection()
    
    timestamp = datetime.now().isoformat()
    items_json = json.dumps(list(cart_items.values()))
    
    # Apply Discount
    final_total = total_amount * (1 - (discount_percent / 100))
    
    # Insert Sale
    conn.execute('INSERT INTO sales (timestamp, total, items) VALUES (?, ?, ?)', 
                 (timestamp, final_total, items_json))
    
    # Update Stock and Last Updated
    for item in cart_items.values():
        conn.execute('UPDATE products SET stock = MAX(0, stock - ?), last_updated = ? WHERE id = ?', 
                     (item['qty'], timestamp, item['id']))
    
    # Clear Cart
    conn.execute('DELETE FROM cart')
    
    conn.commit()
    
    # Return formatted order object
    return {
        "timestamp": timestamp,
        "items": list(cart_items.values()),
        "total": final_total,
        "discount_applied": discount_percent
    }

def get_sales_history():
    conn = get_db_connection()
    sales = conn.execute('SELECT * FROM sales').fetchall()
    conn.close()
    
    history = []
    for s in sales:
        history.append({
            "id": s['id'],
            "timestamp": s['timestamp'],
            "total": s['total'],
            "items": json.loads(s['items'])
        })
    return history

# --- Worker Helpers ---
def add_product(product):
    conn = get_db_connection()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        conn.execute('INSERT INTO products (id, name, unit, price, stock, category, image, last_updated, discount, promotion_description, promotion_expiry) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                     (product['id'], product['name'], product['unit'], product['price'], product['stock'], product['category'], product['image'], timestamp, product.get('discount', 0), product.get('promotion_description', ''), product.get('promotion_expiry', '')))
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def update_product_fields(pid, updates):
    """
    updates: dict of field: value to update
    Example: {'stock': 50, 'price': 25.0}
    """
    if not updates:
        return
        
    conn = get_db_connection()
    updates['last_updated'] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    set_clause = ', '.join([f"{k} = ?" for k in updates.keys()])
    values = list(updates.values()) + [pid]
    
    conn.execute(f'UPDATE products SET {set_clause} WHERE id = ?', values)
    conn.commit()
    conn.close()

def delete_product(pid):
    conn = get_db_connection()
    try:
        # Delete from cart first (foreign key constraint usually handles this but being safe)
        conn.execute('DELETE FROM cart WHERE product_id = ?', (pid,))
        conn.execute('DELETE FROM products WHERE id = ?', (pid,))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error deleting product: {e}")
        return False
    finally:
        conn.close()

# --- UI Settings Helpers ---
def get_ui_settings():
    conn = get_db_connection()
    try:
        settings_rows = conn.execute('SELECT key, value FROM ui_settings').fetchall()
        settings = {row['key']: row['value'] for row in settings_rows}
        return settings
    except Exception as e:
        print(f"Error getting settings: {e}")
        return {}
    finally:
        conn.close()

def update_ui_settings(settings_dict):
    conn = get_db_connection()
    try:
        for k, v in settings_dict.items():
            # Check if key exists
            cursor = conn.execute('SELECT 1 FROM ui_settings WHERE key = ?', (k,))
            if cursor.fetchone():
                conn.execute('UPDATE ui_settings SET value = ? WHERE key = ?', (v, k))
            else:
                conn.execute('INSERT INTO ui_settings (key, value) VALUES (?, ?)', (k, v))
        conn.commit()
        return True
    except Exception as e:
        print(f"Error updating settings: {e}")
        return False
    finally:
        conn.close()

# --- promotions ---
import time

def add_promotion(type, title, content_data):
    conn = get_db_connection()
    try:
        content_json = json.dumps(content_data)
        created_at = datetime.now().isoformat()
        conn.execute('INSERT INTO promotions (type, title, content, active, created_at) VALUES (?, ?, ?, ?, ?)',
                     (type, title, content_json, 1, created_at))
        conn.commit()
        return True
    except Exception as e:
        print(f"db.error: {e}")
        return False
    finally:
        conn.close()

def list_promotions():
    conn = get_db_connection()
    try:
        rows = conn.execute('SELECT * FROM promotions ORDER BY id DESC').fetchall()
        promos = []
        for r in rows:
            # Handle optional columns that may not exist in older databases
            try:
                created_at = r['created_at']
            except (KeyError, IndexError):
                created_at = None
            
            try:
                last_shown = r['last_shown']
            except (KeyError, IndexError):
                last_shown = None
                
            promos.append({
                "id": r['id'],
                "type": r['type'],
                "title": r['title'],
                "content": json.loads(r['content']),
                "active": bool(r['active']),
                "created_at": created_at,
                "last_shown": last_shown
            })
        return promos
    finally:
        conn.close()

def delete_promotion(id):
    conn = get_db_connection()
    conn.execute('DELETE FROM promotions WHERE id = ?', (id,))
    conn.commit()
    conn.close()
    return True

def update_promotion_last_shown(id):
    """Update the last_shown timestamp for a promotion"""
    conn = get_db_connection()
    try:
        now = datetime.now().isoformat()
        conn.execute('UPDATE promotions SET last_shown = ? WHERE id = ?', (now, id))
        conn.commit()
    finally:
        conn.close()

def get_current_promotion():
    """
    Smart promotion system:
    Returns a composite object allowing the frontend to prioritize:
    {
        "spin_wheel": { ... } or None,
        "banner": { ... } or None
    }
    """
    promos = list_promotions()
    active_promos = [p for p in promos if p['active']]
    
    result = {
        "spin_wheel": None,
        "banner": None
    }
    
    if not active_promos:
        return result
    
    # Get Spin Wheel (Highest Priority)
    spin_wheels = [p for p in active_promos if p['type'] == 'spin_wheel']
    if spin_wheels:
        # Return the most recently created spin wheel
        spin_wheels_sorted = sorted(spin_wheels, key=lambda x: x.get('created_at') or '1970-01-01', reverse=True)
        result['spin_wheel'] = spin_wheels_sorted[0]
    
    # Get Banner (Time-based Rotation)
    banners = [p for p in active_promos if p['type'] == 'banner']
    if banners:
        # Sort by last_shown (oldest first) to ensure fair rotation
        banners_sorted = sorted(banners, key=lambda x: x.get('last_shown') or '1970-01-01')
        
        # Calculate which banner to show based on 30-minute intervals
        # Use a faster rotation for demo purposes if needed, keeping 30m for now
        idx = int(time.time() // 1800) % len(banners)
        selected = banners_sorted[idx]
        
        # Only update last_shown occasionally to avoid DB thrashing on every poll
        # or rely on frontend to trigger an 'impression' API (skipping for simplicity)
        update_promotion_last_shown(selected['id'])
        
        result['banner'] = selected
    
    return result
