var getActualStep = require('./getActualStep.js'),
	StepDelay = require('./stepDelay.js'),
	xtend = require('xtend');

module.exports = function Debouncer(redis, prefix, constructorOptions) {
	var lock = require('redis-lock')(redis),
		stepDelay = StepDelay(constructorOptions.delayTimeMs);

	return function debouncer(key, callback) {
		key = prefix+key;
		lock(key+'Lock', function(done) {
			var cb = function () {
				done(); // done, release lock
				callback.apply(null, arguments)
			}
			redis.get(key, function (err, stepInfo) {
				if (err) { //error 
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
						redis.set(key, JSON.stringify(stepInfo), function (err) {
							err? cb(err) : cb(null, true)
						})
					} else {
						cb(null, false, stepInfo.lastStepTime + waitMs - currentTime) //Unsuccessful
					}
				}
			})
		});
	}
}