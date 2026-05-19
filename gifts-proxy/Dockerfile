FROM python:3.12-slim

WORKDIR /app

# Устанавливаем git и gcc (нужны для сборки зависимостей)
RUN apt-get update && apt-get install -y git gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY proxy.py .

CMD ["python", "proxy.py"]