"""TSP retirement projection simulator for military BRS."""
from datetime import date, datetime
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..models import TSPScenario, TSPFundHistory


# 2024 TSP contribution limits
TSP_ANNUAL_LIMIT = Decimal("23000")  # Regular limit
TSP_CATCH_UP_LIMIT = Decimal("7500")  # Additional for 50+
TSP_TOTAL_LIMIT_50_PLUS = TSP_ANNUAL_LIMIT + TSP_CATCH_UP_LIMIT

# BRS (Blended Retirement System) matching
# - 1% automatic agency contribution after 60 days
# - Agency matches dollar-for-dollar up to 3%
# - Agency matches 50 cents on dollar for next 2%
# - Maximum agency contribution: 5% (1% + 3% + 1%)
def calculate_brs_match(contribution_pct: Decimal) -> Decimal:
    """Calculate BRS agency match percentage based on member contribution."""
    if contribution_pct <= Decimal("0"):
        return Decimal("1")  # 1% automatic even with no contribution
    
    match = Decimal("1")  # Start with automatic 1%
    
    # Dollar-for-dollar match up to 3%
    if contribution_pct >= Decimal("3"):
        match += Decimal("3")
    else:
        match += contribution_pct
    
    # 50% match on next 2% (contributions 3-5%)
    if contribution_pct >= Decimal("5"):
        match += Decimal("1")  # 50% of 2%
    elif contribution_pct > Decimal("3"):
        match += (contribution_pct - Decimal("3")) * Decimal("0.5")
    
    return match


def get_fund_historical_returns(db: Session, fund: str, years: int = 10) -> dict:
    """Calculate historical returns for a TSP fund."""
    # Get oldest and newest prices
    cutoff_date = date.today().replace(year=date.today().year - years)
    
    history = db.query(TSPFundHistory).filter(
        TSPFundHistory.fund == fund,
        TSPFundHistory.date >= cutoff_date
    ).order_by(TSPFundHistory.date).all()
    
    if len(history) < 2:
        return {
            "fund": fund,
            "average_annual_return": Decimal("0"),
            "total_return": Decimal("0"),
            "data_points": 0
        }
    
    first_price = history[0].price
    last_price = history[-1].price
    
    # Calculate total return
    total_return = (last_price - first_price) / first_price * 100
    
    # Calculate CAGR (Compound Annual Growth Rate)
    years_elapsed = (history[-1].date - history[0].date).days / 365.25
    if years_elapsed > 0:
        cagr = (((last_price / first_price) ** (Decimal("1") / Decimal(str(years_elapsed)))) - 1) * 100
    else:
        cagr = Decimal("0")
    
    return {
        "fund": fund,
        "average_annual_return": float(cagr.quantize(Decimal("0.01"))),
        "total_return": float(total_return.quantize(Decimal("0.01"))),
        "data_points": len(history),
        "start_date": history[0].date.isoformat(),
        "end_date": history[-1].date.isoformat()
    }


def get_weighted_return(db: Session, allocation: dict) -> Decimal:
    """Calculate weighted average return based on fund allocation."""
    total_return = Decimal("0")
    
    fund_mapping = {
        "g": "G",
        "f": "F", 
        "c": "C",
        "s": "S",
        "i": "I"
    }
    
    for key, fund in fund_mapping.items():
        alloc_pct = Decimal(str(allocation.get(key, 0)))
        if alloc_pct > 0:
            fund_data = get_fund_historical_returns(db, fund)
            fund_return = Decimal(str(fund_data["average_annual_return"]))
            total_return += (alloc_pct / 100) * fund_return
    
    # Handle L fund separately (if allocated)
    l_alloc = Decimal(str(allocation.get("l", 0)))
    if l_alloc > 0:
        l_fund_year = allocation.get("l_fund_year", 2050)
        l_fund = f"L{l_fund_year}"
        l_data = get_fund_historical_returns(db, l_fund)
        if l_data["data_points"] > 0:
            total_return += (l_alloc / 100) * Decimal(str(l_data["average_annual_return"]))
        else:
            # Estimate L fund return based on typical allocation
            # L funds shift from aggressive to conservative over time
            years_to_target = l_fund_year - date.today().year
            if years_to_target > 20:
                # Aggressive - similar to 80% C/S, 20% G/F/I
                estimated_return = Decimal("8.5")
            elif years_to_target > 10:
                estimated_return = Decimal("7.0")
            else:
                estimated_return = Decimal("5.5")
            total_return += (l_alloc / 100) * estimated_return
    
    return total_return


# Historical average returns (fallback if no data)
DEFAULT_FUND_RETURNS = {
    "G": Decimal("2.5"),   # Government Securities
    "F": Decimal("4.0"),   # Fixed Income (Bonds)
    "C": Decimal("10.5"),  # Common Stock (S&P 500)
    "S": Decimal("11.0"),  # Small Cap Stock
    "I": Decimal("7.5"),   # International
}


def project_tsp_balance(
    db: Session,
    scenario: TSPScenario,
    projection_years: int = None
) -> dict:
    """
    Project TSP balance growth to retirement.
    
    Uses:
    - Historical fund returns or custom return rate
    - BRS matching (1% auto + up to 4% match)
    - Annual contribution limits
    - Annual pay increases
    """
    # Determine projection period
    current_year = date.today().year
    if scenario.birth_year:
        current_age = current_year - scenario.birth_year
        years_to_retirement = max(0, scenario.retirement_age - current_age)
    else:
        years_to_retirement = projection_years or 30
    
    if projection_years:
        years_to_project = min(projection_years, years_to_retirement + 5)
    else:
        years_to_project = years_to_retirement + 5
    
    # Get return rate
    if scenario.use_historical_returns:
        allocation = {
            "g": float(scenario.allocation_g),
            "f": float(scenario.allocation_f),
            "c": float(scenario.allocation_c),
            "s": float(scenario.allocation_s),
            "i": float(scenario.allocation_i),
            "l": float(scenario.allocation_l),
            "l_fund_year": scenario.l_fund_year
        }
        annual_return = get_weighted_return(db, allocation)
    else:
        annual_return = scenario.custom_annual_return_pct or Decimal("7.0")
    
    # Initialize variables
    balance = scenario.current_balance or Decimal("0")
    base_pay = scenario.base_pay or Decimal("50000")  # Default if not set
    contribution_pct = scenario.contribution_pct
    pay_increase_pct = scenario.annual_pay_increase_pct
    
    projections = []
    total_contributions = Decimal("0")
    total_employer_match = Decimal("0")
    total_growth = Decimal("0")
    
    for year_offset in range(years_to_project + 1):
        year = current_year + year_offset
        age = (scenario.birth_year and (year - scenario.birth_year)) or None
        
        # Calculate annual contribution
        annual_contribution = (base_pay * contribution_pct / 100).quantize(Decimal("0.01"))
        
        # Apply contribution limit
        limit = TSP_TOTAL_LIMIT_50_PLUS if (age and age >= 50) else TSP_ANNUAL_LIMIT
        annual_contribution = min(annual_contribution, limit)
        
        # Calculate employer match
        match_pct = calculate_brs_match(contribution_pct)
        employer_match = (base_pay * match_pct / 100).quantize(Decimal("0.01"))
        
        # Project growth
        if year_offset == 0:
            # First year - partial year from current balance
            growth = (balance * annual_return / 100).quantize(Decimal("0.01"))
        else:
            # Assume contributions spread throughout year
            mid_year_balance = balance + (annual_contribution + employer_match) / 2
            growth = (mid_year_balance * annual_return / 100).quantize(Decimal("0.01"))
        
        # Update totals
        if year_offset > 0:
            total_contributions += annual_contribution
            total_employer_match += employer_match
            total_growth += growth
            balance = balance + annual_contribution + employer_match + growth
        
        projections.append({
            "year": year,
            "age": age,
            "base_pay": float(base_pay),
            "contribution": float(annual_contribution),
            "employer_match": float(employer_match),
            "growth": float(growth),
            "balance": float(balance.quantize(Decimal("0.01")))
        })
        
        # Increase pay for next year
        base_pay = (base_pay * (1 + pay_increase_pct / 100)).quantize(Decimal("0.01"))
    
    return {
        "scenario_id": scenario.id,
        "scenario_name": scenario.name,
        "projections": projections,
        "final_balance": float(balance.quantize(Decimal("0.01"))),
        "total_contributions": float(total_contributions.quantize(Decimal("0.01"))),
        "total_employer_match": float(total_employer_match.quantize(Decimal("0.01"))),
        "total_growth": float(total_growth.quantize(Decimal("0.01"))),
        "average_annual_return": float(annual_return.quantize(Decimal("0.01"))),
        "years_projected": years_to_project
    }


def compare_scenarios(db: Session, scenario_ids: List[int]) -> dict:
    """Compare multiple TSP scenarios side by side."""
    scenarios = db.query(TSPScenario).filter(TSPScenario.id.in_(scenario_ids)).all()
    
    results = []
    for scenario in scenarios:
        projection = project_tsp_balance(db, scenario)
        results.append(projection)
    
    # Find common years for comparison
    if results:
        all_years = set()
        for r in results:
            all_years.update(p["year"] for p in r["projections"])
        
        common_years = sorted(all_years)
        
        comparison_data = []
        for year in common_years:
            year_data = {"year": year}
            for r in results:
                proj = next((p for p in r["projections"] if p["year"] == year), None)
                if proj:
                    year_data[f"scenario_{r['scenario_id']}_balance"] = proj["balance"]
            comparison_data.append(year_data)
    else:
        comparison_data = []
    
    return {
        "scenarios": results,
        "comparison": comparison_data
    }


def get_all_fund_history(db: Session, years: int = 10) -> dict:
    """Get historical data for all TSP funds."""
    funds = ["G", "F", "C", "S", "I"]
    
    # Also get L funds
    l_funds = db.query(
        func.distinct(TSPFundHistory.fund)
    ).filter(
        TSPFundHistory.fund.like("L%")
    ).all()
    
    funds.extend([f[0] for f in l_funds])
    
    result = {}
    for fund in funds:
        result[fund] = get_fund_historical_returns(db, fund, years)
    
    return result
