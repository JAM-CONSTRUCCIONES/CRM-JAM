"""Helpers de parseo para migración Excel."""
import re
from decimal import Decimal, InvalidOperation


def _norm_header(value):
    return str(value or '').strip().upper()


def col_idx(headers, keys, col_map=None):
    """Busca índice de columna por nombre. La coincidencia exacta gana sobre la IA."""
    header_lookup = {
        _norm_header(h): i
        for i, h in enumerate(headers)
        if h
    }

    for key in keys:
        idx = header_lookup.get(_norm_header(key))
        if idx is not None:
            return idx

    if col_map:
        normalized_map = {
            _norm_header(k): v
            for k, v in col_map.items()
            if k and v
        }
        for key in keys:
            # Soporta schema -> header.
            mapped_header = normalized_map.get(_norm_header(key))
            idx = header_lookup.get(_norm_header(mapped_header))
            if idx is not None:
                return idx

            # Soporta header -> schema.
            for header_excel, campo_schema in normalized_map.items():
                if _norm_header(campo_schema) == _norm_header(key):
                    idx = header_lookup.get(header_excel)
                    if idx is not None:
                        return idx
    return None


def parse_decimal(val, metraje=False):
    """Parsea a Decimal. Soporta moneda, separadores y metraje combinado."""
    if val is None:
        return None
    try:
        s = str(val)
        if metraje:
            s = s.split('+')[0].split(' ')[0]
        s = re.sub(r'[^0-9,.\-]', '', s)
        if not s or s in {'-', '.', ','}:
            return None
        if ',' in s and '.' in s:
            if s.rfind(',') > s.rfind('.'):
                s = s.replace('.', '').replace(',', '.')
            else:
                s = s.replace(',', '')
        elif ',' in s:
            parts = s.split(',')
            if len(parts[-1]) == 3 and len(parts) > 1:
                s = ''.join(parts)
            else:
                s = s.replace(',', '.')
        elif s.count('.') > 1:
            s = s.replace('.', '')
        return Decimal(s)
    except (InvalidOperation, ValueError):
        return None


def parse_int(val):
    if val is None:
        return None
    try:
        return int(Decimal(str(val).strip()))
    except (InvalidOperation, ValueError, TypeError):
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
