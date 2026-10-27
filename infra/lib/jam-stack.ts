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
import * as sfn from 'aws-cdk-lib/aws-stepfunctions';
import * as tasks from 'aws-cdk-lib/aws-stepfunctions-tasks';
import { Construct } from 'constructs';
import * as path from 'path';

export interface JamStackProps extends cdk.StackProps {
  stage?: 'dev' | 'prod';
}

export class JamStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: JamStackProps) {
    super(scope, id, props);

    const stage = props?.stage ?? 'dev';
    const isProd = stage === 'prod';
    const resourceName = (baseName: string) => isProd ? `${baseName}-prod` : baseName;
    const bucketName = (baseName: string) => isProd
      ? `${baseName}-prod-${this.account}`
      : `${baseName}-${this.account}`;
    const notificationEmail = isProd
      ? 'Venta@jamconstruccionesrl.com'
      : 'alvarez@methodicatechnology.com';

    // ─── COGNITO ────────────────────────────────────────────────────────────

    const userPool = new cognito.UserPool(this, 'JamUserPool', {
      userPoolName: resourceName('jam-user-pool'),
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
      userPoolClientName: resourceName('jam-client'),
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
      tableName: resourceName('jam-usuarios'),
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

    const auditoriaTable = new dynamodb.Table(this, 'JamAuditoriaTable', {
      tableName: resourceName('jam-auditoria'),
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    auditoriaTable.addGlobalSecondaryIndex({
      indexName: 'gsi-usuario',
      partitionKey: { name: 'GSI1PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI1SK', type: dynamodb.AttributeType.STRING },
    });
    auditoriaTable.addGlobalSecondaryIndex({
      indexName: 'gsi-entidad',
      partitionKey: { name: 'GSI2PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI2SK', type: dynamodb.AttributeType.STRING },
    });
    auditoriaTable.addGlobalSecondaryIndex({
      indexName: 'gsi-accion',
      partitionKey: { name: 'GSI3PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'GSI3SK', type: dynamodb.AttributeType.STRING },
    });

    const inventarioTable = new dynamodb.Table(this, 'JamInventarioTable', {
      tableName: resourceName('jam-inventario'),
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

    inventarioTable.addGlobalSecondaryIndex({
      indexName: 'gsi-proyecto-id-unidad',
      partitionKey: { name: 'proyecto_id_unidad', type: dynamodb.AttributeType.STRING },
    });

    // ─── LAMBDA jam-auth ────────────────────────────────────────────────────

    const authLambda = new lambda.Function(this, 'JamAuthLambda', {
      functionName: resourceName('jam-auth'),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-auth')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        USER_POOL_ID: userPool.userPoolId,
        USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
        USUARIOS_TABLE: usuariosTable.tableName,
        AUDIT_TABLE: auditoriaTable.tableName,
      },
    });

    usuariosTable.grantReadWriteData(authLambda);
    auditoriaTable.grantWriteData(authLambda);
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
      functionName: resourceName('jam-proyectos'),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-proyectos')),
      // 60s: cada paso del SF de eliminación puede tomar hasta ~50s (schedules en proyectos grandes)
      timeout: cdk.Duration.seconds(60),
      environment: {
        INVENTARIO_TABLE: inventarioTable.tableName,
        USUARIOS_TABLE: usuariosTable.tableName,
        AUDIT_TABLE: auditoriaTable.tableName,
      },
    });

    inventarioTable.grantReadWriteData(proyectosLambda);
    // Necesita escritura para desvincular el proyecto de las inmobiliarias al eliminar
    usuariosTable.grantReadWriteData(proyectosLambda);
    auditoriaTable.grantWriteData(proyectosLambda);

    // ─── DYNAMODB jam-clientes ───────────────────────────────────────────────

    const clientesTable = new dynamodb.Table(this, 'JamClientesTable', {
      tableName: resourceName('jam-clientes'),
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
      tableName: resourceName('jam-historial-estatus'),
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // ─── DYNAMODB jam-procesos ────────────────────────────────────────────────

    const procesosTable = new dynamodb.Table(this, 'JamProcesosTable', {
      tableName: resourceName('jam-procesos'),
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
      tableName: resourceName('jam-historial-bloqueos'),
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const campaniasTable = new dynamodb.Table(this, 'JamCampaniasTable', {
      tableName: resourceName('jam-campanias'),
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const metaConversacionesTable = new dynamodb.Table(this, 'JamMetaConversacionesTable', {
      tableName: resourceName('jam-meta-conversaciones'),
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    metaConversacionesTable.addGlobalSecondaryIndex({
      indexName: 'gsi-external-event',
      partitionKey: { name: 'external_event_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'created_at', type: dynamodb.AttributeType.STRING },
    });

    metaConversacionesTable.addGlobalSecondaryIndex({
      indexName: 'gsi-channel-account',
      partitionKey: { name: 'channel_account', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'event_timestamp', type: dynamodb.AttributeType.STRING },
    });

    metaConversacionesTable.addGlobalSecondaryIndex({
      indexName: 'gsi-contact',
      partitionKey: { name: 'contact_key', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'event_timestamp', type: dynamodb.AttributeType.STRING },
    });

    metaConversacionesTable.addGlobalSecondaryIndex({
      indexName: 'gsi-meta-leads-feed',
      partitionKey: { name: 'feed_pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'feed_sk', type: dynamodb.AttributeType.STRING },
    });

    const tareasTable = new dynamodb.Table(this, 'JamTareasTable', {
      tableName: resourceName('jam-tareas'),
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    tareasTable.addGlobalSecondaryIndex({
      indexName: 'gsi-fecha',
      partitionKey: { name: 'fecha', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'fecha_hora_inicio', type: dynamodb.AttributeType.STRING },
    });

    tareasTable.addGlobalSecondaryIndex({
      indexName: 'gsi-trabajador',
      partitionKey: { name: 'trabajador_id', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'fecha_hora_inicio', type: dynamodb.AttributeType.STRING },
    });

    tareasTable.addGlobalSecondaryIndex({
      indexName: 'gsi-estado',
      partitionKey: { name: 'estado', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'fecha_hora_inicio', type: dynamodb.AttributeType.STRING },
    });

    // ─── SQS jam-notificaciones-queue ────────────────────────────────────────

    // Agregar PROCESOS_TABLE a jam-proyectos ahora que procesosTable está declarada
    proyectosLambda.addEnvironment('PROCESOS_TABLE', procesosTable.tableName);
    procesosTable.grantReadData(proyectosLambda);

    // Agregar CLIENTES_TABLE a jam-auth ahora que clientesTable está declarada
    authLambda.addEnvironment('CLIENTES_TABLE', clientesTable.tableName);
    clientesTable.grantReadData(authLambda);

    const notificacionesDlq = new sqs.Queue(this, 'JamNotificacionesDlq', {
      queueName: resourceName('jam-notificaciones-dlq'),
      retentionPeriod: cdk.Duration.days(14),
    });

    const notificacionesQueue = new sqs.Queue(this, 'JamNotificacionesQueue', {
      queueName: resourceName('jam-notificaciones-queue'),
      retentionPeriod: cdk.Duration.days(7),
      visibilityTimeout: cdk.Duration.seconds(60),
      deadLetterQueue: { queue: notificacionesDlq, maxReceiveCount: 3 },
    });

    // ─── IAM Role para EventBridge Scheduler ─────────────────────────────────

    const schedulerRole = new iam.Role(this, 'JamSchedulerRole', {
      roleName: resourceName('jam-scheduler-role'),
      assumedBy: new iam.ServicePrincipal('scheduler.amazonaws.com'),
    });

    // ─── LAMBDA jam-bloqueos ─────────────────────────────────────────────────

    // Construir ARNs manualmente para evitar dependencia circular
    const bloqueosLambdaArn = `arn:aws:lambda:${this.region}:${this.account}:function:${resourceName('jam-bloqueos')}`;
    const captacionLambdaArn = `arn:aws:lambda:${this.region}:${this.account}:function:${resourceName('jam-captacion')}`;
    const tareasLambdaArn = `arn:aws:lambda:${this.region}:${this.account}:function:${resourceName('jam-tareas')}`;

    const bloqueosLambda = new lambda.Function(this, 'JamBloqueosLambda', {
      functionName: resourceName('jam-bloqueos'),
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
        AUDIT_TABLE: auditoriaTable.tableName,
      },
    });

    inventarioTable.grantReadWriteData(bloqueosLambda);
    historialTable.grantReadWriteData(bloqueosLambda);
    usuariosTable.grantReadData(bloqueosLambda);
    notificacionesQueue.grantSendMessages(bloqueosLambda);
    clientesTable.grantReadWriteData(bloqueosLambda);
    procesosTable.grantReadWriteData(bloqueosLambda);
    auditoriaTable.grantWriteData(bloqueosLambda);

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
      functionName: resourceName('jam-captacion'),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-captacion')),
      timeout: cdk.Duration.seconds(60),
      environment: {
        CLIENTES_TABLE: clientesTable.tableName,
        USUARIOS_TABLE: usuariosTable.tableName,
        INVENTARIO_TABLE: inventarioTable.tableName,
        PROCESOS_TABLE: procesosTable.tableName,
        CAPTACION_LAMBDA_ARN: captacionLambdaArn,
        SCHEDULER_ROLE_ARN: schedulerRole.roleArn,
        SQS_URL: notificacionesQueue.queueUrl,
        AUDIT_TABLE: auditoriaTable.tableName,
      },
    });

    clientesTable.grantReadWriteData(captacionLambda);
    usuariosTable.grantReadData(captacionLambda);
    inventarioTable.grantReadWriteData(captacionLambda);  // Necesita escribir para desvincular unidades
    procesosTable.grantReadWriteData(captacionLambda);
    auditoriaTable.grantWriteData(captacionLambda);
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

    // Agregar variables de entorno y permisos para schedules en jam-proyectos
    proyectosLambda.addEnvironment('HISTORIAL_TABLE', historialTable.tableName);
    proyectosLambda.addEnvironment('SCHEDULER_ROLE_ARN', schedulerRole.roleArn);
    proyectosLambda.addEnvironment('BLOQUEOS_LAMBDA_ARN', bloqueosLambdaArn);
    proyectosLambda.addEnvironment('CAPTACION_LAMBDA_ARN', captacionLambdaArn);
    historialTable.grantReadWriteData(proyectosLambda);

    // Permisos para crear y eliminar schedules en jam-proyectos
    proyectosLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['scheduler:CreateSchedule', 'scheduler:DeleteSchedule'],
      resources: ['*'],
    }));

    proyectosLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [schedulerRole.roleArn],
    }));

    // ─── STEP FUNCTION: Eliminar Proyecto ────────────────────────────────────
    // Soluciona el timeout de 30s al dividir la eliminación en 5 pasos independientes.
    // Cada paso tiene sus propios logs en /aws/lambda/jam-proyectos (buscar [sf_X]).
    //
    // IMPORTANTE: El ARN se construye manualmente ANTES de crear la SF para romper la
    // dependencia circular (Lambda → SF ARN → SF → Lambda permission → Lambda → ∞).
    const eliminarProyectoSFArn = `arn:aws:states:${this.region}:${this.account}:stateMachine:${resourceName('jam-eliminar-proyecto')}`;
    proyectosLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['states:StartExecution'],
      resources: [eliminarProyectoSFArn],
    }));
    proyectosLambda.addEnvironment('ELIMINAR_PROYECTO_SF_ARN', eliminarProyectoSFArn);

    const sfEliminarPreparar = new tasks.LambdaInvoke(this, 'EliminarPreparar', {
      lambdaFunction: proyectosLambda,
      comment: 'Valida el proyecto y cuenta unidades/procesos/clientes',
      payload: sfn.TaskInput.fromObject({
        action: 'sf_eliminar_preparar',
        'proyecto_id.$': '$.proyecto_id',
      }),
      outputPath: '$.Payload',
    });

    const sfEliminarSchedules = new tasks.LambdaInvoke(this, 'EliminarSchedules', {
      lambdaFunction: proyectosLambda,
      comment: 'Cancela todos los schedules de EventBridge del proyecto',
      payload: sfn.TaskInput.fromObject({
        action: 'sf_eliminar_schedules',
        'proyecto_id.$': '$.proyecto_id',
        'total_unidades.$': '$.total_unidades',
        'total_procesos.$': '$.total_procesos',
        'total_clientes.$': '$.total_clientes',
      }),
      outputPath: '$.Payload',
      // Puede durar hasta ~50s en proyectos con muchas unidades (era el cuello de botella)
      taskTimeout: sfn.Timeout.duration(cdk.Duration.seconds(90)),
    });

    const sfEliminarDesvincular = new tasks.LambdaInvoke(this, 'EliminarDesvincular', {
      lambdaFunction: proyectosLambda,
      comment: 'Marca procesos y clientes como desvinculados',
      payload: sfn.TaskInput.fromObject({
        action: 'sf_eliminar_desvincular',
        'proyecto_id.$': '$.proyecto_id',
        'total_unidades.$': '$.total_unidades',
        'schedules_cancelados.$': '$.schedules_cancelados',
      }),
      outputPath: '$.Payload',
    });

    const sfEliminarInventario = new tasks.LambdaInvoke(this, 'EliminarInventario', {
      lambdaFunction: proyectosLambda,
      comment: 'Borra historial de bloqueos y todas las unidades del inventario',
      payload: sfn.TaskInput.fromObject({
        action: 'sf_eliminar_inventario',
        'proyecto_id.$': '$.proyecto_id',
        'total_unidades.$': '$.total_unidades',
        'schedules_cancelados.$': '$.schedules_cancelados',
        'procesos_desvinculados.$': '$.procesos_desvinculados',
        'clientes_desvinculados.$': '$.clientes_desvinculados',
      }),
      outputPath: '$.Payload',
    });

    const sfEliminarFinalizar = new tasks.LambdaInvoke(this, 'EliminarFinalizar', {
      lambdaFunction: proyectosLambda,
      comment: 'Soft-delete del proyecto y desvinculación de inmobiliarias',
      payload: sfn.TaskInput.fromObject({
        action: 'sf_eliminar_finalizar',
        'proyecto_id.$': '$.proyecto_id',
        'total_unidades.$': '$.total_unidades',
        'schedules_cancelados.$': '$.schedules_cancelados',
        'procesos_desvinculados.$': '$.procesos_desvinculados',
        'clientes_desvinculados.$': '$.clientes_desvinculados',
        'inventario_eliminado.$': '$.inventario_eliminado',
        'historial_eliminado.$': '$.historial_eliminado',
      }),
      outputPath: '$.Payload',
    });

    const eliminarProyectoSF = new sfn.StateMachine(this, 'EliminarProyectoSF', {
      stateMachineName: resourceName('jam-eliminar-proyecto'),
      definitionBody: sfn.DefinitionBody.fromChainable(
        sfEliminarPreparar
          .next(sfEliminarSchedules)
          .next(sfEliminarDesvincular)
          .next(sfEliminarInventario)
          .next(sfEliminarFinalizar)
      ),
      timeout: cdk.Duration.minutes(10),
    });

    // ─── LAMBDA jam-crm ──────────────────────────────────────────────────────

    const crmLambdaArn = `arn:aws:lambda:${this.region}:${this.account}:function:${resourceName('jam-crm')}`;
    proyectosLambda.addEnvironment('CRM_LAMBDA_ARN', crmLambdaArn);

    const crmLambda = new lambda.Function(this, 'JamCrmLambda', {
      functionName: resourceName('jam-crm'),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-crm')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        CLIENTES_TABLE: clientesTable.tableName,
        PROCESOS_TABLE: procesosTable.tableName,
        INVENTARIO_TABLE: inventarioTable.tableName,
        USUARIOS_TABLE: usuariosTable.tableName,
        HISTORIAL_TABLE: historialTable.tableName,
        META_CONVERSACIONES_TABLE: metaConversacionesTable.tableName,
        AUDIT_TABLE: auditoriaTable.tableName,
        INSTAGRAM_TOKEN_PARAM_JAM: isProd
          ? '/jam/prod/meta/instagram/jamconstruccionessrl/access-token'
          : '/jam/dev/meta/instagram/jamconstruccionessrl/access-token',
        INSTAGRAM_TOKEN_PARAM_CANEY: isProd
          ? '/jam/prod/meta/instagram/caneyoriental/access-token'
          : '/jam/dev/meta/instagram/caneyoriental/access-token',
        MESSENGER_PAGE_TOKEN_PARAM_JAM: isProd
          ? '/jam/prod/meta/messenger/jam-construcciones/page-access-token'
          : '/jam/dev/meta/messenger/jam-construcciones/page-access-token',
        META_APP_ID_PARAM: isProd
          ? '/jam/prod/meta/app-id'
          : '/jam/dev/meta/app-id',
        META_APP_SECRET_PARAM: isProd
          ? '/jam/prod/meta/app-secret'
          : '/jam/dev/meta/app-secret',
        META_FACEBOOK_REDIRECT_URI: isProd
          ? 'https://dcgjiswnwqab6.cloudfront.net/meta/facebook/callback'
          : 'https://d12nm0khvt8zd9.cloudfront.net/meta/facebook/callback',
        WHATSAPP_TOKEN_PARAM_JAM: isProd
          ? '/jam/prod/meta/whatsapp/jam-construcciones/access-token'
          : '/jam/dev/meta/whatsapp/jam-construcciones/access-token',
        WHATSAPP_PHONE_NUMBER_ID_JAM: isProd ? '109857822123688' : '1072749679263713',
        METHODICA_CHANNEL_MESSAGES_URL: 'https://1ojgtdj4qf.execute-api.us-east-1.amazonaws.com/prod/channels/messages',
        METHODICA_CHANNEL_KEY_PARAM: isProd
          ? '/jam/prod/methodica/channel-api-key'
          : '/jam/dev/methodica/channel-api-key',
        METHODICA_TENANT_ID: 'jam',
        SQS_URL: notificacionesQueue.queueUrl,
        SCHEDULER_ROLE_ARN: schedulerRole.roleArn,
        CRM_LAMBDA_ARN: crmLambdaArn,
        BLOQUEOS_LAMBDA_ARN: bloqueosLambdaArn,
        CAPTACION_LAMBDA_ARN: captacionLambdaArn,
      },
    });

    clientesTable.grantReadWriteData(crmLambda);
    usuariosTable.grantReadData(crmLambda);
    procesosTable.grantReadWriteData(crmLambda);
    inventarioTable.grantReadWriteData(crmLambda);
    historialTable.grantReadWriteData(crmLambda);
    metaConversacionesTable.grantReadWriteData(crmLambda);
    auditoriaTable.grantWriteData(crmLambda);
    auditoriaTable.grantReadData(crmLambda);
    notificacionesQueue.grantSendMessages(crmLambda);
    crmLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['dynamodb:TransactWriteItems'],
      resources: [
        clientesTable.tableArn,
        procesosTable.tableArn,
        inventarioTable.tableArn,
      ],
    }));

    crmLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/jam/${stage}/meta/instagram/jamconstruccionessrl/access-token`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/jam/${stage}/meta/instagram/caneyoriental/access-token`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/jam/${stage}/meta/messenger/jam-construcciones/page-access-token`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/jam/${stage}/meta/app-id`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/jam/${stage}/meta/app-secret`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/jam/${stage}/meta/whatsapp/jam-construcciones/access-token`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/jam/${stage}/methodica/channel-api-key`,
      ],
    }));
    crmLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:PutParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/jam/${stage}/meta/messenger/jam-construcciones/page-access-token`,
      ],
    }));

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

    // ─── LAMBDA jam-campanias ────────────────────────────────────────────────

    const metaWebhooksLambda = new lambda.Function(this, 'JamMetaWebhooksLambda', {
      functionName: resourceName('jam-meta-webhooks'),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-meta-webhooks')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        META_WEBHOOK_VERIFY_TOKEN: isProd
          ? 'jam-crm-meta-webhook-prod'
          : 'jam-crm-meta-webhook-dev',
        INSTAGRAM_TOKEN_PARAM_JAM: isProd
          ? '/jam/prod/meta/instagram/jamconstruccionessrl/access-token'
          : '/jam/dev/meta/instagram/jamconstruccionessrl/access-token',
        INSTAGRAM_TOKEN_PARAM_CANEY: isProd
          ? '/jam/prod/meta/instagram/caneyoriental/access-token'
          : '/jam/dev/meta/instagram/caneyoriental/access-token',
        INSTAGRAM_ACCOUNT_ID_JAM: '28037341805951107',
        INSTAGRAM_ACCOUNT_ID_CANEY: '28096402176655919',
        INSTAGRAM_USER_ID_JAM: '17841451399457183',
        INSTAGRAM_USER_ID_CANEY: '17841479714105082',
        MESSENGER_PAGE_ID_JAM: '134590556407660',
        MESSENGER_PAGE_TOKEN_PARAM_JAM: isProd
          ? '/jam/prod/meta/messenger/jam-construcciones/page-access-token'
          : '/jam/dev/meta/messenger/jam-construcciones/page-access-token',
        WHATSAPP_BUSINESS_ACCOUNT_ID_JAM: isProd ? '127983130284042' : '2173053779923477',
        WHATSAPP_PHONE_NUMBER_ID_JAM: isProd ? '109857822123688' : '1072749679263713',
        WHATSAPP_TOKEN_PARAM_JAM: isProd
          ? '/jam/prod/meta/whatsapp/jam-construcciones/access-token'
          : '/jam/dev/meta/whatsapp/jam-construcciones/access-token',
        META_CONVERSACIONES_TABLE: metaConversacionesTable.tableName,
      },
    });
    metaConversacionesTable.grantReadWriteData(metaWebhooksLambda);
    metaWebhooksLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [
        `arn:aws:ssm:${this.region}:${this.account}:parameter/jam/${stage}/meta/instagram/jamconstruccionessrl/access-token`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/jam/${stage}/meta/instagram/caneyoriental/access-token`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/jam/${stage}/meta/messenger/jam-construcciones/page-access-token`,
        `arn:aws:ssm:${this.region}:${this.account}:parameter/jam/${stage}/meta/whatsapp/jam-construcciones/access-token`,
      ],
    }));

    const campaniasLambda = new lambda.Function(this, 'JamCampaniasLambda', {
      functionName: resourceName('jam-campanias'),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-campanias')),
      timeout: cdk.Duration.seconds(60),
      environment: {
        CLIENTES_TABLE: clientesTable.tableName,
        PROCESOS_TABLE: procesosTable.tableName,
        INVENTARIO_TABLE: inventarioTable.tableName,
        CAMPANIAS_TABLE: campaniasTable.tableName,
        AUDIT_TABLE: auditoriaTable.tableName,
        FROM_EMAIL: notificationEmail,
      },
    });

    clientesTable.grantReadData(campaniasLambda);
    procesosTable.grantReadData(campaniasLambda);
    inventarioTable.grantReadData(campaniasLambda);
    campaniasTable.grantReadWriteData(campaniasLambda);
    auditoriaTable.grantWriteData(campaniasLambda);
    campaniasLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));

    const tareasLambda = new lambda.Function(this, 'JamTareasLambda', {
      functionName: resourceName('jam-tareas'),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-tareas')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        TAREAS_TABLE: tareasTable.tableName,
        USUARIOS_TABLE: usuariosTable.tableName,
        INVENTARIO_TABLE: inventarioTable.tableName,
        AUDIT_TABLE: auditoriaTable.tableName,
        SCHEDULER_ROLE_ARN: schedulerRole.roleArn,
        TAREAS_LAMBDA_ARN: tareasLambdaArn,
        FROM_EMAIL: notificationEmail,
        ADMIN_EMAIL: notificationEmail,
        BUSINESS_TZ: 'America/Santo_Domingo',
      },
    });

    tareasTable.grantReadWriteData(tareasLambda);
    auditoriaTable.grantWriteData(tareasLambda);
    usuariosTable.grantReadData(tareasLambda);
    inventarioTable.grantReadData(tareasLambda);
    tareasLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['scheduler:CreateSchedule', 'scheduler:DeleteSchedule'],
      resources: ['*'],
    }));
    tareasLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [schedulerRole.roleArn],
    }));
    tareasLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: ['*'],
    }));
    schedulerRole.addToPolicy(new iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [tareasLambdaArn],
    }));

    // ─── LAMBDA jam-transferir-cliente ───────────────────────────────────────

    const transferirClienteLambda = new lambda.Function(this, 'JamTransferirClienteLambda', {
      functionName: resourceName('jam-transferir-cliente'),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-transferir-cliente')),
      timeout: cdk.Duration.seconds(60),
      environment: {
        CLIENTES_TABLE: clientesTable.tableName,
        PROCESOS_TABLE: procesosTable.tableName,
        INVENTARIO_TABLE: inventarioTable.tableName,
        BLOQUEOS_LAMBDA_ARN: bloqueosLambdaArn,
        SCHEDULER_ROLE_ARN: schedulerRole.roleArn,
      },
    });

    clientesTable.grantReadWriteData(transferirClienteLambda);
    procesosTable.grantReadWriteData(transferirClienteLambda);
    inventarioTable.grantReadWriteData(transferirClienteLambda);
    
    // Permisos para crear schedules
    transferirClienteLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['scheduler:CreateSchedule', 'scheduler:DeleteSchedule'],
      resources: ['*'],
    }));
    
    transferirClienteLambda.addToRolePolicy(new iam.PolicyStatement({
      actions: ['iam:PassRole'],
      resources: [schedulerRole.roleArn],
    }));

    // ─── STEP FUNCTION: Transferir Cliente ───────────────────────────────────

    // Paso 1: Validar
    const validarStep = new tasks.LambdaInvoke(this, 'ValidarTransferencia', {
      lambdaFunction: transferirClienteLambda,
      payload: sfn.TaskInput.fromObject({
        action: 'validar',
        'cedula.$': '$.cedula',
        'proyecto_id.$': '$.proyecto_id',
        'inmobiliaria_origen.$': '$.inmobiliaria_origen',
        'inmobiliaria_destino.$': '$.inmobiliaria_destino',
        'unidad_id.$': '$.unidad_id',
      }),
      resultPath: '$.validacion',
      outputPath: '$.validacion.Payload',
    });

    // Paso 2: Eliminar registros antiguos
    const eliminarStep = new tasks.LambdaInvoke(this, 'EliminarRegistros', {
      lambdaFunction: transferirClienteLambda,
      payload: sfn.TaskInput.fromObject({
        action: 'eliminar',
        'cedula.$': '$.cedula',
        'proyecto_id.$': '$.proyecto_id',
        'inmobiliaria_origen.$': '$.inmobiliaria_origen',
        'inmobiliaria_destino.$': '$.inmobiliaria_destino',
        'cliente.$': '$.cliente',
        'procesos.$': '$.procesos',
        'bloqueos.$': '$.bloqueos',
        'unidad_id.$': '$.unidad_id',
        'transferencia_parcial.$': '$.transferencia_parcial',
      }),
      resultPath: '$.eliminacion',
      outputPath: '$.eliminacion.Payload',
    });

    // Paso 3: Crear registros nuevos
    const crearStep = new tasks.LambdaInvoke(this, 'CrearRegistros', {
      lambdaFunction: transferirClienteLambda,
      payload: sfn.TaskInput.fromObject({
        action: 'crear',
        'cedula.$': '$.cedula',
        'proyecto_id.$': '$.proyecto_id',
        'inmobiliaria_origen.$': '$.inmobiliaria_origen',
        'inmobiliaria_destino.$': '$.inmobiliaria_destino',
        'cliente.$': '$.cliente',
        'procesos.$': '$.procesos',
        'bloqueos.$': '$.bloqueos',
        'unidad_id.$': '$.unidad_id',
        'transferencia_parcial.$': '$.transferencia_parcial',
      }),
      resultPath: '$.creacion',
      outputPath: '$.creacion.Payload',
    });

    // Manejo de error en validación
    const validacionFallida = new sfn.Fail(this, 'ValidacionFallida', {
      cause: 'La validación de la transferencia falló',
      error: 'VALIDACION_ERROR',
    });

    // Encadenar eliminar -> crear
    eliminarStep.next(crearStep);

    // Choice para verificar si la validación fue exitosa
    const verificarValidacion = new sfn.Choice(this, 'VerificarValidacion')
      .when(sfn.Condition.booleanEquals('$.valido', false), validacionFallida)
      .otherwise(eliminarStep);

    // Definir el flujo: validar -> verificar -> (eliminar -> crear) o (fail)
    const definition = validarStep.next(verificarValidacion);

    const transferirClienteStateMachine = new sfn.StateMachine(this, 'TransferirClienteStateMachine', {
      stateMachineName: resourceName('jam-transferir-cliente-workflow'),
      definition,
      timeout: cdk.Duration.minutes(5),
    });

    // Lambda para iniciar la Step Function desde API Gateway
    const iniciarTransferenciaLambda = new lambda.Function(this, 'JamIniciarTransferenciaLambda', {
      functionName: resourceName('jam-iniciar-transferencia'),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
import json
import boto3
import os
import uuid
from datetime import datetime, timezone

sfn = boto3.client('stepfunctions')
dynamodb = boto3.resource('dynamodb')
STATE_MACHINE_ARN = os.environ['STATE_MACHINE_ARN']
CEDULA_STATE_MACHINE_ARN = os.environ.get('CEDULA_STATE_MACHINE_ARN', '')
AUDIT_TABLE = os.environ.get('AUDIT_TABLE', '')

def handler(event, context):
    body = json.loads(event.get('body', '{}'))
    path = event.get('path', '')

    # Route to correct state machine based on path
    if 'cambiar-cedula' in path:
        arn = CEDULA_STATE_MACHINE_ARN
        msg = 'Cambio de cedula iniciado'
    else:
        arn = STATE_MACHINE_ARN
        msg = 'Transferencia iniciada'

    response = sfn.start_execution(
        stateMachineArn=arn,
        input=json.dumps(body)
    )

    if AUDIT_TABLE:
        claims = ((event.get('requestContext') or {}).get('authorizer') or {}).get('claims') or {}
        sub = claims.get('sub') or claims.get('username') or 'sistema'
        ts = datetime.now(timezone.utc).isoformat()
        event_id = str(uuid.uuid4())
        accion = 'cambio_cedula_iniciado' if 'cambiar-cedula' in path else 'cliente_traspaso_iniciado'
        dynamodb.Table(AUDIT_TABLE).put_item(Item={
            'pk': 'AUDITORIA#' + ts[:10], 'sk': ts + '#' + event_id,
            'tipo': 'AUDITORIA', 'evento_id': event_id, 'fecha': ts,
            'accion': accion, 'modulo': 'clientes', 'resultado': 'completado',
            'usuario_sub': sub, 'usuario_nombre': claims.get('name') or claims.get('cognito:username') or 'Sistema',
            'usuario_rol': claims.get('custom:rol') or claims.get('cognito:groups') or '',
            'entidad_tipo': 'cliente', 'entidad_id': body.get('cedula_actual') or body.get('cedula_antigua') or body.get('cedula') or 'general',
            'GSI1PK': 'USUARIO#' + sub, 'GSI1SK': ts + '#' + event_id,
            'GSI2PK': 'ENTIDAD#cliente#' + str(body.get('cedula_actual') or body.get('cedula_antigua') or body.get('cedula') or 'general'), 'GSI2SK': ts + '#' + event_id,
            'GSI3PK': 'ACCION#' + accion, 'GSI3SK': ts + '#' + event_id,
            'detalles': {'execution_arn': response['executionArn'], 'path': path},
        })

    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        },
        'body': json.dumps({
            'message': msg,
            'execution_arn': response['executionArn']
        })
    }
`),
      timeout: cdk.Duration.seconds(10),
      environment: {
        STATE_MACHINE_ARN: transferirClienteStateMachine.stateMachineArn,
        AUDIT_TABLE: auditoriaTable.tableName,
      },
    });

    transferirClienteStateMachine.grantStartExecution(iniciarTransferenciaLambda);
    auditoriaTable.grantWriteData(iniciarTransferenciaLambda);

    // ─── STEP FUNCTION: Cambiar Cédula ───────────────────────────────────────

    const validarCedulaStep = new tasks.LambdaInvoke(this, 'ValidarCambioCedula', {
      lambdaFunction: transferirClienteLambda,
      payload: sfn.TaskInput.fromObject({
        action: 'validar_cedula',
        'cedula_antigua.$': '$.cedula_antigua',
        'cedula_nueva.$': '$.cedula_nueva',
      }),
      resultPath: '$.validacion',
      outputPath: '$.validacion.Payload',
    });

    const eliminarCedulaStep = new tasks.LambdaInvoke(this, 'EliminarRegistrosCedula', {
      lambdaFunction: transferirClienteLambda,
      payload: sfn.TaskInput.fromObject({
        action: 'eliminar_cedula',
        'cedula_antigua.$': '$.cedula_antigua',
        'cedula_nueva.$': '$.cedula_nueva',
        'clientes.$': '$.clientes',
        'procesos.$': '$.procesos',
        'unidades_vinculadas.$': '$.unidades_vinculadas',
      }),
      resultPath: '$.eliminacion',
      outputPath: '$.eliminacion.Payload',
    });

    const crearCedulaStep = new tasks.LambdaInvoke(this, 'CrearRegistrosCedula', {
      lambdaFunction: transferirClienteLambda,
      payload: sfn.TaskInput.fromObject({
        action: 'crear_cedula',
        'cedula_antigua.$': '$.cedula_antigua',
        'cedula_nueva.$': '$.cedula_nueva',
        'clientes.$': '$.clientes',
        'procesos.$': '$.procesos',
        'unidades_vinculadas.$': '$.unidades_vinculadas',
      }),
      resultPath: '$.creacion',
      outputPath: '$.creacion.Payload',
    });

    const validacionCedulaFallida = new sfn.Fail(this, 'ValidacionCedulaFallida', {
      cause: 'La validación del cambio de cédula falló',
      error: 'VALIDACION_CEDULA_ERROR',
    });

    eliminarCedulaStep.next(crearCedulaStep);

    const verificarValidacionCedula = new sfn.Choice(this, 'VerificarValidacionCedula')
      .when(sfn.Condition.booleanEquals('$.valido', false), validacionCedulaFallida)
      .otherwise(eliminarCedulaStep);

    const definitionCedula = validarCedulaStep.next(verificarValidacionCedula);

    const cambiarCedulaStateMachine = new sfn.StateMachine(this, 'CambiarCedulaStateMachine', {
      stateMachineName: resourceName('jam-cambiar-cedula-workflow'),
      definition: definitionCedula,
      timeout: cdk.Duration.minutes(5),
    });

    cambiarCedulaStateMachine.grantStartExecution(iniciarTransferenciaLambda);
    iniciarTransferenciaLambda.addEnvironment('CEDULA_STATE_MACHINE_ARN', cambiarCedulaStateMachine.stateMachineArn);

    // ─── API GATEWAY ────────────────────────────────────────────────────────

    const api = new apigateway.RestApi(this, 'JamApi', {
      restApiName: resourceName('jam-api'),
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
        authorizerName: resourceName('jam-authorizer'),
      }
    );

    const authLambdaIntegration = new apigateway.LambdaIntegration(authLambda, {
      allowTestInvoke: false,
    });
    const proyectosLambdaIntegration = new apigateway.LambdaIntegration(proyectosLambda);
    const bloqueosLambdaIntegration = new apigateway.LambdaIntegration(bloqueosLambda);
    const captacionLambdaIntegration = new apigateway.LambdaIntegration(captacionLambda);
    const crmLambdaIntegration = new apigateway.LambdaIntegration(crmLambda);
    const metaWebhooksLambdaIntegration = new apigateway.LambdaIntegration(metaWebhooksLambda);
    const campaniasLambdaIntegration = new apigateway.LambdaIntegration(campaniasLambda);
    const tareasLambdaIntegration = new apigateway.LambdaIntegration(tareasLambda);

    // /auth
    const authResource = api.root.addResource('auth');
    authResource.addResource('login').addMethod('POST', authLambdaIntegration);
    authResource.addResource('confirm-mfa').addMethod('POST', authLambdaIntegration);
    const authMeResource = authResource.addResource('me');
    authMeResource.addMethod('GET', authLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const authMeFotoResource = authMeResource.addResource('foto');
    authMeFotoResource.addMethod('POST', authLambdaIntegration, {
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

    // /admin/inmobiliarias/{inmo_id}/imagen (presigned URL para subir imagen)
    adminInmoResource.addResource('imagen').addMethod('POST', authLambdaIntegration, {
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

    // /admin/clientes/{cedula}/proyecto/{proyecto_id}/transferir
    const iniciarTransferenciaIntegration = new apigateway.LambdaIntegration(iniciarTransferenciaLambda);
    adminClienteProyectoResource.addResource('transferir').addMethod('POST', iniciarTransferenciaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/clientes/{cedula}/cambiar-cedula
    adminClienteResource.addResource('cambiar-cedula').addMethod('POST', iniciarTransferenciaIntegration, {
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
    adminInventarioResource.addResource('exportar').addMethod('GET', proyectosLambdaIntegration, {
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

    // /admin/campanias
    const adminCampaniasResource = adminResource.addResource('campanias');
    adminCampaniasResource.addResource('preview').addMethod('POST', campaniasLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminCampaniasResource.addResource('enviar').addMethod('POST', campaniasLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminCampaniasResource.addResource('historial').addMethod('GET', campaniasLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    const adminCampaniasTemplatesResource = adminCampaniasResource.addResource('templates');
    adminCampaniasTemplatesResource.addMethod('GET', campaniasLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminCampaniasTemplatesResource.addResource('{template_id}').addMethod('PUT', campaniasLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    const adminTareasResource = adminResource.addResource('tareas');
    adminTareasResource.addMethod('ANY', tareasLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/procesos
    const adminProcesosResource = adminResource.addResource('procesos');
    adminProcesosResource.addMethod('GET', crmLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminProcesosResource.addMethod('PUT', crmLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });
    adminProcesosResource.addMethod('POST', crmLambdaIntegration, {
      authorizer: cognitoAuthorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // /admin/config/email-templates — routed via query param on existing endpoint
    // No new API Gateway resources needed (stack at resource limit)
    // Frontend calls GET /admin/inmobiliarias?_config=email-templates
    // and PUT /admin/inmobiliarias?_config=email-templates&tipo=xxx

    // /publico — rutas sin auth para captura externa de clientes
    const publicoResource = api.root.addResource('publico');

    const publicoInmobiliariasResource = publicoResource.addResource('inmobiliarias');
    publicoInmobiliariasResource.addMethod('GET', captacionLambdaIntegration);

    const publicoProyectosResource = publicoResource.addResource('proyectos');
    publicoProyectosResource.addMethod('GET', captacionLambdaIntegration);

    const publicoClientesResource = publicoResource.addResource('clientes');
    publicoClientesResource.addMethod('POST', captacionLambdaIntegration);

    // /webhooks/meta — ruta pública para verificación y eventos de Meta
    const webhooksResource = api.root.addResource('webhooks');
    const metaWebhookResource = webhooksResource.addResource('meta');
    metaWebhookResource.addMethod('GET', metaWebhooksLambdaIntegration);
    metaWebhookResource.addMethod('POST', metaWebhooksLambdaIntegration);
    const whatsappWebhookResource = webhooksResource.addResource('whatsapp');
    whatsappWebhookResource.addMethod('GET', metaWebhooksLambdaIntegration);
    whatsappWebhookResource.addMethod('POST', metaWebhooksLambdaIntegration);

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
      bucketName: bucketName('jam-frontend'),
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Bucket para archivos de migración (Excel uploads)
    const archivosBucket = new s3.Bucket(this, 'JamArchivosBucket', {
      bucketName: bucketName('jam-archivos'),
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
      bucketName: bucketName('jam-assets'),
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

    // Permisos: authLambda puede generar presigned URLs para imágenes de inmobiliarias
    assetsBucket.grantReadWrite(authLambda);
    authLambda.addEnvironment('ASSETS_BUCKET', assetsBucket.bucketName);
    authLambda.addEnvironment('CLOUDFRONT_URL', `https://${distribution.distributionDomainName}`);

    assetsBucket.grantReadWrite(campaniasLambda);
    campaniasLambda.addEnvironment('ASSETS_BUCKET', assetsBucket.bucketName);
    campaniasLambda.addEnvironment('CLOUDFRONT_URL', `https://${distribution.distributionDomainName}`);

    assetsBucket.grantReadWrite(metaWebhooksLambda);
    metaWebhooksLambda.addEnvironment('ASSETS_BUCKET', assetsBucket.bucketName);
    metaWebhooksLambda.addEnvironment('CLOUDFRONT_URL', `https://${distribution.distributionDomainName}`);

    // crmLambda sube multimedia saliente del inbox (presigned URL) al bucket de assets.
    assetsBucket.grantReadWrite(crmLambda);
    crmLambda.addEnvironment('ASSETS_BUCKET', assetsBucket.bucketName);
    crmLambda.addEnvironment('CLOUDFRONT_URL', `https://${distribution.distributionDomainName}`);

    // Permisos: proyectosLambda puede leer/escribir en archivos (Excel migrations)
    archivosBucket.grantReadWrite(proyectosLambda);
    proyectosLambda.addEnvironment('ARCHIVOS_BUCKET', archivosBucket.bucketName);
    proyectosLambda.addEnvironment('SQS_URL', notificacionesQueue.queueUrl);
    notificacionesQueue.grantSendMessages(proyectosLambda);
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
        'arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0',
        'arn:aws:bedrock:us-east-1:*:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0',
      ],
    }));

    // ─── LAMBDA LAYER openpyxl ───────────────────────────────────────────────
    // Layer con openpyxl para parsear Excel en jam-excel-parser
    // Para crear el layer: pip install openpyxl -t lambdas/layers/openpyxl/python
    const openpyxlLayer = new lambda.LayerVersion(this, 'OpenpyxlLayer', {
      layerVersionName: resourceName('jam-openpyxl'),
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/layers/openpyxl')),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      description: 'openpyxl para parseo de archivos Excel',
    });

    // Agregar layer de openpyxl a lambdas que generan exportaciones Excel
    proyectosLambda.addLayers(openpyxlLayer);
    captacionLambda.addLayers(openpyxlLayer);
    archivosBucket.grantReadWrite(captacionLambda);
    captacionLambda.addEnvironment('ARCHIVOS_BUCKET', archivosBucket.bucketName);

    // ─── LAMBDA jam-excel-parser ─────────────────────────────────────────────
    // Lambda separada para parsear Excel — timeout largo, disparada por evento S3

    const excelParserLambda = new lambda.Function(this, 'JamExcelParserLambda', {
      functionName: resourceName('jam-excel-parser'),
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
        'arn:aws:bedrock:*::foundation-model/anthropic.claude-haiku-4-5-20251001-v1:0',
        'arn:aws:bedrock:us-east-1:*:inference-profile/us.anthropic.claude-haiku-4-5-20251001-v1:0',
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
      backupVaultName: resourceName('jam-backup-vault'),
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const backupPlan = new backup.BackupPlan(this, 'JamBackupPlan', {
      backupPlanName: resourceName('jam-backup-plan'),
      backupVault,
      backupPlanRules: [
        new backup.BackupPlanRule({
          ruleName: resourceName('jam-daily-backup'),
          scheduleExpression: events.Schedule.cron({ hour: '4', minute: '0' }), // 12am RD (UTC-4)
          deleteAfter: cdk.Duration.days(30),
          startWindow: cdk.Duration.hours(1),
          completionWindow: cdk.Duration.hours(3),
        }),
      ],
    });

    backupPlan.addSelection('JamBackupSelection', {
      backupSelectionName: resourceName('jam-dynamodb-tables'),
      resources: [
        backup.BackupResource.fromDynamoDbTable(usuariosTable),
        backup.BackupResource.fromDynamoDbTable(inventarioTable),
        backup.BackupResource.fromDynamoDbTable(clientesTable),
        backup.BackupResource.fromDynamoDbTable(procesosTable),
        backup.BackupResource.fromDynamoDbTable(historialEstatusTable),
        backup.BackupResource.fromDynamoDbTable(historialTable),
        backup.BackupResource.fromDynamoDbTable(campaniasTable),
        backup.BackupResource.fromDynamoDbTable(metaConversacionesTable),
        backup.BackupResource.fromDynamoDbTable(tareasTable),
        backup.BackupResource.fromDynamoDbTable(auditoriaTable),
      ],
    });

    // ─── LAMBDA jam-notificaciones ───────────────────────────────────────────

    const notificacionesLambda = new lambda.Function(this, 'JamNotificacionesLambda', {
      functionName: resourceName('jam-notificaciones'),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-notificaciones')),
      timeout: cdk.Duration.seconds(30),
      environment: {
        ADMIN_EMAIL: notificationEmail,
        FROM_EMAIL: notificationEmail,
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
