'use strict';

const chai = require('chai');
const expect = chai.expect;
chai.use(require('chai-as-promised'));
chai.use(require('sinon-chai'));

const redis = require('redis-mock');
const mockery = require('mockery');
const sinon = require('sinon');
const upath = require('upath');

let Ravel, app, fs, stub;

describe('Ravel SequelizeProvider integration test', () => {
  beforeEach((done) => {
    process.removeAllListeners('unhandledRejection');
    // enable mockery
    mockery.enable({
      useCleanCache: true,
      warnOnReplace: false,
      warnOnUnregistered: false
    });

    fs = require('fs');
    mockery.registerMock('fs', fs);
    mockery.registerMock('fs-readdir-recursive', function (basePath) { // eslint-disable-line no-unused-vars
      return ['test.js'];
    });

    // scaffold basic Ravel app
    Ravel = require('ravel');

    mockery.registerMock('redis', redis);

    app = new Ravel();
    new (require('../lib/ravel-sequelize-provider'))(app); // eslint-disable-line new-cap, no-new
    app.set('log level', app.log.DEBUG);
    app.set('sequelize options', {
      username: 'ravel',
      password: 'ravel',
      port: 15432
    });
    app.set('keygrip keys', ['mysecret']);

    done();
  });

  afterEach((done) => {
    process.removeAllListeners('unhandledRejection');
    mockery.deregisterAll();
    mockery.disable();
    if (stub) {
      stub.restore();
    }
    done();
  });

  it('should expose models etc. from Sequelize to the app', () => {
    stub = sinon.stub(fs, 'lstatSync').callsFake(function () {
      return {
        isDirectory: function () { return true; }
      };
    });

    const TestModel = (sequelize, Sequelize) => {
      return sequelize.define('task', {
        title: Sequelize.STRING,
        description: Sequelize.TEXT,
        deadline: Sequelize.DATE
      });
    };

    mockery.registerMock(upath.join(app.cwd, './models/test.js'), TestModel);
    app.models('./models');
    app.init();
    app.emit('pre listen');

    return new Promise((resolve, reject) => {
      app.sequelize().then(() => {
        const models = app.getModels();
        expect(models).to.not.be.null;
        expect(models).to.have.a.property('size');
        expect(models.size).to.equal(1);
        app.close();
        resolve();
      }).catch((err) => {
        app.close();
        reject(err);
      });
    });
  });
});
