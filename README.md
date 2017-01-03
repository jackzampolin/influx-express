# Influx Express Middleware

This repository contains [express](https://expressjs.com/) [middleware](https://expressjs.com/en/guide/writing-middleware.html) for logging request and response metrics to InfluxDB.

### Usage

First add `influx-express` to your project:

```console
$ cd /path/to/node/project
$ npm install --save influx-express
```

To enable the express logging middleware do the following:

```js
var express = require('express')
var influxExpress = require('influx-express')
var app = express()

app.use(influxExpress())

app.get('/', function (req, res) {
  res.send('Hello World!')
})

app.listen(3000)
```

### Changing the client defaults

```js
var influxOpts = {
  protocol: "https",
  host: "fourbyfour-923ah8ar.influxcloud.net",
  port: 8086,
  database: "mydb",
  username: "myuser",
  password: "mypass",
  batchSize: 10,
}

app.use(influxExpress(influxOpts))
```

### Data

Currently this example implementation only gathers the following data. 
If you have some data you would like to see gathered by this plugin please open an issue.

```yaml
database: 'node'
  measurement: 'requests'
  tags:
    - path: req.path
    - host: req.hostname
    - verb: req.method
    - status: req.statusCode
  fields:
    - responseTime: req.startTime - res.finishTime
```