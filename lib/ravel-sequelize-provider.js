'use strict';

const fs = require('fs');
const recursive = require('fs-readdir-recursive');
const upath = require('upath');

const Sequelize = require('sequelize');

const sProvider = Symbol.for('_sequelizeProvider');
const instantiatedModels = Symbol.for('_instantiatedModels');
const uninstantiatedModels = Symbol.for('_uninstantiatedModels');

const DEFAULT_OPTIONS = {
  host: 'localhost',
  port: 5432,
  database: 'ravel',
  dialect: 'postgres',
  username: '',
  password: '',
  supportBigNumbers: true,
  bigNumberStrings: true,
  connectionLimit: 10,
  idleTimeoutMillis: 30000,
  pool: {
    min: 5,
    max: 10,
    idle: 15000,
    acquire: 2500,
    evict: 15000,
    handleDisconnects: true
  }
};

class SequelizeConfigurator {
  constructor (ravelInstance) {
    ravelInstance.registerParameter('sequelize options', true, DEFAULT_OPTIONS);

    this.logger = ravelInstance.log.getLogger('sequelize');

    ravelInstance.on('post load parameters', () => {
      // overlay user options onto defaults
      const opts = {};
      Object.assign(opts, DEFAULT_OPTIONS);
      Object.assign(opts, ravelInstance.get('sequelize options'));

      this.logger.debug('Instantiating Sequelize.');
      ravelInstance[sProvider] = new Sequelize(opts);

      ravelInstance[instantiatedModels] = new Map();
      ravelInstance[uninstantiatedModels] = new Map();
    });

    ravelInstance.on('pre listen', () => {
      if (ravelInstance[uninstantiatedModels].size > 0) {
        for (const modelEntry of ravelInstance[uninstantiatedModels].entries()) {
          this.logger.debug(`Instantiating ${modelEntry[0]}`);
          ravelInstance[instantiatedModels].put(modelEntry[0], modelEntry[1](ravelInstance[sProvider], Sequelize));
        }
      }

      ravelInstance[sProvider].sync({
        force: false
      });
    });
  }
}

module.exports = function (Ravel) {
  Ravel.prototype.getModels = function () {
    return this[instantiatedModels];
  };

  Ravel.prototype.getModel = function (key) {
    return this[instantiatedModels].get(key);
  };

  Ravel.prototype.models = function (basePath) {
    const absPath = upath.isAbsolute(basePath) ? basePath : upath.join(this.cwd, basePath);
    if (!fs.lstatSync(absPath).isDirectory()) {
      throw new this.ApplicationError.IllegalValue(
        'Base module scanning path \'' + absPath + '\' is not a directory.');
    } else {
      for (const file of recursive(absPath)) {
        if (upath.extname(file) === '.js') {
          // derive module name from filename, using subdirectories of basePath as namespacing
          const name = upath.trimExt(upath.normalize(file)).split('/').join('.');
          // declare module
          this[uninstantiatedModels].put(name, upath.join(absPath, file));
        }
      }
    }
  };
};

module.exports.SequelizeConfigurator = SequelizeConfigurator;
