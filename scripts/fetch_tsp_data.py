"""
Fetch historical TSP fund performance data.

This script downloads historical share prices for TSP funds (G, F, C, S, I, L funds)
from the TSP.gov website and saves them to a JSON file for use by the TSP simulator.

Data source: https://www.tsp.gov/fund-performance/share-price-history.csv
"""
import json
import csv
import requests
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional
from collections import defaultdict


# TSP share price history URL
TSP_HISTORY_URL = "https://www.tsp.gov/fund-performance/share-price-history.csv"

# Output file path
OUTPUT_DIR = Path(__file__).parent.parent / "backend" / "data"
OUTPUT_FILE = OUTPUT_DIR / "tsp_fund_history.json"

# Core TSP funds
CORE_FUNDS = ["G", "F", "C", "S", "I"]
# L funds (Lifecycle) - we'll track these too but they change over time
L_FUNDS_PREFIX = "L"


def fetch_tsp_data() -> Optional[str]:
    """Fetch raw CSV data from TSP website."""
    print(f"Fetching data from {TSP_HISTORY_URL}...")
    
    try:
        response = requests.get(TSP_HISTORY_URL, timeout=30)
        response.raise_for_status()
        print(f"Downloaded {len(response.content):,} bytes")
        return response.text
    except requests.RequestException as e:
        print(f"Error fetching data: {e}")
        return None


def parse_tsp_csv(csv_data: str) -> Dict:
    """Parse TSP CSV data into structured format."""
    print("Parsing CSV data...")
    
    # Store daily prices and calculate annual returns
    daily_prices: Dict[str, List[Dict]] = defaultdict(list)
    
    lines = csv_data.strip().split('\n')
    reader = csv.DictReader(lines)
    
    row_count = 0
    for row in reader:
        row_count += 1
        try:
            # Parse date (format: YYYY-MM-DD or MM/DD/YYYY depending on source)
            date_str = row.get('date', row.get('Date', ''))
            if '/' in date_str:
                date = datetime.strptime(date_str, '%m/%d/%Y')
            else:
                date = datetime.strptime(date_str, '%Y-%m-%d')
            
            date_formatted = date.strftime('%Y-%m-%d')
            
            # Extract fund prices
            for fund in CORE_FUNDS:
                # Try different column name formats
                price_str = (row.get(f'{fund} Fund', '') or 
                           row.get(f'{fund}Fund', '') or 
                           row.get(fund, ''))
                
                if price_str:
                    try:
                        price = float(price_str.replace('$', '').replace(',', ''))
                        daily_prices[fund].append({
                            'date': date_formatted,
                            'price': price
                        })
                    except (ValueError, AttributeError):
                        pass
            
            # Also capture L funds if present
            for key in row.keys():
                if key.startswith('L ') or key.startswith('L2'):
                    fund_name = key.replace(' Fund', '').replace(' ', '')
                    price_str = row[key]
                    if price_str:
                        try:
                            price = float(price_str.replace('$', '').replace(',', ''))
                            daily_prices[fund_name].append({
                                'date': date_formatted,
                                'price': price
                            })
                        except (ValueError, AttributeError):
                            pass
                            
        except (ValueError, KeyError) as e:
            continue
    
    print(f"Processed {row_count} rows")
    
    # Sort by date
    for fund in daily_prices:
        daily_prices[fund].sort(key=lambda x: x['date'])
    
    return dict(daily_prices)


def calculate_annual_returns(daily_prices: Dict[str, List[Dict]]) -> Dict:
    """Calculate annual returns for each fund."""
    print("Calculating annual returns...")
    
    annual_returns: Dict[str, Dict[int, float]] = defaultdict(dict)
    
    for fund, prices in daily_prices.items():
        if not prices:
            continue
            
        # Group by year
        yearly_prices: Dict[int, List[float]] = defaultdict(list)
        for entry in prices:
            year = int(entry['date'][:4])
            yearly_prices[year].append(entry['price'])
        
        # Calculate returns (end of year vs start of year)
        years = sorted(yearly_prices.keys())
        for i, year in enumerate(years):
            if i == 0:
                continue  # Need previous year for return calculation
            
            prev_year = years[i - 1]
            
            # Get last price of previous year and last price of current year
            prev_end = yearly_prices[prev_year][-1]
            curr_end = yearly_prices[year][-1]
            
            if prev_end > 0:
                return_pct = ((curr_end - prev_end) / prev_end) * 100
                annual_returns[fund][year] = round(return_pct, 2)
    
    return dict(annual_returns)


def calculate_average_returns(annual_returns: Dict[str, Dict[int, float]], years: int = 10) -> Dict[str, float]:
    """Calculate average returns over specified period."""
    current_year = datetime.now().year
    start_year = current_year - years
    
    averages = {}
    for fund, returns in annual_returns.items():
        recent_returns = [r for y, r in returns.items() if y > start_year and y < current_year]
        if recent_returns:
            averages[fund] = round(sum(recent_returns) / len(recent_returns), 2)
    
    return averages


def create_output_data(daily_prices: Dict, annual_returns: Dict) -> Dict:
    """Create the final output data structure."""
    
    # Calculate various average periods
    avg_5yr = calculate_average_returns(annual_returns, 5)
    avg_10yr = calculate_average_returns(annual_returns, 10)
    avg_20yr = calculate_average_returns(annual_returns, 20)
    
    # Get date range
    all_dates = []
    for prices in daily_prices.values():
        for entry in prices:
            all_dates.append(entry['date'])
    
    if all_dates:
        min_date = min(all_dates)
        max_date = max(all_dates)
    else:
        min_date = max_date = None
    
    return {
        "metadata": {
            "source": "TSP.gov",
            "url": TSP_HISTORY_URL,
            "fetched_at": datetime.now().isoformat(),
            "date_range": {
                "start": min_date,
                "end": max_date
            }
        },
        "funds": {
            fund: {
                "name": get_fund_name(fund),
                "description": get_fund_description(fund),
                "average_returns": {
                    "5_year": avg_5yr.get(fund),
                    "10_year": avg_10yr.get(fund),
                    "20_year": avg_20yr.get(fund)
                },
                "annual_returns": annual_returns.get(fund, {}),
                "daily_prices": daily_prices.get(fund, [])[-365:]  # Last year only for file size
            }
            for fund in CORE_FUNDS
        }
    }


def get_fund_name(fund: str) -> str:
    """Get full fund name."""
    names = {
        "G": "Government Securities Investment Fund",
        "F": "Fixed Income Index Investment Fund",
        "C": "Common Stock Index Investment Fund",
        "S": "Small Cap Stock Index Investment Fund",
        "I": "International Stock Index Investment Fund"
    }
    return names.get(fund, fund)


def get_fund_description(fund: str) -> str:
    """Get fund description."""
    descriptions = {
        "G": "Invests in short-term U.S. Treasury securities. Lowest risk, lowest potential return.",
        "F": "Tracks the Bloomberg U.S. Aggregate Bond Index. Low-to-moderate risk.",
        "C": "Tracks the S&P 500 index. Moderate-to-high risk with potential for higher returns.",
        "S": "Tracks the Dow Jones U.S. Completion TSM Index. Higher risk, higher potential return.",
        "I": "Tracks the MSCI EAFE Index (international stocks). Higher risk, international exposure."
    }
    return descriptions.get(fund, "")


def main():
    """Main execution function."""
    print("=" * 60)
    print("TSP Fund Data Fetcher")
    print("=" * 60)
    
    # Ensure output directory exists
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Fetch data
    csv_data = fetch_tsp_data()
    if not csv_data:
        print("Failed to fetch data. Exiting.")
        return False
    
    # Parse CSV
    daily_prices = parse_tsp_csv(csv_data)
    if not daily_prices:
        print("No data parsed. Exiting.")
        return False
    
    # Calculate returns
    annual_returns = calculate_annual_returns(daily_prices)
    
    # Create output
    output_data = create_output_data(daily_prices, annual_returns)
    
    # Save to file
    print(f"\nSaving to {OUTPUT_FILE}...")
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output_data, f, indent=2)
    
    # Print summary
    print("\n" + "=" * 60)
    print("Summary")
    print("=" * 60)
    
    for fund in CORE_FUNDS:
        fund_data = output_data["funds"].get(fund, {})
        avg = fund_data.get("average_returns", {})
        print(f"\n{fund} Fund ({fund_data.get('name', 'Unknown')}):")
        print(f"  5-year avg:  {avg.get('5_year', 'N/A')}%")
        print(f"  10-year avg: {avg.get('10_year', 'N/A')}%")
        print(f"  20-year avg: {avg.get('20_year', 'N/A')}%")
    
    print(f"\nData saved to: {OUTPUT_FILE}")
    print(f"File size: {OUTPUT_FILE.stat().st_size:,} bytes")
    
    return True


if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)
