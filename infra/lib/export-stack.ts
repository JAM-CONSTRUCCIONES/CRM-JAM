import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ExportStackProps extends cdk.StackProps {
  stage?: 'dev' | 'prod';
}

export class ExportStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: ExportStackProps) {
    super(scope, id, props);

    const stage = props?.stage ?? 'dev';
    const isProd = stage === 'prod';
    const resourceName = (baseName: string) => isProd ? `${baseName}-prod` : baseName;
    const bucketName = (baseName: string) => isProd
      ? `${baseName}-prod-${this.account}`
      : `${baseName}-${this.account}`;

    const inventarioTable = dynamodb.Table.fromTableName(this, 'InventarioTable', resourceName('jam-inventario'));
    const usuariosTable = dynamodb.Table.fromTableName(this, 'UsuariosTable', resourceName('jam-usuarios'));
    const clientesTable = dynamodb.Table.fromTableName(this, 'ClientesTable', resourceName('jam-clientes'));
    const procesosTable = dynamodb.Table.fromTableName(this, 'ProcesosTable', resourceName('jam-procesos'));
    const archivosBucket = s3.Bucket.fromBucketName(this, 'ArchivosBucket', bucketName('jam-archivos'));

    const openpyxlLayer = new lambda.LayerVersion(this, 'OpenpyxlLayer', {
      layerVersionName: resourceName('jam-export-openpyxl'),
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/layers/openpyxl')),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_12],
      description: 'openpyxl para exportación de inventario',
    });

    const exportLambda = new lambda.Function(this, 'JamExportarProyectosLambda', {
      functionName: resourceName('jam-exportar-proyectos'),
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: 'export_handler.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../lambdas/jam-proyectos')),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(120),
      layers: [openpyxlLayer],
      environment: {
        INVENTARIO_TABLE: inventarioTable.tableName,
        USUARIOS_TABLE: usuariosTable.tableName,
        CLIENTES_TABLE: clientesTable.tableName,
        PROCESOS_TABLE: procesosTable.tableName,
        ARCHIVOS_BUCKET: archivosBucket.bucketName,
      },
    });

    inventarioTable.grantReadData(exportLambda);
    usuariosTable.grantReadData(exportLambda);
    clientesTable.grantReadData(exportLambda);
    procesosTable.grantReadData(exportLambda);
    archivosBucket.grantReadWrite(exportLambda);
  }
}
