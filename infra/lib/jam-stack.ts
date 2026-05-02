import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3notifications from 'aws-cdk-lib/aws-s3-notifications';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as backup from 'aws-cdk-lib/aws-backup';
import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import * as path from 'path';

export class JamStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ─── COGNITO ────────────────────────────────────────────────────────────

    const userPool = new cognito.UserPool(this, 'JamUserPool', {
      userPoolName: 'jam-user-pool',
      selfSignUpEnabled: false,
      signInAliases: { username: true },
      passwordPolicy: {
        minLength: 8,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      mfa: cognito.Mfa.OPTIONAL,
      mfaSecondFactor: { otp: true, sms: false },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'JamUserPoolClient', {
      userPool,
      userPoolClientName: 'jam-client',
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      // Configurar tiempos de token más largos
      accessTokenValidity: cdk.Duration.hours(8),    // 8 horas en lugar de 1
      idTokenValidity: cdk.Duration.hours(8),        // 8 horas en lugar de 1
      refreshTokenValidity: cdk.Duration.days(30),   // 30 días (por defecto)
    });

    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'admin',
      description: 'Administradores JAM Construcciones',
    });

    new cognito.CfnUserPoolGroup(this, 'CoordinadorGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'coordinador',
      description: 'Coordinadores JAM Construcciones',
    });

    new cognito.CfnUserPoolGroup(this, 'SupervisorGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'supervisor',
      description: 'Supervisores JAM Construcciones',
    });

    new cognito.CfnUserPoolGroup(this, 'InmobiliariaGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'inmobiliaria',
      description: 'Usuarios de inmobiliarias',
    });

    // ─── DYNAMODB ───────────────────────────────────────────────────────────

    const usuariosTable = new dynamodb.Table(this, 'JamUsuariosTable', {
      tableName: 'jam-usuarios',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    usuariosTable.addGlobalSecondaryIndex({
      indexName: 'gsi-tipo',
      partitionKey: { name: 'tipo', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'creado_en', type: dynamodb.AttributeType.STRING },
    });

    usuariosTable.addGlobalSecondaryIndex({
      indexName: 'gsi-por-inmobiliaria',
      partitionKey: { name: 'inmobiliaria_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
    });

    const inventarioTable = new dynamodb.Table(this, 'JamInventarioTable', {
      tableName: 'jam-inventario',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    inventarioTable.addGlobalSecondaryIndex({
      indexName: 'gsi-tipo',
      partitionKey: { name: 'tipo', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'creado_en', type: dynamodb.AttributeType.STRING },
    });

    inventarioTable.addGlobalSecondaryIndex({
      indexName: 'gsi-estado',
      partitionKey: { name: 'estado', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'fecha_bloqueo', type: dynamodb.AttributeType.STRING },
    });

    inventarioTable.addGlobalSecondaryIndex({
      indexName: 'gsi-inmobiliaria',
      partitionKey: { name: 'bloqueado_por', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });

    // ─── LAMBDA jam-auth ────────────────────────────────────────────────────

    const authLambda = new lambda.Function(this, 'JamAuthLambda', {
      functionName: 'jam-auth',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-auth')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        USUARIOS_TABLE: usuariosTable.tableName,
      },
    });

    usuariosTable.grantReadWriteData(authLambda);
    authLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: [
        'cognito-idp:InitiateAuth',
        'cognito-idp:RespondToAuthChallenge',
        'cognito-idp:AdminGetUser',
        'cognito-idp:AdminListGroupsForUser',
        'cognito-idp:AdminCreateUser',
        'cognito-idp:AdminSetUserPassword',
        'cognito-idp:AdminAddUserToGroup',
        'cognito-idp:AdminEnableUser',
        'cognito-idp:AdminDisableUser',
        'cognito-idp:AdminDeleteUser',
        'cognito-idp:AdminRemoveUserFromGroup',
        'cognito-idp:AdminSetUserMFAPreference',
        'cognito-idp:AssociateSoftwareToken',
        'cognito-idp:VerifySoftwareToken',
        'cognito-idp:SetUserMFAPreference',
      ],
      resources: [userPool.userPoolArn],
    }));

    // ─── LAMBDA jam-proyectos ────────────────────────────────────────────────

    const proyectosLambda = new lambda.Function(this, 'JamProyectosLambda', {
      functionName: 'jam-proyectos',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-proyectos')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        INVENTARIO_TABLE: inventarioTable.tableName,
        USUARIOS_TABLE: usuariosTable.tableName,
      },
    });

    inventarioTable.grantReadWriteData(proyectosLambda);
    usuariosTable.grantReadData(proyectosLambda);

    // ─── DYNAMODB jam-clientes ───────────────────────────────────────────────

    const clientesTable = new dynamodb.Table(this, 'JamClientesTable', {
      tableName: 'jam-clientes',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    clientesTable.addGlobalSecondaryIndex({
      indexName: 'gsi-inmobiliaria-clientes',
      partitionKey: { name: 'inmobiliaria_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'fecha_captacion', type: dynamodb.AttributeType.STRING },
    });

    clientesTable.addGlobalSecondaryIndex({
      indexName: 'gsi-proyecto-clientes',
      partitionKey: { name: 'proyecto_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'fecha_captacion', type: dynamodb.AttributeType.STRING },
    });

    // GSI para validar exclusividad: buscar por cedula + sk (PROYECTO#<id>)
    clientesTable.addGlobalSecondaryIndex({
      indexName: 'gsi-cedula-proyecto',
      partitionKey: { name: 'cedula', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
    });

    // ─── DYNAMODB jam-historial-estatus ──────────────────────────────────────

    const historialEstatusTable = new dynamodb.Table(this, 'JamHistorialEstatusTable', {
      tableName: 'jam-historial-estatus',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── DYNAMODB jam-procesos ────────────────────────────────────────────────

    const procesosTable = new dynamodb.Table(this, 'JamProcesosTable', {
      tableName: 'jam-procesos',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // GSI para buscar todos los procesos de una cédula (admin sin filtro de inmobiliaria)
    procesosTable.addGlobalSecondaryIndex({
      indexName: 'gsi-cedula-procesos',
      partitionKey: { name: 'cedula', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'actualizado_en', type: dynamodb.AttributeType.STRING },
    });

    // GSI para ver todos los procesos de un proyecto
    procesosTable.addGlobalSecondaryIndex({
      indexName: 'gsi-proyecto-procesos',
      partitionKey: { name: 'proyecto_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'estado', type: dynamodb.AttributeType.STRING },
    });

    // GSI para que la inmobiliaria vea sus propios procesos
    procesosTable.addGlobalSecondaryIndex({
      indexName: 'gsi-inmobiliaria-procesos',
      partitionKey: { name: 'inmobiliaria_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'actualizado_en', type: dynamodb.AttributeType.STRING },
    });

    // ─── DYNAMODB jam-historial-bloqueos ─────────────────────────────────────

    const historialTable = new dynamodb.Table(this, 'JamHistorialBloqueosTable', {
      tableName: 'jam-historial-bloqueos',
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── SQS jam-notificaciones-queue ────────────────────────────────────────

    // Agregar PROCESOS_TABLE a jam-proyectos ahora que procesosTable está declarada
    proyectosLambda.addEnvironment('PROCESOS_TABLE', procesosTable.tableName);
    procesosTable.grantReadData(proyectosLambda);

    // Agregar CLIENTES_TABLE a jam-auth ahora que clientesTable está declarada
    authLambda.addEnvironment('CLIENTES_TABLE', clientesTable.tableName);
    clientesTable.grantReadData(authLambda);

    const notificacionesDlq = new sqs.Queue(this, 'JamNotificacionesDlq', {
      queueName: 'jam-notificaciones-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    const notificacionesQueue = new sqs.Queue(this, 'JamNotificacionesQueue', {
      queueName: 'jam-notificaciones-queue',
      retentionPeriod: cdk.Duration.days(7),
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: { queue: notificacionesDlq, maxReceiveCount: 3 },
    });

    // ─── IAM Role para EventBridge Scheduler ─────────────────────────────────

    const schedulerRole = new iam.Role(this, 'JamSchedulerRole', {
      roleName: 'jam-scheduler-role',
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });

    // ─── LAMBDA jam-bloqueos ─────────────────────────────────────────────────

    // Construir ARNs manualmente para evitar dependencia circular
    const bloqueosLambdaArn = `arn:aws:lambda:${this.region}:${this.account}:function:jam-bloqueos`;
    const captacionLambdaArn = `arn:aws:lambda:${this.region}:${this.account}:function:jam-captacion`;

    const bloqueosLambda = new lambda.Function(this, 'JamBloqueosLambda', {
      functionName: 'jam-bloqueos',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-bloqueos')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        INVENTARIO_TABLE: inventarioTable.tableName,
        HISTORIAL_TABLE: historialTable.tableName,
        SQS_URL: notificacionesQueue.queueUrl,
        SCHEDULER_ROLE_ARN: schedulerRole.roleArn,
        BLOQUEOS_LAMBDA_ARN: bloqueosLambdaArn,
        USUARIOS_TABLE: usuariosTable.tableName,
        CLIENTES_TABLE: clientesTable.tableName,
        PROCESOS_TABLE: procesosTable.tableName,
        CAPTACION_LAMBDA_ARN: captacionLambdaArn,
      },
    });

    inventarioTable.grantReadWriteData(bloqueosLambda);
    historialTable.grantReadWriteData(bloqueosLambda);
    usuariosTable.grantReadData(bloqueosLambda);
    notificacionesQueue.grantSendMessages(bloqueosLambda);
    clientesTable.grantReadWriteData(bloqueosLambda);
    procesosTable.grantReadWriteData(bloqueosLambda);

    bloqueosLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['scheduler:CreateSchedule', 'scheduler:DeleteSchedule'],
      resources: ['*'],
    }));

    bloqueosLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [schedulerRole.roleArn],
    }));

    schedulerRole.addToPolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [bloqueosLambdaArn],
    }));

    // ─── LAMBDA jam-captacion ────────────────────────────────────────────────

    const captacionLambda = new lambda.Function(this, 'JamCaptacionLambda', {
      functionName: 'jam-captacion',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-captacion')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CLIENTES_TABLE: clientesTable.tableName,
        USUARIOS_TABLE: usuariosTable.tableName,
        INVENTARIO_TABLE: inventarioTable.tableName,
        PROCESOS_TABLE: procesosTable.tableName,
        CAPTACION_LAMBDA_ARN: captacionLambdaArn,
        SCHEDULER_ROLE_ARN: schedulerRole.roleArn,
        SQS_URL: notificacionesQueue.queueUrl,
      },
    });

    clientesTable.grantReadWriteData(captacionLambda);
    usuariosTable.grantReadData(captacionLambda);
    inventarioTable.grantReadData(captacionLambda);
    procesosTable.grantReadWriteData(captacionLambda);
    notificacionesQueue.grantSendMessages(captacionLambda);

    // jam-bloqueos también necesita leer/escribir clientes para desvincular unidades
    clientesTable.grantReadWriteData(bloqueosLambda);

    captacionLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['scheduler:CreateSchedule', 'scheduler:DeleteSchedule'],
      resources: ['*'],
    }));

    captacionLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [schedulerRole.roleArn],
    }));

    schedulerRole.addToPolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [captacionLambdaArn],
    }));

    // ─── LAMBDA jam-crm ──────────────────────────────────────────────────────

    const crmLambdaArn = `arn:aws:lambda:${this.region}:${this.account}:function:jam-crm`;

    const crmLambda = new lambda.Function(this, 'JamCrmLambda', {
      functionName: 'jam-crm',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-crm')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CLIENTES_TABLE: clientesTable.tableName,
        PROCESOS_TABLE: procesosTable.tableName,
        INVENTARIO_TABLE: inventarioTable.tableName,
        SQS_URL: notificacionesQueue.queueUrl,
        SCHEDULER_ROLE_ARN: schedulerRole.roleArn,
        CRM_LAMBDA_ARN: crmLambdaArn,
      },
    });

    clientesTable.grantReadData(crmLambda);
    procesosTable.grantReadWriteData(crmLambda);
    inventarioTable.grantReadWriteData(crmLambda);
    notificacionesQueue.grantSendMessages(crmLambda);

    crmLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['scheduler:CreateSchedule', 'scheduler:DeleteSchedule'],
      resources: ['*'],
    }));

    crmLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [schedulerRole.roleArn],
    }));

    schedulerRole.addToPolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [crmLambdaArn],
    }));

    // ─── API GATEWAY ────────────────────────────────────────────────────────

    const api = new apigateway.RestApi(this, 'JamApi', {
      restApiName: 'jam-api',
      deployOptions: { stageName: 'api' },
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'Authorization'],
      },
    });

    const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this, 'JamCognitoAuthorizer', {
        cognitoUserPools: [userPool],
        authorizerName: 'jam-authorizer',
      }
    );

    const authLambdaIntegration = new apigateway.LambdaIntegration(authLambda);
    const proyectosLambdaIntegration = new apigateway.LambdaIntegration(proyectosLambda);
    const bloqueosLambdaIntegration = new apigateway.LambdaIntegration(bloqueosLambda);
    const captacionLambdaIntegration = new apigateway.LambdaIntegration(captacionLambda);
    const crmLambdaIntegration = new apigateway.LambdaIntegration(crmLambda);

    // /auth
    const authResource = api.root.addResource('auth');
    authResource.addResource('login').addMethod('POST', authLambdaIntegration);
    authResource.addResource('confirm-mfa').addMethod('POST', authLambdaIntegration);
    authResource.addResource('me').addMethod('GET', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const mfaResource = authResource.addResource('mfa');
    mfaResource.addResource('setup').addMethod('POST', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    mfaResource.addResource('verify').addMethod('POST', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /proyectos
    const proyectosResource = api.root.addResource('proyectos');
    proyectosResource.addMethod('GET', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const proyectoResource = proyectosResource.addResource('{proyecto_id}');
    proyectoResource.addMethod('GET', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const etapasPublicResource = proyectoResource.addResource('etapas');
    etapasPublicResource.addMethod('GET', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const unidadesResource = proyectoResource.addResource('unidades');
    unidadesResource.addMethod('GET', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const unidadResource = unidadesResource.addResource('{unidad_id}');
    unidadResource.addMethod('GET', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    unidadResource.addResource('estado').addMethod('PUT', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin
    const adminResource = api.root.addResource('admin');

    // /admin/sistema/usuarios
    const adminSistemaResource = adminResource.addResource('sistema');
    const adminSistemaUsuariosResource = adminSistemaResource.addResource('usuarios');
    adminSistemaUsuariosResource.addMethod('GET', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminSistemaUsuariosResource.addMethod('POST', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const adminSistemaUsuarioResource = adminSistemaUsuariosResource.addResource('{usuario_id}');
    adminSistemaUsuarioResource.addMethod('PUT', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminSistemaUsuarioResource.addResource('deshabilitar').addMethod('PUT', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminSistemaUsuarioResource.addResource('habilitar').addMethod('PUT', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminSistemaUsuarioResource.addMethod('DELETE', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/inmobiliarias
    const adminInmobiliariasResource = adminResource.addResource('inmobiliarias');
    adminInmobiliariasResource.addMethod('GET', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminInmobiliariasResource.addMethod('POST', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const adminInmoResource = adminInmobiliariasResource.addResource('{inmo_id}');
    adminInmoResource.addMethod('PUT', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminInmoResource.addMethod('DELETE', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminInmoResource.addResource('deshabilitar').addMethod('PUT', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminInmoResource.addResource('habilitar').addMethod('PUT', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const adminInmoUsuariosResource = adminInmoResource.addResource('usuarios');
    adminInmoUsuariosResource.addMethod('GET', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminInmoUsuariosResource.addMethod('POST', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const adminUsuarioResource = adminInmoUsuariosResource.addResource('{usuario_id}');
    adminUsuarioResource.addMethod('DELETE', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminUsuarioResource.addResource('deshabilitar').addMethod('PUT', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminUsuarioResource.addResource('habilitar').addMethod('PUT', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /bloqueos
    const bloqueosResource = api.root.addResource('bloqueos');
    bloqueosResource.addMethod('POST', bloqueosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    bloqueosResource.addResource('activos').addMethod('GET', bloqueosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/bloqueos
    const adminBloqueosResource = adminResource.addResource('bloqueos');
    adminBloqueosResource.addResource('historial').addMethod('GET', bloqueosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const adminBloqueoResource = adminBloqueosResource.addResource('{unidad_id}');
    adminBloqueoResource.addMethod('DELETE', bloqueosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminBloqueoResource.addResource('extender').addMethod('PUT', bloqueosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /clientes
    const clientesResource = api.root.addResource('clientes');
    clientesResource.addMethod('POST', captacionLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    clientesResource.addMethod('GET', captacionLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const clienteResource = clientesResource.addResource('{cedula}');
    clienteResource.addMethod('GET', captacionLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /mis-procesos — inmobiliaria ve sus procesos de venta
    api.root.addResource('mis-procesos').addMethod('GET', captacionLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/clientes
    const adminClientesResource = adminResource.addResource('clientes');
    adminClientesResource.addMethod('GET', captacionLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    // /admin/clientes/buscar?cedula=xxx
    adminClientesResource.addResource('buscar').addMethod('GET', captacionLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const adminClienteResource = adminClientesResource.addResource('{cedula}');
    const adminClienteProyectoResource = adminClienteResource
      .addResource('proyecto')
      .addResource('{proyecto_id}');
    adminClienteProyectoResource.addMethod('GET', captacionLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminClienteProyectoResource.addMethod('PUT', captacionLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/clientes/{cedula}/proyecto/{proyecto_id}/estatus y /historial
    adminClienteProyectoResource.addResource('estatus').addMethod('PUT', crmLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminClienteProyectoResource.addResource('historial').addMethod('GET', crmLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/clientes/{cedula}/procesos
    const adminClienteProcesosResource = adminClienteResource.addResource('procesos');
    adminClienteProcesosResource.addMethod('GET', crmLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminClienteProcesosResource.addMethod('POST', crmLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/clientes/{cedula}/proyecto/{proyecto_id}/unidad/{unidad_id}/estatus y /historial
    const adminUnidadProcesoResource = adminClienteProyectoResource
      .addResource('unidad')
      .addResource('{unidad_id}');
    adminUnidadProcesoResource.addResource('estatus').addMethod('PUT', crmLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminUnidadProcesoResource.addResource('historial').addMethod('GET', crmLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/proyectos
    const adminProyectosResource = adminResource.addResource('proyectos');
    adminProyectosResource.addMethod('POST', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const adminProyectoResource = adminProyectosResource.addResource('{proyecto_id}');
    adminProyectoResource.addMethod('PUT', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminProyectoResource.addMethod('DELETE', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/proyectos/{id}/imagen (presigned URL para subir imagen)
    adminProyectoResource.addResource('imagen').addMethod('POST', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/inventario — migraciones Excel
    const adminInventarioResource = adminResource.addResource('inventario');
    adminInventarioResource.addResource('upload-url').addMethod('GET', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const adminInventarioPreviewResource = adminInventarioResource.addResource('preview');
    adminInventarioPreviewResource.addResource('{job_id}').addMethod('GET', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const adminInventarioConfirmarResource = adminInventarioResource.addResource('confirmar');
    adminInventarioConfirmarResource.addResource('{job_id}').addMethod('POST', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const adminInventarioReportesResource = adminInventarioResource.addResource('reportes');
    adminInventarioReportesResource.addMethod('GET', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminInventarioReportesResource.addResource('{job_id}').addMethod('GET', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/proyectos/{id}/etapas
    const adminEtapasResource = adminProyectoResource.addResource('etapas');
    adminEtapasResource.addMethod('POST', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const adminEtapaResource = adminEtapasResource.addResource('{etapa_id}');
    adminEtapaResource.addMethod('PUT', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminEtapaResource.addMethod('DELETE', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/proyectos/{id}/unidades
    const adminUnidadesResource = adminProyectoResource.addResource('unidades');
    adminUnidadesResource.addMethod('POST', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const adminUnidadResource = adminUnidadesResource.addResource('{unidad_id}');
    adminUnidadResource.addMethod('PUT', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminUnidadResource.addMethod('DELETE', proyectosLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/analytics
    adminResource.addResource('analytics').addMethod('GET', crmLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/procesos
    adminResource.addResource('procesos').addMethod('GET', crmLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /publico — rutas sin auth para captura externa de clientes
    const publicoResource = api.root.addResource('publico');

    const publicoProyectosResource = publicoResource.addResource('proyectos');
    publicoProyectosResource.addMethod('GET', captacionLambdaIntegration);

    const publicoClientesResource = publicoResource.addResource('clientes');
    publicoClientesResource.addMethod('POST', captacionLambdaIntegration);

    // CORS en respuestas de error del Gateway (401, 403, 5xx)
    api.addGatewayResponse('GatewayResponseDefault4XX', {
      type: apigateway.ResponseType.DEFAULT_4XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
      },
    });
    api.addGatewayResponse('GatewayResponseDefault5XX', {
      type: apigateway.ResponseType.DEFAULT_5XX,
      responseHeaders: {
        'Access-Control-Allow-Origin': "'*'",
        'Access-Control-Allow-Headers': "'Content-Type,Authorization'",
      },
    });

    // ─── S3 + CLOUDFRONT ────────────────────────────────────────────────────

    const frontendBucket = new s3.Bucket(this, 'JamFrontendBucket', {
      bucketName: `jam-frontend-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Bucket para archivos de migración (Excel uploads)
    const archivosBucket = new s3.Bucket(this, 'JamArchivosBucket', {
      bucketName: `jam-archivos-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [{
        allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        maxAge: 3000,
      }],
      lifecycleRules: [{
        prefix: 'inventario/previews/',
        expiration: cdk.Duration.days(1),
      }],
    });

    // Bucket para assets (imágenes de proyectos, etc.)
    const assetsBucket = new s3.Bucket(this, 'JamAssetsBucket', {
      bucketName: `jam-assets-${this.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [{
        allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        maxAge: 3000,
      }],
    });

    const oac = new cloudfront.S3OriginAccessControl(this, 'JamOAC', {
      signing: cloudfront.Signing.SIGV4_NO_OVERRIDE,
    });

    const distribution = new cloudfront.Distribution(this, 'JamDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      additionalBehaviors: {
        '/assets/*': {
          origin: origins.S3BucketOrigin.withOriginAccessControl(assetsBucket, { originAccessControl: oac }),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html' },
        { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html' },
      ],
    });

    // Permisos: proyectosLambda puede generar presigned URLs y escribir en assets
    assetsBucket.grantReadWrite(proyectosLambda);
    proyectosLambda.addEnvironment('ASSETS_BUCKET', assetsBucket.bucketName);
    proyectosLambda.addEnvironment('CLOUDFRONT_URL', `https://${distribution.distributionDomainName}`);

    // Permisos: proyectosLambda puede leer/escribir en archivos (Excel migrations)
    archivosBucket.grantReadWrite(proyectosLambda);
    proyectosLambda.addEnvironment('ARCHIVOS_BUCKET', archivosBucket.bucketName);
    // Permisos adicionales para DynamoDB (clientes, procesos, historial, usuarios write)
    clientesTable.grantReadWriteData(proyectosLambda);
    procesosTable.grantReadWriteData(proyectosLambda);
    historialTable.grantReadWriteData(proyectosLambda);
    usuariosTable.grantReadWriteData(proyectosLambda);
    proyectosLambda.addEnvironment('CLIENTES_TABLE', clientesTable.tableName);
    proyectosLambda.addEnvironment('PROCESOS_TABLE', procesosTable.tableName);
    proyectosLambda.addEnvironment('HISTORIAL_TABLE', historialTable.tableName);
    // Permiso Bedrock para IA
    proyectosLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: [
        'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0',
        'arn:aws:bedrock:us-east-1:*:inference-profile/us.anthropic.claude-3-5-haiku-20241022-v1:0',
      ],
    }));

    // ─── LAMBDA LAYER openpyxl ───────────────────────────────────────────────
    // Layer con openpyxl para parsear Excel en jam-excel-parser
    // Para crear el layer: pip install openpyxl -t lambdas/layers/openpyxl/python
    const openpyxlLayer = new lambda.LayerVersion(this, 'OpenpyxlLayer', {
      layerVersionName: 'jam-openpyxl',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/layers/openpyxl')),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      description: 'openpyxl para parseo de archivos Excel',
    });

    // ─── LAMBDA jam-excel-parser ─────────────────────────────────────────────
    // Lambda separada para parsear Excel — timeout largo, disparada por evento S3

    const excelParserLambda = new lambda.Function(this, 'JamExcelParserLambda', {
      functionName: 'jam-excel-parser',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler_excel_parser.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-proyectos')),
      timeout: cdk.Duration.minutes(5),
      layers: [openpyxlLayer],
      environment: {
        INVENTARIO_TABLE: inventarioTable.tableName,
        USUARIOS_TABLE:   usuariosTable.tableName,
        CLIENTES_TABLE:   clientesTable.tableName,
        PROCESOS_TABLE:   procesosTable.tableName,
        HISTORIAL_TABLE:  historialTable.tableName,
        ARCHIVOS_BUCKET:  archivosBucket.bucketName,
      },
    });

    // Permisos DynamoDB
    inventarioTable.grantReadData(excelParserLambda);
    usuariosTable.grantReadData(excelParserLambda);

    // Permisos S3 — leer uploads, escribir previews
    archivosBucket.grantReadWrite(excelParserLambda);

    // Permiso Bedrock
    excelParserLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['bedrock:InvokeModel'],
      resources: [
        'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-5-haiku-20241022-v1:0',
        'arn:aws:bedrock:us-east-1:*:inference-profile/us.anthropic.claude-3-5-haiku-20241022-v1:0',
      ],
    }));

    // Trigger S3: cuando se sube un .xlsx al prefijo inventario/uploads/
    archivosBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3notifications.LambdaDestination(excelParserLambda),
      { prefix: 'inventario/uploads/', suffix: '.xlsx' },
    );

    // ─── AWS BACKUP ─────────────────────────────────────────────────────────

    const backupVault = new backup.BackupVault(this, 'JamBackupVault', {
      backupVaultName: 'jam-backup-vault',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const backupPlan = new backup.BackupPlan(this, 'JamBackupPlan', {
      backupPlanName: 'jam-backup-plan',
      backupVault,
      backupPlanRules: [
        new backup.BackupPlanRule({
          ruleName: 'jam-daily-backup',
          scheduleExpression: events.Schedule.cron({ hour: '4', minute: '0' }), // 12am RD (UTC-4)
          deleteAfter: cdk.Duration.days(30),
          startWindow: cdk.Duration.hours(1),
          completionWindow: cdk.Duration.hours(3),
        }),
      ],
    });

    backupPlan.addSelection('JamBackupSelection', {
      backupSelectionName: 'jam-dynamodb-tables',
      resources: [
        backup.BackupResource.fromDynamoDbTable(usuariosTable),
        backup.BackupResource.fromDynamoDbTable(inventarioTable),
        backup.BackupResource.fromDynamoDbTable(clientesTable),
        backup.BackupResource.fromDynamoDbTable(procesosTable),
        backup.BackupResource.fromDynamoDbTable(historialEstatusTable),
        backup.BackupResource.fromDynamoDbTable(historialTable),
      ],
    });

    // ─── LAMBDA jam-notificaciones ───────────────────────────────────────────

    const notificacionesLambda = new lambda.Function(this, 'JamNotificacionesLambda', {
      functionName: 'jam-notificaciones',
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-notificaciones')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        ADMIN_EMAIL: 'alvarez@methodicatechnology.com',
        FROM_EMAIL: 'alvarez@methodicatechnology.com',
        USUARIOS_TABLE: usuariosTable.tableName,
        CLIENTES_TABLE: clientesTable.tableName,
        INVENTARIO_TABLE: inventarioTable.tableName,
      },
    });

    notificacionesQueue.grantConsumeMessages(notificacionesLambda);
    notificacionesLambda.addEventSource(
      new lambdaEventSources.SqsEventSource(notificacionesQueue, { batchSize: 5 })
    );
    usuariosTable.grantReadData(notificacionesLambda);
    clientesTable.grantReadData(notificacionesLambda);
    inventarioTable.grantReadData(notificacionesLambda);

    notificacionesLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    // ─── OUTPUTS ────────────────────────────────────────────────────────────

    new cdk.CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
    new cdk.CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
    new cdk.CfnOutput(this, 'ApiUrl', { value: api.url });
    new cdk.CfnOutput(this, 'CloudFrontUrl', { value: distribution.distributionDomainName });
    new cdk.CfnOutput(this, 'FrontendBucketName', { value: frontendBucket.bucketName });
    new cdk.CfnOutput(this, 'AssetsBucketName', { value: assetsBucket.bucketName });
  }
}
