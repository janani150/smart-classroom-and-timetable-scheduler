from pymongo import MongoClient

client = MongoClient("mongodb://localhost:27017/")
db = client["smart_classroom_test"]

print(db.list_collection_names())
