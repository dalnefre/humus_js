/*
 * gen_json.js -- Humus JSON code generator (CRLF grammar)
 * https://github.com/organix/crlf/blob/master/Humus.md
 *
 * author: Dale Schumacher <dale.schumacher@gmail.com>
 */

import core from "./core.js";
import Actor from "./actor.js";
import Humus from "./humus.js";

var version = '0.8.0 2024-01-29';
var log = core.log;
//	var debug = function (msg) {
//		core.debug(msg);
//		core.trace('--?-- '+msg);
//	};
var trace = core.trace;
var HUM = Humus;
var UNDEF = HUM.UNDEF;
var NIL = HUM.NIL;
//	var Obj = HUM.Obj;
var Pr = HUM.Pr;

var sink_beh = Actor.sink_beh;
var const_expr_beh = function (value) {
	value = JSON.parse(JSON.stringify(value));  // safe round-trip value
	return { "kind":"const_expr", "value":value }
};
var ident_expr_beh = function (ident) {
	return { "kind":"ident_expr", "ident":String(ident) }
};
var abs_expr_beh = function (ptrn, expr) {
	return { "kind":"abs_expr", "ptrn":ptrn, "body":expr }
};
//	var closure_beh = function (ptrn, body, env) {...};
var app_expr_beh = function (abs_expr, arg_expr) {
	return { "kind":"app_expr", "abs":abs_expr, "arg":arg_expr }
};
var pair_expr_beh = function (h_expr, t_expr) {
	return { "kind":"pair_expr", "head":h_expr, "tail":t_expr }
};
var case_expr_beh = function (expr, next) {
	return { "kind":"case_expr", "expr":expr, "next":next }
};
var case_choice_beh = function (ptrn, expr, next) {
	return { "kind":"case_choice", "ptrn":ptrn, "expr":expr, "next":next }
};
var case_end_beh = { "kind":"case_end" };
var if_expr_beh = function (eqtn, expr, next) {
	return { "kind":"if_expr", "eqtn":eqtn, "expr":expr, "next":next }
};
var let_expr_beh = function (eqtn, expr) {
	return { "kind":"let_expr", "eqtn":eqtn, "expr":expr }
};
var block_expr_beh = function (vars, stmt) {
	var vs = [];  // convert Pair-list to native Array
	while (Pr.created(vars)) {
		vs.push(String(vars.hd));
		vars = vars.tl;
	}
	return { "kind":"block_expr", "vars":vs, "stmt":stmt }
};
var now_expr_beh = { "kind":"now_expr" };
var self_expr_beh = { "kind":"self_expr" };
var new_expr_beh = function (b_expr) {
	return { "kind":"new_expr", "expr":b_expr }
};
var eqtn_beh = function (left_ptrn, right_ptrn) {
	return { "kind":"eqtn", "left":left_ptrn, "right":right_ptrn }
};
var const_ptrn_beh = function (value) {
	value = JSON.parse(JSON.stringify(value));  // safe round-trip value
	return { "kind":"const_ptrn", "value":value }
};
var ident_ptrn_beh = function (ident) {
	return { "kind":"ident_ptrn", "ident":String(ident) }
};
var any_ptrn_beh = { "kind":"any_ptrn" };
var pair_ptrn_beh = function (h_ptrn, t_ptrn) {
	return { "kind":"pair_ptrn", "head":h_ptrn, "tail":t_ptrn };
};
var value_ptrn_beh = function (expr) {
	return { "kind":"value_ptrn", "expr":expr };
};
var self_ptrn_beh = { "kind":"self_ptrn" };
//	var block_beh = function (vars, stmt, env) {...};
var empty_stmt_beh = { "kind":"empty_stmt" };
var stmt_pair_beh = function (h_stmt, t_stmt) {
	return { "kind":"stmt_pair", "head":h_stmt, "tail":t_stmt }
};
var def_stmt_beh = function (ptrn, expr) {
	return { "kind":"def_stmt", "ptrn":ptrn, "expr":expr }
};
var let_stmt_beh = function (eqtn) {
	//...{ "kind":"eqtn", "left":<pattern>, "right":{ "kind":"value_ptrn", "expr":<expression> }}
	if ((typeof eqtn === 'object')
	 && (eqtn.kind === 'eqtn')
	 && (typeof eqtn.left === 'object')
	 && (typeof eqtn.right === 'object')
	 && (eqtn.right.kind === 'value_ptrn')) {
		// rewrite "LET <ptrn> = $<expr>" as "DEF <ptrn> AS <expr>"
		return { "kind":"def_stmt", "ptrn":eqtn.left, "expr":eqtn.right.expr }
	}
	return { "kind":"let_stmt", "eqtn":eqtn }
};
var send_stmt_beh = function (m_expr, a_expr, t_expr) {
	if (t_expr) {
		return { "kind":"after_send_stmt", "dt":t_expr, "msg":m_expr, "to":a_expr }
	}
	return { "kind":"send_stmt", "msg":m_expr, "to":a_expr }
};
var create_stmt_beh = function (ident, b_expr) {
	return { "kind":"create_stmt", "ident":String(ident), "expr":b_expr }
};
var become_stmt_beh = function (b_expr) {
	return { "kind":"become_stmt", "expr":b_expr }
};
var throw_stmt_beh = function (e_expr) {
	return { "kind":"throw_stmt", "expr":e_expr }
};
var expr_stmt_beh = function (expr) {
	return { "kind":"expr_stmt", "expr":expr }
};

var factory;
var constructor = function Gen_Json(cfg) {
	this.config = cfg;
	this.Actor = (function () {  // private class -- needs access to 'cfg'
		var factory;
		var constructor = function Actor(beh, id) {
			if (typeof beh === 'object') {
				for (const key of Object.keys(beh)) {
					const value = beh[key]
					if (typeof value !== 'function') {
						this[key] = value;
					}
				}
			} else {
				this.beh = beh;
			}
		}
		.field('isActor', true)
		.method('behavior', function (msg) {
			log(msg + '\n -> ' + this);
			if (Pr.created(msg)
			 && Pr.created(msg.tl)) {
				var cust = msg.hd;
				var sponsor = msg.tl.hd;
				var message = msg.tl.tl;

				HUM.println(JSON.stringify(this, null, '  '));
				cfg.send('ok', cust);
			}
		})
		.override('toString', function () {
			return JSON.stringify(this);
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
.method('def_stmt_beh', def_stmt_beh)
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

export default Object.freeze(factory);
