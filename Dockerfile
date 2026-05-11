# Usamos una versión estable de Node
FROM node:18

# Creamos el directorio de trabajo
WORKDIR /usr/src/app

# Copiamos los archivos de dependencias
COPY package*.json ./

# Instalamos las librerías
RUN npm install

# Copiamos el resto del código
COPY . .

# Comando para arrancar el bot (ajusta index.js por el nombre de tu archivo)
CMD [ "node", "index.js" ]