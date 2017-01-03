var express = require('express')
var Influx = require('influx')
var extend = require('obj-extend');
var events = require('events')

// TODO: Remove
var app = express()

var clientDefaults = {
  protocol: "http",
  host: "localhost",
  port: 8086,
  database: "node",
  username: "",
  password: "",
  batchSize: 2,
} 

var influxURL = function (options) {
  if (options.username && options.password) {
    return (options.protocol + "://" + options.username + ":" + options.password + "@" + options.host + ":" + options.port + "/" + options.database)
  }
  return (options.protocol + "://" + options.host + ":" + options.port + "/" + options.database)
}

var influxExpress = function expressInfluxInit (options) {
  // Merge user options into the defaults and create client
  options = extend(clientDefaults, options)
  var client = new Influx.InfluxDB(influxURL(options))
  
  // Create batcher
  var batch = new events.EventEmitter();
  batch.points = [];
  
  // When each point is added check the size of the batch and send if >= batchSize
  var checkBatch = function () {
    var len = this.points.length
    if (len >= options.batchSize) {
      // Write the points and log error if any
      client.writePoints(this.points).then(function (res) {
        console.log(`wrote ${len} points`)
      }).catch(function (error) {
        console.log(error.message)
      })
      this.points = []
    }
  }
  
  // Set event listener
  batch.on("addPoint", checkBatch);
  
  // Express Middleware
  return function expressInflux (req, res, next) {
    // Start request timer
    req.start = Date.now()

    // Make line protocol point and add to batcher
    function makePoint() {
      // Pull start time from req and log responseTime
      var responseTime = Date.now() - req.start;
      
      // Add the new point to the batch of points
      batch.points.push({
        measurement: "requests",
        "tags": {
          "path": req.path,
          "app": req.app.locals.title,
          "host": req.hostname,
          "verb": req.method,
        },
        "fields": {
          responseTime: responseTime,
        },
      })
      
      // Emit the 'addPoint' event
      batch.emit("addPoint")
    }

    // Function to clean up the listeners we've added
    function cleanup() {
      res.removeListener('finish', makePoint);
      res.removeListener('error', cleanup);
      res.removeListener('close', cleanup);
    }

    // Add response listeners
    res.once('finish', makePoint);
    res.once('error', cleanup);
    res.once('close', cleanup);

    if (next) {
      next();
    }
  };
};


// #####################################
// # FOR TESTING REMOVE BEFORE PUBLISH #
// #####################################
app.use(influxExpress())

app.get('/', function (req, res) {
  res.send('Hello World!')
})

console.log("app listening")
app.listen(3000)