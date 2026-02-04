"""Transaction categorization service."""
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from ..models import Category

# Mapping of keywords to category names
KEYWORD_MAPPINGS = {
    # Food & Dining
    "grocery": "Groceries",
    "groceries": "Groceries",
    "walmart": "Groceries",
    "target": "Groceries",
    "costco": "Groceries",
    "kroger": "Groceries",
    "safeway": "Groceries",
    "publix": "Groceries",
    "whole foods": "Groceries",
    "trader joe": "Groceries",
    "aldi": "Groceries",
    "heb": "Groceries",
    "commissary": "Groceries",
    
    "restaurant": "Restaurants",
    "dining": "Restaurants",
    "doordash": "Restaurants",
    "uber eats": "Restaurants",
    "grubhub": "Restaurants",
    "postmates": "Restaurants",
    
    "mcdonald": "Fast Food",
    "burger king": "Fast Food",
    "wendy": "Fast Food",
    "taco bell": "Fast Food",
    "chick-fil-a": "Fast Food",
    "chipotle": "Fast Food",
    "subway": "Fast Food",
    "pizza": "Fast Food",
    
    "starbucks": "Coffee Shops",
    "dunkin": "Coffee Shops",
    "coffee": "Coffee Shops",
    
    # Transportation
    "shell": "Gas/Fuel",
    "chevron": "Gas/Fuel",
    "exxon": "Gas/Fuel",
    "bp": "Gas/Fuel",
    "gas station": "Gas/Fuel",
    "fuel": "Gas/Fuel",
    "mobil": "Gas/Fuel",
    
    "uber": "Ride Share",
    "lyft": "Ride Share",
    
    # Shopping
    "amazon": "Amazon",
    "amzn": "Amazon",
    
    "best buy": "Electronics",
    "apple store": "Electronics",
    "apple.com": "Electronics",
    
    # Entertainment
    "netflix": "Streaming",
    "hulu": "Streaming",
    "disney+": "Streaming",
    "disney plus": "Streaming",
    "hbo": "Streaming",
    "spotify": "Streaming",
    "youtube": "Streaming",
    "prime video": "Streaming",
    "paramount": "Streaming",
    "peacock": "Streaming",
    
    "xbox": "Games",
    "playstation": "Games",
    "steam": "Games",
    "nintendo": "Games",
    
    # Utilities
    "electric": "Electric",
    "power company": "Electric",
    "utility": "Electric",
    
    "gas company": "Gas",
    "natural gas": "Gas",
    
    "water": "Water",
    
    "internet": "Internet",
    "comcast": "Internet",
    "xfinity": "Internet",
    "att": "Internet",
    "verizon": "Internet",
    "spectrum": "Internet",
    "t-mobile": "Phone",
    "tmobile": "Phone",
    
    # Healthcare
    "pharmacy": "Pharmacy",
    "cvs": "Pharmacy",
    "walgreens": "Pharmacy",
    "rite aid": "Pharmacy",
    
    "doctor": "Doctor",
    "medical": "Doctor",
    "hospital": "Doctor",
    "clinic": "Doctor",
    
    "dentist": "Dentist",
    "dental": "Dentist",
    
    # Personal
    "gym": "Gym",
    "fitness": "Gym",
    "planet fitness": "Gym",
    "anytime fitness": "Gym",
    
    # Military-specific
    "dfas": "Military Pay",
    "allotment": "Military Pay",
    "aafes": "Shopping",
    "exchange": "Shopping",
    "bx": "Shopping",
    "px": "Shopping",
    "nex": "Shopping",
    
    # Financial
    "interest": "Interest",
    "dividend": "Dividends",
    "atm": "ATM Fees",
    "overdraft": "Bank Fees",
    "bank fee": "Bank Fees",
    "monthly fee": "Bank Fees",
    
    # Transfers
    "transfer": "Transfer",
    "zelle": "Transfer",
    "venmo": "Transfer",
    "paypal": "Transfer",
}

# Plaid category mappings
PLAID_CATEGORY_MAPPINGS = {
    "Food and Drink": "Food",
    "Food and Drink > Restaurants": "Restaurants",
    "Food and Drink > Groceries": "Groceries",
    "Food and Drink > Coffee Shop": "Coffee Shops",
    "Food and Drink > Fast Food": "Fast Food",
    "Travel": "Travel",
    "Travel > Airlines and Aviation Services": "Flights",
    "Travel > Lodging": "Hotels",
    "Travel > Car Rental": "Rental Car",
    "Transportation": "Transportation",
    "Transportation > Gas Stations": "Gas/Fuel",
    "Transportation > Public Transit": "Public Transit",
    "Transportation > Taxi": "Ride Share",
    "Shops": "Shopping",
    "Shops > Clothing and Accessories": "Clothing",
    "Shops > Electronics": "Electronics",
    "Shops > Supermarkets and Groceries": "Groceries",
    "Recreation": "Entertainment",
    "Service": "Other Shopping",
    "Service > Subscription": "Streaming",
    "Healthcare": "Healthcare",
    "Healthcare > Pharmacies": "Pharmacy",
    "Payment": "Transfer",
    "Transfer": "Transfer",
    "Bank Fees": "Bank Fees",
}


def categorize_transaction(db: Session, merchant_name: str, plaid_categories: list = None) -> Optional[int]:
    """
    Auto-categorize a transaction based on merchant name and Plaid categories.
    Returns the category_id or None if no match found.
    """
    category_name = None
    
    # First, try keyword matching on merchant name
    if merchant_name:
        merchant_lower = merchant_name.lower()
        for keyword, cat_name in KEYWORD_MAPPINGS.items():
            if keyword in merchant_lower:
                category_name = cat_name
                break
    
    # If no keyword match, try Plaid categories
    if not category_name and plaid_categories:
        # Build hierarchical category string
        plaid_cat_str = " > ".join(plaid_categories)
        
        # Try exact match first, then parent categories
        if plaid_cat_str in PLAID_CATEGORY_MAPPINGS:
            category_name = PLAID_CATEGORY_MAPPINGS[plaid_cat_str]
        elif len(plaid_categories) > 0:
            # Try just the top-level category
            if plaid_categories[0] in PLAID_CATEGORY_MAPPINGS:
                category_name = PLAID_CATEGORY_MAPPINGS[plaid_categories[0]]
    
    # Look up category ID
    if category_name:
        category = db.query(Category).filter(Category.name == category_name).first()
        if category:
            return category.id
    
    # Default to Uncategorized
    uncategorized = db.query(Category).filter(Category.name == "Uncategorized").first()
    return uncategorized.id if uncategorized else None


def get_category_hierarchy(db: Session) -> List[Dict]:
    """Get all categories in a hierarchical structure."""
    # Get all top-level categories
    top_level = db.query(Category).filter(Category.parent_id.is_(None)).all()
    
    def build_tree(category):
        children = db.query(Category).filter(Category.parent_id == category.id).all()
        return {
            "id": category.id,
            "name": category.name,
            "icon": category.icon,
            "color": category.color,
            "is_income": category.is_income,
            "children": [build_tree(c) for c in children]
        }
    
    return [build_tree(cat) for cat in top_level]
