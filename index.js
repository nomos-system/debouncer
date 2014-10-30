var getActualStep = require('./getActualStep.js')
var StepDelay = require('./stepDelay.js')
var xtend = = require('util')._extend

module.exports = function Debouncer(redis, prefix, constructorOptions) {
	var lock = require('redis-lock')(redis);
	var debouncerDatabase = redis
	var stepDelay = StepDelay(constructorOptions.delayTimeMs)

	return function debouncer(key, callback) {
		key = prefix+key;
		lock(key+'Lock', function(done) {
			var cb = function () {
				callback.apply(null, arguments)
			}
			debouncerDatabase.get(key, function (err, stepInfo) {
				if (err && !err.notFound) { //error and found the key
					cb(err)
				} else {
					try { stepInfo = JSON.parse(stepInfo) } catch (e) {}
					stepInfo = xtend({
						lastStepTime: new Date().getTime(),
						step: 0
					}, stepInfo)

					var currentTime = new Date().getTime()
					stepInfo.step = getActualStep(stepDelay, stepInfo.step, stepInfo.lastStepTime, currentTime)
					var waitMs = stepDelay(stepInfo.step)

					if (currentTime >= stepInfo.lastStepTime + waitMs) {
						stepInfo.lastStepTime = currentTime
						stepInfo.step++
						debouncerDatabase.set(key, JSON.stringify(stepInfo), function (err) {
							err? cb(err) : cb(null, true)
						})
					} else {
						cb(null, false, stepInfo.lastStepTime + waitMs - currentTime) //Unsuccessful
					}
				}
			})
			
			// done, release lock
			done();
		});
	}
}
