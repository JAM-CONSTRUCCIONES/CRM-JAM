from datetime import datetime, timezone
from decimal import Decimal


def now():
    return datetime.now(timezone.utc).isoformat()


def decimal_to_number(obj):
    """Convierte Decimals de DynamoDB a int o float para serialización JSON."""
    if isinstance(obj, list):
        return [decimal_to_number(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: decimal_to_number(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        else:
            return float(obj)
    else:
        return obj
