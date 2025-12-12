# Sistema de Inventario - Fundación Aprender

Proyecto mínimo para que estudiantes gestionen un catálogo, inventario y ventas.

Características incluidas:
- Registro de productos con categoría, precio, cantidad e imágenes (múltiples).
- Reordenamiento del catálogo por drag & drop.
- Ordenación/edición de imágenes por producto.
- Registro de ventas con ajuste de stock.
- Persistencia local usando localStorage.
- Exportación CSV (productos, inventario, ventas) para backup.

Paleta de colores aplicada: #1FCF97, #343434, #ffffff, #225641, #90e077

How to use
1. Abrir `Index.html` en un navegador (o desplegar en Vercel).
2. En la pestaña "Registrar producto" rellenar nombre, precio, categoría, cantidad y subir imágenes.
3. En "Catálogo" arrastrar productos para reorganizarlos.
4. En "Ventas" registrar ventas; el inventario se ajustará automáticamente.
5. Pulsar "Exportar a Excel" para descargar CSVs con los respaldos.

Persistencia
- Los datos se guardan en localStorage bajo la clave `tienda_v1_data_v1`.

Despliegue en Vercel (GitHub Actions)
Se incluye un workflow en `.github/workflows/vercel-deploy.yml` que despliega cuando se hace push a la rama `master`.

Configurar secretos en GitHub repository settings -> Secrets:
- `VERCEL_TOKEN`: token personal de Vercel
- `VERCEL_ORG_ID`: ID de la organización en Vercel
- `VERCEL_PROJECT_ID`: ID del proyecto en Vercel

Notas para docentes
- Este sistema está pensado como base educativa — es totalmente cliente-side y usa localStorage. Para un uso real en producción se recomienda conectar un backend y una base de datos.
- Sugerencia: añadir validaciones, gestión de usuarios, y un endpoint para backups periódicos.
