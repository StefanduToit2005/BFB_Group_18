def delayed_retrievals_per_day(retrievals_per_day, delay_rate):
    """
    Expected number of delayed file retrievals per day.

    Formula: retrievals_per_day * delay_rate

    Inputs:
    retrievals_per_day: average file retrievals per day
    delay_rate: fraction of retrievals that are delayed, 0 to 1

    Returns:
        Expected delayed retrievals per day 
    """
    return retrievals_per_day * delay_rate

def wasted_hours_per_day(retrievals_per_day, delay_rate, extra_minutes):
    """
    Expected number of wasted hours per day due to delayed file retrievals.

    Formula: delayed_retrievals_per_day * (extra_minutes / 60)

    Inputs:
    retrievals_per_day: average file retrievals per day
    delay_rate: fraction of retrievals that are delayed, 0 to 1
    extra_minutes: average extra minutes spent on each delayed retrieval

    Returns:
        Expected wasted hours per day 
    """
    delayed_retrievals = delayed_retrievals_per_day(retrievals_per_day, delay_rate)
    return delayed_retrievals * (extra_minutes / 60)

def monthly_cost(hours_per_day, hourly_rate, working_days):
    """
    Expected monthly cost of wasted hours due to delayed file retrievals.

    Formula: hours_per_day * hourly_rate * working_days

    Inputs:
    hours_per_day: expected wasted hours per day
    hourly_rate: cost per hour of work
    working_days: number of working days in a month

    Returns:
        Expected monthly cost of wasted hours 
    """
    return hours_per_day * hourly_rate * working_days