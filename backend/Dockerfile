FROM python:3.10-slim-bullseye

# Install Java 11 (Stable and compatible with Spark 3.x)
RUN apt-get update && apt-get install -y \
    openjdk-11-jdk-headless \
    procps \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set JAVA_HOME for Bullseye's OpenJDK 11
ENV JAVA_HOME=/usr/lib/jvm/java-11-openjdk-amd64
ENV PATH=$PATH:$JAVA_HOME/bin

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]