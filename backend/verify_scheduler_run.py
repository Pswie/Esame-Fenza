from pymongo import MongoClient
from datetime import datetime
import os

MONGO_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
client = MongoClient(MONGO_URL)
db = client.cinematch_db
quiz_questions = db.quiz_questions

today = datetime.utcnow().strftime("%Y-%m-%d")
print(f"Checking for questions with quiz_date: {today}")

# Check for questions generated today
questions = list(quiz_questions.find({"quiz_date": today}))

if questions:
    print(f"Found {len(questions)} questions for today.")
    for q in questions:
        print(f"- Question: {q.get('question')[:50]}...")
        print(f"  Created at: {q.get('created_at')}")
else:
    print("No questions found for today yet.")
