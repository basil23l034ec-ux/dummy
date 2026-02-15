
import db
import json
from datetime import datetime

print("Checking sales timestamps...")
history = db.get_sales_history()
today = datetime.now().strftime("%Y-%m-%d")
print(f"Today is: {today}")

count = 0
for h in history:
    ts = h['timestamp']
    is_today = str(ts).startswith(today)
    print(f" - ID: {h['id']}, Date: {ts}, Is Today? {is_today}")
    if is_today: count += 1

print(f"Total sales likely to be shown for today: {count}")
