/*
 * hum_xlat.js -- Humus translator (source text -> generated code)
 *
 * author: Dale Schumacher <dale.schumacher@gmail.com>
 */

import core from "./core.js";
import Humus from "./humus.js";

var version = '0.8.1 2024-02-03';
//	var log = core.log;
//	var debug = function (msg) {
//		core.debug(msg);
//		core.trace('--?-- '+msg);
//	};
var trace = core.trace;
//	var xtrace = core.trace;
var xtrace = function (msg) {};  // ignored
var Dictionary = core.Dictionary;
//	var Set = core.Set;
//	var Queue = core.Queue;
var Msg = Dictionary;  // local alias
var HUM = Humus;
var UNDEF = HUM.UNDEF;
var NIL = HUM.NIL;
var Obj = HUM.Obj;
var Pr = HUM.Pr;

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

var factory;
var constructor = function Hum_Xlat(generator) {
	var GEN = generator;  // local alias
	var Actor = function Actor(beh, id) {
		return GEN.Actor(beh, id);
	};
	var const_expr_beh = GEN.const_expr_beh;
	var ident_expr_beh = GEN.ident_expr_beh;
	var abs_expr_beh = GEN.abs_expr_beh;
	var app_expr_beh = GEN.app_expr_beh;
	var pair_expr_beh = GEN.pair_expr_beh;
	var case_expr_beh = GEN.case_expr_beh;
	var case_choice_beh = GEN.case_choice_beh;
	var case_end_beh = GEN.case_end_beh;
	var if_expr_beh = GEN.if_expr_beh;
	var let_expr_beh = GEN.let_expr_beh;
	var block_expr_beh = GEN.block_expr_beh;
	var now_expr_beh = GEN.now_expr_beh;  // FIXME: non-standard extension
	var self_expr_beh = GEN.self_expr_beh;
	var new_expr_beh = GEN.new_expr_beh;
	var eqtn_beh = GEN.eqtn_beh;
	var const_ptrn_beh = GEN.const_ptrn_beh;
	var value_ptrn_beh = GEN.value_ptrn_beh;
	var ident_ptrn_beh = GEN.ident_ptrn_beh;
	var any_ptrn_beh = GEN.any_ptrn_beh;
	var pair_ptrn_beh = GEN.pair_ptrn_beh;
	var self_ptrn_beh = GEN.self_ptrn_beh;
	var empty_stmt_beh = GEN.empty_stmt_beh;
	var stmt_pair_beh = GEN.stmt_pair_beh;
	var def_stmt_beh = GEN.def_stmt_beh;
	var let_stmt_beh = GEN.let_stmt_beh;
	var send_stmt_beh = GEN.send_stmt_beh;
	var create_stmt_beh = GEN.create_stmt_beh;
	var become_stmt_beh = GEN.become_stmt_beh;
	var throw_stmt_beh = GEN.throw_stmt_beh;
	var expr_stmt_beh = GEN.expr_stmt_beh;
	var Scope = (function (self) {
		var factory;
		var constructor = function Scope(vars) {
			this.vars = vars || NIL;
		}
		.method('declare', function (ident) {
			this.vars = Pr(ident, this.vars);
		});

		factory = function (data) {
			var self = new constructor(data);

			self.constructor = constructor;
			return self;
		};
		factory.class = constructor;
		return factory;
	})();
	//
	// Tokenizer
	//
	var start = Obj({
		value: '<start>',
		type: 'control'
	});
	var end = Obj({
		value: '<end>',
		type: 'control'
	});
	var token = start;
	var tokens = [];
	var escape_map = {
		'b' : '\b',
		't' : '\t',
		'n' : '\n',
		'r' : '\r',
		'"' : '"',
		'\'' : '\'',
		'\\' : '\\'
	};
	var string_to_tuple = function (s) {
		if (s.length > 0) {
			if (s.charAt(0) === '\\') {
				var e = escape_map[s.charAt(1)] || s.charAt(1);

				return Pr(e.charCodeAt(0), string_to_tuple(s.substring(2)));
			}
			return Pr(s.charCodeAt(0), string_to_tuple(s.substring(1)));
		}
		return NIL;
	};
	var token_type = function (token) {
		var t = token.text;
		var r;
		var s;

		token.value = token.text;
		if ((r = /^(-?\d+)$/.exec(t))) {
			token.value = parseInt(r[1], 10);
			token.type = 'number';
		} else if ((r = /^(\d+)#(\w+)$/.exec(t))) {
			token.value = parseInt(r[2], r[1]);
			token.type = 'number';
		} else if ((r = /^'(\\.)'$/.exec(t))) {
			s = r[1];
			s = escape_map[s.charAt(1)] || s.charAt(1);
			token.value = s.charCodeAt(0);
			token.type = 'char';
		} else if ((r = /^'([^\\'])'$/.exec(t))) {
			token.value = r[1].charCodeAt(0);
			token.type = 'char';
		} else if ((r = /^"((\\.|[^\\"])*)"$/.exec(t))) {
			token.value = string_to_tuple(r[1]);
			token.type = 'string';
		} else if ((r = /^[#$(),.:;=\[\\\]λ]$/.exec(t))) {
			token.type = 'punct';
		} else {
			token.type = 'symbol';
		}
		return token;
	};
	var tokenize = function (line, lineno, ofs) {  // tokenize line, adding to tokens[]
		var s = line.slice();
		var p =
/(\s*)([#$(),.:;=\[\\\]λ]|'(\\.|[^\\'])'|"(\\.|[^\\"])*"|\d+#\w+|[^#$(),.:;=\[\\\]λ\s]+)/g
		var r;

		lineno = lineno || 0;
		s = s.replace(/#\s.*$/, '');  // strip comments
		s = s.replace(/#$/, '');
//			s = s.replace(/^\s+/, '');  // strip leading whitespace
		s = s.replace(/\s+$/, '');  // strip trailing whitespace
		p.lastIndex = 0;
		while ((r = p.exec(s))) {
			var t = r[2];
			var i = p.lastIndex;

			tokens.push(
				token_type(Obj({
					start_ofs: ofs + (i - t.length),
					end_ofs: ofs + i,
					lineno: lineno,
					start: i - t.length,
					end: i,
					space: r[1],
					text: t
				}))
			);
		}
	};
	var lookahead = function () {
		var t = tokens[0];

		if (t === undefined) {
			t = end;
		}
		return t;
	};
	var advance = function () {
		var t = lookahead();

		tokens.shift();
		token = t;
		xtrace('token: ' + token);
		return t;
	};
	var expect = function (match) {
		if (token.value !== match) {
			token.error(match + ' expected.');
		}
		advance();
	};
	var annotate = function (actor, debug) {
		if (typeof actor === 'object') {
			actor.debug = Obj(debug);
		}
		return actor;
	};
	//
	// Recognizers
	//
	var mk_stmt = function (scope) {
		var first = clone(token);
		var actor;

		if (token.value === 'DEF') {
			var ptrn, expr;

			advance();
			if ((token.type === 'symbol')
			 &&	(lookahead().value === '(')) {  // function definition -> rewrite
				var ident = token.value;

				advance();
				ptrn = mk_ptrn();
				expect('AS');
				expr = mk_expr();
				expr = Actor(abs_expr_beh(ptrn, expr), 'abs');
				ptrn = Actor(ident_ptrn_beh(ident), 'ptrn:'+ident);
				if (scope) {
					scope.declare(ident);
				}
			} else {
				ptrn = mk_ptrn(scope);
				expect('AS');
				expr = mk_expr();
			}
			actor = Actor(def_stmt_beh(ptrn, expr), 'DEF');
		} else if (token.value === 'LET') {
			var eqtn;

			advance();
			eqtn = mk_eqtn(scope);
			if (token.value === 'IN') { // special case for LET/IN expression
				var expr;

				advance();
				expr = mk_expr();
				return Actor(let_expr_beh(eqtn, expr), 'LET/IN');
			}
			actor = Actor(let_stmt_beh(eqtn), 'LET');
		} else if (token.value === 'SEND') {
			var m_expr, a_expr;

			advance();
			m_expr = mk_expr();
			expect('TO');
			a_expr = mk_expr();
			actor = Actor(send_stmt_beh(m_expr, a_expr), 'SEND');
		} else if (token.value === 'AFTER') {
			var t_expr, m_expr, a_expr;

			advance();
			t_expr = mk_expr();
			expect('SEND');
			m_expr = mk_expr();
			expect('TO');
			a_expr = mk_expr();
			actor = Actor(send_stmt_beh(m_expr, a_expr, t_expr), 'AFTER/SEND');
		} else if (token.value === 'CREATE') {
			var ident, b_expr;

			advance();
			ident = mk_ident();
			expect('WITH');
			b_expr = mk_expr();
			if (scope) {
				scope.declare(ident);
			}
			actor = Actor(create_stmt_beh(ident, b_expr), 'CREATE');
		} else if (token.value === 'BECOME') {
			var b_expr;

			advance();
			b_expr = mk_expr();
			actor = Actor(become_stmt_beh(b_expr), 'BECOME');
		} else if (token.value === 'THROW') {
			var e_expr;

			advance();
			e_expr = mk_expr();
			actor = Actor(throw_stmt_beh(e_expr), 'THROW');
		} else {
			var expr;

			expr = mk_expr();
			actor = Actor(expr_stmt_beh(expr), 'stmt:expr');
		}
		return annotate(actor, {
			first: first,
			last: clone(token)
		});
	};
	var mk_eqtn = function (scope) {
		var ident, left, right;

		if ((token.type === 'symbol')
		 &&	(lookahead().value === '(')) {  // function definition -> rewrite
			ident = token.value;
			advance();
			left = mk_ptrn();
			expect('=');
			right = mk_expr();
			right = Actor(abs_expr_beh(left, right), 'abs');
			right = Actor(value_ptrn_beh(right), 'ptrn:$');
			left = Actor(ident_ptrn_beh(ident), 'ptrn:'+ident);
			if (scope) {
				scope.declare(ident);
			}
		} else {
			left = mk_ptrn(scope);
			expect('=');
			right = mk_ptrn(scope);
		}
		return Actor(eqtn_beh(left, right), 'eqtn');
	};
	var mk_ptrn = function (scope) {
		var first = clone(token);
		var h_ptrn = mk_pterm(scope);
		var actor = h_ptrn;

		if (token.value === ',') {
			var t_ptrn;

			advance();
			t_ptrn = mk_ptrn(scope);
			actor = Actor(pair_ptrn_beh(h_ptrn, t_ptrn), 'ptrn:,');
		}
		return annotate(actor, {
			first: first,
			last: clone(token)
		});
	};
	var mk_pterm = function (scope) {
		var first = clone(token);
		var term;

		if (token.value === '_') {
			advance();
			term = Actor(any_ptrn_beh, 'ptrn:_');
		} else if (token.value === '$') {
			advance()
			term = mk_term();
			term = Actor(value_ptrn_beh(term), 'ptrn:$');
		} else if (is_const(token)) {
			term = mk_const_ptrn();
		} else if (token.type === 'symbol') {
			var ident = token.value;

			advance();
			if (scope) {
				scope.declare(ident);
			}
			term = Actor(ident_ptrn_beh(ident), 'ptrn:'+ident);
		} else if (token.value === '(') {
			advance();
			if (token.value === ')') {
				advance();
				term = Actor(const_ptrn_beh(NIL), 'ptrn:NIL');
			} else {
				term = mk_ptrn(scope);
				expect(')');
			}
		} else {
			token.error('Pattern expected.');
		}
		return annotate(term, {
			first: first,
			last: clone(token)
		});
	};
	var mk_const_ptrn = function () {
		var t = token.type;
		var v = token.value;

		if (t === 'number') {
			advance();
			return Actor(const_ptrn_beh(v), 'ptrn:'+v);
		}
		if (t === 'char') {
			advance();
			return Actor(const_ptrn_beh(v), 'ptrn:\''+v+'\'');
		}
		if (t === 'string') {
			advance();
			return Actor(const_ptrn_beh(v), 'ptrn:"'+v+'"');
		}
		if (v === '#') {
			var value = advance().value;

			advance();
			return Actor(const_ptrn_beh(value), 'ptrn:#'+value);
		}
		if ((v === '\\') || (v === 'λ')
		 || (v === '[')) {
			var expr = mk_const_expr();  // delegate to expression parser

			return Actor(value_ptrn_beh(expr), 'ptrn:$');
		}
		if (v === 'SELF') {
			return Actor(self_ptrn_beh, 'ptrn:SELF');
		}
		if (v === '?') {
			advance();
			return Actor(const_ptrn_beh(UNDEF), 'ptrn:?');
		}
		if (v === 'TRUE') {
			advance();
			return Actor(const_ptrn_beh(true), 'ptrn:TRUE');
		}
		if (v === 'FALSE') {
			advance();
			return Actor(const_ptrn_beh(false), 'ptrn:FALSE');
		}
		if (v === 'NIL') {
			advance();
			return Actor(const_ptrn_beh(NIL), 'ptrn:NIL');
		}
		token.error('Constant expected.');
	};
	var mk_expr = function () {
		var first = clone(token);
		var term, expr;

		if (token.value === 'LET') {
			var eqtn;

			advance();
			eqtn = mk_eqtn();
			expect('IN');
			expr = mk_expr();
			term = Actor(let_expr_beh(eqtn, expr), 'LET/IN');
		} else if (token.value === 'IF') {
			var eqtn, next;

			advance();
			eqtn = mk_eqtn();
			expr = mk_expr();
			next = mk_if_else();
			term = Actor(if_expr_beh(eqtn, expr, next), 'IF');
		} else if (token.value === 'CASE') {
			var next;

			advance();
			expr = mk_expr();
			expect('OF');
			next = mk_case_end();
			term = Actor(case_expr_beh(expr, next), 'CASE');
		} else {
			term = mk_term();
			if (token.value === ',') {
				var t_expr;

				advance();
				expr = mk_expr();
				term = Actor(pair_expr_beh(term, expr), 'expr:,');
			}
		}
		return annotate(term, {
			first: first,
			last: clone(token)
		});
	};
	var mk_term = function () {
		var first = clone(token);
		var term, expr;

		if (token.value === 'NEW') {
			advance();
			expr = mk_term();
			term = Actor(new_expr_beh(expr), 'NEW');
		} else if (is_const(token)) {
			term = mk_const_expr();
		} else if (token.type === 'symbol') {
			var ident = token.value;

			advance();
			term = Actor(ident_expr_beh(ident), ident);
			term = annotate(term, {
				first: first,
				last: clone(token)
			});
			term = mk_call(term);
		} else if (token.value === '(') {  // grouping
			advance();
			if (token.value === ')') {
				advance();
				term = Actor(const_expr_beh(NIL), 'NIL');
			} else {
				term = mk_expr();
				expect(')');
				term = mk_call(term);
			}
		} else {
			token.error('Term expected.');
		}
		return annotate(term, {
			first: first,
			last: clone(token)
		});
	};
	var mk_call = function (term) {
		var expr;

		if ((token.value === '(')
		 && (token.space === '')) {  // application
			advance();
			if (token.value === ')') {
				advance();
				expr = Actor(const_expr_beh(NIL), 'NIL');
			} else {
				expr = mk_expr();
				expect(')');
			}
			term = Actor(app_expr_beh(term, expr), 'app');
		}
		return term;
	};
	var mk_if_else = function () {
		var eqtn, expr;

		if (token.value === 'ELSE') {
			advance();
			expr = mk_expr();
			return expr;
		} else if (token.value === 'ELIF') {
			advance();
			eqtn = mk_eqtn();
			expr = mk_expr();
			next = mk_if_else();
			return Actor(if_expr_beh(eqtn, expr, next), 'ELIF');
		} else {
			return Actor(const_expr_beh(UNDEF), '?');
		}
	};
	var mk_case_end = function () {
		if (token.value === 'END') {
			advance();
			return Actor(case_end_beh, 'END');
		} else {
			var ptrn, expr, next;

			ptrn = mk_ptrn();
			expect(':');
			expr = mk_expr();
			next = mk_case_end();
			return Actor(case_choice_beh(ptrn, expr, next), 'OF');
		}
	};
	var mk_const_expr = function () {
		var t = token.type;
		var v = token.value;

		if (t === 'number') {
			advance();
			return Actor(const_expr_beh(v), '#'+v);
		}
		if (t === 'char') {
			advance();
			return Actor(const_expr_beh(v), '\''+v+'\'');
		}
		if (t === 'string') {
			advance();
			return Actor(const_expr_beh(v), '"'+v+'"');
		}
		if (v === '[') {
			var scope = Scope();
			var stmt;

			advance();
			stmt = mk_block_end(scope);
			return Actor(block_expr_beh(scope.vars, stmt), '[');
		}
		if (v === '#') {
			var value = advance().value;

			advance();
			return Actor(const_expr_beh(value), '#'+value);
		}
		if ((v === '\\') || (v === 'λ')) {
			var ptrn, expr;

			advance();
			ptrn = mk_ptrn();
			expect('.');
			expr = mk_expr();
			return Actor(abs_expr_beh(ptrn, expr), 'abs');
		}
		if (v === 'NOW') {  // FIXME: non-standard extension
			advance();
			return Actor(now_expr_beh, 'NOW');
		}
		if (v === 'SELF') {
			advance();
			return Actor(self_expr_beh, 'SELF');
		}
		if (v === '?') {
			advance();
			return Actor(const_expr_beh(UNDEF), '?');
		}
		if (v === 'TRUE') {
			advance();
			return Actor(const_expr_beh(true), 'TRUE');
		}
		if (v === 'FALSE') {
			advance();
			return Actor(const_expr_beh(false), 'FALSE');
		}
		if (v === 'NIL') {
			advance();
			return Actor(const_expr_beh(NIL), 'NIL');
		}
		token.error('Constant expected.');
	};
	var mk_block_end = function (scope) {
		if (token.value === ']') {
			advance();
			return Actor(empty_stmt_beh, ']');
		} else {
			var stmt, next;

			stmt = mk_stmt(scope);
			next = mk_block_end(scope);
			return Actor(stmt_pair_beh(stmt, next), 'stmt:,');
		}
	};
	var mk_ident = function () {
		var ident;

		if (token.type !== 'symbol') {
			token.error('Symbol required.');
		}
		ident = token.value;
		advance();
		return ident;
	};
	var is_const = function (token) {
		var t = token.type;
		var v = token.value;

		if ((t === 'number')
		 || (t === 'char')
		 || (t === 'string')) {
			return true;
		}
		if ((v === '?')
		 || (v === '[')
		 || (v === '#')
		 || (v === '\\') || (v === 'λ')
		 || (v === 'NOW')  // FIXME: non-standard extension
		 || (v === 'SELF')
		 || (v === 'TRUE')
		 || (v === 'FALSE')
		 || (v === 'NIL')) {
			return true;
		}
		return false;
	};
    //
    // Top-down parser/compiler
    //
    var parse = function (script) {
        var lines = script.split('\n');
        var lineno = 0;
        var ofs = 0;

        token = start;
        tokens = [];
        while (lineno < lines.length) {
        	var line = lines[lineno];
            tokenize(line, lineno + 1, ofs);
            lineno += 1;
            ofs += line.length + 1;
        }
        return tokens/*.join('\n')*/;
    };
    var compile = function () {
        var actor;

        if (token === start) {
            advance();
        }
        if (token !== end) {
            actor = mk_stmt();
        }
        return actor;
    };

	this.generator = generator;
	this.parse = parse;
	this.compile = compile;
}
.field('version', version)
.override('toString', function () {
	return '<Hum_Xlat v' + this.version + '>';
});

factory = function (cfg) {
	var self = new constructor(cfg);

	self.constructor = constructor;
	return self;
};
factory.class = constructor;
factory.created = function (instance) {
	return ((typeof instance === 'object')
		&&  (instance !== null)
		&&  (instance.constructor === constructor));
};

export default Object.freeze(factory);
