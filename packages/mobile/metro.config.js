const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// El logo vive en /shared, fuera de este paquete.
config.watchFolders = [path.resolve(projectRoot, '../../shared')];

module.exports = config;
