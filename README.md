# Mi Plan Alimentario 🌸💜

Aplicación web personal con diseño rosa y morado, acceso mediante correo y contraseña, menú, despensa, compras, recetas, diario, perfil, peso, medidas corporales y hábitos.

## Publicar en GitHub y Railway

1. Crea un repositorio NUEVO en GitHub para esta aplicación. No mezcles sus archivos con Camino de Sentido.
2. Descomprime este ZIP y sube **su contenido**, conservando la carpeta `public`. Los archivos `server.js` y `package.json` deben quedar en la raíz del repositorio.
3. En Railway selecciona **New Project** → **Deploy from GitHub repo** y selecciona el repositorio.
4. Railway detectará Node.js. El comando para iniciar es `npm start`. No requiere `npm install` de paquetes externos.
5. En **Settings → Networking** genera un dominio HTTPS. Ese será el enlace de tu aplicación.
6. En Railway configura `NODE_ENV=production`.
7. Para conservar tus registros tras nuevos despliegues, **crea un volumen persistente en Railway**, móntalo en `/app/data` solo si `/app` es el directorio de trabajo de tu servicio y define la variable `DATA_DIR` apuntando exactamente al directorio montado. Consulta la ruta de montaje que Railway muestre en tu servicio. No uses el almacenamiento temporal para datos importantes.
8. Al entrar por primera vez, pulsa **Crear mi cuenta privada**. La contraseña debe tener mínimo 10 caracteres.

## Funciones disponibles

- Autenticación privada, sesiones HttpOnly y almacenamiento separado por usuario.
- Perfil y estimaciones basadas en Mifflin St Jeor.
- Despensa e inventario, lista de compras y registro de gastos.
- Planificador semanal editable, recetario y diario alimentario.
- Registro de peso y medidas corporales, con gráfico de peso.
- Cámara/galería para previsualización de fotos. Registro de comidas con campos nutricionales manuales.
- Búsqueda de una pequeña tabla inicial de valores nutricionales por 100 g.
- Panel de sugerencias sencillas según coincidencias en la despensa.

## Pendiente de integrar

- Análisis automático de fotos mediante servicio real de IA y base nutricional extensa.
- Chat conversacional de IA.
- Recuperación de contraseña por correo, notificaciones push, exportación y copias de seguridad automatizadas.
- Sincronización automática de compras con inventario más allá de la opción de registro.
- Cálculo preciso de nutrientes por recetas y una biblioteca amplia de alimentos.

La estimación energética es orientativa, nunca prescribe automáticamente un déficit por debajo del metabolismo basal calculado. No hay registro de consumo de agua.

## Seguridad y permanencia

El sistema usa `crypto.scrypt`, sesiones aleatorias protegidas con cookies HttpOnly y controles de acceso por cuenta. Es un MVP para uso personal, no una solución clínica. La base se guarda en un archivo JSON, por lo que debe usarse un solo proceso/instancia; para alto tráfico y copias de seguridad conviene migrar a PostgreSQL. Los datos permanecen únicamente mientras el volumen donde se guardan sea persistente. Mantén el repositorio privado y activa copias de seguridad del volumen.
