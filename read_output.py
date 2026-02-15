try:
    with open('models_output.txt', 'r', encoding='utf-16') as f:
        print(f.read())
except Exception as e:
    # Fallback to utf-8 if it wasn't utf-16
    with open('models_output.txt', 'r', encoding='utf-8') as f:
        print(f.read())
