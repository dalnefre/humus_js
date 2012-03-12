/*
 * gen_json.js -- Humus JSON-like code generator (JavaScript Actor Notation)
 *
 * author: Dale Schumacher <dale.schumacher@gmail.com>
 * requires: core.js, humus.js
 */

if (typeof DALNEFRE === 'undefined') {
	throw Error('Namespace "DALNEFRE" required!');
}
if (typeof DALNEFRE.Humus === 'undefined') {
	throw Error('Namespace "DALNEFRE.Humus" required!');
}
if (typeof DALNEFRE.Humus.Gen_Json !== 'undefined') {
	throw Error('Module "DALNEFRE.Humus.Gen_Json" already defined!');
}

DALNEFRE.Humus.Gen_Json = (function () {
	var version = '0.7.3 2011-04-28';
	var DAL = DALNEFRE;
	var log = DAL.log;
//	var debug = function (msg) {
//		DAL.debug(msg);
//		DAL.trace('--?-- '+msg);
//	};
	var trace = DAL.trace;
	var HUM = DAL.Humus;
	var UNDEF = HUM.UNDEF;
	var NIL = HUM.NIL;
	var Obj = HUM.Obj;
	var Pr = HUM.Pr;
	
	var sink_beh = DAL.Actor.sink_beh;
	var const_expr_beh = function (value) {
		return Obj({
			beh: 'const_expr',
			value: value
		});
	};
	var ident_expr_beh = function (ident) {
		return Obj({
			beh: 'ident_expr',
			ident: ident
		});
	};
	var abs_expr_beh = function (ptrn, expr) {
		return Obj({
			beh: 'abs_expr',
			ptrn: ptrn,
			body: expr
		});
	};
//	var closure_beh = function (ptrn, body, env) {...};
	var app_expr_beh = function (abs_expr, arg_expr) {
		return Obj({
			beh: 'app_expr',
			abs: abs_expr,
			arg: arg_expr
		});
	};
	var pair_expr_beh = function (h_expr, t_expr) {
		return Obj({
			beh: 'pair_expr',
			head: h_expr,
			tail: t_expr
		});
	};
	var case_expr_beh = function (expr, next) {
		return Obj({
			beh: 'case_expr',
			expr: expr,
			next: next
		});
	};
	var case_choice_beh = function (ptrn, expr, next) {
		return Obj({
			beh: 'case_choice',
			ptrn: ptrn,
			expr: expr,
			next: next
		});
	};
	var case_end_beh = Obj({
		beh: 'case_end'
	});
	var if_expr_beh = function (eqtn, expr, next) {
		return Obj({
			beh: 'if_expr',
			eqtn: eqtn,
			expr: expr,
			next: next
		});
	};
	var let_expr_beh = function (eqtn, expr) {
		return Obj({
			beh: 'let_expr',
			eqtn: eqtn,
			expr: expr
		});
	};
	var block_expr_beh = function (vars, stmt) {
		return Obj({
			beh: 'block_expr',
			vars: vars,
			stmt: stmt
		});
	};
	var now_expr_beh = Obj({
		beh: 'now_expr'
	});
	var self_expr_beh = Obj({
		beh: 'self_expr'
	});
	var new_expr_beh = function (expr) {
		return Obj({
			beh: 'new_expr',
			expr: expr
		});
	};
	var eqtn_beh = function (left_ptrn, right_ptrn) {
		return Obj({
			beh: 'eqtn',
			left: left_ptrn,
			right: right_ptrn
		});
	};
	var const_ptrn_beh = function (value) {
		return Obj({
			beh: 'const_ptrn',
			value: value
		});
	};
	var value_ptrn_beh = function (expr) {
		return Obj({
			beh: 'value_ptrn',
			expr: expr
		});
	};
	var ident_ptrn_beh = function (ident) {
		return Obj({
			beh: 'ident_ptrn',
			ident: ident
		});
	};
	var any_ptrn_beh = Obj({
		beh: 'any_ptrn'
	});
	var pair_ptrn_beh = function (h_ptrn, t_ptrn) {
		return Obj({
			beh: 'pair_ptrn',
			head: h_ptrn,
			tail: t_ptrn
		});
	};
	var self_ptrn_beh = Obj({
		beh: 'self_ptrn'
	});
//	var block_beh = function (vars, stmt, env) {...};
	var empty_stmt_beh = Obj({
		beh: 'empty_stmt'
	});
	var stmt_pair_beh = function (h_stmt, t_stmt) {
		return Obj({
			beh: 'stmt_pair',
			head: h_stmt,
			tail: t_stmt
		});
	};
	var let_stmt_beh = function (eqtn) {
		return Obj({
			beh: 'let_stmt',
			eqtn: eqtn
		});
	};
	var send_stmt_beh = function (m_expr, a_expr, t_expr) {
		if (t_expr) {
			return Obj({
				beh: 'after_send_stmt',
				dt: t_expr,
				msg: m_expr,
				to: a_expr
			});
		}
		return Obj({
			beh: 'send_stmt',
			msg: m_expr,
			to: a_expr
		});
	};
	var create_stmt_beh = function (ident, b_expr) {
		return Obj({
			beh: 'create_stmt',
			ident: ident,
			expr: b_expr
		});
	};
	var become_stmt_beh = function (b_expr) {
		return Obj({
			beh: 'become_stmt',
			expr: b_expr
		});
	};
	var throw_stmt_beh = function (e_expr) {
		return Obj({
			beh: 'throw_stmt',
			expr: e_expr
		});
	};
	var expr_stmt_beh = function (expr) {
		return Obj({
			beh: 'expr_stmt',
			expr: expr
		});
	};

	var factory;
	var constructor = function Gen_Json(cfg) {
		this.config = cfg;
		this.Actor = (function () {  // private class -- needs access to 'cfg'
			var factory;
			var constructor = function Actor(beh) {
				this.isActor = true;
				this.attrs = beh;
			}
			.method('behavior', function (msg) {
				log(msg + '\n -> ' + this);
				if (Pr.created(msg)
				 && Pr.created(msg.tl)) {
					var cust = msg.hd;
					var sponsor = msg.tl.hd;
					var message = msg.tl.tl;
				
					HUM.println(this.pp());
					cfg.send('ok', cust);
				}
			})
			.method('pp', function (depth) {
				var d = this.attrs;
				var s = '';
				var indent = function (depth) {
					var i;
					var t = '';

					for (i = 0; i < depth; ++i) {
						t += '  ';  // indent 2 spaces per level
					}
					return t;
				}

				depth = depth || 0;
				s += '@{\n';
				depth += 1;
				s += d.forEachData(function (key, acc) {
					var v = d[key];
					
					if ((typeof v === 'object') && (typeof v.pp === 'function')) {
						v = v.pp(depth);
					}
					acc.push(indent(depth) + key + ': ' + v);
					return acc;
				}, []).join(',\n');
				s += '\n';
				depth -= 1;
				s += indent(depth);
				s += '}';
				return s;
			})
			.override('toString', function () {
				return '@' + this.attrs;
			});
		
			factory = function (beh) {
				var self = new constructor(beh);
				
				self.constructor = constructor;
				return self;
			};
			factory.class = constructor;
			factory.created = function (instance) {
				return ((typeof instance === 'object')
					&&  (instance !== null)
					&&  (instance.constructor === constructor));
			};
			return factory;
		})();

	}
	.field('version', version)
//	.method('tag_beh', tag_beh)
//	.method('join_beh', join_beh)
//	.method('fork_beh', fork_beh)
//	.method('call_pair_beh', call_pair_beh)
//	.method('pair_of', pair_of)
//	.method('serializer_beh', serializer_beh)
//	.method('undefined_beh', undefined_beh)
	.method('empty_env_beh', sink_beh)  // disabled
	.method('env_beh', sink_beh)  // disabled
	.method('dynamic_env_beh', sink_beh)  // disabled
	.method('repl_env_beh', sink_beh)  // disabled
	.method('const_expr_beh', const_expr_beh)
	.method('ident_expr_beh', ident_expr_beh)
	.method('abs_expr_beh', abs_expr_beh)
//	.method('closure_beh', closure_beh)
	.method('app_expr_beh', app_expr_beh)
	.method('pair_expr_beh', pair_expr_beh)
	.method('case_expr_beh', case_expr_beh)
	.method('case_choice_beh', case_choice_beh)
	.field('case_end_beh', case_end_beh)
	.method('if_expr_beh', if_expr_beh)
	.method('let_expr_beh', let_expr_beh)
	.method('block_expr_beh', block_expr_beh)
	.field('now_expr_beh', now_expr_beh)  // FIXME: non-standard extension
	.field('self_expr_beh', self_expr_beh)
	.method('new_expr_beh', new_expr_beh)
	.method('eqtn_beh', eqtn_beh)
	.method('const_ptrn_beh', const_ptrn_beh)
	.method('value_ptrn_beh', value_ptrn_beh)
	.method('ident_ptrn_beh', ident_ptrn_beh)
	.field('any_ptrn_beh', any_ptrn_beh)
	.method('pair_ptrn_beh', pair_ptrn_beh)
	.field('self_ptrn_beh', self_ptrn_beh)
//	.method('block_beh', block_beh)
	.field('empty_stmt_beh', empty_stmt_beh)
	.method('stmt_pair_beh', stmt_pair_beh)
	.method('let_stmt_beh', let_stmt_beh)
	.method('send_stmt_beh', send_stmt_beh)
	.method('create_stmt_beh', create_stmt_beh)
	.method('become_stmt_beh', become_stmt_beh)
	.method('throw_stmt_beh', throw_stmt_beh)
	.method('expr_stmt_beh', expr_stmt_beh)
	.method('config_beh', sink_beh)  // disabled
	.method('repl_sponsor_beh', sink_beh)  // disabled
	.method('upcall_beh', sink_beh)  // disabled
	.method('downcall_beh', sink_beh)  // disabled
	.method('native_fn_beh', sink_beh)  // disabled
	.override('toString', function () {
		return '<Gen_Json v' + this.version + '>';
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
	return factory;
})();
