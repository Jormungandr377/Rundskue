"""Seed the database with default transaction categories."""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models import Category

DEFAULT_CATEGORIES = [
    # Income
    {"name": "Salary", "type": "income", "icon": "💰"},
    {"name": "Military Pay", "type": "income", "icon": "🎖️"},
    {"name": "BAH", "type": "income", "icon": "🏠"},
    {"name": "BAS", "type": "income", "icon": "🍽️"},
    {"name": "Bonus", "type": "income", "icon": "🎁"},
    {"name": "Interest", "type": "income", "icon": "📈"},
    {"name": "Dividends", "type": "income", "icon": "💹"},
    {"name": "Refund", "type": "income", "icon": "↩️"},
    {"name": "Other Income", "type": "income", "icon": "💵"},
    
    # Housing
    {"name": "Rent", "type": "expense", "icon": "🏠"},
    {"name": "Mortgage", "type": "expense", "icon": "🏡"},
    {"name": "Utilities", "type": "expense", "icon": "💡"},
    {"name": "Home Insurance", "type": "expense", "icon": "🛡️"},
    {"name": "Home Maintenance", "type": "expense", "icon": "🔧"},
    
    # Transportation
    {"name": "Gas", "type": "expense", "icon": "⛽"},
    {"name": "Car Payment", "type": "expense", "icon": "🚗"},
    {"name": "Car Insurance", "type": "expense", "icon": "🚙"},
    {"name": "Car Maintenance", "type": "expense", "icon": "🔩"},
    {"name": "Parking", "type": "expense", "icon": "🅿️"},
    {"name": "Public Transit", "type": "expense", "icon": "🚌"},
    
    # Food & Dining
    {"name": "Groceries", "type": "expense", "icon": "🛒"},
    {"name": "Restaurants", "type": "expense", "icon": "🍽️"},
    {"name": "Fast Food", "type": "expense", "icon": "🍔"},
    {"name": "Coffee Shops", "type": "expense", "icon": "☕"},
    {"name": "Alcohol & Bars", "type": "expense", "icon": "🍺"},
    
    # Shopping
    {"name": "Clothing", "type": "expense", "icon": "👕"},
    {"name": "Electronics", "type": "expense", "icon": "📱"},
    {"name": "Home Goods", "type": "expense", "icon": "🛋️"},
    {"name": "Amazon", "type": "expense", "icon": "📦"},
    {"name": "General Shopping", "type": "expense", "icon": "🛍️"},
    
    # Entertainment
    {"name": "Streaming Services", "type": "expense", "icon": "📺"},
    {"name": "Movies & Shows", "type": "expense", "icon": "🎬"},
    {"name": "Games", "type": "expense", "icon": "🎮"},
    {"name": "Hobbies", "type": "expense", "icon": "🎨"},
    {"name": "Sports & Fitness", "type": "expense", "icon": "💪"},
    {"name": "Events & Concerts", "type": "expense", "icon": "🎵"},
    
    # Health
    {"name": "Medical", "type": "expense", "icon": "🏥"},
    {"name": "Pharmacy", "type": "expense", "icon": "💊"},
    {"name": "Gym", "type": "expense", "icon": "🏋️"},
    {"name": "Personal Care", "type": "expense", "icon": "💇"},
    
    # Financial
    {"name": "Insurance", "type": "expense", "icon": "📋"},
    {"name": "Bank Fees", "type": "expense", "icon": "🏦"},
    {"name": "Taxes", "type": "expense", "icon": "📑"},
    {"name": "Investment", "type": "expense", "icon": "📊"},
    {"name": "TSP Contribution", "type": "expense", "icon": "🎖️"},
    
    # Education
    {"name": "Tuition", "type": "expense", "icon": "🎓"},
    {"name": "Books & Supplies", "type": "expense", "icon": "📚"},
    {"name": "Courses", "type": "expense", "icon": "💻"},
    
    # Family & Pets
    {"name": "Childcare", "type": "expense", "icon": "👶"},
    {"name": "Pet Care", "type": "expense", "icon": "🐕"},
    {"name": "Gifts", "type": "expense", "icon": "🎁"},
    
    # Travel
    {"name": "Flights", "type": "expense", "icon": "✈️"},
    {"name": "Hotels", "type": "expense", "icon": "🏨"},
    {"name": "Vacation", "type": "expense", "icon": "🏖️"},
    
    # Subscriptions
    {"name": "Phone", "type": "expense", "icon": "📱"},
    {"name": "Internet", "type": "expense", "icon": "📶"},
    {"name": "Software", "type": "expense", "icon": "💻"},
    {"name": "Memberships", "type": "expense", "icon": "🪪"},
    
    # Other
    {"name": "Charity", "type": "expense", "icon": "❤️"},
    {"name": "Miscellaneous", "type": "expense", "icon": "📌"},
    {"name": "Uncategorized", "type": "expense", "icon": "❓"},
    
    # Transfers (neither income nor expense)
    {"name": "Transfer", "type": "transfer", "icon": "↔️"},
    {"name": "Credit Card Payment", "type": "transfer", "icon": "💳"},
]


def seed_categories():
    """Seed categories into the database."""
    db = SessionLocal()
    try:
        # Check if categories already exist
        existing = db.query(Category).count()
        if existing > 0:
            print(f"Categories already seeded ({existing} exist). Skipping.")
            return
        
        for cat_data in DEFAULT_CATEGORIES:
            category = Category(**cat_data)
            db.add(category)
        
        db.commit()
        print(f"Successfully seeded {len(DEFAULT_CATEGORIES)} categories.")
        
    except Exception as e:
        db.rollback()
        print(f"Error seeding categories: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_categories()
