"""Turn database rows into plain JSON-friendly dictionaries."""
from datetime import date, datetime
from decimal import Decimal


def clean_row(row, hide=("password_hash",)):
    """Dates become ISO text, decimals become floats, secrets are removed."""
    if row is None:
        return None
    out = {}
    for key, value in row.items():
        if key in hide:
            continue
        if isinstance(value, (datetime, date)):
            value = value.isoformat()
        elif isinstance(value, Decimal):
            value = float(value)
        out[key] = value
    return out


def clean_rows(rows):
    return [clean_row(r) for r in rows]
