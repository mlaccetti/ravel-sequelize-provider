'use strict';

const fs = require('fs');
const recursive = require('fs-readdir-recursive');
const upath = require('upath');

const Sequelize = require('sequelize');

const sProvider = Symbol.for('_sequelizeProvider');
const sSequelizeModels = Symbol.for('_sequelizeModels');

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
    this.ravelInstance = ravelInstance;
    ravelInstance.registerParameter('sequelize options', true, DEFAULT_OPTIONS);

    this.logger = this.ravelInstance.log.getLogger('sequelize');

    ravelInstance.on('post load parameters', () => {
      const opts = this.ravelInstance.get('sequelize options');

      this.logger.debug('Instantiating Sequelize.');
      ravelInstance[sProvider] = new Sequelize(opts);

      ravelInstance[sSequelizeModels] = new Map();
    });

    ravelInstance.on('pre listen', () => {
      ravelInstance[sProvider].sync({
        force: false
      });
    });
  }
}

module.exports = function (Ravel) {
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
          this.module(upath.join(absPath, file), name);
        }
      }
    }
  };

  Ravel.prototype.sequelize = function () {
    return this[sProvider];
  };

  Ravel.prototype.addModel = function (key, model) {
    this[sSequelizeModels].set(key, model);
  };

  Ravel.prototype.getModel = function (key) {
    return this[sSequelizeModels].get(key);
  };
};

module.exports.SequelizeConfigurator = SequelizeConfigurator;
