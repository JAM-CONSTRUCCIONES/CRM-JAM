import json


def ok(body):
    return _build(200, body)


def created(body):
    return _build(201, body)


def bad_request(message):
    return _build(400, {'message': message})


def forbidden(message='Sin permisos'):
    return _build(403, {'message': message})


def not_found(message='No encontrado'):
    return _build(404, {'message': message})


def conflict(message):
    return _build(409, {'message': message})


def _build(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps(body, ensure_ascii=False, default=str),
    }
