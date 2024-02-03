/*
 * actor_test.js -- actor.js unit tests
 *
 * author: Dale Schumacher <dale.schumacher@gmail.com>
 */

 import core from "./core.js";
 import Actor from "./actor.js";
 import Test from "./test.js";

function testSuite (callback) {
	var log = core.trace;  // log to trace channel
	var trace = core.trace;
	var Dictionary = core.Dictionary;
	var Config = Actor.Config;
	var suite = Test.Suite();
	var asyncTest = function (name, test_fn) {
		suite.asyncTest(name, function () {
			log('... '+name+' ...');
			test_fn();
		});
	};
	var asyncWait = suite.asyncWait;
	var asyncDone = suite.asyncDone;
	var test = function (name, test_fn) {
		suite.test(name, function () {
			log('--- '+name+' ---');
			test_fn();
		});
	};
	var fail = suite.fail;
	var assertEqual = suite.assertEqual;

	var assert_fail_beh = function (msg) {
		fail('assert_fail_beh');
	};
	var assert_end_beh = function (end) {
		return function (msg) {
			assertEqual(end, msg, 'assert_end_beh');
			this.become(assert_fail_beh);
		};
	};
	var assert_equal_beh = function (expect, next) {
		return function (actual) {
			assertEqual(expect, actual);
			this.become(next);
		};
	};

	test('create Config', function () {
		var cfg = Config();

		assertEqual(true, cfg.sink.isActor, 'cfg.sink.isActor');
	});
	test('actor basics', function () {
		var cfg = Config();
		var actor;
		
		assertEqual(0, cfg.pending(), 'no messages in initial config');
		actor = cfg.create();  // create default (sink) actor
		assertEqual(true, actor.isActor, 'run-time type indicator');
		cfg.send('Hello', actor);  // imperative send
		assertEqual(1, cfg.pending(), 'first message queued for dispatch');
		actor.send('World');  // object-oriented send
		assertEqual(2, cfg.pending(), 'second message queued for dispatch');
		assertEqual(true, cfg.dispatch(), 'first message delivered');
		assertEqual(true, cfg.dispatch(), 'second message delivered');
		assertEqual(false, cfg.dispatch(), 'all messages delivered');
		assertEqual(0, cfg.pending(), 'no more message to dispatch');
	});
	test('single message', function () {
		var self = this;
		var cfg = Config();
		var mock = cfg.create(
			assert_equal_beh(
				'single', 
				assert_end_beh(self)
			)
		);

		// test behavior
		cfg.send('single', mock);
		assertEqual(1, cfg.pending(), 'pending before');
		while (cfg.dispatch())
			;
		assertEqual(0, cfg.pending(), 'pending after');
		// verify mock
		cfg.send(self, mock);
		assertEqual(true, cfg.dispatch(), 'end mock');
		assertEqual(false, cfg.dispatch(), 'end config');
	});
	test('observer pattern', function () {
		var subject_beh = Actor.subject_beh;
		var cfg = Config();
		var a, b, c, s;
		var observer_beh = function (label) {
			return function (msg) {
				trace('observer[' + label +']: ' + msg);
			};
		};
		
		a = cfg.create(observer_beh('a'));
		b = cfg.create(observer_beh('b'));
		c = cfg.create(observer_beh('c'));
		s = cfg.create(subject_beh());
		s.send(Dictionary({ op:'attach', observer:a }));
		s.send(Dictionary({ op:'attach', observer:b }));
		s.send(Dictionary({ op:'attach', observer:c }));
		s.send(Dictionary({ op:'notify', event:'Ping!' }));
		assertEqual(4, cfg.pending(), 'pending before');
		while (cfg.dispatch())
			;
		assertEqual(0, cfg.pending(), 'pending after');
	});
	asyncTest('delay timer', function () {
		var sink_beh = Actor.sink_beh;
		var cfg = Config();
		var delay_beh = function (delay, target) {
			return function (msg) {
				setTimeout(function () {
					log('AFTER ' + delay + ' SEND (' + msg + ') TO ' + target);
					cfg.send(msg, target);
				}, delay);
			};
		};
		var done = false;
		var countdown_beh = function (count) {
			return function (msg) {
				trace('countdown: ' + count);
				if (count > 0) {
					--count;
					this.become(countdown_beh(count));
					this.send(msg,
						this.create(delay_beh(337, this.self)));
				} else {
					done = true;
					this.become(sink_beh);
				}
			};
		};
		var timer_dispatch = function () {
			trace('timer_dispatch: ' + cfg);
			while (cfg.dispatch())
				;
			if (!done) {
				trace('timer_dispatch: waiting...');
				setTimeout(timer_dispatch, 144);
			} else {
				trace('timer_dispatch: done!');
				asyncDone();
			}
		};

		cfg.create(countdown_beh(5)).send('tick');
		timer_dispatch();
		asyncWait();
	});
	asyncTest('run/halt', function () {
		var sink_beh = Actor.sink_beh;
		var cfg = Config();
		var countdown_beh = function (count) {
			return function (msg) {
				trace('countdown: ' + count);
				if (count > 0) {
					--count;
					this.become(countdown_beh(count));
					this.sendAfter(400, count, this.self);
				} else {
					trace('countdown: done!');
					cfg.halt();
					this.become(sink_beh);
					asyncDone();
				}
			};
		};

		cfg.create(countdown_beh(3)).send(3);
		cfg.run();
		asyncWait();
	});
	return suite.getResult(callback);
};

function run_tests() {
	var log = core.log;  // log to info channel

	log('core(Actor) v' + Actor.version);
	testSuite(function (result) {
		log(result.formatted('Actor suite: '));
	});
};

export default Object.freeze({testSuite, run_tests});
