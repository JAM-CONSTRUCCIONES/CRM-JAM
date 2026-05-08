"""Helpers de parseo para migración Excel."""
from decimal import Decimal, InvalidOperation


def col_idx(headers, keys, col_map=None):
    """Busca índice de columna por nombre. Usa col_map de IA si está disponible."""
    if col_map:
        for key in keys:
            mapped = col_map.get(key)
            if mapped and mapped in headers:
                return headers.index(mapped)
    for key in keys:
        for i, h in enumerate(headers):
            if h and h.strip().upper() == key.strip().upper():
                return i
    return None


def parse_decimal(val, metraje=False):
    """Parsea a Decimal. Para metraje extrae el primer número antes de + o espacio."""
    if val is None:
        return None
    try:
        s = str(val)
        if metraje:
            s = s.split('+')[0].split(' ')[0]
        return Decimal(s.replace(',', '.'))
    except (InvalidOperation, ValueError):
        return None


def parse_int(val):
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def parse_fecha(val):
    if val is None:
        return None
    if hasattr(val, 'isoformat'):
        return val.isoformat()
    return str(val)


def extraer_torre(id_unidad):
    """B-A-101 → 'Torre A',  A-101 → 'Torre A'"""
    parts = str(id_unidad).split('-')
    if len(parts) >= 3:
        return f'Torre {parts[1]}'
    if len(parts) == 2:
        return f'Torre {parts[0]}'
    return f'Torre {id_unidad}'
