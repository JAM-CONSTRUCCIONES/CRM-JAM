# Lambda Layers

## openpyxl

Antes del primer deploy, construir el layer:

```bash
pip install openpyxl -t lambdas/layers/openpyxl/python --platform manylinux2014_x86_64 --only-binary=:all:
```

Esto instala openpyxl compatible con el runtime de Lambda (Linux x86_64).
