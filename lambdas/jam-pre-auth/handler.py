import boto3

cognito = boto3.client('cognito-idp')

GRUPOS_INTERNOS = {'admin', 'coordinador', 'supervisor'}


def handler(event, context):
    """
    Pre-Authentication trigger de Cognito.
    Bloquea el login de usuarios internos CONFIRMADOS que no tienen MFA configurado.
    - Primer login (FORCE_CHANGE_PASSWORD): deja pasar para que Cognito maneje el challenge.
    - Usuarios de inmobiliaria: siempre dejan pasar.
    """
    user_pool_id = event['userPoolId']
    username = event['userName']

    try:
        # Obtener datos del usuario
        user_data = cognito.admin_get_user(
            UserPoolId=user_pool_id,
            Username=username,
        )

        user_status = user_data.get('UserStatus', '')

        # Si el usuario no está confirmado aún (primer login), dejar pasar
        # Cognito manejará el challenge MFA_SETUP naturalmente
        if user_status != 'CONFIRMED':
            return event

        # Obtener grupos del usuario
        response = cognito.admin_list_groups_for_user(
            UserPoolId=user_pool_id,
            Username=username,
        )
        grupos = {g['GroupName'] for g in response.get('Groups', [])}

        # Si no es usuario interno, dejar pasar
        if not grupos.intersection(GRUPOS_INTERNOS):
            return event

        # Es usuario interno confirmado — verificar si tiene MFA configurado
        mfa_options = user_data.get('UserMFASettingList', [])
        tiene_mfa = 'SOFTWARE_TOKEN_MFA' in mfa_options

        if not tiene_mfa:
            raise Exception('MFA_SETUP_REQUIRED: Los usuarios internos deben configurar MFA.')

    except Exception as e:
        raise e

    return event
