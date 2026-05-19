FROM python:3.12-slim

WORKDIR /app

# Устанавливаем git (нужен для установки kurigram из GitHub)
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY proxy.py .

CMD ["python", "proxy.py"]