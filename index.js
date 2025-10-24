var getActualStep = require('./getActualStep.js'),
	StepDelay = require('./stepDelay.js');

module.exports = function Debouncer(redis, options, constructorOptions) {
	options = Object.assign({
		prefix: '',
		ttl: 1800
	}, options)

	var lock = require('redis-lock')(redis),
		stepDelay = StepDelay(constructorOptions.delayTimeMs);

	return function debouncer(key, callback) {
		key = options.prefix+key;
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
					if(stepInfo === null) { // init on first usage
						stepInfo = {	
							lastStepTime: 0,
							step: 0
						};
					}
					stepInfo = Object.assign({
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
							if(!err) {
								redis.expire(key, options.ttl);
								cb(null, true);
							}
							else {
								cb(err);
							}
						})
					} else {
						cb(null, false, stepInfo.lastStepTime + waitMs - currentTime) // Unsuccessful
					}
				}
			})
		});
	}

}
