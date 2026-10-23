import pytest
from models.retrieval import (
    delayed_retrievals_per_day,
    wasted_hours_per_day,
    monthly_cost,
)

def test_delayed_retrievals_per_day():
    # Hand calculation: 22 * 0.45 = 9.9
    assert delayed_retrievals_per_day(22, 0.45) == pytest.approx(9.9)


def test_wasted_hours_per_day():
    # Hand calculation: 9.9 delayed * 10 min / 60 = 1.65
    assert wasted_hours_per_day(22, 0.45, 10) == pytest.approx(1.65)


def test_monthly_cost():
    # Hand calculation: 1.65 h * R78 * 22 days = 2831.4
    assert monthly_cost(1.65, 78, 22) == pytest.approx(2831.4)


def test_full_model_matches_proposal():
    hours = wasted_hours_per_day(22, 0.45, 10)
    cost = monthly_cost(hours, 78, 22)
    
    assert cost == pytest.approx(2900, rel=0.05)   