"""TSP (Thrift Savings Plan) API router - retirement projections."""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import date, datetime
from decimal import Decimal

from ..database import get_db
from ..models import Profile, TSPScenario, TSPFundHistory, User
from ..dependencies import get_current_active_user
from ..services import audit
from ..services.tsp_simulator import (
    project_tsp_balance,
    compare_scenarios as compare_tsp_scenarios,
    get_fund_historical_returns,
    get_all_fund_history,
)

router = APIRouter()


class TSPAllocation(BaseModel):
    g: float = 0
    f: float = 0
    c: float = 60
    s: float = 30
    i: float = 10
    l: float = 0
    l_fund_year: Optional[int] = None

class TSPScenarioCreate(BaseModel):
    profile_id: int
    name: str
    current_balance: float
    contribution_pct: float
    base_pay: float
    annual_pay_increase_pct: float = 2.0
    allocation: TSPAllocation
    use_historical_returns: bool = True
    custom_annual_return_pct: Optional[float] = None
    retirement_age: int = 60
    birth_year: int

class TSPScenarioResponse(BaseModel):
    id: int
    profile_id: int
    name: str
    is_active: bool
    current_balance: float
    contribution_pct: float
    base_pay: float
    annual_pay_increase_pct: float
    allocation: TSPAllocation
    use_historical_returns: bool
    custom_annual_return_pct: Optional[float]
    retirement_age: int
    birth_year: int
    
    class Config:
        from_attributes = True

class ProjectionYear(BaseModel):
    year: int
    age: int
    starting_balance: float
    contribution: float
    employer_match: float
    growth: float
    ending_balance: float

class ProjectionResponse(BaseModel):
    scenario_name: str
    years_to_retirement: int
    final_balance: float
    total_contributions: float
    total_employer_match: float
    total_growth: float
    average_return_rate: float
    projections: List[ProjectionYear]

class FundPerformance(BaseModel):
    fund: str
    one_year: Optional[float]
    three_year: Optional[float]
    five_year: Optional[float]
    ten_year: Optional[float]
    all_time: Optional[float]


@router.get("/scenarios", response_model=List[TSPScenarioResponse])
def get_scenarios(
    profile_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all TSP scenarios for a profile."""
    profile_ids = [p.id for p in current_user.profiles]
    if profile_id not in profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    scenarios = db.query(TSPScenario).filter(
        TSPScenario.profile_id == profile_id
    ).all()
    
    result = []
    for s in scenarios:
        result.append(TSPScenarioResponse(
            id=s.id,
            profile_id=s.profile_id,
            name=s.name,
            is_active=s.is_active,
            current_balance=float(s.current_balance),
            contribution_pct=float(s.contribution_pct),
            base_pay=float(s.base_pay) if s.base_pay else 0,
            annual_pay_increase_pct=float(s.annual_pay_increase_pct),
            allocation=TSPAllocation(
                g=float(s.allocation_g),
                f=float(s.allocation_f),
                c=float(s.allocation_c),
                s=float(s.allocation_s),
                i=float(s.allocation_i),
                l=float(s.allocation_l),
                l_fund_year=s.l_fund_year
            ),
            use_historical_returns=s.use_historical_returns,
            custom_annual_return_pct=float(s.custom_annual_return_pct) if s.custom_annual_return_pct else None,
            retirement_age=s.retirement_age,
            birth_year=s.birth_year
        ))
    
    return result


@router.post("/scenarios", response_model=TSPScenarioResponse)
def create_scenario(
    scenario: TSPScenarioCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Create a new TSP projection scenario."""
    profile_ids = [p.id for p in current_user.profiles]
    if scenario.profile_id not in profile_ids:
        raise HTTPException(status_code=403, detail="Access denied to this profile")

    # Validate allocation sums to 100
    alloc = scenario.allocation
    total_alloc = alloc.g + alloc.f + alloc.c + alloc.s + alloc.i + alloc.l
    if abs(total_alloc - 100) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Fund allocation must sum to 100%, got {total_alloc}%"
        )
    
    db_scenario = TSPScenario(
        profile_id=scenario.profile_id,
        name=scenario.name,
        current_balance=scenario.current_balance,
        contribution_pct=scenario.contribution_pct,
        base_pay=scenario.base_pay,
        annual_pay_increase_pct=scenario.annual_pay_increase_pct,
        allocation_g=alloc.g,
        allocation_f=alloc.f,
        allocation_c=alloc.c,
        allocation_s=alloc.s,
        allocation_i=alloc.i,
        allocation_l=alloc.l,
        l_fund_year=alloc.l_fund_year,
        use_historical_returns=scenario.use_historical_returns,
        custom_annual_return_pct=scenario.custom_annual_return_pct,
        retirement_age=scenario.retirement_age,
        birth_year=scenario.birth_year,
        is_active=True
    )
    
    db.add(db_scenario)
    db.commit()
    db.refresh(db_scenario)
    
    return get_scenarios(scenario.profile_id, current_user, db)[-1]


@router.delete("/scenarios/{scenario_id}")
def delete_scenario(
    scenario_id: int,
    request: Request,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Delete a TSP scenario."""
    profile_ids = [p.id for p in current_user.profiles]

    scenario = db.query(TSPScenario).filter(
        TSPScenario.id == scenario_id,
        TSPScenario.profile_id.in_(profile_ids)
    ).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    db.delete(scenario)
    db.commit()
    audit.log_from_request(db, request, audit.RESOURCE_DELETED, user_id=current_user.id, resource_type="tsp_scenario", resource_id=str(scenario_id))

    return {"status": "deleted"}


def _transform_projection(raw: dict) -> ProjectionResponse:
    """Transform raw projection data from service into response model."""
    projections = []
    for p in raw["projections"]:
        ending_balance = p["balance"]
        starting_balance = ending_balance - p["contribution"] - p["employer_match"] - p["growth"]
        projections.append(ProjectionYear(
            year=p["year"],
            age=p["age"] or 0,
            starting_balance=starting_balance,
            contribution=p["contribution"],
            employer_match=p["employer_match"],
            growth=p["growth"],
            ending_balance=ending_balance,
        ))
    return ProjectionResponse(
        scenario_name=raw["scenario_name"],
        years_to_retirement=raw.get("years_projected", 0),
        final_balance=raw["final_balance"],
        total_contributions=raw["total_contributions"],
        total_employer_match=raw["total_employer_match"],
        total_growth=raw["total_growth"],
        average_return_rate=raw["average_annual_return"],
        projections=projections,
    )


@router.get("/scenarios/{scenario_id}/project", response_model=ProjectionResponse)
def project_scenario(
    scenario_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Run projection for a specific scenario."""
    profile_ids = [p.id for p in current_user.profiles]

    scenario = db.query(TSPScenario).filter(
        TSPScenario.id == scenario_id,
        TSPScenario.profile_id.in_(profile_ids)
    ).first()
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    raw = project_tsp_balance(db, scenario)
    return _transform_projection(raw)


@router.post("/project", response_model=ProjectionResponse)
def project_custom(
    params: TSPScenarioCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Run a one-off projection without saving the scenario."""
    # Validate allocation
    alloc = params.allocation
    total_alloc = alloc.g + alloc.f + alloc.c + alloc.s + alloc.i + alloc.l
    if abs(total_alloc - 100) > 0.01:
        raise HTTPException(
            status_code=400,
            detail=f"Fund allocation must sum to 100%, got {total_alloc}%"
        )
    
    # Create a temporary scenario object
    temp_scenario = TSPScenario(
        name=params.name,
        current_balance=params.current_balance,
        contribution_pct=params.contribution_pct,
        base_pay=params.base_pay,
        annual_pay_increase_pct=params.annual_pay_increase_pct,
        allocation_g=alloc.g,
        allocation_f=alloc.f,
        allocation_c=alloc.c,
        allocation_s=alloc.s,
        allocation_i=alloc.i,
        allocation_l=alloc.l,
        l_fund_year=alloc.l_fund_year,
        use_historical_returns=params.use_historical_returns,
        custom_annual_return_pct=params.custom_annual_return_pct,
        retirement_age=params.retirement_age,
        birth_year=params.birth_year
    )

    raw = project_tsp_balance(db, temp_scenario)
    return _transform_projection(raw)


@router.get("/compare")
def compare_scenarios_endpoint(
    scenario_ids: str,  # Comma-separated IDs
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Compare multiple scenarios side by side."""
    profile_ids = [p.id for p in current_user.profiles]
    ids = [int(id.strip()) for id in scenario_ids.split(",")]

    # Verify all scenarios belong to user
    user_scenarios = db.query(TSPScenario.id).filter(
        TSPScenario.id.in_(ids),
        TSPScenario.profile_id.in_(profile_ids)
    ).all()
    user_scenario_ids = [s.id for s in user_scenarios]

    if len(user_scenario_ids) != len(ids):
        raise HTTPException(status_code=404, detail="One or more scenarios not found")

    return compare_tsp_scenarios(db, ids)


@router.get("/fund-performance", response_model=List[FundPerformance])
def get_fund_performance(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get historical performance stats for each TSP fund."""
    funds = ["G", "F", "C", "S", "I"]
    result = []
    for fund in funds:
        one_yr = get_fund_historical_returns(db, fund, years=1)
        three_yr = get_fund_historical_returns(db, fund, years=3)
        five_yr = get_fund_historical_returns(db, fund, years=5)
        ten_yr = get_fund_historical_returns(db, fund, years=10)
        all_time = get_fund_historical_returns(db, fund, years=50)

        result.append(FundPerformance(
            fund=fund,
            one_year=one_yr["average_annual_return"] if one_yr["data_points"] > 0 else None,
            three_year=three_yr["average_annual_return"] if three_yr["data_points"] > 0 else None,
            five_year=five_yr["average_annual_return"] if five_yr["data_points"] > 0 else None,
            ten_year=ten_yr["average_annual_return"] if ten_yr["data_points"] > 0 else None,
            all_time=all_time["average_annual_return"] if all_time["data_points"] > 0 else None,
        ))
    return result


@router.get("/fund-history")
def get_fund_history(
    fund: str,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get historical price data for a specific fund."""
    query = db.query(TSPFundHistory).filter(TSPFundHistory.fund == fund.upper())
    
    if start_date:
        query = query.filter(TSPFundHistory.date >= start_date)
    if end_date:
        query = query.filter(TSPFundHistory.date <= end_date)
    
    history = query.order_by(TSPFundHistory.date).all()
    
    return {
        "fund": fund.upper(),
        "data": [{"date": h.date.isoformat(), "price": float(h.price)} for h in history]
    }


@router.get("/contribution-limits")
def get_contribution_limits(
    current_user: User = Depends(get_current_active_user),
):
    """Get current TSP contribution limits."""
    # 2024 limits (update annually)
    current_year = date.today().year
    
    return {
        "year": current_year,
        "elective_deferral_limit": 23000,  # Regular contribution limit
        "catch_up_limit": 7500,  # Additional for age 50+
        "annual_addition_limit": 69000,  # Total including employer
        "notes": [
            "Catch-up contributions available if you turn 50 during the year",
            "BRS (Blended Retirement System) provides up to 5% matching",
            "Matching: 1% automatic + up to 4% matching your contributions"
        ]
    }


@router.get("/brs-match")
def calculate_brs_match(
    base_pay: float,
    contribution_pct: float,
    current_user: User = Depends(get_current_active_user),
):
    """Calculate BRS (Blended Retirement System) matching contribution."""
    # BRS matching structure:
    # 1% automatic agency contribution
    # First 3% contributed: 100% match (dollar for dollar)
    # Next 2% contributed: 50% match
    # Above 5%: no additional match
    
    annual_base_pay = base_pay * 12 if base_pay < 20000 else base_pay
    
    automatic = annual_base_pay * 0.01  # 1% automatic
    
    if contribution_pct >= 5:
        match = annual_base_pay * 0.04  # Full 4% match
    elif contribution_pct >= 3:
        # 3% full match + partial on remainder
        match = (annual_base_pay * 0.03) + (annual_base_pay * (contribution_pct - 3) / 100 * 0.5)
    else:
        match = annual_base_pay * contribution_pct / 100
    
    total_employer = automatic + match
    employee_contribution = annual_base_pay * contribution_pct / 100
    
    return {
        "annual_base_pay": annual_base_pay,
        "contribution_pct": contribution_pct,
        "employee_contribution": round(employee_contribution, 2),
        "automatic_1_pct": round(automatic, 2),
        "matching_contribution": round(match, 2),
        "total_employer_contribution": round(total_employer, 2),
        "total_annual_contribution": round(employee_contribution + total_employer, 2),
        "effective_rate": round((employee_contribution + total_employer) / annual_base_pay * 100, 2)
    }
