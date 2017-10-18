'use strict';

const _ = require('lodash');
const fs = require('fs');
const recursive = require('fs-readdir-recursive');
const upath = require('upath');

const Ravel = require('ravel');
const Sequelize = require('sequelize');

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

class SequelizeConfigurator extends Ravel.DatabaseProvider {
  constructor (ravelInstance) {
    super(ravelInstance, 'sequelize');

    ravelInstance.registerParameter('sequelize options', true, DEFAULT_OPTIONS);
    this.logger = ravelInstance.log.getLogger('sequelize');

    this.seq = null;
    this[instantiatedModels] = new Map();
    this[uninstantiatedModels] = new Map();

    const p = this;

    Ravel.prototype.getModels = function () {
      return p[instantiatedModels];
    };

    Ravel.prototype.getModel = function (key) {
      return p[instantiatedModels].get(key);
    };

    Ravel.prototype.sequelize = function () {
      return new Promise((resolve, reject) => {
        p.logger.debug('Attempting authentication against the database.');
        p.seq.authenticate()
          .then(() => {
            p.logger.debug('Synchronizing Sequelize with the database.');
            return p.seq.sync({
              force: false
            });
          })
          .then(() => {
            p.logger.debug('Sychronized.');
            resolve();
          })
          .catch(err => {
            p.logger.error(`Could not connect to Sequelize database: ${err.message}`);
            reject(new Error(`Could not connect to Sequelize database: ${err.message}.`));
          });
      });
    };

    Ravel.prototype.models = function (basePath) {
      p.logger.trace(`Add in all models from ${basePath}`);
      const absPath = upath.isAbsolute(basePath) ? basePath : upath.join(this.cwd, basePath);
      if (!fs.lstatSync(absPath).isDirectory()) {
        throw new this.ApplicationError.IllegalValue(
          "Base module scanning path '" + absPath + "' is not a directory.");
      } else {
        for (const file of recursive(absPath)) {
          if (upath.extname(file) === '.js') {
            // derive module name from filename, using subdirectories of basePath as namespacing
            const name = upath.trimExt(upath.normalize(file)).split('/').join('.');
            // declare module
            const nameAsKey = _.kebabCase(name);
            p.logger.trace(`Adding ${nameAsKey} to the list of models.`);
            p[uninstantiatedModels].set(nameAsKey, upath.join(absPath, file));
          }
        }
      }
    };
  }

  prelisten (ravelInstance) {
    // overlay user options onto defaults
    const opts = {};
    Object.assign(opts, DEFAULT_OPTIONS);
    Object.assign(opts, ravelInstance.get('sequelize options'));

    this.logger.debug('Instantiating Sequelize.');
    this.seq = new Sequelize(opts);

    if (this[uninstantiatedModels].size > 0) {
      for (const modelEntry of this[uninstantiatedModels].entries()) {
        const modelName = modelEntry[0];
        this.logger.debug(`Instantiating ${modelName}`);

        const absPath = modelEntry[1];
        const modelClass = require(absPath)(this.seq, Sequelize);
        this[instantiatedModels].set(modelName, modelClass);
      }
    }
  }

  end (ravelInstance) {
    if (this.seq) {
      this.seq.close();
    }
  }
}

module.exports = SequelizeConfigurator;
