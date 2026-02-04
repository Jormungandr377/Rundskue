"""Initialize database with tables and default data."""
import json
from pathlib import Path
from datetime import date
from .database import engine, SessionLocal, Base
from .models import Category, TSPFundHistory


DEFAULT_CATEGORIES = [
    # Income categories
    {"name": "Income", "icon": "💰", "color": "#22c55e", "is_income": True, "children": [
        {"name": "Salary", "icon": "💵", "color": "#22c55e"},
        {"name": "Military Pay", "icon": "🎖️", "color": "#22c55e"},
        {"name": "BAH", "icon": "🏠", "color": "#22c55e"},
        {"name": "BAS", "icon": "🍽️", "color": "#22c55e"},
        {"name": "Bonus", "icon": "🎁", "color": "#22c55e"},
        {"name": "Interest", "icon": "🏦", "color": "#22c55e"},
        {"name": "Dividends", "icon": "📈", "color": "#22c55e"},
        {"name": "Refunds", "icon": "↩️", "color": "#22c55e"},
        {"name": "Other Income", "icon": "💵", "color": "#22c55e"},
    ]},
    
    # Expense categories
    {"name": "Housing", "icon": "🏠", "color": "#3b82f6", "children": [
        {"name": "Rent", "icon": "🏠", "color": "#3b82f6"},
        {"name": "Mortgage", "icon": "🏡", "color": "#3b82f6"},
        {"name": "Property Tax", "icon": "📋", "color": "#3b82f6"},
        {"name": "Home Insurance", "icon": "🛡️", "color": "#3b82f6"},
        {"name": "HOA Fees", "icon": "🏘️", "color": "#3b82f6"},
        {"name": "Maintenance", "icon": "🔧", "color": "#3b82f6"},
    ]},
    
    {"name": "Utilities", "icon": "💡", "color": "#f59e0b", "children": [
        {"name": "Electric", "icon": "⚡", "color": "#f59e0b"},
        {"name": "Gas", "icon": "🔥", "color": "#f59e0b"},
        {"name": "Water", "icon": "💧", "color": "#f59e0b"},
        {"name": "Internet", "icon": "🌐", "color": "#f59e0b"},
        {"name": "Phone", "icon": "📱", "color": "#f59e0b"},
        {"name": "Trash", "icon": "🗑️", "color": "#f59e0b"},
    ]},
    
    {"name": "Food", "icon": "🍔", "color": "#ef4444", "children": [
        {"name": "Groceries", "icon": "🛒", "color": "#ef4444"},
        {"name": "Restaurants", "icon": "🍽️", "color": "#ef4444"},
        {"name": "Fast Food", "icon": "🍟", "color": "#ef4444"},
        {"name": "Coffee Shops", "icon": "☕", "color": "#ef4444"},
        {"name": "Alcohol", "icon": "🍺", "color": "#ef4444"},
    ]},
    
    {"name": "Transportation", "icon": "🚗", "color": "#8b5cf6", "children": [
        {"name": "Gas/Fuel", "icon": "⛽", "color": "#8b5cf6"},
        {"name": "Car Payment", "icon": "🚙", "color": "#8b5cf6"},
        {"name": "Car Insurance", "icon": "🛡️", "color": "#8b5cf6"},
        {"name": "Maintenance", "icon": "🔧", "color": "#8b5cf6"},
        {"name": "Parking", "icon": "🅿️", "color": "#8b5cf6"},
        {"name": "Public Transit", "icon": "🚌", "color": "#8b5cf6"},
        {"name": "Ride Share", "icon": "🚕", "color": "#8b5cf6"},
    ]},
    
    {"name": "Healthcare", "icon": "🏥", "color": "#ec4899", "children": [
        {"name": "Insurance", "icon": "🛡️", "color": "#ec4899"},
        {"name": "Doctor", "icon": "👨‍⚕️", "color": "#ec4899"},
        {"name": "Dentist", "icon": "🦷", "color": "#ec4899"},
        {"name": "Pharmacy", "icon": "💊", "color": "#ec4899"},
        {"name": "Vision", "icon": "👓", "color": "#ec4899"},
    ]},
    
    {"name": "Entertainment", "icon": "🎬", "color": "#06b6d4", "children": [
        {"name": "Streaming", "icon": "📺", "color": "#06b6d4"},
        {"name": "Movies", "icon": "🎬", "color": "#06b6d4"},
        {"name": "Games", "icon": "🎮", "color": "#06b6d4"},
        {"name": "Music", "icon": "🎵", "color": "#06b6d4"},
        {"name": "Events", "icon": "🎫", "color": "#06b6d4"},
        {"name": "Hobbies", "icon": "🎨", "color": "#06b6d4"},
    ]},
    
    {"name": "Shopping", "icon": "🛍️", "color": "#f97316", "children": [
        {"name": "Clothing", "icon": "👕", "color": "#f97316"},
        {"name": "Electronics", "icon": "📱", "color": "#f97316"},
        {"name": "Home Goods", "icon": "🏠", "color": "#f97316"},
        {"name": "Amazon", "icon": "📦", "color": "#f97316"},
        {"name": "Other Shopping", "icon": "🛒", "color": "#f97316"},
    ]},
    
    {"name": "Personal Care", "icon": "💇", "color": "#14b8a6", "children": [
        {"name": "Haircuts", "icon": "💇", "color": "#14b8a6"},
        {"name": "Gym", "icon": "🏋️", "color": "#14b8a6"},
        {"name": "Personal Items", "icon": "🧴", "color": "#14b8a6"},
    ]},
    
    {"name": "Education", "icon": "📚", "color": "#6366f1", "children": [
        {"name": "Tuition", "icon": "🎓", "color": "#6366f1"},
        {"name": "Books", "icon": "📖", "color": "#6366f1"},
        {"name": "Courses", "icon": "💻", "color": "#6366f1"},
    ]},
    
    {"name": "Travel", "icon": "✈️", "color": "#0ea5e9", "children": [
        {"name": "Flights", "icon": "✈️", "color": "#0ea5e9"},
        {"name": "Hotels", "icon": "🏨", "color": "#0ea5e9"},
        {"name": "Rental Car", "icon": "🚗", "color": "#0ea5e9"},
        {"name": "Vacation", "icon": "🏖️", "color": "#0ea5e9"},
    ]},
    
    {"name": "Financial", "icon": "💳", "color": "#64748b", "children": [
        {"name": "Bank Fees", "icon": "🏦", "color": "#64748b"},
        {"name": "Interest Paid", "icon": "📉", "color": "#64748b"},
        {"name": "Late Fees", "icon": "⚠️", "color": "#64748b"},
        {"name": "ATM Fees", "icon": "🏧", "color": "#64748b"},
    ]},
    
    {"name": "Savings & Investments", "icon": "📈", "color": "#22c55e", "children": [
        {"name": "TSP", "icon": "🎖️", "color": "#22c55e"},
        {"name": "401k", "icon": "📊", "color": "#22c55e"},
        {"name": "IRA", "icon": "📈", "color": "#22c55e"},
        {"name": "Brokerage", "icon": "💹", "color": "#22c55e"},
        {"name": "Savings Transfer", "icon": "💰", "color": "#22c55e"},
    ]},
    
    {"name": "Gifts & Donations", "icon": "🎁", "color": "#d946ef", "children": [
        {"name": "Gifts Given", "icon": "🎁", "color": "#d946ef"},
        {"name": "Charity", "icon": "❤️", "color": "#d946ef"},
        {"name": "Church/Tithe", "icon": "⛪", "color": "#d946ef"},
    ]},
    
    {"name": "Kids", "icon": "👶", "color": "#fb923c", "children": [
        {"name": "Childcare", "icon": "👶", "color": "#fb923c"},
        {"name": "Kids Activities", "icon": "⚽", "color": "#fb923c"},
        {"name": "Kids Clothing", "icon": "👕", "color": "#fb923c"},
        {"name": "School", "icon": "🏫", "color": "#fb923c"},
    ]},
    
    {"name": "Pets", "icon": "🐕", "color": "#a3e635", "children": [
        {"name": "Pet Food", "icon": "🦴", "color": "#a3e635"},
        {"name": "Vet", "icon": "🏥", "color": "#a3e635"},
        {"name": "Pet Supplies", "icon": "🐕", "color": "#a3e635"},
    ]},
    
    {"name": "Insurance", "icon": "🛡️", "color": "#78716c", "children": [
        {"name": "Life Insurance", "icon": "🛡️", "color": "#78716c"},
        {"name": "SGLI", "icon": "🎖️", "color": "#78716c"},
    ]},
    
    {"name": "Taxes", "icon": "📋", "color": "#991b1b", "children": [
        {"name": "Federal Tax", "icon": "🏛️", "color": "#991b1b"},
        {"name": "State Tax", "icon": "📋", "color": "#991b1b"},
        {"name": "Property Tax", "icon": "🏠", "color": "#991b1b"},
    ]},
    
    {"name": "Uncategorized", "icon": "❓", "color": "#9ca3af", "children": []},
    {"name": "Transfer", "icon": "↔️", "color": "#6b7280", "children": []},
]


def create_categories(db, categories, parent_id=None):
    """Recursively create categories."""
    for cat_data in categories:
        children = cat_data.pop("children", [])
        
        # Check if category already exists
        existing = db.query(Category).filter(
            Category.name == cat_data["name"],
            Category.parent_id == parent_id
        ).first()
        
        if existing:
            cat = existing
        else:
            cat = Category(
                **cat_data,
                parent_id=parent_id,
                is_system=True
            )
            db.add(cat)
            db.flush()
        
        # Create children
        if children:
            create_categories(db, children, cat.id)


def load_tsp_historical_data(db):
    """Load TSP historical fund data from JSON file."""
    data_path = Path(__file__).parent.parent / "data" / "tsp_historical.json"
    
    if not data_path.exists():
        print(f"Warning: TSP historical data not found at {data_path}")
        return
    
    with open(data_path) as f:
        data = json.load(f)
    
    count = 0
    for fund, prices in data.items():
        for date_str, price in prices.items():
            # Check if already exists
            existing = db.query(TSPFundHistory).filter(
                TSPFundHistory.fund == fund,
                TSPFundHistory.date == date.fromisoformat(date_str)
            ).first()
            
            if not existing:
                entry = TSPFundHistory(
                    fund=fund,
                    date=date.fromisoformat(date_str),
                    price=price
                )
                db.add(entry)
                count += 1
    
    db.commit()
    print(f"Loaded {count} TSP fund history entries")


def init_db():
    """Initialize database with all tables and default data."""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created successfully!")
    
    db = SessionLocal()
    try:
        # Create default categories
        print("Creating default categories...")
        create_categories(db, DEFAULT_CATEGORIES)
        db.commit()
        print("Categories created successfully!")
        
        # Load TSP historical data
        print("Loading TSP historical data...")
        load_tsp_historical_data(db)
        print("TSP data loaded successfully!")
        
    finally:
        db.close()
    
    print("\nDatabase initialization complete!")


if __name__ == "__main__":
    init_db()
