/*
 * actor.js -- Actor library
 *
 * author: Dale Schumacher <dale.schumacher@gmail.com>
 * website: dalnefre.com
 */

 import core from "./core.js";

var version = '0.8.1 2024-02-03';
var log = core.log;
var debug = core.debug;
//	var trace = function (msg) { /*disabled*/ };
var trace = core.trace;
var xtrace = function (msg) { /*disabled*/ };
//	var xtrace = core.trace;
var Dictionary = core.Dictionary;
var Set = core.Set;
var Queue = core.Queue;

// actor behavior library
var sink_beh = function (msg) {};  // default no-op behavior
var subject_beh = function (observerSet) {
	observerSet = observerSet || Set();
	return function (msg) {
		if (msg.op === 'notify') {
			this.send(observerSet,
				this.create(broadcast_beh(msg.event)));
		} else if (msg.op === 'attach') {
			observerSet.add(msg.observer);
		} else if (msg.op === 'detach') {
			observerSet.remove(msg.observer);
		} else {
			debug('subject_beh: DOES NOT UNDERSTAND ' + msg);
		}
	};
};
var broadcast_beh = function (event) {
	return function (observerSet) {
		observerSet.forEach(function (observer) {
			observer.send(event);
		});
	};
};

var Config = (function () {  // Actor Configuration
	var factory;
	var constructor = function Config() {
		var cfg = this;  // lexical capture
		var Actor = function (beh, id, name) {  // private Actor class
			this.isActor = true;
			this.self = this;
			this.behavior = beh;
			this.id = id;
			this.name = name;
		}
		.method('create', function (beh, name) {
			name = name || cfg.actors.cardinality();
			return cfg.create(beh, this.name + '~' + name);
		})
		.method('send', function (msg, actor) {
			return cfg.send(msg, actor || this);
		})
		.method('sendAfter', function (delay, msg, actor) {
			return cfg.sendAfter(delay, msg, actor || this);
		})
		.method('become', function (beh, name) {
			if (typeof beh !== 'function') {
				throw Error('Actor.become() requires a function, beh: '+beh);
			}
			this.behavior = beh;
			return this.rename(name);
		})
		.method('rename', function (name) {
			this.name = name || this.name;
			return this;
		})
		.override('toString', function () {
			return '<Actor:' + this.name + '.' + this.id + '>';
		});
		var create = function (beh, name) {
			var id = cfg.actors.cardinality();
			if (typeof beh !== 'function') {
				beh = sink_beh;  // default no-op behavior
			}
			name = name || id;
			var self = new Actor(beh, id, name);
			trace('create: ' + self);
			cfg.actors.add(self);
			return self;
		};

		Dictionary.class.call(this);  // init superclass
		this.isConfig = true;
		this.messages = Queue();
		this.actors = Set();
		this.timer = null;
		this.period = 60;  // default 60ms
		this.paused = false;
		this.create = create;
		this.sink = create(sink_beh, '_');  // no-op actor
	}
	.subclass(Dictionary.class)
	.method('send', function (msg, actor) {
		var item;

		if ((typeof actor !== 'object') || !actor.isActor) {
			throw Error('Config.send() requires an actor target, to: '+actor);
		}
		item = Dictionary({msg: msg, to: actor});
		trace('send: ' + item);
		this.messages.put(item);
		this.resume();
	})
	.method('sendAfter', function (delay, msg, actor) {
		var cfg = this;

		setTimeout(function () {
			trace('after: ' + delay + ' ...');
			cfg.send(msg, actor);
		}, delay);
	})
	.method('dispatch', function () {
		var item = this.messages.take();

		if (item) {
			trace('dispatch: ' + item + ' ... ' + this.messages);
			item.to.behavior(item.msg);
			return true;
		}
		return false;
	})
	.method('dispatchLoop', function (limit) {
		var count = 0;

		limit = limit || 1;
		while ((count < limit) && this.dispatch()) {
			count += 1;
		}
		return count;
	})
	.method('run', function (period) {
		var cfg = this;
		var tick = function () {
			var count;

			// deliver up to 144 messages each tick
			count = cfg.dispatchLoop(144);
			xtrace('tick: count = ' + count);
			if (count === 0) {
				cfg.pause();
			}
		};

		this.period = period || this.period;
		if (this.timer) {
			this.halt();
		}
		this.paused = false;
		this.timer = setInterval(tick, this.period);
		xtrace('run: running@' + this.period + '...');
	})
	.method('halt', function () {
		if (this.timer) {
			clearInterval(this.timer);
		}
		this.timer = null;
		xtrace('halt: halted...');
	})
	.method('pause', function () {
		if (this.timer) {
			this.halt();
			this.paused = true;
			xtrace('pause: paused = ' + this.paused);
		}
	})
	.method('resume', function (period) {
		if (this.paused) {
			this.run(period);
			this.paused = false;
			xtrace('resume: paused = ' + this.paused);
		}
	})
	.method('pending', function () {
		return this.messages.size();
	})
	.override('toString', function () {
		return '<Config: '
			+ 'messages=' + this.messages + ', '
			+ 'actors=' + this.actors + '>';
	});

	factory = function (data) {
		var self = new constructor(data);

		self.constructor = constructor;
		return self;
	};
	factory.class = constructor;
	return factory;
})();

export default Object.freeze({
	sink_beh,
	subject_beh,
	Config,
	version
});
