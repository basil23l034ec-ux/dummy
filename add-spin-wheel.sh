#!/bin/bash
# Re-add spin wheel promotion

curl -X POST http://localhost:5001/api/worker/login \
  -H "Content-Type: application/json" \
  -d '{"username":"worker","password":"worker123"}' \
  -c /tmp/worker_cookie.txt

curl -X POST http://localhost:5001/api/worker/promotions/add \
  -H "Content-Type: application/json" \
  -b /tmp/worker_cookie.txt \
  -d '{
    "type": "spin_wheel",
    "title": "Spin & Win Big!",
    "content": {
      "prizes": ["10% OFF", "5% OFF", "Free Item", "15% OFF", "20% OFF", "Try Again"]
    }
  }'

echo "Spin wheel re-added!"
