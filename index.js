var Influx = require('influx')
var extend = require('obj-extend');
var events = require('events')

// Call the import to instantiate a middleware (req, res, next) 
// function that logs response time to InfluxDB
module.exports = function expressInfluxInit (options) {
  // Default Influx connection settings
  var clientDefaults = {
    protocol: "http",
    host: "localhost",
    port: 8086,
    database: "node",
    username: "",
    password: "",
    batchSize: 2,
    measurement: "requests"
  } 
  
  // This is a convinence function for creating the InfluxDB connection string
  var influxURL = function (options) {
    if (options.username && options.password) {
      return (options.protocol + "://" + options.username + ":" + options.password + "@" + options.host + ":" + options.port + "/" + options.database)
    }
    return (options.protocol + "://" + options.host + ":" + options.port + "/" + options.database)
  }
  
  // Merge user options into the defaults and create client
  options = extend(clientDefaults, options)
  var client = new Influx.InfluxDB(influxURL(options))
  
  // Create batcher
  var batch = new events.EventEmitter();
  batch.points = [];
  
  // When each point is added check the size of the batch and send if >= batchSize
  var writePoints = function () {
    var len = this.points.length
    
    // Check the length of the point buffer
    if (len >= options.batchSize) {  
      // Write the points and log error if any
      client.writePoints(this.points).catch(function (error) {
        console.log(error.message)
      })
      
      // Reset point buffer
      this.points = []
    }
  }
  
  // Set event listener
  batch.on("addPoint", writePoints);
  
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
        measurement: options.measurement,
        "tags": {
          "path": req.path,
          "host": req.hostname,
          "verb": req.method,
          "status": res.statusCode,
        },
        "fields": {
          "responseTime": responseTime,
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
