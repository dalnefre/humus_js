/*
 * test.js -- JavaScript Unit Testing Framework
 *
 * author: Dale Schumacher <dale.schumacher@gmail.com>
 * requires: core.js
 */

if (typeof DALNEFRE === 'undefined') {
	throw Error('Namespace "DALNEFRE" required!');
}
if (typeof DALNEFRE.Test !== 'undefined') {
	throw Error('Namespace "DALNEFRE.Test" already defined!');
}

DALNEFRE.Test = (function (self) {
	var version = '0.4.2 2011-01-13';
	var DAL = DALNEFRE;  // shorter alias
    var equal = DAL.equal;
	var log = DAL.debug;  // log messages to debug channel
	var Dictionary = DAL.Dictionary;
	var Queue = DAL.Queue;
	var Suite = function () {
		var running = undefined;
		var pending = Queue();
		var onComplete = null;
		var result = Dictionary({
			passed: 0, 
			failed: 0, 
			failures: [],
			elapsed: 0,
			formatted: function (report) {
				report = report || '';
				report += this.passed + ' passed, ';
				report += this.failed + ' failed, ';
				report += this.elapsed + 'ms elapsed.';
				if (this.failed > 0) {
					report += "\n";
					report += this.failures.join("\n");
				}
				return report;
			}
		});
		var dispatch = function () {
			if (!running) {
				running = pending.take();
//				log('dispatch: running=' + running);
				if (typeof running === 'undefined') {
					// test run completed...
					result.elapsed = (+(new Date()) - result.elapsed);
					if (onComplete) {
						onComplete(result);
					}
				} else if (typeof running === 'function') {
					running = Dictionary({
						label: 'test: ',
						status: undefined,
						timer: null,
						msg: 'FAIL!',
						onResult: function () {
							var msg;

//							log('onResult: running=' + running);
							if (running.status) {
								result.passed += 1;
							} else {
								msg = running.label + running.msg;
								log(msg);
								result.failures.push(msg);
								result.failed += 1;
							}
							running = undefined;
							dispatch();
//							log('<onResult');
						},
						test_fn: running
					});
					running.test_fn();
				}
			}
//			log('<dispatch');
		};
		var enqueue = function (fn) {
			pending.put(fn);
		};
		var test = function (label, test_fn) {
//			log('enqueue test: ' + label);
			enqueue(function () {
				runTest(label, test_fn);
				asyncDone();
			});
		};
		var asyncTest = function (label, test_fn) {
//			log('enqueue asyncTest: ' + label);
			enqueue(function () {
				runTest(label, test_fn);
			});
		};
		var asyncWait = function (timeout) {
			timeout = timeout || 6000;  // default timeout: 6 seconds
//			log('asyncWait: timeout=' + timeout);
			if (running) {
				running.timer = setTimeout(function () {
					fail('TIMEOUT! (' + timeout + ')');
				}, timeout);
			}
		};
		var asyncDone = function () {
//			log('asyncDone: running=' + running);
			if (running) {
				if (running.timer) {
					clearTimeout(running.timer);
					running.timer = null;
				}
				if (running.status === undefined) {
					running.status = true;
				}
				running.onResult();
			}
		};
		var runTest = function (label, test_fn) {
			if (typeof label === 'function') {  // make 'label' optional
				test = label;
				label = 'test';
			}
//			log('runTest: ' + label);
			label += ': ';
			running.label = label;
			try {
				test_fn();
			} catch (e) {
				fail('Caught, ' + e);
			}
		};
		var fail = function (msg) {
			msg = msg || 'FAIL!';
			if (running) {
				running.status = false;
				running.msg = msg;
				running.onResult();
			} else {
				throw msg;
			}
		};
		var assertEqual = function (expected, actual, msg) {
			if (!equal(expected, actual)) {
				msg = msg || 'assertEqual FAIL!';
				fail(msg + ' expected=' + expected + ' actual=' + actual);
			}
			return true;
		};
		var getResult = function (callback) {
			// start test run
			onComplete = function () {
//				log('>onComplete');
				if (callback) {
					callback(result);
				}
			};
			result.elapsed = +(new Date());
			dispatch();
//			log('<onComplete: result=' + result);
			return result;
		};
	
		return {
			test: test,
			asyncTest: asyncTest,
			asyncWait: asyncWait,
			asyncDone: asyncDone,
			fail: fail,
			assertEqual: assertEqual,
//			assertMatch: assertEqual,
			getResult: getResult
		};
	};

	self = {
		Suite: Suite,
		version: version
	};
	return self;
})();
