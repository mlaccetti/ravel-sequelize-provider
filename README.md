# ravel-sequelize-provider

> Ravel Sequelize Provider

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/raveljs/ravel-sequelize-provider/master/LICENSE) [![npm version](https://badge.fury.io/js/ravel-sequelize-provider.svg)](http://badge.fury.io/js/ravel-sequelize-provider) [![Dependency Status](https://david-dm.org/raveljs/ravel-sequelize-provider.svg)](https://david-dm.org/raveljs/ravel-sequelize-provider) [![npm](https://img.shields.io/npm/dm/ravel.svg?maxAge=2592000)](https://www.npmjs.com/package/ravel) [![Build Status](https://travis-ci.org/raveljs/ravel-sequelize-provider.svg?branch=master)](https://travis-ci.org/raveljs/ravel-sequelize-provider) [![Code Climate](https://codeclimate.com/github/raveljs/ravel-sequelize-provider/badges/gpa.svg)](https://codeclimate.com/github/raveljs/ravel-sequelize-provider) [![Test Coverage](https://codeclimate.com/github/raveljs/ravel-sequelize-provider/badges/coverage.svg)](https://codeclimate.com/github/raveljs/ravel-sequelize-provider/coverage)

`ravel-sequelize-provider` is a `DatabaseProvider` for Ravel, wrapping the powerful node [mysql](https://github.com/mysqljs/mysql) library. It supports connection pooling as well as Ravel's [transaction system](http://raveljs.github.io/docs/latest/db/decorators/transaction.js.html) (including rollbacks).

## Example usage:

### Step 1: Import and instantiate the SequelizeProvider

*app.js*
```javascript
const app = new require('ravel')();
const SequelizeProvider = require('ravel-sequelize-provider');
new SequelizeProvider(app);

// load all model files
app.models('./models');

// ... other providers and parameters
app.modules('./modules');
app.resources('./resources');
// ... the rest of your Ravel app
app.init();
app.listen();
```

### Step 2: Access models via `app.getModel`

*resources/posts_resource.js*
```javascript
const Ravel = require('ravel');
const Resource = Ravel.Resource;
const transaction = Resource.transaction;

class PostsResource extends Resource {
  constructor() {
    super('/posts');
  }

  /**
   * Retrieve a single post
   */
  get(ctx) {
    // Best practice is to pass the transaction object through to a Module, where you handle the actual business logic.
    return this.app.getModel('posts').findAll().then((posts) => {
      ctx.body = posts;
    });
  }
}
```

### Step 3: Configuration

Requiring the `ravel-sequelize-provider` module will register a configuration parameter with Ravel which must be supplied via `.ravelrc` or `app.set()`:

*.ravelrc*
```json
{
  "sequelize options": {
    "dialect": "postgres",
    "host": "localhost",
    "port": 5432,
    "username": "",
    "password": "",
    "database": "ravel"
  }
}
```
