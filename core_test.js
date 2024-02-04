/*
 * core_test.js -- core.js unit tests
 *
 * author: Dale Schumacher <dale.schumacher@gmail.com>
 */

import core from "./core.js";
import Test from "./test.js";

var testSuite = function (callback) {
	var suite = Test.Suite();
	var test = suite.test;
	var fail = suite.fail;
	var assertEqual = suite.assertEqual;
	var id = core.id;
    var equal = core.equal;
	var Dictionary = core.Dictionary;
	var Set = core.Set;
	var Queue = core.Queue;
	var HtmlBuilder = core.HtmlBuilder;

	test('assert/fail', function () {
		assertEqual(0, 0);
//		assertEqual(0, 1);
//		fail('Throw expected');
		assertEqual('xyzzy', 'xyzzy');
		assertEqual(true, ('xyzzy' === 'xyzzy'));
	});
	test('equality', function () {
		var x, y, z;
		
		x = 42;
		y = x;
		z = 42;
		assertEqual(true, (x === y), 'x === y  // number');
		assertEqual(true, (y === z), 'y === z  // number');
		assertEqual(true, (z === x), 'z === x  // number');
		x = 'ECMA';
		y = x;
		z = 'Standard ECMAScript'.slice(9, 13); //'ECMA';
		assertEqual(true, (x === y), 'x === y  // string');
		assertEqual(true, (y === z), 'y === z  // string');
		assertEqual(true, (z === x), 'z === x  // string');
		x = {};
		y = x;
		z = {};
		assertEqual(true, (x === y), 'x === y  // object');
		assertEqual(false, (y === z), 'y === z  // object');
		assertEqual(false, (z === x), 'z === x  // object');
		assertEqual(true, equal(x, y), 'equal(x, y)  // object');
		assertEqual(false, equal(y, z), 'equal(y, z)  // object');
		assertEqual(false, equal(z, x), 'equal(x, y)  // object');
		x = Dictionary({});
		y = x;
		z = Dictionary({});
		assertEqual(true, (x === y), 'x === y  // Dictionary');
		assertEqual(false, (y === z), 'y === z  // Dictionary');
		assertEqual(false, (z === x), 'z === x  // Dictionary');
		assertEqual(true, equal(x, y), 'equal(x, y)  // Dictionary');
		assertEqual(true, equal(y, z), 'equal(y, z)  // Dictionary');
		assertEqual(true, equal(z, x), 'equal(x, y)  // Dictionary');
	});
	test('Core extensions', function () {
		var a = { a:1 };
		var b = { b:function () { return 2; } };
		var y = 'y';
		var XX = function () { this.x = y; };
		var yy = { y:-1 };
		var ts = function plugh() { return 'xyzzy'; }
		var o, oo, x;
		
		o = Object.create(b);
		assertEqual(undefined, o.prototype, 'Object.create(b).prototype');
		assertEqual(true, ("b" in o), '"b" in o');
		assertEqual(false, o.hasOwnProperty("b"), 'o.hasOwnProperty("b")');

		XX.method('y', function () { return this.x; });
		XX.override('toString', ts);
		o = new XX();
		assertEqual(undefined, o.prototype, 'new XX().prototype');
		assertEqual(true, "x" in o, '"x" in o');
		assertEqual(true, o.hasOwnProperty("x"), 'o.hasOwnProperty("x")');
		assertEqual(true, "y" in o, '"y" in o');
		assertEqual(false, o.hasOwnProperty("y"), 'o.hasOwnProperty("y")');
		assertEqual(true, "toString" in o, '"toString" in o');
		assertEqual(false, o.hasOwnProperty("toString"), 'o.hasOwnProperty("toString")');
		assertEqual(ts, o.toString, 'o.toString');
		
		o = Object.create(b);
		x = 'all';
		o.a = x;
		oo = {a:'foo', b:'bar', c:'baz'};
		Object.extend(o, oo);
		assertEqual(oo.a, o.a, 'extend.copyAll[a]');
		assertEqual(oo.b, o.b, 'extend.copyAll[b]');
		assertEqual(oo.c, o.c, 'extend.copyAll[c]');
		
		o = Object.create(b);
		x = 'write';
		o.a = x;
		oo = {a:'foo', b:'bar', c:'baz'};
		Object.extend(o, oo, Object.extend.noOverwrite);
		assertEqual(x, o.a, 'extend.noOverwrite[a]');
		assertEqual(oo.b, o.b, 'extend.noOverwrite[b]');
		assertEqual(oo.c, o.c, 'extend.noOverwrite[c]');
		
		o = Object.create(b);
		x = 'ride';
		o.a = x;
		oo = {a:'foo', b:'bar', c:'baz'};
		Object.extend(o, oo, Object.extend.noOverride);
		assertEqual(x, o.a, 'extend.noOverride[a]');
		assertEqual(b.b, o.b, 'extend.noOverride[b]');
		assertEqual(oo.c, o.c, 'extend.noOverride[c]');
		
		o = Object.create(b);
		x = 'own';
		o.a = x;
		oo = new XX();
		Object.extend(o, oo, Object.extend.ownProperties);
		assertEqual(x, o.a, 'extend.ownProperties[a]');
		assertEqual(b.b, o.b, 'extend.ownProperties[b]');
		assertEqual(undefined, o.c, 'extend.ownProperties[c]');
		assertEqual(oo.x, o.x, 'extend.ownProperties[c]');
		
		x = function X() { XX.call(this); this.z = yy; }.subclass(XX);
		assertEqual(XX, x.superclass, 'X.subclass(XX).superclass');
		assertEqual(false, x.prototype === XX.prototype, 'subclass has own prototype');
		o = new x();
		assertEqual(y, o.x, '(new X()).x');
		assertEqual(XX.prototype.y, o.y, '(new X()).y');
		assertEqual(yy, o.z, '(new X()).z');
	});
	test('Set', function () {
		var S = Set();
		
		assertEqual('function', typeof Set.class, 'Set.class');
		assertEqual(Set.class, S.constructor, 'S.constructor');
		assertEqual(0, S.cardinality(), '{}.cardinality()');
		assertEqual(false, S.contains(1), '{}.contains(1)');
		assertEqual(true, S.add(1).contains(1), '{}.add(1).contains(1)');
		assertEqual(1, S.cardinality(), '{1}.cardinality()');
		assertEqual(true, S.contains(1), '{1}.contains(1)');
		assertEqual(true, S.add(0).contains(1), '{1}.add(0).contains(1)');
		assertEqual(2, S.cardinality(), '{1,0}.cardinality()');
		assertEqual(true, S.contains(0), '{1,0}.contains(0)');
		S.add(1);
		assertEqual(2, S.cardinality(), '{1,0}.cardinality() #2');
		assertEqual([1,0].toString(), S.forEach().toString(), '{1,0}.forEach()');
		assertEqual([-1,0].toString(), S.forEach(function (item, acc) {
			acc.push(-item);
			return acc;
		}).toString(), '{1,0}.forEach(negate)');
		assertEqual(3, S.forEach(function (item, acc) {
			return acc + item;
		}, 2), '{1,0}.forEach(sum, 2)');
		assertEqual(true, S.add(2).contains(1), '{}.add(2).contains(2)');
		assertEqual(2, S.remove(2).cardinality(), '{1,0,2}.remove(2).cardinality');
		assertEqual(true, S.contains(1), '{1,0}.contains(1) // pre-remove');
		assertEqual(false, S.remove(1).contains(1), '{1,0}.remove(1).contains(1)');
		assertEqual(true, S.contains(0), '{0}.contains(0) // pre-remove');
		assertEqual(false, S.remove(0).contains(0), '{0}.remove(0).contains(0)');
		assertEqual(0, S.cardinality(), '{}.cardinality() #2');
	});
	test('Queue', function () {
		var Q = Queue();
		
		assertEqual('function', typeof Queue.class, 'Queue.class');
		assertEqual(Queue.class, Q.constructor, 'Q.constructor');
		assertEqual(0, Q.size(), '[].size()');
		assertEqual(1, Q.put(1).size(), '[].put(1).size()');
		assertEqual(2, Q.put(2).size(), '[1].put(2).size()');
		assertEqual(3, Q.put(5).size(), '[1,2].put(5).size()');
		assertEqual(1, Q.take(), '[1,2,5].take()');
		assertEqual(3, Q.put(3).size(), '[2,5].put(3).size()');
		assertEqual('[2,5,3]', Q.toString(), '[2,5,3].toString()');
		assertEqual([2,5,3].toString(), Q.forEach().toString(), '[2,5,3].forEach()');
		assertEqual(2, Q.take(), '[2,5,3].take()');
		assertEqual(5, Q.take(), '[5,3].take()');
		assertEqual(3, Q.take(), '[3].take()');
		assertEqual(0, Q.size(), '[].size()');
		assertEqual(undefined, Q.take(), '[].take()');
		assertEqual(1, Q.put(4).size(), '[].put(4).size()');
		assertEqual(4, Q.take(), '[4].take()');
	});
	test('HtmlBuilder', function () {
		var r, p, c;
		
		r = HtmlBuilder();
		assertEqual(undefined, r.parent, 'root parent');
		assertEqual(undefined, r.node, 'root node');

		c = r.text('sample');
		assertEqual(r, c.parent, 'text.parent');
		assertEqual('object', typeof c.node, 'text.node');

		c = r.div({ 'class':'section' });
		assertEqual(r, c.parent, 'div.parent');
		assertEqual('object', typeof c.node, 'div.node');

		p = c;
		c = p.span();
		assertEqual(p, c.parent, 'span.parent');
		assertEqual('object', typeof c.node, 'span.node');
		
		p = HtmlBuilder(id('log'));
//		c = p.text('HtmlBuilder!\n');
		c = p.text(new Date() + "\n");
		assertEqual(p, c.parent, '#log.text.parent');
		assertEqual('object', typeof c.node, '#log.text.node');
		
	});
	return suite.getResult(callback);
};

var run_tests = function () {
	var log = core.log;  // log to info channel

	log('DALNEFRE(core) v' + core.version);
	testSuite(function (result) {
		log(result.formatted('Core suite: '));
	});
};

export default Object.freeze({testSuite, run_tests});
