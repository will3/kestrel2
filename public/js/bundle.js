(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
;(function(undefined) {
    'use strict';
    /**
     * BottleJS v1.6.1 - 2017-05-17
     * A powerful dependency injection micro container
     *
     * Copyright (c) 2017 Stephen Young
     * Licensed MIT
     */
    
    /**
     * Unique id counter;
     *
     * @type Number
     */
    var id = 0;
    
    /**
     * Local slice alias
     *
     * @type Functions
     */
    var slice = Array.prototype.slice;
    
    /**
     * Iterator used to walk down a nested object.
     *
     * If Bottle.config.strict is true, this method will throw an exception if it encounters an
     * undefined path
     *
     * @param Object obj
     * @param String prop
     * @return mixed
     * @throws Error if Bottle is unable to resolve the requested service.
     */
    var getNested = function getNested(obj, prop) {
        var service = obj[prop];
        if (service === undefined && globalConfig.strict) {
            throw new Error('Bottle was unable to resolve a service.  `' + prop + '` is undefined.');
        }
        return service;
    };
    
    /**
     * Get a nested bottle. Will set and return if not set.
     *
     * @param String name
     * @return Bottle
     */
    var getNestedBottle = function getNestedBottle(name) {
        return this.nested[name] || (this.nested[name] = Bottle.pop());
    };
    
    /**
     * Get a service stored under a nested key
     *
     * @param String fullname
     * @return Service
     */
    var getNestedService = function getNestedService(fullname) {
        return fullname.split('.').reduce(getNested, this);
    };
    
    /**
     * Register a constant
     *
     * @param String name
     * @param mixed value
     * @return Bottle
     */
    var constant = function constant(name, value) {
        var parts = name.split('.');
        name = parts.pop();
        defineConstant.call(parts.reduce(setValueObject, this.container), name, value);
        return this;
    };
    
    var defineConstant = function defineConstant(name, value) {
        Object.defineProperty(this, name, {
            configurable : false,
            enumerable : true,
            value : value,
            writable : false
        });
    };
    
    /**
     * Register decorator.
     *
     * @param String fullname
     * @param Function func
     * @return Bottle
     */
    var decorator = function decorator(fullname, func) {
        var parts, name;
        if (typeof fullname === 'function') {
            func = fullname;
            fullname = '__global__';
        }
    
        parts = fullname.split('.');
        name = parts.shift();
        if (parts.length) {
            getNestedBottle.call(this, name).decorator(parts.join('.'), func);
        } else {
            if (!this.decorators[name]) {
                this.decorators[name] = [];
            }
            this.decorators[name].push(func);
        }
        return this;
    };
    
    /**
     * Register a function that will be executed when Bottle#resolve is called.
     *
     * @param Function func
     * @return Bottle
     */
    var defer = function defer(func) {
        this.deferred.push(func);
        return this;
    };
    
    
    /**
     * Immediately instantiates the provided list of services and returns them.
     *
     * @param Array services
     * @return Array Array of instances (in the order they were provided)
     */
    var digest = function digest(services) {
        return (services || []).map(getNestedService, this.container);
    };
    
    /**
     * Register a factory inside a generic provider.
     *
     * @param String name
     * @param Function Factory
     * @return Bottle
     */
    var factory = function factory(name, Factory) {
        return provider.call(this, name, function GenericProvider() {
            this.$get = Factory;
        });
    };
    
    /**
     * Register an instance factory inside a generic factory.
     *
     * @param {String} name - The name of the service
     * @param {Function} Factory - The factory function, matches the signature required for the
     * `factory` method
     * @return Bottle
     */
    var instanceFactory = function instanceFactory(name, Factory) {
        return factory.call(this, name, function GenericInstanceFactory(container) {
            return {
                instance : Factory.bind(Factory, container)
            };
        });
    };
    
    /**
     * A filter function for removing bottle container methods and providers from a list of keys
     */
    var byMethod = function byMethod(name) {
        return !/^\$(?:decorator|register|list)$|Provider$/.test(name);
    };
    
    /**
     * List the services registered on the container.
     *
     * @param Object container
     * @return Array
     */
    var list = function list(container) {
        return Object.keys(container || this.container || {}).filter(byMethod);
    };
    
    /**
     * Function used by provider to set up middleware for each request.
     *
     * @param Number id
     * @param String name
     * @param Object instance
     * @param Object container
     * @return void
     */
    var applyMiddleware = function applyMiddleware(middleware, name, instance, container) {
        var descriptor = {
            configurable : true,
            enumerable : true
        };
        if (middleware.length) {
            descriptor.get = function getWithMiddlewear() {
                var index = 0;
                var next = function nextMiddleware(err) {
                    if (err) {
                        throw err;
                    }
                    if (middleware[index]) {
                        middleware[index++](instance, next);
                    }
                };
                next();
                return instance;
            };
        } else {
            descriptor.value = instance;
            descriptor.writable = true;
        }
    
        Object.defineProperty(container, name, descriptor);
    
        return container[name];
    };
    
    /**
     * Register middleware.
     *
     * @param String name
     * @param Function func
     * @return Bottle
     */
    var middleware = function middleware(fullname, func) {
        var parts, name;
        if (typeof fullname === 'function') {
            func = fullname;
            fullname = '__global__';
        }
    
        parts = fullname.split('.');
        name = parts.shift();
        if (parts.length) {
            getNestedBottle.call(this, name).middleware(parts.join('.'), func);
        } else {
            if (!this.middlewares[name]) {
                this.middlewares[name] = [];
            }
            this.middlewares[name].push(func);
        }
        return this;
    };
    
    /**
     * Named bottle instances
     *
     * @type Object
     */
    var bottles = {};
    
    /**
     * Get an instance of bottle.
     *
     * If a name is provided the instance will be stored in a local hash.  Calling Bottle.pop multiple
     * times with the same name will return the same instance.
     *
     * @param String name
     * @return Bottle
     */
    var pop = function pop(name) {
        var instance;
        if (typeof name === 'string') {
            instance = bottles[name];
            if (!instance) {
                bottles[name] = instance = new Bottle();
                instance.constant('BOTTLE_NAME', name);
            }
            return instance;
        }
        return new Bottle();
    };
    
    /**
     * Clear all named bottles.
     */
    var clear = function clear(name) {
        if (typeof name === 'string') {
            delete bottles[name];
        } else {
            bottles = {};
        }
    };
    
    /**
     * Used to process decorators in the provider
     *
     * @param Object instance
     * @param Function func
     * @return Mixed
     */
    var reducer = function reducer(instance, func) {
        return func(instance);
    };
    
    /**
     * Register a provider.
     *
     * @param String fullname
     * @param Function Provider
     * @return Bottle
     */
    var provider = function provider(fullname, Provider) {
        var parts, name;
        parts = fullname.split('.');
        if (this.providerMap[fullname] && parts.length === 1 && !this.container[fullname + 'Provider']) {
            return console.error(fullname + ' provider already instantiated.');
        }
        this.originalProviders[fullname] = Provider;
        this.providerMap[fullname] = true;
    
        name = parts.shift();
    
        if (parts.length) {
            createSubProvider.call(this, name, Provider, parts);
            return this;
        }
        return createProvider.call(this, name, Provider);
    };
    
    /**
     * Get decorators and middleware including globals
     *
     * @return array
     */
    var getWithGlobal = function getWithGlobal(collection, name) {
        return (collection[name] || []).concat(collection.__global__ || []);
    };
    
    /**
     * Create the provider properties on the container
     *
     * @param String name
     * @param Function Provider
     * @return Bottle
     */
    var createProvider = function createProvider(name, Provider) {
        var providerName, properties, container, id, decorators, middlewares;
    
        id = this.id;
        container = this.container;
        decorators = this.decorators;
        middlewares = this.middlewares;
        providerName = name + 'Provider';
    
        properties = Object.create(null);
        properties[providerName] = {
            configurable : true,
            enumerable : true,
            get : function getProvider() {
                var instance = new Provider();
                delete container[providerName];
                container[providerName] = instance;
                return instance;
            }
        };
    
        properties[name] = {
            configurable : true,
            enumerable : true,
            get : function getService() {
                var provider = container[providerName];
                var instance;
                if (provider) {
                    // filter through decorators
                    instance = getWithGlobal(decorators, name).reduce(reducer, provider.$get(container));
    
                    delete container[providerName];
                    delete container[name];
                }
                return instance === undefined ? instance : applyMiddleware(getWithGlobal(middlewares, name),
                    name, instance, container);
            }
        };
    
        Object.defineProperties(container, properties);
        return this;
    };
    
    /**
     * Creates a bottle container on the current bottle container, and registers
     * the provider under the sub container.
     *
     * @param String name
     * @param Function Provider
     * @param Array parts
     * @return Bottle
     */
    var createSubProvider = function createSubProvider(name, Provider, parts) {
        var bottle;
        bottle = getNestedBottle.call(this, name);
        this.factory(name, function SubProviderFactory() {
            return bottle.container;
        });
        return bottle.provider(parts.join('.'), Provider);
    };
    
    /**
     * Register a service, factory, provider, or value based on properties on the object.
     *
     * properties:
     *  * Obj.$name   String required ex: `'Thing'`
     *  * Obj.$type   String optional 'service', 'factory', 'provider', 'value'.  Default: 'service'
     *  * Obj.$inject Mixed  optional only useful with $type 'service' name or array of names
     *  * Obj.$value  Mixed  optional Normally Obj is registered on the container.  However, if this
     *                       property is included, it's value will be registered on the container
     *                       instead of the object itsself.  Useful for registering objects on the
     *                       bottle container without modifying those objects with bottle specific keys.
     *
     * @param Function Obj
     * @return Bottle
     */
    var register = function register(Obj) {
        var value = Obj.$value === undefined ? Obj : Obj.$value;
        return this[Obj.$type || 'service'].apply(this, [Obj.$name, value].concat(Obj.$inject || []));
    };
    
    /**
     * Deletes providers from the map and container.
     *
     * @param String name
     * @return void
     */
    var removeProviderMap = function resetProvider(name) {
        delete this.providerMap[name];
        delete this.container[name];
        delete this.container[name + 'Provider'];
    };
    
    /**
     * Resets all providers on a bottle instance.
     *
     * @return void
     */
    var resetProviders = function resetProviders() {
        var providers = this.originalProviders;
        Object.keys(this.originalProviders).forEach(function resetPrvider(provider) {
            var parts = provider.split('.');
            if (parts.length > 1) {
                removeProviderMap.call(this, parts[0]);
                parts.forEach(removeProviderMap, getNestedBottle.call(this, parts[0]));
            }
            removeProviderMap.call(this, provider);
            this.provider(provider, providers[provider]);
        }, this);
    };
    
    
    /**
     * Execute any deferred functions
     *
     * @param Mixed data
     * @return Bottle
     */
    var resolve = function resolve(data) {
        this.deferred.forEach(function deferredIterator(func) {
            func(data);
        });
    
        return this;
    };
    
    /**
     * Register a service inside a generic factory.
     *
     * @param String name
     * @param Function Service
     * @return Bottle
     */
    var service = function service(name, Service) {
        var deps = arguments.length > 2 ? slice.call(arguments, 2) : null;
        var bottle = this;
        return factory.call(this, name, function GenericFactory() {
            var ServiceCopy = Service;
            if (deps) {
                var args = deps.map(getNestedService, bottle.container);
                args.unshift(Service);
                ServiceCopy = Service.bind.apply(Service, args);
            }
            return new ServiceCopy();
        });
    };
    
    /**
     * Register a value
     *
     * @param String name
     * @param mixed val
     * @return Bottle
     */
    var value = function value(name, val) {
        var parts;
        parts = name.split('.');
        name = parts.pop();
        defineValue.call(parts.reduce(setValueObject, this.container), name, val);
        return this;
    };
    
    /**
     * Iterator for setting a plain object literal via defineValue
     *
     * @param Object container
     * @param string name
     */
    var setValueObject = function setValueObject(container, name) {
        var nestedContainer = container[name];
        if (!nestedContainer) {
            nestedContainer = {};
            defineValue.call(container, name, nestedContainer);
        }
        return nestedContainer;
    };
    
    /**
     * Define a mutable property on the container.
     *
     * @param String name
     * @param mixed val
     * @return void
     * @scope container
     */
    var defineValue = function defineValue(name, val) {
        Object.defineProperty(this, name, {
            configurable : true,
            enumerable : true,
            value : val,
            writable : true
        });
    };
    
    
    /**
     * Bottle constructor
     *
     * @param String name Optional name for functional construction
     */
    var Bottle = function Bottle(name) {
        if (!(this instanceof Bottle)) {
            return Bottle.pop(name);
        }
    
        this.id = id++;
    
        this.decorators = {};
        this.middlewares = {};
        this.nested = {};
        this.providerMap = {};
        this.originalProviders = {};
        this.deferred = [];
        this.container = {
            $decorator : decorator.bind(this),
            $register : register.bind(this),
            $list : list.bind(this)
        };
    };
    
    /**
     * Bottle prototype
     */
    Bottle.prototype = {
        constant : constant,
        decorator : decorator,
        defer : defer,
        digest : digest,
        factory : factory,
        instanceFactory: instanceFactory,
        list : list,
        middleware : middleware,
        provider : provider,
        resetProviders : resetProviders,
        register : register,
        resolve : resolve,
        service : service,
        value : value
    };
    
    /**
     * Bottle static
     */
    Bottle.pop = pop;
    Bottle.clear = clear;
    Bottle.list = list;
    
    /**
     * Global config
     */
    var globalConfig = Bottle.config = {
        strict : false
    };
    
    /**
     * Exports script adapted from lodash v2.4.1 Modern Build
     *
     * @see http://lodash.com/
     */
    
    /**
     * Valid object type map
     *
     * @type Object
     */
    var objectTypes = {
        'function' : true,
        'object' : true
    };
    
    (function exportBottle(root) {
    
        /**
         * Free variable exports
         *
         * @type Function
         */
        var freeExports = objectTypes[typeof exports] && exports && !exports.nodeType && exports;
    
        /**
         * Free variable module
         *
         * @type Object
         */
        var freeModule = objectTypes[typeof module] && module && !module.nodeType && module;
    
        /**
         * CommonJS module.exports
         *
         * @type Function
         */
        var moduleExports = freeModule && freeModule.exports === freeExports && freeExports;
    
        /**
         * Free variable `global`
         *
         * @type Object
         */
        var freeGlobal = objectTypes[typeof global] && global;
        if (freeGlobal && (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal)) {
            root = freeGlobal;
        }
    
        /**
         * Export
         */
        if (typeof define === 'function' && typeof define.amd === 'object' && define.amd) {
            root.Bottle = Bottle;
            define(function() { return Bottle; });
        } else if (freeExports && freeModule) {
            if (moduleExports) {
                (freeModule.exports = Bottle).Bottle = Bottle;
            } else {
                freeExports.Bottle = Bottle;
            }
        } else {
            root.Bottle = Bottle;
        }
    }((objectTypes[typeof window] && window) || this));
    
}.call(this));
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],2:[function(require,module,exports){
'use strict';

var assign        = require('es5-ext/object/assign')
  , normalizeOpts = require('es5-ext/object/normalize-options')
  , isCallable    = require('es5-ext/object/is-callable')
  , contains      = require('es5-ext/string/#/contains')

  , d;

d = module.exports = function (dscr, value/*, options*/) {
	var c, e, w, options, desc;
	if ((arguments.length < 2) || (typeof dscr !== 'string')) {
		options = value;
		value = dscr;
		dscr = null;
	} else {
		options = arguments[2];
	}
	if (dscr == null) {
		c = w = true;
		e = false;
	} else {
		c = contains.call(dscr, 'c');
		e = contains.call(dscr, 'e');
		w = contains.call(dscr, 'w');
	}

	desc = { value: value, configurable: c, enumerable: e, writable: w };
	return !options ? desc : assign(normalizeOpts(options), desc);
};

d.gs = function (dscr, get, set/*, options*/) {
	var c, e, options, desc;
	if (typeof dscr !== 'string') {
		options = set;
		set = get;
		get = dscr;
		dscr = null;
	} else {
		options = arguments[3];
	}
	if (get == null) {
		get = undefined;
	} else if (!isCallable(get)) {
		options = get;
		get = set = undefined;
	} else if (set == null) {
		set = undefined;
	} else if (!isCallable(set)) {
		options = set;
		set = undefined;
	}
	if (dscr == null) {
		c = true;
		e = false;
	} else {
		c = contains.call(dscr, 'c');
		e = contains.call(dscr, 'e');
	}

	desc = { get: get, set: set, configurable: c, enumerable: e };
	return !options ? desc : assign(normalizeOpts(options), desc);
};

},{"es5-ext/object/assign":3,"es5-ext/object/is-callable":6,"es5-ext/object/normalize-options":10,"es5-ext/string/#/contains":13}],3:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? Object.assign
	: require('./shim');

},{"./is-implemented":4,"./shim":5}],4:[function(require,module,exports){
'use strict';

module.exports = function () {
	var assign = Object.assign, obj;
	if (typeof assign !== 'function') return false;
	obj = { foo: 'raz' };
	assign(obj, { bar: 'dwa' }, { trzy: 'trzy' });
	return (obj.foo + obj.bar + obj.trzy) === 'razdwatrzy';
};

},{}],5:[function(require,module,exports){
'use strict';

var keys  = require('../keys')
  , value = require('../valid-value')

  , max = Math.max;

module.exports = function (dest, src/*, …srcn*/) {
	var error, i, l = max(arguments.length, 2), assign;
	dest = Object(value(dest));
	assign = function (key) {
		try { dest[key] = src[key]; } catch (e) {
			if (!error) error = e;
		}
	};
	for (i = 1; i < l; ++i) {
		src = arguments[i];
		keys(src).forEach(assign);
	}
	if (error !== undefined) throw error;
	return dest;
};

},{"../keys":7,"../valid-value":12}],6:[function(require,module,exports){
// Deprecated

'use strict';

module.exports = function (obj) { return typeof obj === 'function'; };

},{}],7:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? Object.keys
	: require('./shim');

},{"./is-implemented":8,"./shim":9}],8:[function(require,module,exports){
'use strict';

module.exports = function () {
	try {
		Object.keys('primitive');
		return true;
	} catch (e) { return false; }
};

},{}],9:[function(require,module,exports){
'use strict';

var keys = Object.keys;

module.exports = function (object) {
	return keys(object == null ? object : Object(object));
};

},{}],10:[function(require,module,exports){
'use strict';

var forEach = Array.prototype.forEach, create = Object.create;

var process = function (src, obj) {
	var key;
	for (key in src) obj[key] = src[key];
};

module.exports = function (options/*, …options*/) {
	var result = create(null);
	forEach.call(arguments, function (options) {
		if (options == null) return;
		process(Object(options), result);
	});
	return result;
};

},{}],11:[function(require,module,exports){
'use strict';

module.exports = function (fn) {
	if (typeof fn !== 'function') throw new TypeError(fn + " is not a function");
	return fn;
};

},{}],12:[function(require,module,exports){
'use strict';

module.exports = function (value) {
	if (value == null) throw new TypeError("Cannot use null or undefined");
	return value;
};

},{}],13:[function(require,module,exports){
'use strict';

module.exports = require('./is-implemented')()
	? String.prototype.contains
	: require('./shim');

},{"./is-implemented":14,"./shim":15}],14:[function(require,module,exports){
'use strict';

var str = 'razdwatrzy';

module.exports = function () {
	if (typeof str.contains !== 'function') return false;
	return ((str.contains('dwa') === true) && (str.contains('foo') === false));
};

},{}],15:[function(require,module,exports){
'use strict';

var indexOf = String.prototype.indexOf;

module.exports = function (searchString/*, position*/) {
	return indexOf.call(this, searchString, arguments[1]) > -1;
};

},{}],16:[function(require,module,exports){
'use strict';

var d        = require('d')
  , callable = require('es5-ext/object/valid-callable')

  , apply = Function.prototype.apply, call = Function.prototype.call
  , create = Object.create, defineProperty = Object.defineProperty
  , defineProperties = Object.defineProperties
  , hasOwnProperty = Object.prototype.hasOwnProperty
  , descriptor = { configurable: true, enumerable: false, writable: true }

  , on, once, off, emit, methods, descriptors, base;

on = function (type, listener) {
	var data;

	callable(listener);

	if (!hasOwnProperty.call(this, '__ee__')) {
		data = descriptor.value = create(null);
		defineProperty(this, '__ee__', descriptor);
		descriptor.value = null;
	} else {
		data = this.__ee__;
	}
	if (!data[type]) data[type] = listener;
	else if (typeof data[type] === 'object') data[type].push(listener);
	else data[type] = [data[type], listener];

	return this;
};

once = function (type, listener) {
	var once, self;

	callable(listener);
	self = this;
	on.call(this, type, once = function () {
		off.call(self, type, once);
		apply.call(listener, this, arguments);
	});

	once.__eeOnceListener__ = listener;
	return this;
};

off = function (type, listener) {
	var data, listeners, candidate, i;

	callable(listener);

	if (!hasOwnProperty.call(this, '__ee__')) return this;
	data = this.__ee__;
	if (!data[type]) return this;
	listeners = data[type];

	if (typeof listeners === 'object') {
		for (i = 0; (candidate = listeners[i]); ++i) {
			if ((candidate === listener) ||
					(candidate.__eeOnceListener__ === listener)) {
				if (listeners.length === 2) data[type] = listeners[i ? 0 : 1];
				else listeners.splice(i, 1);
			}
		}
	} else {
		if ((listeners === listener) ||
				(listeners.__eeOnceListener__ === listener)) {
			delete data[type];
		}
	}

	return this;
};

emit = function (type) {
	var i, l, listener, listeners, args;

	if (!hasOwnProperty.call(this, '__ee__')) return;
	listeners = this.__ee__[type];
	if (!listeners) return;

	if (typeof listeners === 'object') {
		l = arguments.length;
		args = new Array(l - 1);
		for (i = 1; i < l; ++i) args[i - 1] = arguments[i];

		listeners = listeners.slice();
		for (i = 0; (listener = listeners[i]); ++i) {
			apply.call(listener, this, args);
		}
	} else {
		switch (arguments.length) {
		case 1:
			call.call(listeners, this);
			break;
		case 2:
			call.call(listeners, this, arguments[1]);
			break;
		case 3:
			call.call(listeners, this, arguments[1], arguments[2]);
			break;
		default:
			l = arguments.length;
			args = new Array(l - 1);
			for (i = 1; i < l; ++i) {
				args[i - 1] = arguments[i];
			}
			apply.call(listeners, this, args);
		}
	}
};

methods = {
	on: on,
	once: once,
	off: off,
	emit: emit
};

descriptors = {
	on: d(on),
	once: d(once),
	off: d(off),
	emit: d(emit)
};

base = defineProperties({}, descriptors);

module.exports = exports = function (o) {
	return (o == null) ? create(base) : defineProperties(Object(o), descriptors);
};
exports.methods = methods;

},{"d":2,"es5-ext/object/valid-callable":11}],17:[function(require,module,exports){
(function (global){
/*jshint -W054 */
(function (exports) {
  'use strict';

  // http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
  function shuffle(array) {
    var currentIndex = array.length
      , temporaryValue
      , randomIndex
      ;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

      // Pick a remaining element...
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex -= 1;

      // And swap it with the current element.
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }

    return array;
  }

  exports.knuthShuffle = shuffle;
}('undefined' !== typeof exports && exports || 'undefined' !== typeof window && window || global));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],18:[function(require,module,exports){
/*
 * A speed-improved perlin and simplex noise algorithms for 2D.
 *
 * Based on example code by Stefan Gustavson (stegu@itn.liu.se).
 * Optimisations by Peter Eastman (peastman@drizzle.stanford.edu).
 * Better rank ordering method by Stefan Gustavson in 2012.
 * Converted to Javascript by Joseph Gentle.
 *
 * Version 2012-03-09
 *
 * This code was placed in the public domain by its original author,
 * Stefan Gustavson. You may use it as you see fit, but
 * attribution is appreciated.
 *
 */

(function(global){
  var module = global.noise = {};

  function Grad(x, y, z) {
    this.x = x; this.y = y; this.z = z;
  }
  
  Grad.prototype.dot2 = function(x, y) {
    return this.x*x + this.y*y;
  };

  Grad.prototype.dot3 = function(x, y, z) {
    return this.x*x + this.y*y + this.z*z;
  };

  var grad3 = [new Grad(1,1,0),new Grad(-1,1,0),new Grad(1,-1,0),new Grad(-1,-1,0),
               new Grad(1,0,1),new Grad(-1,0,1),new Grad(1,0,-1),new Grad(-1,0,-1),
               new Grad(0,1,1),new Grad(0,-1,1),new Grad(0,1,-1),new Grad(0,-1,-1)];

  var p = [151,160,137,91,90,15,
  131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,
  190, 6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,
  88,237,149,56,87,174,20,125,136,171,168, 68,175,74,165,71,134,139,48,27,166,
  77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,
  102,143,54, 65,25,63,161, 1,216,80,73,209,76,132,187,208, 89,18,169,200,196,
  135,130,116,188,159,86,164,100,109,198,173,186, 3,64,52,217,226,250,124,123,
  5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,
  223,183,170,213,119,248,152, 2,44,154,163, 70,221,153,101,155,167, 43,172,9,
  129,22,39,253, 19,98,108,110,79,113,224,232,178,185, 112,104,218,246,97,228,
  251,34,242,193,238,210,144,12,191,179,162,241, 81,51,145,235,249,14,239,107,
  49,192,214, 31,181,199,106,157,184, 84,204,176,115,121,50,45,127, 4,150,254,
  138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
  // To remove the need for index wrapping, double the permutation table length
  var perm = new Array(512);
  var gradP = new Array(512);

  // This isn't a very good seeding function, but it works ok. It supports 2^16
  // different seed values. Write something better if you need more seeds.
  module.seed = function(seed) {
    if(seed > 0 && seed < 1) {
      // Scale the seed out
      seed *= 65536;
    }

    seed = Math.floor(seed);
    if(seed < 256) {
      seed |= seed << 8;
    }

    for(var i = 0; i < 256; i++) {
      var v;
      if (i & 1) {
        v = p[i] ^ (seed & 255);
      } else {
        v = p[i] ^ ((seed>>8) & 255);
      }

      perm[i] = perm[i + 256] = v;
      gradP[i] = gradP[i + 256] = grad3[v % 12];
    }
  };

  module.seed(0);

  /*
  for(var i=0; i<256; i++) {
    perm[i] = perm[i + 256] = p[i];
    gradP[i] = gradP[i + 256] = grad3[perm[i] % 12];
  }*/

  // Skewing and unskewing factors for 2, 3, and 4 dimensions
  var F2 = 0.5*(Math.sqrt(3)-1);
  var G2 = (3-Math.sqrt(3))/6;

  var F3 = 1/3;
  var G3 = 1/6;

  // 2D simplex noise
  module.simplex2 = function(xin, yin) {
    var n0, n1, n2; // Noise contributions from the three corners
    // Skew the input space to determine which simplex cell we're in
    var s = (xin+yin)*F2; // Hairy factor for 2D
    var i = Math.floor(xin+s);
    var j = Math.floor(yin+s);
    var t = (i+j)*G2;
    var x0 = xin-i+t; // The x,y distances from the cell origin, unskewed.
    var y0 = yin-j+t;
    // For the 2D case, the simplex shape is an equilateral triangle.
    // Determine which simplex we are in.
    var i1, j1; // Offsets for second (middle) corner of simplex in (i,j) coords
    if(x0>y0) { // lower triangle, XY order: (0,0)->(1,0)->(1,1)
      i1=1; j1=0;
    } else {    // upper triangle, YX order: (0,0)->(0,1)->(1,1)
      i1=0; j1=1;
    }
    // A step of (1,0) in (i,j) means a step of (1-c,-c) in (x,y), and
    // a step of (0,1) in (i,j) means a step of (-c,1-c) in (x,y), where
    // c = (3-sqrt(3))/6
    var x1 = x0 - i1 + G2; // Offsets for middle corner in (x,y) unskewed coords
    var y1 = y0 - j1 + G2;
    var x2 = x0 - 1 + 2 * G2; // Offsets for last corner in (x,y) unskewed coords
    var y2 = y0 - 1 + 2 * G2;
    // Work out the hashed gradient indices of the three simplex corners
    i &= 255;
    j &= 255;
    var gi0 = gradP[i+perm[j]];
    var gi1 = gradP[i+i1+perm[j+j1]];
    var gi2 = gradP[i+1+perm[j+1]];
    // Calculate the contribution from the three corners
    var t0 = 0.5 - x0*x0-y0*y0;
    if(t0<0) {
      n0 = 0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * gi0.dot2(x0, y0);  // (x,y) of grad3 used for 2D gradient
    }
    var t1 = 0.5 - x1*x1-y1*y1;
    if(t1<0) {
      n1 = 0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * gi1.dot2(x1, y1);
    }
    var t2 = 0.5 - x2*x2-y2*y2;
    if(t2<0) {
      n2 = 0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * gi2.dot2(x2, y2);
    }
    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 70 * (n0 + n1 + n2);
  };

  // 3D simplex noise
  module.simplex3 = function(xin, yin, zin) {
    var n0, n1, n2, n3; // Noise contributions from the four corners

    // Skew the input space to determine which simplex cell we're in
    var s = (xin+yin+zin)*F3; // Hairy factor for 2D
    var i = Math.floor(xin+s);
    var j = Math.floor(yin+s);
    var k = Math.floor(zin+s);

    var t = (i+j+k)*G3;
    var x0 = xin-i+t; // The x,y distances from the cell origin, unskewed.
    var y0 = yin-j+t;
    var z0 = zin-k+t;

    // For the 3D case, the simplex shape is a slightly irregular tetrahedron.
    // Determine which simplex we are in.
    var i1, j1, k1; // Offsets for second corner of simplex in (i,j,k) coords
    var i2, j2, k2; // Offsets for third corner of simplex in (i,j,k) coords
    if(x0 >= y0) {
      if(y0 >= z0)      { i1=1; j1=0; k1=0; i2=1; j2=1; k2=0; }
      else if(x0 >= z0) { i1=1; j1=0; k1=0; i2=1; j2=0; k2=1; }
      else              { i1=0; j1=0; k1=1; i2=1; j2=0; k2=1; }
    } else {
      if(y0 < z0)      { i1=0; j1=0; k1=1; i2=0; j2=1; k2=1; }
      else if(x0 < z0) { i1=0; j1=1; k1=0; i2=0; j2=1; k2=1; }
      else             { i1=0; j1=1; k1=0; i2=1; j2=1; k2=0; }
    }
    // A step of (1,0,0) in (i,j,k) means a step of (1-c,-c,-c) in (x,y,z),
    // a step of (0,1,0) in (i,j,k) means a step of (-c,1-c,-c) in (x,y,z), and
    // a step of (0,0,1) in (i,j,k) means a step of (-c,-c,1-c) in (x,y,z), where
    // c = 1/6.
    var x1 = x0 - i1 + G3; // Offsets for second corner
    var y1 = y0 - j1 + G3;
    var z1 = z0 - k1 + G3;

    var x2 = x0 - i2 + 2 * G3; // Offsets for third corner
    var y2 = y0 - j2 + 2 * G3;
    var z2 = z0 - k2 + 2 * G3;

    var x3 = x0 - 1 + 3 * G3; // Offsets for fourth corner
    var y3 = y0 - 1 + 3 * G3;
    var z3 = z0 - 1 + 3 * G3;

    // Work out the hashed gradient indices of the four simplex corners
    i &= 255;
    j &= 255;
    k &= 255;
    var gi0 = gradP[i+   perm[j+   perm[k   ]]];
    var gi1 = gradP[i+i1+perm[j+j1+perm[k+k1]]];
    var gi2 = gradP[i+i2+perm[j+j2+perm[k+k2]]];
    var gi3 = gradP[i+ 1+perm[j+ 1+perm[k+ 1]]];

    // Calculate the contribution from the four corners
    var t0 = 0.5 - x0*x0-y0*y0-z0*z0;
    if(t0<0) {
      n0 = 0;
    } else {
      t0 *= t0;
      n0 = t0 * t0 * gi0.dot3(x0, y0, z0);  // (x,y) of grad3 used for 2D gradient
    }
    var t1 = 0.5 - x1*x1-y1*y1-z1*z1;
    if(t1<0) {
      n1 = 0;
    } else {
      t1 *= t1;
      n1 = t1 * t1 * gi1.dot3(x1, y1, z1);
    }
    var t2 = 0.5 - x2*x2-y2*y2-z2*z2;
    if(t2<0) {
      n2 = 0;
    } else {
      t2 *= t2;
      n2 = t2 * t2 * gi2.dot3(x2, y2, z2);
    }
    var t3 = 0.5 - x3*x3-y3*y3-z3*z3;
    if(t3<0) {
      n3 = 0;
    } else {
      t3 *= t3;
      n3 = t3 * t3 * gi3.dot3(x3, y3, z3);
    }
    // Add contributions from each corner to get the final noise value.
    // The result is scaled to return values in the interval [-1,1].
    return 32 * (n0 + n1 + n2 + n3);

  };

  // ##### Perlin noise stuff

  function fade(t) {
    return t*t*t*(t*(t*6-15)+10);
  }

  function lerp(a, b, t) {
    return (1-t)*a + t*b;
  }

  // 2D Perlin Noise
  module.perlin2 = function(x, y) {
    // Find unit grid cell containing point
    var X = Math.floor(x), Y = Math.floor(y);
    // Get relative xy coordinates of point within that cell
    x = x - X; y = y - Y;
    // Wrap the integer cells at 255 (smaller integer period can be introduced here)
    X = X & 255; Y = Y & 255;

    // Calculate noise contributions from each of the four corners
    var n00 = gradP[X+perm[Y]].dot2(x, y);
    var n01 = gradP[X+perm[Y+1]].dot2(x, y-1);
    var n10 = gradP[X+1+perm[Y]].dot2(x-1, y);
    var n11 = gradP[X+1+perm[Y+1]].dot2(x-1, y-1);

    // Compute the fade curve value for x
    var u = fade(x);

    // Interpolate the four results
    return lerp(
        lerp(n00, n10, u),
        lerp(n01, n11, u),
       fade(y));
  };

  // 3D Perlin Noise
  module.perlin3 = function(x, y, z) {
    // Find unit grid cell containing point
    var X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    // Get relative xyz coordinates of point within that cell
    x = x - X; y = y - Y; z = z - Z;
    // Wrap the integer cells at 255 (smaller integer period can be introduced here)
    X = X & 255; Y = Y & 255; Z = Z & 255;

    // Calculate noise contributions from each of the eight corners
    var n000 = gradP[X+  perm[Y+  perm[Z  ]]].dot3(x,   y,     z);
    var n001 = gradP[X+  perm[Y+  perm[Z+1]]].dot3(x,   y,   z-1);
    var n010 = gradP[X+  perm[Y+1+perm[Z  ]]].dot3(x,   y-1,   z);
    var n011 = gradP[X+  perm[Y+1+perm[Z+1]]].dot3(x,   y-1, z-1);
    var n100 = gradP[X+1+perm[Y+  perm[Z  ]]].dot3(x-1,   y,   z);
    var n101 = gradP[X+1+perm[Y+  perm[Z+1]]].dot3(x-1,   y, z-1);
    var n110 = gradP[X+1+perm[Y+1+perm[Z  ]]].dot3(x-1, y-1,   z);
    var n111 = gradP[X+1+perm[Y+1+perm[Z+1]]].dot3(x-1, y-1, z-1);

    // Compute the fade curve value for x, y, z
    var u = fade(x);
    var v = fade(y);
    var w = fade(z);

    // Interpolate
    return lerp(
        lerp(
          lerp(n000, n100, u),
          lerp(n001, n101, u), w),
        lerp(
          lerp(n010, n110, u),
          lerp(n011, n111, u), w),
       v);
  };

})(typeof module === "undefined" ? this : module.exports);
},{}],19:[function(require,module,exports){
const container = require('../container');
const randomQuaternion = require('../utils/math').randomQuaternion;
const randomUnitVector = require('../utils/math').randomUnitVector;

class Asteroid {
	constructor(props) {
		props = props || {};
		this.__isAsteroid = true;
		this.size = props.size || 1;
		this.scene = container.scene;
		this.collisions = container.collisions;

		// const geometry = new THREE.IcosahedronGeometry(3.5 * this.size);
		const geometry = props.geometry || new THREE.BoxGeometry(3.5, 3.5, 3.5);
		geometry.computeFlatVertexNormals();
		const material = new THREE.MeshLambertMaterial({
			color: 0x999999
		});
		this.object = new THREE.Mesh(geometry, material);
		this.object.scale.set(this.size, this.size, this.size);
		this.object.quaternion.copy(randomQuaternion());
		if (props.position != null) {
			this.object.position.copy(props.position);
		}

		const speed = Math.random() * 0.03 / this.size / this.size;
		this.rotationSpeed = 
			new THREE.Quaternion().setFromAxisAngle(randomUnitVector(), speed);

		this.body = {
			type: 'mesh',
			onCollision: this.onCollision,
			mesh: this.object,
			entity: this,
			mask: [],
			static: true
		};
	}

	get position() {
		return this.object.position;
	}

	start() {
		this.scene.add(this.object);
		this.collisions.add(this.body);
	}

	tick(dt) {
		this.object.quaternion.multiply(this.rotationSpeed);
	}

	destroy() {
		this.scene.remove(this.object);	
		this.collisions.remove(this.body);
	}
}

module.exports = Asteroid;
},{"../container":33,"../utils/math":40}],20:[function(require,module,exports){
const container = require('../container');
const linearBillboard = require('../utils/math').linearBillboard;

class Beam {
	constructor(props) {
		this.target = props.target;
		this.turrent = props.turrent;

		this.scene = container.scene;		
		this.camera = container.camera;
		this.app = container.app;

		this.length = 0;
		const height = 0.5;

		this.dir = this.target.position.clone().sub(this.turrent.position).normalize();
		this.quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), this.dir);

		this.geometry = new THREE.Geometry();
		this.geometry.vertices.push(
			new THREE.Vector3(0, -height, 0),
			new THREE.Vector3(0, height, 0),
			new THREE.Vector3(1, height, 0),
			new THREE.Vector3(1, -height, 0)
		);

		this.geometry.faces.push(
			new THREE.Face3(2, 1, 0),
			new THREE.Face3(2, 0, 3)
		);

		this.material = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			side: THREE.DoubleSide
		});

		this.mesh = new THREE.Mesh(this.geometry, this.material);
		
		this.object = new THREE.Object3D();
		this.object.add(this.mesh);

		this.r = Math.random() * Math.PI / 2;

		this.life = 1.0;
		this.counter = 0;

		this.speed = 50;
	}

	start() {
		this.scene.add(this.object);
	}

	tick(dt) {
		this.dir = this.target.position.clone().sub(this.turrent.position).normalize();
		this.quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), this.dir);
		this.length += this.speed;

		linearBillboard(this.camera, this.object, this.dir, this.quaternion);

		const date = new Date().getTime();

		const widthNoise =
	    Math.sin(date / 17 + this.r) * 0.3 +
  	  Math.sin((date + 123 + this.r) / 27) * 0.4 +
    	Math.sin((date + 234 + this.r) / 13) * 0.4;

    const t = this.counter / this.life;
    const width = 2;

		this.mesh.scale.y = Math.sin(t * Math.PI) * width + widthNoise;
		this.mesh.scale.y *= 0.7;
		this.mesh.scale.x = this.length;

		this.object.position.copy(this.turrent.position);

		this.counter += dt;
		if (this.counter > this.life) {
			this.app.destroy(this);
		}
	}

	destroy() {
		this.scene.remove(this.object);	
	}
}	

module.exports = Beam;
},{"../container":33,"../utils/math":40}],21:[function(require,module,exports){
const container = require('../container');

class DragCamera {
	constructor(props) {
		this.rotation = new THREE.Euler(-Math.PI / 4, Math.PI / 4, 0, 'YXZ');
		this.distance = 50;
		this.target = new THREE.Vector3();
		this.camera = container.camera;
		this.up = new THREE.Vector3(0, 1, 0);
		this.isDrag = false;
		this.lastX = 0;
		this.lastY = 0;
		this.xSpeed = 0.01;
		this.ySpeed = 0.01;

		this.onMouseWheel = this.onMouseWheel.bind(this);
		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
	}

	start() {
		window.addEventListener('mousewheel', this.onMouseWheel);
		window.addEventListener('mousedown', this.onMouseDown);
		window.addEventListener('mouseup', this.onMouseUp);
		window.addEventListener('mousemove', this.onMouseMove);
	}

	onMouseWheel(e) {
		const scale = 1 + e.deltaY / 1000;
		this.distance *= scale;
	}

	onMouseDown(e) {
		this.isDrag = true;
	}

	onMouseUp(e) {
		this.isDrag = false;
	}

	onMouseMove(e) {
		if (this.isDrag) {
			const diffX = e.clientX - this.lastX;
			const diffY = e.clientY - this.lastY;

			this.rotation.x += diffY * this.ySpeed;
			this.rotation.y += diffX * this.xSpeed;
		}

		this.lastX = e.clientX;
		this.lastY = e.clientY;
	}
	
	tick() {
		const position = this.target.clone()
			.add(new THREE.Vector3(0, 0, 1)
				.applyEuler(this.rotation)
				.multiplyScalar(this.distance));
		this.camera.position.copy(position);
		this.camera.lookAt(this.target, this.up);
	}

	destroy() {
		window.removeEventListener('mousewheel', this.onMouseWheel);
	}
};

module.exports = DragCamera;
},{"../container":33}],22:[function(require,module,exports){
const container = require('../container');
const ParticleSystem = require('./particlesystem');

class Engine {
  constructor(props) {
    this.props = props;
    this.object = new THREE.Object3D();
    this.scene = container.scene;
    this.app = container.app;
    this.particleVelocity = new THREE.Vector3();
    this.amount = 0;

    this.particleSystem = this.app.add(ParticleSystem, {
      scale: [ ((p) => {
      	return p._size;
      }), 0],
      life: ((p) => {
        return p._size * 150;
      }),
      interval: 30,
      velocity: this.particleVelocity,
      autoPlay: false,
      onParticle: (p) => {
        p._size = Math.random() + 1;
      }
    });
  }

  start() {
    const ship = this.props.ship;
    const coord = this.props.coord;
    ship.innerObject.add(this.object);
    this.object.position
      .fromArray(coord)
      .add(new THREE.Vector3(0.5, 0.5, 0.5))
      .add(new THREE.Vector3(0, 0, 1));

    this.updateParticleSystem();
  }

  tick(dt) {
    this.updateParticleSystem();
  }

  destroy() {
    this.app.destroy(this.particleSystem);
  }

  updateParticleSystem() {
    this.particleSystem.amount = Math.abs(this.amount);
    if (this.amount === 0 && this.particleSystem.playing) {
      this.particleSystem.pause();
    } else if (this.amount > 0 && !this.particleSystem.playing) {
      this.particleSystem.play();
    }
    this.particleSystem.position.copy(this.object.getWorldPosition());
    const rotation = this.object.getWorldRotation();
    const direction = new THREE.Vector3(0, 0, 1).applyEuler(rotation);
    this.particleVelocity.copy(direction.multiplyScalar(10));
  }
};

module.exports = Engine;

},{"../container":33,"./particlesystem":26}],23:[function(require,module,exports){
const container = require('../container');

class Grid {
  // 01 02 03 04 05
  //   11 12 13 14 15
  // 21 22 23 24 25
  //   31 32 33 34 35
  //   
  // 000
  // 100
  constructor(props) {
    props = props || {};
    this.axis = [1, Math.sqrt(3) / 2];
    this.scene = container.scene;
    this.width = props.width || 100;
    this.height = props.height || 100;
    this.size = props.size || 12;
  }

  hexToCoord(i, j) {
    i -= this.width / 2;
    j -= this.height / 2;
    return [
      (this.axis[0] * i + ((j % 2 === 0) ? this.axis[1] / 2 : 0)) * this.size,
      this.axis[1] * j * this.size
    ];
  }

  getSurroundingCoords(coord) {
    const i = coord[0];
    const j = coord[1];

    if (j % 2 === 0) {
      return [
        [i - 1, j - 1],
        [i, j - 1],
        [i - 1, j],
        [i + 1, j],
        [i, j + 1],
        [i - 1, j + 1],
      ];
    } else {
      return [
        [i + 1, j - 1],
        [i, j - 1],
        [i - 1, j],
        [i + 1, j],
        [i, j + 1],
        [i + 1, j + 1],
      ];
    }
  }

  start() {
    for (let i = 0; i < this.width; i++) {
      for (let j = 0; j < this.height; j++) {

        const sprite = new THREE.Sprite();
        const screen = this.hexToCoord(i, j);
        sprite.position.x = screen[0];
        sprite.position.z = screen[1];

        // this.scene.add(sprite);
      }
    }
  }

  place(ships, side) {

  }
}

module.exports = Grid;

},{"../container":33}],24:[function(require,module,exports){
const container = require('../container');

class Laser {
  constructor(props) {
    this.target = props.target;
    this.turrent = props.turrent;

    this.scene = container.scene;
    this.app = container.app;
    this.collisions = container.collisions;

    this.object = new THREE.Sprite();
    this.object.scale.set(2, 2, 2);

    this.speed = 200;

    this.life = 1000;

    this.onCollision = this.onCollision.bind(this);

    this.body = {
      type: 'ray',
      raycaster: new THREE.Raycaster(),
      onCollision: this.onCollision,
      entity: this
    };
  }

  onCollision(collision) {
    const entity = collision.body.entity;
    if (entity === this.turrent.ship) {
      return;
    }

    // Explosion
    this.app.destroy(this);
  }

  start() {
  	this.object.position.copy(this.turrent.position);
  	this.scene.add(this.object);

    const dis = this.turrent.position.distanceTo(this.target.position);
    const time = dis / this.speed;
    const leading = this.target.velocity.clone().multiplyScalar(time);
  	this.velocity = this.target.position.clone()
      .add(leading)
      .sub(this.turrent.position)
      .normalize()
      .multiplyScalar(this.speed);

  	this.dieTime = new Date().getTime() + this.life;

    this.collisions.add(this.body);
  }

  destroy() {
  	this.scene.remove(this.object);
    this.collisions.remove(this.body);
  }

  tick(dt) {
    const velocity = this.velocity.clone().multiplyScalar(dt);
  	this.object.position.add(velocity);

  	if (new Date().getTime() > this.dieTime) {
  		this.app.destroy(this);
  	}

    this.body.raycaster = new THREE.Raycaster(
      this.object.position, 
      velocity.clone().normalize(),
      0,
      velocity.length());
  }
}

module.exports = Laser;

},{"../container":33}],25:[function(require,module,exports){
const container = require('../container');

class Value {
	constructor(value, object) {
		this.value = value;
		this.object = object;

		this.isNumber = typeof value === 'number';
		this.isFunc = typeof value === 'function';
		// Linear intervals
		this.intervals = [];

		if (Array.isArray(value)) {
			const values = value.map((v) => {
				if (typeof v === 'function') {
					return v(this.object);
				}
				return v;
			});

			for (let i = 0; i < values.length; i++) {
				const interval = {
					t: i / values.length,
					v: values[i]
				};
				if (i < values.length - 1) {
					interval.vd = values[i + 1] - values[i];
				}
				this.intervals.push(interval);
			}
		}
	}

	get(t) {
		t = t || 0;
		if (this.isNumber) {
			return this.value;
		} else if (this.isFunc) {
			return this.value(this.object);
		} else if (this.intervals.length > 0) {
			let interval;
			if (t > 1) {
				return this.intervals[this.intervals.length - 1].v;
			}

			for (let i = 0; i < this.intervals.length; i++) {
				interval = this.intervals[i];
				if (t < interval.t) {
					continue;
				}

				const td = t - interval.t;
				const vd = interval.vd;
				return interval.v + td * vd;
			}
		}
	}
}

class Particle {
	constructor(props) {
		this.props = props;

		this.parent = props.parent;
		this.object = new THREE.Sprite(props.material);
		this.app = container.app;
	}

	initProps() {
		this.life = new Value(this.props.life, this);
		this.velocity = this.props.velocity;
		this.scale = new Value(this.props.scale, this);
	}

	start() {
		this.parent.add(this.object);
		this.startTimer = new Date().getTime();
		this.timer = new Date().getTime() + this.life.get();
	}

	tick(dt) {
		this.object.position.add(this.velocity.clone().multiplyScalar(dt));
		const t = (new Date().getTime() - this.startTimer) / this.life.get();
		const scale = this.scale.get(t);
		this.object.scale.set(scale, scale, scale);

		if (new Date().getTime() > this.timer) {
			this.app.destroy(this);
		}
	}

	destroy() {
		this.object.parent.remove(this.object);
	}
}

module.exports = Particle;
},{"../container":33}],26:[function(require,module,exports){
const container = require('../container');
const Particle = require('./particle');

const defaultMaterial = new THREE.SpriteMaterial();

class ParticleSystem {
	constructor(props) {
		props = props || {};

		this.material = props.material || defaultMaterial;
		this.materials = this.material.length > 0 ? this.material : [];
		this.parent = props.parent || container.scene;
		this.autoPlay = props.autoPlay === undefined ? true : props.autoPlay;
		this.onParticle = props.onParticle;

		this.particleProps = props.particleProps;

		if (this.particleProps == null) {
			this.life = props.life;
			this.interval = props.interval;
			this.velocity = props.velocity;
			this.scale = props.scale;
			this.defaultParticleProps(this);
		}

		this._timeout = null;
		this.emit = this.emit.bind(this);
		this.app = container.app;
		this.position = new THREE.Vector3();

		this.playing = false;

		this.amount = 1;
	}

	defaultParticleProps(obj) {
		obj.life = obj.life || 5000;
		obj.interval = obj.interval || 1000;
		obj.velocity = obj.velocity || new THREE.Vector3(0, 2, 0);
		obj.scale = obj.scale || 1;	
		obj.parent = obj.parent || container.scene;
		return obj;
	}

	start() {
		if (this.autoPlay) {
			this.play();	
		}
	}

	play() {
		this.emit();
		this.playing = true;
	}

	pause() {
		if (this._timeout != null) {
			clearTimeout(this._timeout);
		}
		this.playing = false;
	}

	emit() {
		let props;
		const material = this.materials.length > 0 ? this.materials[Math.floor(Math.random() * this.materials.length)] : this.material;
		if (this.particleProps == null) {
			props = {
				life: this.life,
				velocity: this.velocity,
				material: material,
				parent: this.parent,
				scale: this.scale
			};
		} else {
			props = this.defaultParticleProps(this.particleProps());
		}
		const particle = this.app.add(Particle, props);
		if (this.onParticle != null) {
			this.onParticle(particle);
		}
		particle.initProps();
		particle.object.position.copy(this.position);
		this._timeout = setTimeout(this.emit, this.interval / this.amount);
	}
}

module.exports = ParticleSystem;
},{"../container":33,"./particle":25}],27:[function(require,module,exports){
const container = require('../../container');

class AI {
	constructor(props) {
		this.ships = container.ships;

		this.ship = props.ship;
		this.thinkCooldown = 0.1;
		this.nextThink = 0;
		this.target = null;
	}

	think() {
		this.ship.orbit(new THREE.Vector3(0, 0, 0), 100);

		for (let i = 0; i < this.ship.turrents.length; i ++) {
			const turrent = this.ship.turrents[i];
			turrent.fire({
				position: new THREE.Vector3(),
				velocity: new THREE.Vector3()
			});
		}

		if (this.target == null) {
			const ships = this.ships.getTargets(this.ship);

			if (ships.length > 0) {
				ships.sort((a, b) => {
					return a.position.distanceTo(this.ship.position) - 
						b.position.distanceTo(this.ship.position);
				});
				this.target = ships[0];
			} 
		}

		if (this.target == null) {
			return;
		}

		this.ship.orbit(this.target.position, 100);

		// demo
		// this.ascend(10);
		
		for (let i = 0; i < this.ship.turrents.length; i ++) {
			const turrent = this.ship.turrents[i];
			turrent.fire({
				position: this.target.position,
				velocity: this.target.velocity
			});
		}
	}

	start() {
		this.nextThink = new Date().getTime() + this.thinkCooldown;
	}

	tick(dt) {
		if (new Date().getTime() > this.nextThink) {
			this.think();
			this.nextThink = new Date().getTime() + this.thinkCooldown;
		}
	}
};

module.exports = AI;
},{"../../container":33}],28:[function(require,module,exports){
(function (global){
const container = require('../../container');
const THREE = (typeof window !== "undefined" ? window['THREE'] : typeof global !== "undefined" ? global['THREE'] : null);
const Chunks = require('../../voxel/chunks');
const mesher = require('../../voxel/mesher');
const reader = require('./reader');
const normalizeAngle = require('../../utils/math').normalizeAngle;
const clamp = require('../../utils/math').clamp;
const AI = require('./ai');

class Ship {
	constructor(props) {
		this.__isShip = true;

		this.props = props;
		this.scene = container.scene;
		this.app = container.app;
		this.collisions = container.collisions;

		this.object = new THREE.Object3D();
		this.object.rotation.order = 'YXZ';

		if (props.rotation != null) {
			this.object.rotation.copy(props.rotation);
		}

		this.innerObject = new THREE.Object3D();
		this.innerObject.rotation.order = 'YXZ';
		this.object.add(this.innerObject);
		this.chunks = new Chunks();

		this.engines = [];
		this.turrents = [];

		this.turnSpeed = 0;

		this.turnAmount = 0;
		this.forwardAmount = 0;
		this.maxTurnSpeed = 0.03;
		this.power = 10;

		this.velocity = new THREE.Vector3();

		this.friction = 0.5;

		this.hull = [];

		this.ai = new AI({
			ship: this
		});

		this.side = props.side || 0;

		this.hull = [];
		this.center = new THREE.Vector3();

		this.onCollision = this.onCollision.bind(this);
		this.body = {
			type: 'mesh',
			onCollision: this.onCollision,
			entity: this
		}
	}

	onCollision(collision) {
		const dt = this.app.delta;
		const entity = collision.body.entity;
		if (entity.__isAsteroid || entity.__isShip) {
			this.velocity.add(
				this.position.clone().sub(entity.position).normalize()
				.multiplyScalar((collision.minDis - collision.dis) * dt * 10)
			);
		}
	}

	get position() {
		return this.object.position;
	}

	get rotation() {
		return this.object.rotation;
	}

	start() {
		this.material = [ null, new THREE.MeshBasicMaterial({
			color: 0xffffff
		}) ];

		this.scene.add(this.object);
	
		const result = reader(this.props.data, this);

		this.ai.start();

		this.collisions.add(this.body);

		mesher(this.chunks, this.innerObject, this.material);

		const collisionGeometry = new THREE.Geometry();

		this.innerObject.children.forEach((mesh) => {
			collisionGeometry.mergeMesh(mesh);
		});

		this.body.mesh = new THREE.Mesh(collisionGeometry);
	}

	destroy() {
		this.scene.remove(this.object);
		this.collisions.remove(this.body);
	}

	tick() {
		const dt = this.app.delta;
		this.ai.tick(dt);
		mesher(this.chunks, this.innerObject, this.material);

		// Step turrents
		for (let i = 0; i < this.turrents.length; i ++) {
			const turrent = this.turrents[i];
			turrent.tick(dt);
		}

		// Step yaw
		const turnAcceleration = 0.1;
		const desiredTurnSpeed = this.turnAmount * this.maxTurnSpeed;

		if (this.turnSpeed < desiredTurnSpeed) {
			this.turnSpeed += turnAcceleration * dt;
		} else if (this.turnSpeed > desiredTurnSpeed) {
			this.turnSpeed -= turnAcceleration * dt;
		}

		if (this.turnSpeed < -this.maxTurnSpeed) {
			this.turnSpeed = -this.maxTurnSpeed;
		} else if (this.turnSpeed > this.maxTurnSpeed) {
			this.turnSpeed = this.maxTurnSpeed;
		}

		// Step roll
		this.object.rotation.y += this.turnSpeed;

		const ratio = this.turnSpeed / this.maxTurnSpeed;

		const maxRollAmount = Math.PI / 4;
		const angle = ratio * maxRollAmount;

		this.object.rotation.z += (angle - this.object.rotation.z) * 0.01;

		// this.turnAmount = 0;

		// Step forward
		const acc = new THREE.Vector3(0, 0, -1)
			.applyEuler(this.object.rotation)
			.multiplyScalar(this.forwardAmount * this.power * dt);

		this.velocity.add(acc);
		this.object.position.add(this.velocity.clone().multiplyScalar(dt));

		this.velocity.multiplyScalar(Math.pow(this.friction, dt));

		this.engines.forEach((engine) => {
			engine.amount = this.forwardAmount;
		});

		this.body.mesh.position.copy(this.position);
	}

	ascend(y) {
		const yDiff = y - this.object.position.y;
		const desiredYSpeed = yDiff * 0.1;
		const ySpeedDiff = desiredYSpeed - this.velocity.y;
		const desiredYAcc = ySpeedDiff * 0.1;

		let ratio = desiredYAcc / this.power;
		if (ratio > 1.0) {
			ratio = 1.0;
		} else if (ratio < -1.0) {
			ratio = -1.0;
		}

		let desiredPitch = Math.asin(ratio);

		const maxPitch = 0.3

		if (desiredPitch > maxPitch) {
			desiredPitch = maxPitch;
		} else if (desiredPitch < -maxPitch) {
			desiredPitch = -maxPitch;
		}

		const pitchDiff = desiredPitch - this.rotation.x;

		const desiredPitchSpeed = pitchDiff;

		const maxPitchSpeed = 0.03;


		this.rotation.x += clamp(desiredPitchSpeed, -maxPitchSpeed, maxPitchSpeed);
	}

	turn(amount) {
		this.turnAmount = amount;
	}

	forward(amount) {
		this.forwardAmount = amount;
	}

	align(point) {
		const angleDiff = this.getAngleDiff(point);
		const desiredTurnSpeed = angleDiff * 0.1;

		let desiredTurnAmount = desiredTurnSpeed / this.maxTurnSpeed;
		if (desiredTurnAmount > 1) {
			desiredTurnAmount = 1;
		} else if (desiredTurnAmount < -1) {
			desiredTurnAmount = -1;
		}

		this.turn(desiredTurnAmount);
	}

	orbit(point, distance) {
		let dis = this.object.position.clone().sub(point);
		dis.y = 0;
		dis = dis.normalize().multiplyScalar(distance);
		const a = point.clone().add(
			dis.clone().applyEuler(new THREE.Euler(0, Math.PI / 3, 0)));
		const b = point.clone().add(
			dis.clone().applyEuler(new THREE.Euler(0, -Math.PI / 3, 0)));

		const diffA = this.getAngleDiff(a);
		const diffB = this.getAngleDiff(b);

		if (Math.abs(diffA) < Math.abs(diffB)) {
			this.align(a);
		} else {
			this.align(b);
		}

		this.forward(1.0);
	}

	getAngleDiff(point) {
		const angle = Math.atan2(point.x - this.object.position.x, point.z - this.object.position.z) - Math.PI;
		const angleDiff = angle - this.object.rotation.y;
		return normalizeAngle(angleDiff);
	}
}

module.exports = Ship;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../../container":33,"../../utils/math":40,"../../voxel/chunks":42,"../../voxel/mesher":43,"./ai":27,"./reader":29}],29:[function(require,module,exports){
const container = require('../../container');
const Engine = require('../engine');
const Turrent = require('./turrent');
const Beam = require('../beam');
const Laser = require('../laser');

const reader = (data, ship) => {
	const lines = data.split('\n');
	const chunks = ship.chunks;
	const engines = ship.engines;

	let line;
	let current;
	let z = 0;
	let char;

	const result = {
		modules: []
	};

	const app = container.app;

	for (let i = 0; i < lines.length; i++) {
		line = lines[i];

		if (line === 'HULL') {
			current = 'HULL';
			z = 0;
		} else if (line === 'MODULES') {
			current = 'MODULES';
			z = 0;
		} else if (current === 'HULL') {
			for (let x = 0; x < line.length; x++) {
				char = line[x];

				if (char === '0') {
					chunks.set(x, 0, z, 1);
					ship.hull.push([x, 0, z, 1]);
				}
			}
			z++;
		} else if (current === 'MODULES') {
			for (let x = 0; x < line.length; x++) {
				char = line[x];
				if (char === 'E') {
					const engine = app.add(Engine, {
						ship: ship,
						coord: [x, 0, z]
					});
					engines.push(engine);
				} else if (char === 'L' || char === 'l') {
					const type = Laser;
					const cooldown = 0.1;
					const reloadTime = 1.0;
					const clip = 3;

					ship.turrents.push(new Turrent({
						coord: [x, 0, z],
						ship: ship,
						type, cooldown, reloadTime, clip
					}));
				}
			}
			z++;
		}
	}

	const center = [ 0, 0, 0 ];
	for (let i = 0; i < ship.hull.length; i++) {
		const v = ship.hull[i];
		center[0] += v[0];
		center[1] += v[1];
		center[2] += v[2];
	}
	center[0] /= ship.hull.length;
	center[1] /= ship.hull.length;
	center[2] /= ship.hull.length;
	
	center[0] += 0.5;
	center[1] += 0.5;
	center[2] += 0.5;

	ship.center.fromArray(center);

	ship.innerObject.position.fromArray(center).multiplyScalar(-1);

	return result;
};

module.exports = reader;
},{"../../container":33,"../beam":20,"../engine":22,"../laser":24,"./turrent":31}],30:[function(require,module,exports){
const container = require('../../container');

class Ships {
  constructor() {
    this.app = container.app;
    container.ships = this;
    this.onAdd = this.onAdd.bind(this);
    this.onDestroy = this.onDestroy.bind(this);

    this.sides = {};
  }

  getTargets(ship) {
  	const targets = [];
  	for (let side in this.sides) {
      if (side === ship.side) {
        continue;
      }
  		for (let id in this.sides[side]) {
  			targets.push(this.sides[side][id]);
  		}
  	}

  	return targets;
  }

  onAdd(component) {
    if (!component.__isShip) {
			return;
    }

    if (this.sides[component.side] == null) {
    	this.sides[component.side] = {};
    }

    this.sides[component.side][component._id] = component;
  }

  onDestroy(component) {
    if (!component.__isShip) {
			return;
    }

    delete this.sides[component.side][component._id];
  }

  start() {
    for (let id in this.app.map) {
      this.onAdd(this.app.map[id]);
    }
    this.app.on('add', this.onAdd);
    this.app.on('destory', this.onDestroy);
  }

  destroy() {
  	this.app.off('add', this.onAdd);
  	this.app.off('destory', this.onDestroy);
  }
}

module.exports = Ships;

},{"../../container":33}],31:[function(require,module,exports){
const container = require('../../container');

class Turrent {
	constructor(props) {
		this.app = container.app;

		this.localPosition = 
			new THREE.Vector3()
				.fromArray(props.coord)
				.add(new THREE.Vector3(0.5, 0.5, 0.5));
		this.ship = props.ship;

		this.type = props.type;

		this.cooldown = props.cooldown || 0;
		this.clip = props.clip || 0;
		this.reloadTime = props.reloadTime || 1;

		this.ammo = this.clip;

		this._counter = 0;
		this._reloadTimer = 0;
	}

	tick(dt) {
		if (this.cooldown == 0) {
			return;
		}
		if (this._counter > this.cooldown) {
			return;
		}
		this._counter += dt;
	}

	fire(target) {
		if (this.ammo <= 0) {
			if (this._reloadTimer === 0) {
				// Set reload timer
				this._reloadTimer = this.app.time + this.reloadTime;
				return;
			} else if (this.app.time > this._reloadTimer) {
				// Reload done
				this._reloadTimer = 0;
				this.ammo = this.clip;
			} else {
				// Reloading...
				return;
			}
		}

		if (this.cooldown == 0) {
			return;
		}

		if (this._counter > this.cooldown) {
			this._fire(target);
			this.ammo--;
			this._counter -= this.cooldown;
		}
	}

	get position() {
		return this.ship.innerObject.localToWorld(this.localPosition.clone());
	}

	// target { position }
	_fire(target) {
		const vector = target.position.clone().sub(this.position);

		this.app.add(this.type, {
			target: target,
			turrent: this
		});
	}
}

module.exports = Turrent;
},{"../../container":33}],32:[function(require,module,exports){
var randomUnitVector = require('../utils/math').randomUnitVector;
const container = require('../container');

module.exports = function() {
  var scene = container.scene;
  var dragCamera = container.dragCamera;
  var object = new THREE.Object3D();

  function start() {
    var spread = 1000;
    for (var i = 0; i < 120; i++) {
      var size = 2 + Math.pow(Math.random(), 3) * 8;
      var sprite = new THREE.Sprite();
      sprite.scale.set(size, size, size);
      var position = randomUnitVector().multiplyScalar(1000);
      sprite.position.copy(position);
      object.add(sprite);
    }
    scene.add(object);
  };

  function tick(dt) {
    object.position.copy(dragCamera.target);

    const scale = dragCamera.distance / 200;
    object.scale.set(scale, scale, scale);
  };

  function destroy() {
    scene.remove(object);
  };

  function random() {
    return Math.random() - 0.5;
  }

  return {
    start: start,
    tick: tick,
    destroy: destroy
  };
};

},{"../container":33,"../utils/math":40}],33:[function(require,module,exports){
const Bottle = require('bottlejs');
const app = require('./core/app');

const bottle = new Bottle();
const container = bottle.container;

container.app = app;
container.renderer = app.renderer;
container.collisions = app.collisions;
container.scene = app.renderer.scene;
container.camera = app.renderer.camera;

module.exports = container;
},{"./core/app":34,"bottlejs":1}],34:[function(require,module,exports){
const guid = require('./guid');
const ee = require('event-emitter');
const renderer = require('./renderer');
const Collisions = require('./collisions');

const clone = (obj) => {
	const c = {};
	for (let key in obj) {
		c[key] = obj[key];
	}
	return c;
};

class App {
	constructor() {
		this.map = {};
		this._startMap = {};
		this._destroyMap = {};

		this.renderer = renderer;
		this.collisions = new Collisions({ app: this });

		this.animate = this.animate.bind(this);
		
		this.time = 0;
		this.delta = 1000 / 60;
	}

	add(type, props) {
		const component = new type(props);
		component._id = guid();
		this.map[component._id] = component;
		this._startMap[component._id] = component;
		this.emit('add', component);
		return component;
	}

	destroy(component) {
		this._destroyMap[component._id] = component;
		this.emit('destroy', component);
	}

	tick(dt) {
		this.collisions.tick();
		
		let id, component;

		const _startMap = clone(this._startMap);
		this._startMap = {};

		for (id in _startMap) {
			component = _startMap[id];
			if (component.start != null) {
				component.start();
			}
		}

		for (id in this.map) {
			component = this.map[id];
			if (component.tick != null) {
				component.tick(dt);
			}
		}

		const _destroyMap = clone(this._destroyMap);
		this._destroyMap = {};
		
		for (id in _destroyMap) {
			component = _destroyMap[id];
			if (component.destroy != null) {
				component.destroy();
			}
			delete this.map[component._id];
		}

		this.renderer.render();
	}

	animate() {
		const frameRate = 1 / 60;
		
		this.tick(frameRate);

		this.time += frameRate;
		this.delta = frameRate;

		requestAnimationFrame(this.animate);
	}

	start() {
		this.animate();
	}
};

ee(App.prototype);

module.exports = new App();
},{"./collisions":35,"./guid":36,"./renderer":37,"event-emitter":16}],35:[function(require,module,exports){
const guid = require('./guid');

class Collisions {
  constructor(props) {
    this.map = {};
    this.app = props.app;
  }

  add(body) {
    if (body._id == null) {
      body._id = guid();
    }

    body.group = body.group || 'default';
    body.mask = body.mask || ['default'];

    if (this.map[body.group] == null) {
      this.map[body.group] = {};
    }
    this.map[body.group][body._id] = body;
  }

  remove(body) {
    delete this.map[body.group][body._id];
  }

  tick() {
    let a, b, group2;

    const resolved = {};

    for (let group in this.map) {
      for (let id in this.map[group]) {
        a = this.map[group][id];

        if (a.static) {
          continue;
        }

        for (let i = 0; i < a.mask.length; i++) {
          group2 = this.map[a.mask[i]];
          for (let id2 in group2) {
            b = group2[id2];

            if (a === b) {
              continue;
            }

            if (resolved[a._id] != null && resolved[a._id][b._id]) {
            	continue;
            }

            // Resolve a, b				
            if (a.type === 'ray' && b.type === 'mesh') {
              this.hitTestRayMesh(a, b);
            } else if (a.type === 'mesh' && b.type === 'ray') {
              this.hitTestRayMesh(b, a);
            } else if (a.type === 'mesh' && b.type === 'mesh') {
              this.hitTestMeshMesh(a, b);
            }

            // Mark resolved
            if (resolved[a._id] == null) {
            	resolved[a._id] = {};
            }
            resolved[a._id][b._id] = true;
            if (resolved[b._id] == null) {
            	resolved[b._id] = {};
            }
            resolved[b._id][a._id] = true;
          }
        }
      }
    }
  }

  hitTestRayMesh(ray, mesh) {
    const delta = this.app.delta;

    const raycaster = ray.raycaster;
    const results = raycaster.intersectObject(mesh.mesh, true);

    if (results.length === 0) {
      return;
    }

    if (ray.onCollision != null) {
      ray.onCollision({
        results: results,
        body: mesh
      });
    }

    if (mesh.onCollision != null) {
      mesh.onCollision({
        results: results,
        body: ray
      });
    }
  }

  hitTestMeshMesh(a, b) {
    if (a.mesh.geometry.boundingSphere == null) {
      a.mesh.geometry.computeBoundingSphere();
    }
    if (b.mesh.geometry.boundingSphere == null) {
      b.mesh.geometry.computeBoundingSphere();
    }

    const dis = a.mesh.position.distanceTo(b.mesh.position);
    const minDis = a.mesh.geometry.boundingSphere.radius + b.mesh.geometry.boundingSphere.radius;
    
    if (dis > minDis) {
      return;
    }

    if (a.onCollision != null) {
      a.onCollision({
        dis: dis,
        minDis: minDis,
        body: b
      });
    }

    if (b.onCollision != null) {
      b.onCollision({
        dis: dis,
        minDis: minDis,
        body: a
      });
    } 
  }
};

module.exports = Collisions;

},{"./guid":36}],36:[function(require,module,exports){
function guid() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000)
      .toString(16)
      .substring(1);
  }
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
    s4() + '-' + s4() + s4() + s4();
}

module.exports = guid;
},{}],37:[function(require,module,exports){
(function (global){
const THREE = (typeof window !== "undefined" ? window['THREE'] : typeof global !== "undefined" ? global['THREE'] : null);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 50000);
camera.position.z = 5;

const render = () => {
	renderer.render(scene, camera);
};

const animate = () => {
	render();
	requestAnimationFrame(animate);
};

const onResize = () => {
	renderer.setSize(window.innerWidth, window.innerHeight);
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
};

window.addEventListener('resize', onResize);

animate();

module.exports = {
	render,
	scene,
	camera
};
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{}],38:[function(require,module,exports){
const app = require('./core/app');
const container = require('./container');
const Ship = require('./components/ship');
const DragCamera = require('./components/dragcamera');
const Asteroid = require('./components/asteroid');
const Grid = require('./components/grid');
const Ships = require('./components/ship/ships');
const Stars = require('./components/stars');

app.start();
app.add(Ships);

const dragCamera = app.add(DragCamera);
container.dragCamera = dragCamera;
dragCamera.distance = 200;

app.add(Stars);

const frigate = require('./ships/frigate');
app.add(Ship, { 
	data: frigate, 
	side: '0' });

// app.add(Ship, { 
// 	data: frigate, 
// 	side: '1' });

const grid = app.add(Grid);

const noise = require('perlin').noise;
noise.seed(Math.random());

const asteroids = {};

for (let i = 0; i < grid.width; i++) {
	for (let j = 0; j < grid.height; j++) {
		const coord = grid.hexToCoord(i, j);
		const dis = Math.sqrt(coord[0] * coord[0] + coord[1] * coord[1]);

		let ratio = Math.pow((-dis + 500) / 500, 0.5);
		if (ratio > 1) {
			ratio = 1;
		} else if (ratio < 0) {
			ratio = 0;
		}

		const n1 = noise.simplex2(coord[0] * 0.005, coord[1] * 0.005) * 0.7;
		const n2 = noise.simplex2(coord[0] * 0.1, coord[1] * 0.1) * 0.7;

		const n3 = noise.simplex2(coord[0] * 0.0025, coord[1] * 0.0025) * 0.7;
		const n = (n1 + n2 + n3) * ratio;

		if (n > 0.7) {
			const size = n > 0.95 ? 4 : n > 0.9 ? 3 : n > 0.8 ? 2 : 1;

			const id = [i, j].join(',');
			asteroids[id] = {
				size: size,
				position: new THREE.Vector3(coord[0], 0, coord[1]),
				coord: [i, j]
			};
		}
	}
}

const shuffle = require('knuth-shuffle').knuthShuffle;
const ids = shuffle(Object.keys(asteroids));
for (let i = 0; i < ids.length; i++) {
	const asteroid = asteroids[ids[i]];
	if (asteroid.removed) {
		continue;
	}
	if (asteroid.size >= 3) {
		// Remove asteroid around
		const coords = grid.getSurroundingCoords(asteroid.coord);

		for (let j = 0; j < coords.length; j++) {
			const coord = coords[j];
			const id = coord.join(',');
			if (asteroids[id] == null) {
				continue;
			}
			asteroids[id].removed = true;
		}
	}
}

for (let id in asteroids) {
	const asteroid = asteroids[id];
	if (asteroid.removed) {
		continue;
	}
	app.add(Asteroid, {
		position: asteroid.position,
		size: asteroid.size
	});
}

const ambientLight = new THREE.AmbientLight(0xAAAAAA);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.7);
directionalLight.position.set(0.5, 1.0, 0.3);

const scene = app.renderer.scene;

scene.add(ambientLight);
scene.add(directionalLight);
},{"./components/asteroid":19,"./components/dragcamera":21,"./components/grid":23,"./components/ship":28,"./components/ship/ships":30,"./components/stars":32,"./container":33,"./core/app":34,"./ships/frigate":39,"knuth-shuffle":17,"perlin":18}],39:[function(require,module,exports){
module.exports = `
HULL
 0         0
 0   0 0   0
0000000000000
0000000000000
 0   0 0   0
          

MODULES
 0         0
 0   0l0   0
0000000000000
000000C000000
 E   0 0   E
          
`
},{}],40:[function(require,module,exports){
const randomUnitVector = () => {
  const theta = Math.random() * 2.0 * Math.PI;

  const rawX = Math.sin(theta);

  const rawY = Math.cos(theta);

  const z = Math.random() * 2.0 - 1.0;

  const phi = Math.asin(z);

  const scalar = Math.cos(phi);

  const x = rawX * scalar;

  const y = rawY * scalar;

  return new THREE.Vector3(x, y, z);  
}

const randomQuaternion = () => {
	const vector = randomUnitVector();
	return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), vector);
};

const normalizeAngle = (angle) => {
	angle %= (Math.PI * 2);
	if (angle > Math.PI) {
		angle -= Math.PI * 2;
	} else if (angle < -Math.PI) {
		angle += Math.PI * 2;
	}

	return angle;
};

const clamp = (v, min, max) => {
	if (v < min) {
		return min;
	} else if (v > max) {
		return max;
	}
	return v;
};

const linearBillboard = (camera, object, dir, quaternion) => {
	const a = object.position.clone().sub(camera.position).normalize();
	const b = a.clone().projectOnPlane(dir).normalize();
	const c = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion);

	const quat2 = new THREE.Quaternion().setFromUnitVectors(c, b);

	object.quaternion.copy(new THREE.Quaternion());
	object.quaternion.multiply(quat2);
	object.quaternion.multiply(quaternion);
}

module.exports = { randomUnitVector, randomQuaternion, normalizeAngle, clamp, linearBillboard };

},{}],41:[function(require,module,exports){
class Chunk {
	constructor(size) {
		this.size = size;
		this.yz = size * size;
		this.data = [];
	}

	get(i, j, k) {
		const index = i * this.yz + j * this.size + k;
		return this.data[index];
	}

	set(i, j, k, v) {
		const index = i * this.yz + j * this.size + k;
		this.data[index] = v;
	}
}

module.exports = Chunk;
},{}],42:[function(require,module,exports){
const Chunk = require('./chunk');

class Chunks {
	constructor(size) {
		this.size = size || 16;
		this.map = {};
	}

	get(i, j, k) {
		const origin = this.getOrigin(i, j, k);
		const id = origin.join(',');

		const region = this.map[id];
		if (region == null) {
			return null;
		} 

		return region.chunk.get(i - origin[0], j - origin[1], k - origin[2]);
	}

	set(i, j, k, v) {
		const origin = this.getOrigin(i, j, k);
		const id = origin.join(',');

		let region = this.map[id];
		if (region == null) {
			region = this.map[id] = {
				chunk: new Chunk(this.size),
				origin: origin
			};
		}
		region.dirty = true;
		this.dirty = true;

		region.chunk.set(i - origin[0], j - origin[1], k - origin[2], v);
	}

	getOrigin(i, j, k) {
		return [ 
			Math.floor(i / this.size) * this.size,
			Math.floor(j / this.size) * this.size,
			Math.floor(k / this.size) * this.size
		]
	}
};

module.exports = Chunks;
},{"./chunk":41}],43:[function(require,module,exports){
const mesher = require('./monotone').mesher;

const meshRegion = (region, object, material) => {
	if (region.mesh != null) {
		object.remove(region.mesh);
		region.mesh.geometry.dispose();
	}

	const geometry = new THREE.Geometry();
	const mesh = new THREE.Mesh(geometry, material);

	const chunk = region.chunk;

	const f = chunk.get.bind(chunk);
	const dims = [ chunk.size, chunk.size, chunk.size ];

	const result = mesher(f, dims);

	result.vertices.forEach((v) => {
		geometry.vertices.push(new THREE.Vector3(v[0], v[1], v[2]));
	});

	result.faces.forEach((f) => {
		const face = new THREE.Face3(f[0], f[1], f[2]);
		face.materialIndex = f[3];
		geometry.faces.push(face);
	});

	object.add(mesh);
	region.mesh = mesh;
};

const meshChunks = (chunks, object, material) => {
	if (!chunks.dirty) {
		return;
	}
	
	let id, region;
	for (id in chunks.map) {
		region = chunks.map[id];
		if (region.dirty) {
			meshRegion(region, object, material);
			region.dirty = false;
		}
	}
	chunks.dirty = false;
};

module.exports = meshChunks;
},{"./monotone":44}],44:[function(require,module,exports){
"use strict";

var MonotoneMesh = (function(){

function MonotonePolygon(c, v, ul, ur) {
  this.color  = c;
  this.left   = [[ul, v]];
  this.right  = [[ur, v]];
};

MonotonePolygon.prototype.close_off = function(v) {
  this.left.push([ this.left[this.left.length-1][0], v ]);
  this.right.push([ this.right[this.right.length-1][0], v ]);
};

MonotonePolygon.prototype.merge_run = function(v, u_l, u_r) {
  var l = this.left[this.left.length-1][0]
    , r = this.right[this.right.length-1][0]; 
  if(l !== u_l) {
    this.left.push([ l, v ]);
    this.left.push([ u_l, v ]);
  }
  if(r !== u_r) {
    this.right.push([ r, v ]);
    this.right.push([ u_r, v ]);
  }
};


return function(f, dims) {
  //Sweep over 3-axes
  var vertices = [], faces = [];
  for(var d=0; d<3; ++d) {
    var i, j, k
      , u = (d+1)%3   //u and v are orthogonal directions to d
      , v = (d+2)%3
      , x = new Int32Array(3)
      , q = new Int32Array(3)
      , runs = new Int32Array(2 * (dims[u]+1))
      , frontier = new Int32Array(dims[u])  //Frontier is list of pointers to polygons
      , next_frontier = new Int32Array(dims[u])
      , left_index = new Int32Array(2 * dims[v])
      , right_index = new Int32Array(2 * dims[v])
      , stack = new Int32Array(24 * dims[v])
      , delta = [[0,0], [0,0]];
    //q points along d-direction
    q[d] = 1;
    //Initialize sentinel
    for(x[d]=-1; x[d]<dims[d]; ) {
      // --- Perform monotone polygon subdivision ---
      var n = 0
        , polygons = []
        , nf = 0;
      for(x[v]=0; x[v]<dims[v]; ++x[v]) {
        //Make one pass over the u-scan line of the volume to run-length encode polygon
        var nr = 0, p = 0, c = 0;
        for(x[u]=0; x[u]<dims[u]; ++x[u], p = c) {
          //Compute the type for this face
          var a = (0    <= x[d]      ? f(x[0],      x[1],      x[2])      : 0)
            , b = (x[d] <  dims[d]-1 ? f(x[0]+q[0], x[1]+q[1], x[2]+q[2]) : 0);
          c = a;
          if((!a) === (!b)) {
            c = 0;
          } else if(!a) {
            c = -b;
          }
          //If cell type doesn't match, start a new run
          if(p !== c) {
            runs[nr++] = x[u];
            runs[nr++] = c;
          }
        }
        //Add sentinel run
        runs[nr++] = dims[u];
        runs[nr++] = 0;
        //Update frontier by merging runs
        var fp = 0;
        for(var i=0, j=0; i<nf && j<nr-2; ) {
          var p    = polygons[frontier[i]]
            , p_l  = p.left[p.left.length-1][0]
            , p_r  = p.right[p.right.length-1][0]
            , p_c  = p.color
            , r_l  = runs[j]    //Start of run
            , r_r  = runs[j+2]  //End of run
            , r_c  = runs[j+1]; //Color of run
          //Check if we can merge run with polygon
          if(r_r > p_l && p_r > r_l && r_c === p_c) {
            //Merge run
            p.merge_run(x[v], r_l, r_r);
            //Insert polygon into frontier
            next_frontier[fp++] = frontier[i];
            ++i;
            j += 2;
          } else {
            //Check if we need to advance the run pointer
            if(r_r <= p_r) {
              if(!!r_c) {
                var n_poly = new MonotonePolygon(r_c, x[v], r_l, r_r);
                next_frontier[fp++] = polygons.length;
                polygons.push(n_poly);
              }
              j += 2;
            }
            //Check if we need to advance the frontier pointer
            if(p_r <= r_r) {
              p.close_off(x[v]);
              ++i;
            }
          }
        }
        //Close off any residual polygons
        for(; i<nf; ++i) {
          polygons[frontier[i]].close_off(x[v]);
        }
        //Add any extra runs to frontier
        for(; j<nr-2; j+=2) {
          var r_l  = runs[j]
            , r_r  = runs[j+2]
            , r_c  = runs[j+1];
          if(!!r_c) {
            var n_poly = new MonotonePolygon(r_c, x[v], r_l, r_r);
            next_frontier[fp++] = polygons.length;
            polygons.push(n_poly);
          }
        }
        //Swap frontiers
        var tmp = next_frontier;
        next_frontier = frontier;
        frontier = tmp;
        nf = fp;
      }
      //Close off frontier
      for(var i=0; i<nf; ++i) {
        var p = polygons[frontier[i]];
        p.close_off(dims[v]);
      }
      // --- Monotone subdivision of polygon is complete at this point ---
      
      x[d]++;
      
      //Now we just need to triangulate each monotone polygon
      for(var i=0; i<polygons.length; ++i) {
        var p = polygons[i]
          , c = p.color
          , flipped = false;
        if(c < 0) {
          flipped = true;
          c = -c;
        }
        for(var j=0; j<p.left.length; ++j) {
          left_index[j] = vertices.length;
          var y = [0.0,0.0,0.0]
            , z = p.left[j];
          y[d] = x[d];
          y[u] = z[0];
          y[v] = z[1];
          vertices.push(y);
        }
        for(var j=0; j<p.right.length; ++j) {
          right_index[j] = vertices.length;
          var y = [0.0,0.0,0.0]
            , z = p.right[j];
          y[d] = x[d];
          y[u] = z[0];
          y[v] = z[1];
          vertices.push(y);
        }
        //Triangulate the monotone polygon
        var bottom = 0
          , top = 0
          , l_i = 1
          , r_i = 1
          , side = true;  //true = right, false = left
        
        stack[top++] = left_index[0];
        stack[top++] = p.left[0][0];
        stack[top++] = p.left[0][1];
        
        stack[top++] = right_index[0];
        stack[top++] = p.right[0][0];
        stack[top++] = p.right[0][1];
        
        while(l_i < p.left.length || r_i < p.right.length) {
          //Compute next side
          var n_side = false;
          if(l_i === p.left.length) {
            n_side = true;
          } else if(r_i !== p.right.length) {
            var l = p.left[l_i]
              , r = p.right[r_i];
            n_side = l[1] > r[1];
          }
          var idx = n_side ? right_index[r_i] : left_index[l_i]
            , vert = n_side ? p.right[r_i] : p.left[l_i];
          if(n_side !== side) {
            //Opposite side
            while(bottom+3 < top) {
              if(flipped === n_side) {
                faces.push([ stack[bottom], stack[bottom+3], idx, c]);
              } else {
                faces.push([ stack[bottom+3], stack[bottom], idx, c]);              
              }
              bottom += 3;
            }
          } else {
            //Same side
            while(bottom+3 < top) {
              //Compute convexity
              for(var j=0; j<2; ++j)
              for(var k=0; k<2; ++k) {
                delta[j][k] = stack[top-3*(j+1)+k+1] - vert[k];
              }
              var det = delta[0][0] * delta[1][1] - delta[1][0] * delta[0][1];
              if(n_side === (det > 0)) {
                break;
              }
              if(det !== 0) {
                if(flipped === n_side) {
                  faces.push([ stack[top-3], stack[top-6], idx, c ]);
                } else {
                  faces.push([ stack[top-6], stack[top-3], idx, c ]);
                }
              }
              top -= 3;
            }
          }
          //Push vertex
          stack[top++] = idx;
          stack[top++] = vert[0];
          stack[top++] = vert[1];
          //Update loop index
          if(n_side) {
            ++r_i;
          } else {
            ++l_i;
          }
          side = n_side;
        }
      }
    }
  }
  return { vertices:vertices, faces:faces };
}
})();

if(exports) {
  exports.mesher = MonotoneMesh;
}

},{}]},{},[38])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYm90dGxlanMvZGlzdC9ib3R0bGUuanMiLCJub2RlX21vZHVsZXMvZC9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9lczUtZXh0L29iamVjdC9hc3NpZ24vaW5kZXguanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3QvYXNzaWduL2lzLWltcGxlbWVudGVkLmpzIiwibm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2Fzc2lnbi9zaGltLmpzIiwibm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2lzLWNhbGxhYmxlLmpzIiwibm9kZV9tb2R1bGVzL2VzNS1leHQvb2JqZWN0L2tleXMvaW5kZXguanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3Qva2V5cy9pcy1pbXBsZW1lbnRlZC5qcyIsIm5vZGVfbW9kdWxlcy9lczUtZXh0L29iamVjdC9rZXlzL3NoaW0uanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3Qvbm9ybWFsaXplLW9wdGlvbnMuanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3QvdmFsaWQtY2FsbGFibGUuanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9vYmplY3QvdmFsaWQtdmFsdWUuanMiLCJub2RlX21vZHVsZXMvZXM1LWV4dC9zdHJpbmcvIy9jb250YWlucy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9lczUtZXh0L3N0cmluZy8jL2NvbnRhaW5zL2lzLWltcGxlbWVudGVkLmpzIiwibm9kZV9tb2R1bGVzL2VzNS1leHQvc3RyaW5nLyMvY29udGFpbnMvc2hpbS5qcyIsIm5vZGVfbW9kdWxlcy9ldmVudC1lbWl0dGVyL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL2tudXRoLXNodWZmbGUvaW5kZXguanMiLCJub2RlX21vZHVsZXMvcGVybGluL2luZGV4LmpzIiwic3JjL2NvbXBvbmVudHMvYXN0ZXJvaWQuanMiLCJzcmMvY29tcG9uZW50cy9iZWFtLmpzIiwic3JjL2NvbXBvbmVudHMvZHJhZ2NhbWVyYS5qcyIsInNyYy9jb21wb25lbnRzL2VuZ2luZS5qcyIsInNyYy9jb21wb25lbnRzL2dyaWQuanMiLCJzcmMvY29tcG9uZW50cy9sYXNlci5qcyIsInNyYy9jb21wb25lbnRzL3BhcnRpY2xlLmpzIiwic3JjL2NvbXBvbmVudHMvcGFydGljbGVzeXN0ZW0uanMiLCJzcmMvY29tcG9uZW50cy9zaGlwL2FpLmpzIiwic3JjL2NvbXBvbmVudHMvc2hpcC9pbmRleC5qcyIsInNyYy9jb21wb25lbnRzL3NoaXAvcmVhZGVyLmpzIiwic3JjL2NvbXBvbmVudHMvc2hpcC9zaGlwcy5qcyIsInNyYy9jb21wb25lbnRzL3NoaXAvdHVycmVudC5qcyIsInNyYy9jb21wb25lbnRzL3N0YXJzLmpzIiwic3JjL2NvbnRhaW5lci5qcyIsInNyYy9jb3JlL2FwcC5qcyIsInNyYy9jb3JlL2NvbGxpc2lvbnMuanMiLCJzcmMvY29yZS9ndWlkLmpzIiwic3JjL2NvcmUvcmVuZGVyZXIuanMiLCJzcmMvaW5kZXguanMiLCJzcmMvc2hpcHMvZnJpZ2F0ZS5qcyIsInNyYy91dGlscy9tYXRoLmpzIiwic3JjL3ZveGVsL2NodW5rLmpzIiwic3JjL3ZveGVsL2NodW5rcy5qcyIsInNyYy92b3hlbC9tZXNoZXIuanMiLCJzcmMvdm94ZWwvbW9ub3RvbmUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7O0FDQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2xwQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNMQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3RCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDTkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ0xBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1BBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNwSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN2RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDakVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUMxUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzdEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzVFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDWkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUNoQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNoREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIjsoZnVuY3Rpb24odW5kZWZpbmVkKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuICAgIC8qKlxuICAgICAqIEJvdHRsZUpTIHYxLjYuMSAtIDIwMTctMDUtMTdcbiAgICAgKiBBIHBvd2VyZnVsIGRlcGVuZGVuY3kgaW5qZWN0aW9uIG1pY3JvIGNvbnRhaW5lclxuICAgICAqXG4gICAgICogQ29weXJpZ2h0IChjKSAyMDE3IFN0ZXBoZW4gWW91bmdcbiAgICAgKiBMaWNlbnNlZCBNSVRcbiAgICAgKi9cbiAgICBcbiAgICAvKipcbiAgICAgKiBVbmlxdWUgaWQgY291bnRlcjtcbiAgICAgKlxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIHZhciBpZCA9IDA7XG4gICAgXG4gICAgLyoqXG4gICAgICogTG9jYWwgc2xpY2UgYWxpYXNcbiAgICAgKlxuICAgICAqIEB0eXBlIEZ1bmN0aW9uc1xuICAgICAqL1xuICAgIHZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBJdGVyYXRvciB1c2VkIHRvIHdhbGsgZG93biBhIG5lc3RlZCBvYmplY3QuXG4gICAgICpcbiAgICAgKiBJZiBCb3R0bGUuY29uZmlnLnN0cmljdCBpcyB0cnVlLCB0aGlzIG1ldGhvZCB3aWxsIHRocm93IGFuIGV4Y2VwdGlvbiBpZiBpdCBlbmNvdW50ZXJzIGFuXG4gICAgICogdW5kZWZpbmVkIHBhdGhcbiAgICAgKlxuICAgICAqIEBwYXJhbSBPYmplY3Qgb2JqXG4gICAgICogQHBhcmFtIFN0cmluZyBwcm9wXG4gICAgICogQHJldHVybiBtaXhlZFxuICAgICAqIEB0aHJvd3MgRXJyb3IgaWYgQm90dGxlIGlzIHVuYWJsZSB0byByZXNvbHZlIHRoZSByZXF1ZXN0ZWQgc2VydmljZS5cbiAgICAgKi9cbiAgICB2YXIgZ2V0TmVzdGVkID0gZnVuY3Rpb24gZ2V0TmVzdGVkKG9iaiwgcHJvcCkge1xuICAgICAgICB2YXIgc2VydmljZSA9IG9ialtwcm9wXTtcbiAgICAgICAgaWYgKHNlcnZpY2UgPT09IHVuZGVmaW5lZCAmJiBnbG9iYWxDb25maWcuc3RyaWN0KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0JvdHRsZSB3YXMgdW5hYmxlIHRvIHJlc29sdmUgYSBzZXJ2aWNlLiAgYCcgKyBwcm9wICsgJ2AgaXMgdW5kZWZpbmVkLicpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzZXJ2aWNlO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogR2V0IGEgbmVzdGVkIGJvdHRsZS4gV2lsbCBzZXQgYW5kIHJldHVybiBpZiBub3Qgc2V0LlxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgZ2V0TmVzdGVkQm90dGxlID0gZnVuY3Rpb24gZ2V0TmVzdGVkQm90dGxlKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubmVzdGVkW25hbWVdIHx8ICh0aGlzLm5lc3RlZFtuYW1lXSA9IEJvdHRsZS5wb3AoKSk7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBHZXQgYSBzZXJ2aWNlIHN0b3JlZCB1bmRlciBhIG5lc3RlZCBrZXlcbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgZnVsbG5hbWVcbiAgICAgKiBAcmV0dXJuIFNlcnZpY2VcbiAgICAgKi9cbiAgICB2YXIgZ2V0TmVzdGVkU2VydmljZSA9IGZ1bmN0aW9uIGdldE5lc3RlZFNlcnZpY2UoZnVsbG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bGxuYW1lLnNwbGl0KCcuJykucmVkdWNlKGdldE5lc3RlZCwgdGhpcyk7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBSZWdpc3RlciBhIGNvbnN0YW50XG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWVcbiAgICAgKiBAcGFyYW0gbWl4ZWQgdmFsdWVcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciBjb25zdGFudCA9IGZ1bmN0aW9uIGNvbnN0YW50KG5hbWUsIHZhbHVlKSB7XG4gICAgICAgIHZhciBwYXJ0cyA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgbmFtZSA9IHBhcnRzLnBvcCgpO1xuICAgICAgICBkZWZpbmVDb25zdGFudC5jYWxsKHBhcnRzLnJlZHVjZShzZXRWYWx1ZU9iamVjdCwgdGhpcy5jb250YWluZXIpLCBuYW1lLCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG4gICAgXG4gICAgdmFyIGRlZmluZUNvbnN0YW50ID0gZnVuY3Rpb24gZGVmaW5lQ29uc3RhbnQobmFtZSwgdmFsdWUpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIG5hbWUsIHtcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZSA6IGZhbHNlLFxuICAgICAgICAgICAgZW51bWVyYWJsZSA6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZSA6IHZhbHVlLFxuICAgICAgICAgICAgd3JpdGFibGUgOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyIGRlY29yYXRvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgZnVsbG5hbWVcbiAgICAgKiBAcGFyYW0gRnVuY3Rpb24gZnVuY1xuICAgICAqIEByZXR1cm4gQm90dGxlXG4gICAgICovXG4gICAgdmFyIGRlY29yYXRvciA9IGZ1bmN0aW9uIGRlY29yYXRvcihmdWxsbmFtZSwgZnVuYykge1xuICAgICAgICB2YXIgcGFydHMsIG5hbWU7XG4gICAgICAgIGlmICh0eXBlb2YgZnVsbG5hbWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGZ1bmMgPSBmdWxsbmFtZTtcbiAgICAgICAgICAgIGZ1bGxuYW1lID0gJ19fZ2xvYmFsX18nO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIHBhcnRzID0gZnVsbG5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgbmFtZSA9IHBhcnRzLnNoaWZ0KCk7XG4gICAgICAgIGlmIChwYXJ0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGdldE5lc3RlZEJvdHRsZS5jYWxsKHRoaXMsIG5hbWUpLmRlY29yYXRvcihwYXJ0cy5qb2luKCcuJyksIGZ1bmMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmRlY29yYXRvcnNbbmFtZV0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlY29yYXRvcnNbbmFtZV0gPSBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZGVjb3JhdG9yc1tuYW1lXS5wdXNoKGZ1bmMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXIgYSBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgZXhlY3V0ZWQgd2hlbiBCb3R0bGUjcmVzb2x2ZSBpcyBjYWxsZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gRnVuY3Rpb24gZnVuY1xuICAgICAqIEByZXR1cm4gQm90dGxlXG4gICAgICovXG4gICAgdmFyIGRlZmVyID0gZnVuY3Rpb24gZGVmZXIoZnVuYykge1xuICAgICAgICB0aGlzLmRlZmVycmVkLnB1c2goZnVuYyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG4gICAgXG4gICAgXG4gICAgLyoqXG4gICAgICogSW1tZWRpYXRlbHkgaW5zdGFudGlhdGVzIHRoZSBwcm92aWRlZCBsaXN0IG9mIHNlcnZpY2VzIGFuZCByZXR1cm5zIHRoZW0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0gQXJyYXkgc2VydmljZXNcbiAgICAgKiBAcmV0dXJuIEFycmF5IEFycmF5IG9mIGluc3RhbmNlcyAoaW4gdGhlIG9yZGVyIHRoZXkgd2VyZSBwcm92aWRlZClcbiAgICAgKi9cbiAgICB2YXIgZGlnZXN0ID0gZnVuY3Rpb24gZGlnZXN0KHNlcnZpY2VzKSB7XG4gICAgICAgIHJldHVybiAoc2VydmljZXMgfHwgW10pLm1hcChnZXROZXN0ZWRTZXJ2aWNlLCB0aGlzLmNvbnRhaW5lcik7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBSZWdpc3RlciBhIGZhY3RvcnkgaW5zaWRlIGEgZ2VuZXJpYyBwcm92aWRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgbmFtZVxuICAgICAqIEBwYXJhbSBGdW5jdGlvbiBGYWN0b3J5XG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgZmFjdG9yeSA9IGZ1bmN0aW9uIGZhY3RvcnkobmFtZSwgRmFjdG9yeSkge1xuICAgICAgICByZXR1cm4gcHJvdmlkZXIuY2FsbCh0aGlzLCBuYW1lLCBmdW5jdGlvbiBHZW5lcmljUHJvdmlkZXIoKSB7XG4gICAgICAgICAgICB0aGlzLiRnZXQgPSBGYWN0b3J5O1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyIGFuIGluc3RhbmNlIGZhY3RvcnkgaW5zaWRlIGEgZ2VuZXJpYyBmYWN0b3J5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgc2VydmljZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IEZhY3RvcnkgLSBUaGUgZmFjdG9yeSBmdW5jdGlvbiwgbWF0Y2hlcyB0aGUgc2lnbmF0dXJlIHJlcXVpcmVkIGZvciB0aGVcbiAgICAgKiBgZmFjdG9yeWAgbWV0aG9kXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgaW5zdGFuY2VGYWN0b3J5ID0gZnVuY3Rpb24gaW5zdGFuY2VGYWN0b3J5KG5hbWUsIEZhY3RvcnkpIHtcbiAgICAgICAgcmV0dXJuIGZhY3RvcnkuY2FsbCh0aGlzLCBuYW1lLCBmdW5jdGlvbiBHZW5lcmljSW5zdGFuY2VGYWN0b3J5KGNvbnRhaW5lcikge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZSA6IEZhY3RvcnkuYmluZChGYWN0b3J5LCBjb250YWluZXIpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEEgZmlsdGVyIGZ1bmN0aW9uIGZvciByZW1vdmluZyBib3R0bGUgY29udGFpbmVyIG1ldGhvZHMgYW5kIHByb3ZpZGVycyBmcm9tIGEgbGlzdCBvZiBrZXlzXG4gICAgICovXG4gICAgdmFyIGJ5TWV0aG9kID0gZnVuY3Rpb24gYnlNZXRob2QobmFtZSkge1xuICAgICAgICByZXR1cm4gIS9eXFwkKD86ZGVjb3JhdG9yfHJlZ2lzdGVyfGxpc3QpJHxQcm92aWRlciQvLnRlc3QobmFtZSk7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBMaXN0IHRoZSBzZXJ2aWNlcyByZWdpc3RlcmVkIG9uIHRoZSBjb250YWluZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gT2JqZWN0IGNvbnRhaW5lclxuICAgICAqIEByZXR1cm4gQXJyYXlcbiAgICAgKi9cbiAgICB2YXIgbGlzdCA9IGZ1bmN0aW9uIGxpc3QoY29udGFpbmVyKSB7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhjb250YWluZXIgfHwgdGhpcy5jb250YWluZXIgfHwge30pLmZpbHRlcihieU1ldGhvZCk7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBGdW5jdGlvbiB1c2VkIGJ5IHByb3ZpZGVyIHRvIHNldCB1cCBtaWRkbGV3YXJlIGZvciBlYWNoIHJlcXVlc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gTnVtYmVyIGlkXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHBhcmFtIE9iamVjdCBpbnN0YW5jZVxuICAgICAqIEBwYXJhbSBPYmplY3QgY29udGFpbmVyXG4gICAgICogQHJldHVybiB2b2lkXG4gICAgICovXG4gICAgdmFyIGFwcGx5TWlkZGxld2FyZSA9IGZ1bmN0aW9uIGFwcGx5TWlkZGxld2FyZShtaWRkbGV3YXJlLCBuYW1lLCBpbnN0YW5jZSwgY29udGFpbmVyKSB7XG4gICAgICAgIHZhciBkZXNjcmlwdG9yID0ge1xuICAgICAgICAgICAgY29uZmlndXJhYmxlIDogdHJ1ZSxcbiAgICAgICAgICAgIGVudW1lcmFibGUgOiB0cnVlXG4gICAgICAgIH07XG4gICAgICAgIGlmIChtaWRkbGV3YXJlLmxlbmd0aCkge1xuICAgICAgICAgICAgZGVzY3JpcHRvci5nZXQgPSBmdW5jdGlvbiBnZXRXaXRoTWlkZGxld2VhcigpIHtcbiAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSAwO1xuICAgICAgICAgICAgICAgIHZhciBuZXh0ID0gZnVuY3Rpb24gbmV4dE1pZGRsZXdhcmUoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAobWlkZGxld2FyZVtpbmRleF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pZGRsZXdhcmVbaW5kZXgrK10oaW5zdGFuY2UsIG5leHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRlc2NyaXB0b3IudmFsdWUgPSBpbnN0YW5jZTtcbiAgICAgICAgICAgIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb250YWluZXIsIG5hbWUsIGRlc2NyaXB0b3IpO1xuICAgIFxuICAgICAgICByZXR1cm4gY29udGFpbmVyW25hbWVdO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXIgbWlkZGxld2FyZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgbmFtZVxuICAgICAqIEBwYXJhbSBGdW5jdGlvbiBmdW5jXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgbWlkZGxld2FyZSA9IGZ1bmN0aW9uIG1pZGRsZXdhcmUoZnVsbG5hbWUsIGZ1bmMpIHtcbiAgICAgICAgdmFyIHBhcnRzLCBuYW1lO1xuICAgICAgICBpZiAodHlwZW9mIGZ1bGxuYW1lID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBmdW5jID0gZnVsbG5hbWU7XG4gICAgICAgICAgICBmdWxsbmFtZSA9ICdfX2dsb2JhbF9fJztcbiAgICAgICAgfVxuICAgIFxuICAgICAgICBwYXJ0cyA9IGZ1bGxuYW1lLnNwbGl0KCcuJyk7XG4gICAgICAgIG5hbWUgPSBwYXJ0cy5zaGlmdCgpO1xuICAgICAgICBpZiAocGFydHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBnZXROZXN0ZWRCb3R0bGUuY2FsbCh0aGlzLCBuYW1lKS5taWRkbGV3YXJlKHBhcnRzLmpvaW4oJy4nKSwgZnVuYyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMubWlkZGxld2FyZXNbbmFtZV0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1pZGRsZXdhcmVzW25hbWVdID0gW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLm1pZGRsZXdhcmVzW25hbWVdLnB1c2goZnVuYyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBOYW1lZCBib3R0bGUgaW5zdGFuY2VzXG4gICAgICpcbiAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgKi9cbiAgICB2YXIgYm90dGxlcyA9IHt9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEdldCBhbiBpbnN0YW5jZSBvZiBib3R0bGUuXG4gICAgICpcbiAgICAgKiBJZiBhIG5hbWUgaXMgcHJvdmlkZWQgdGhlIGluc3RhbmNlIHdpbGwgYmUgc3RvcmVkIGluIGEgbG9jYWwgaGFzaC4gIENhbGxpbmcgQm90dGxlLnBvcCBtdWx0aXBsZVxuICAgICAqIHRpbWVzIHdpdGggdGhlIHNhbWUgbmFtZSB3aWxsIHJldHVybiB0aGUgc2FtZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgbmFtZVxuICAgICAqIEByZXR1cm4gQm90dGxlXG4gICAgICovXG4gICAgdmFyIHBvcCA9IGZ1bmN0aW9uIHBvcChuYW1lKSB7XG4gICAgICAgIHZhciBpbnN0YW5jZTtcbiAgICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgaW5zdGFuY2UgPSBib3R0bGVzW25hbWVdO1xuICAgICAgICAgICAgaWYgKCFpbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIGJvdHRsZXNbbmFtZV0gPSBpbnN0YW5jZSA9IG5ldyBCb3R0bGUoKTtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZS5jb25zdGFudCgnQk9UVExFX05BTUUnLCBuYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IEJvdHRsZSgpO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogQ2xlYXIgYWxsIG5hbWVkIGJvdHRsZXMuXG4gICAgICovXG4gICAgdmFyIGNsZWFyID0gZnVuY3Rpb24gY2xlYXIobmFtZSkge1xuICAgICAgICBpZiAodHlwZW9mIG5hbWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBkZWxldGUgYm90dGxlc1tuYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJvdHRsZXMgPSB7fTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogVXNlZCB0byBwcm9jZXNzIGRlY29yYXRvcnMgaW4gdGhlIHByb3ZpZGVyXG4gICAgICpcbiAgICAgKiBAcGFyYW0gT2JqZWN0IGluc3RhbmNlXG4gICAgICogQHBhcmFtIEZ1bmN0aW9uIGZ1bmNcbiAgICAgKiBAcmV0dXJuIE1peGVkXG4gICAgICovXG4gICAgdmFyIHJlZHVjZXIgPSBmdW5jdGlvbiByZWR1Y2VyKGluc3RhbmNlLCBmdW5jKSB7XG4gICAgICAgIHJldHVybiBmdW5jKGluc3RhbmNlKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyIGEgcHJvdmlkZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIGZ1bGxuYW1lXG4gICAgICogQHBhcmFtIEZ1bmN0aW9uIFByb3ZpZGVyXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgcHJvdmlkZXIgPSBmdW5jdGlvbiBwcm92aWRlcihmdWxsbmFtZSwgUHJvdmlkZXIpIHtcbiAgICAgICAgdmFyIHBhcnRzLCBuYW1lO1xuICAgICAgICBwYXJ0cyA9IGZ1bGxuYW1lLnNwbGl0KCcuJyk7XG4gICAgICAgIGlmICh0aGlzLnByb3ZpZGVyTWFwW2Z1bGxuYW1lXSAmJiBwYXJ0cy5sZW5ndGggPT09IDEgJiYgIXRoaXMuY29udGFpbmVyW2Z1bGxuYW1lICsgJ1Byb3ZpZGVyJ10pIHtcbiAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKGZ1bGxuYW1lICsgJyBwcm92aWRlciBhbHJlYWR5IGluc3RhbnRpYXRlZC4nKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm9yaWdpbmFsUHJvdmlkZXJzW2Z1bGxuYW1lXSA9IFByb3ZpZGVyO1xuICAgICAgICB0aGlzLnByb3ZpZGVyTWFwW2Z1bGxuYW1lXSA9IHRydWU7XG4gICAgXG4gICAgICAgIG5hbWUgPSBwYXJ0cy5zaGlmdCgpO1xuICAgIFxuICAgICAgICBpZiAocGFydHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjcmVhdGVTdWJQcm92aWRlci5jYWxsKHRoaXMsIG5hbWUsIFByb3ZpZGVyLCBwYXJ0cyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY3JlYXRlUHJvdmlkZXIuY2FsbCh0aGlzLCBuYW1lLCBQcm92aWRlcik7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBHZXQgZGVjb3JhdG9ycyBhbmQgbWlkZGxld2FyZSBpbmNsdWRpbmcgZ2xvYmFsc1xuICAgICAqXG4gICAgICogQHJldHVybiBhcnJheVxuICAgICAqL1xuICAgIHZhciBnZXRXaXRoR2xvYmFsID0gZnVuY3Rpb24gZ2V0V2l0aEdsb2JhbChjb2xsZWN0aW9uLCBuYW1lKSB7XG4gICAgICAgIHJldHVybiAoY29sbGVjdGlvbltuYW1lXSB8fCBbXSkuY29uY2F0KGNvbGxlY3Rpb24uX19nbG9iYWxfXyB8fCBbXSk7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgdGhlIHByb3ZpZGVyIHByb3BlcnRpZXMgb24gdGhlIGNvbnRhaW5lclxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHBhcmFtIEZ1bmN0aW9uIFByb3ZpZGVyXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgY3JlYXRlUHJvdmlkZXIgPSBmdW5jdGlvbiBjcmVhdGVQcm92aWRlcihuYW1lLCBQcm92aWRlcikge1xuICAgICAgICB2YXIgcHJvdmlkZXJOYW1lLCBwcm9wZXJ0aWVzLCBjb250YWluZXIsIGlkLCBkZWNvcmF0b3JzLCBtaWRkbGV3YXJlcztcbiAgICBcbiAgICAgICAgaWQgPSB0aGlzLmlkO1xuICAgICAgICBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lcjtcbiAgICAgICAgZGVjb3JhdG9ycyA9IHRoaXMuZGVjb3JhdG9ycztcbiAgICAgICAgbWlkZGxld2FyZXMgPSB0aGlzLm1pZGRsZXdhcmVzO1xuICAgICAgICBwcm92aWRlck5hbWUgPSBuYW1lICsgJ1Byb3ZpZGVyJztcbiAgICBcbiAgICAgICAgcHJvcGVydGllcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICAgIHByb3BlcnRpZXNbcHJvdmlkZXJOYW1lXSA9IHtcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZSA6IHRydWUsXG4gICAgICAgICAgICBlbnVtZXJhYmxlIDogdHJ1ZSxcbiAgICAgICAgICAgIGdldCA6IGZ1bmN0aW9uIGdldFByb3ZpZGVyKCkge1xuICAgICAgICAgICAgICAgIHZhciBpbnN0YW5jZSA9IG5ldyBQcm92aWRlcigpO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBjb250YWluZXJbcHJvdmlkZXJOYW1lXTtcbiAgICAgICAgICAgICAgICBjb250YWluZXJbcHJvdmlkZXJOYW1lXSA9IGluc3RhbmNlO1xuICAgICAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICBcbiAgICAgICAgcHJvcGVydGllc1tuYW1lXSA9IHtcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZSA6IHRydWUsXG4gICAgICAgICAgICBlbnVtZXJhYmxlIDogdHJ1ZSxcbiAgICAgICAgICAgIGdldCA6IGZ1bmN0aW9uIGdldFNlcnZpY2UoKSB7XG4gICAgICAgICAgICAgICAgdmFyIHByb3ZpZGVyID0gY29udGFpbmVyW3Byb3ZpZGVyTmFtZV07XG4gICAgICAgICAgICAgICAgdmFyIGluc3RhbmNlO1xuICAgICAgICAgICAgICAgIGlmIChwcm92aWRlcikge1xuICAgICAgICAgICAgICAgICAgICAvLyBmaWx0ZXIgdGhyb3VnaCBkZWNvcmF0b3JzXG4gICAgICAgICAgICAgICAgICAgIGluc3RhbmNlID0gZ2V0V2l0aEdsb2JhbChkZWNvcmF0b3JzLCBuYW1lKS5yZWR1Y2UocmVkdWNlciwgcHJvdmlkZXIuJGdldChjb250YWluZXIpKTtcbiAgICBcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGNvbnRhaW5lcltwcm92aWRlck5hbWVdO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgY29udGFpbmVyW25hbWVdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gaW5zdGFuY2UgPT09IHVuZGVmaW5lZCA/IGluc3RhbmNlIDogYXBwbHlNaWRkbGV3YXJlKGdldFdpdGhHbG9iYWwobWlkZGxld2FyZXMsIG5hbWUpLFxuICAgICAgICAgICAgICAgICAgICBuYW1lLCBpbnN0YW5jZSwgY29udGFpbmVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICBcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoY29udGFpbmVyLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgYm90dGxlIGNvbnRhaW5lciBvbiB0aGUgY3VycmVudCBib3R0bGUgY29udGFpbmVyLCBhbmQgcmVnaXN0ZXJzXG4gICAgICogdGhlIHByb3ZpZGVyIHVuZGVyIHRoZSBzdWIgY29udGFpbmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHBhcmFtIEZ1bmN0aW9uIFByb3ZpZGVyXG4gICAgICogQHBhcmFtIEFycmF5IHBhcnRzXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgY3JlYXRlU3ViUHJvdmlkZXIgPSBmdW5jdGlvbiBjcmVhdGVTdWJQcm92aWRlcihuYW1lLCBQcm92aWRlciwgcGFydHMpIHtcbiAgICAgICAgdmFyIGJvdHRsZTtcbiAgICAgICAgYm90dGxlID0gZ2V0TmVzdGVkQm90dGxlLmNhbGwodGhpcywgbmFtZSk7XG4gICAgICAgIHRoaXMuZmFjdG9yeShuYW1lLCBmdW5jdGlvbiBTdWJQcm92aWRlckZhY3RvcnkoKSB7XG4gICAgICAgICAgICByZXR1cm4gYm90dGxlLmNvbnRhaW5lcjtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBib3R0bGUucHJvdmlkZXIocGFydHMuam9pbignLicpLCBQcm92aWRlcik7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBSZWdpc3RlciBhIHNlcnZpY2UsIGZhY3RvcnksIHByb3ZpZGVyLCBvciB2YWx1ZSBiYXNlZCBvbiBwcm9wZXJ0aWVzIG9uIHRoZSBvYmplY3QuXG4gICAgICpcbiAgICAgKiBwcm9wZXJ0aWVzOlxuICAgICAqICAqIE9iai4kbmFtZSAgIFN0cmluZyByZXF1aXJlZCBleDogYCdUaGluZydgXG4gICAgICogICogT2JqLiR0eXBlICAgU3RyaW5nIG9wdGlvbmFsICdzZXJ2aWNlJywgJ2ZhY3RvcnknLCAncHJvdmlkZXInLCAndmFsdWUnLiAgRGVmYXVsdDogJ3NlcnZpY2UnXG4gICAgICogICogT2JqLiRpbmplY3QgTWl4ZWQgIG9wdGlvbmFsIG9ubHkgdXNlZnVsIHdpdGggJHR5cGUgJ3NlcnZpY2UnIG5hbWUgb3IgYXJyYXkgb2YgbmFtZXNcbiAgICAgKiAgKiBPYmouJHZhbHVlICBNaXhlZCAgb3B0aW9uYWwgTm9ybWFsbHkgT2JqIGlzIHJlZ2lzdGVyZWQgb24gdGhlIGNvbnRhaW5lci4gIEhvd2V2ZXIsIGlmIHRoaXNcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHkgaXMgaW5jbHVkZWQsIGl0J3MgdmFsdWUgd2lsbCBiZSByZWdpc3RlcmVkIG9uIHRoZSBjb250YWluZXJcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgaW5zdGVhZCBvZiB0aGUgb2JqZWN0IGl0c3NlbGYuICBVc2VmdWwgZm9yIHJlZ2lzdGVyaW5nIG9iamVjdHMgb24gdGhlXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgIGJvdHRsZSBjb250YWluZXIgd2l0aG91dCBtb2RpZnlpbmcgdGhvc2Ugb2JqZWN0cyB3aXRoIGJvdHRsZSBzcGVjaWZpYyBrZXlzLlxuICAgICAqXG4gICAgICogQHBhcmFtIEZ1bmN0aW9uIE9ialxuICAgICAqIEByZXR1cm4gQm90dGxlXG4gICAgICovXG4gICAgdmFyIHJlZ2lzdGVyID0gZnVuY3Rpb24gcmVnaXN0ZXIoT2JqKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IE9iai4kdmFsdWUgPT09IHVuZGVmaW5lZCA/IE9iaiA6IE9iai4kdmFsdWU7XG4gICAgICAgIHJldHVybiB0aGlzW09iai4kdHlwZSB8fCAnc2VydmljZSddLmFwcGx5KHRoaXMsIFtPYmouJG5hbWUsIHZhbHVlXS5jb25jYXQoT2JqLiRpbmplY3QgfHwgW10pKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIERlbGV0ZXMgcHJvdmlkZXJzIGZyb20gdGhlIG1hcCBhbmQgY29udGFpbmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHJldHVybiB2b2lkXG4gICAgICovXG4gICAgdmFyIHJlbW92ZVByb3ZpZGVyTWFwID0gZnVuY3Rpb24gcmVzZXRQcm92aWRlcihuYW1lKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnByb3ZpZGVyTWFwW25hbWVdO1xuICAgICAgICBkZWxldGUgdGhpcy5jb250YWluZXJbbmFtZV07XG4gICAgICAgIGRlbGV0ZSB0aGlzLmNvbnRhaW5lcltuYW1lICsgJ1Byb3ZpZGVyJ107XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBSZXNldHMgYWxsIHByb3ZpZGVycyBvbiBhIGJvdHRsZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm4gdm9pZFxuICAgICAqL1xuICAgIHZhciByZXNldFByb3ZpZGVycyA9IGZ1bmN0aW9uIHJlc2V0UHJvdmlkZXJzKCkge1xuICAgICAgICB2YXIgcHJvdmlkZXJzID0gdGhpcy5vcmlnaW5hbFByb3ZpZGVycztcbiAgICAgICAgT2JqZWN0LmtleXModGhpcy5vcmlnaW5hbFByb3ZpZGVycykuZm9yRWFjaChmdW5jdGlvbiByZXNldFBydmlkZXIocHJvdmlkZXIpIHtcbiAgICAgICAgICAgIHZhciBwYXJ0cyA9IHByb3ZpZGVyLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICBpZiAocGFydHMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIHJlbW92ZVByb3ZpZGVyTWFwLmNhbGwodGhpcywgcGFydHNbMF0pO1xuICAgICAgICAgICAgICAgIHBhcnRzLmZvckVhY2gocmVtb3ZlUHJvdmlkZXJNYXAsIGdldE5lc3RlZEJvdHRsZS5jYWxsKHRoaXMsIHBhcnRzWzBdKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZW1vdmVQcm92aWRlck1hcC5jYWxsKHRoaXMsIHByb3ZpZGVyKTtcbiAgICAgICAgICAgIHRoaXMucHJvdmlkZXIocHJvdmlkZXIsIHByb3ZpZGVyc1twcm92aWRlcl0pO1xuICAgICAgICB9LCB0aGlzKTtcbiAgICB9O1xuICAgIFxuICAgIFxuICAgIC8qKlxuICAgICAqIEV4ZWN1dGUgYW55IGRlZmVycmVkIGZ1bmN0aW9uc1xuICAgICAqXG4gICAgICogQHBhcmFtIE1peGVkIGRhdGFcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciByZXNvbHZlID0gZnVuY3Rpb24gcmVzb2x2ZShkYXRhKSB7XG4gICAgICAgIHRoaXMuZGVmZXJyZWQuZm9yRWFjaChmdW5jdGlvbiBkZWZlcnJlZEl0ZXJhdG9yKGZ1bmMpIHtcbiAgICAgICAgICAgIGZ1bmMoZGF0YSk7XG4gICAgICAgIH0pO1xuICAgIFxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyIGEgc2VydmljZSBpbnNpZGUgYSBnZW5lcmljIGZhY3RvcnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWVcbiAgICAgKiBAcGFyYW0gRnVuY3Rpb24gU2VydmljZVxuICAgICAqIEByZXR1cm4gQm90dGxlXG4gICAgICovXG4gICAgdmFyIHNlcnZpY2UgPSBmdW5jdGlvbiBzZXJ2aWNlKG5hbWUsIFNlcnZpY2UpIHtcbiAgICAgICAgdmFyIGRlcHMgPSBhcmd1bWVudHMubGVuZ3RoID4gMiA/IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKSA6IG51bGw7XG4gICAgICAgIHZhciBib3R0bGUgPSB0aGlzO1xuICAgICAgICByZXR1cm4gZmFjdG9yeS5jYWxsKHRoaXMsIG5hbWUsIGZ1bmN0aW9uIEdlbmVyaWNGYWN0b3J5KCkge1xuICAgICAgICAgICAgdmFyIFNlcnZpY2VDb3B5ID0gU2VydmljZTtcbiAgICAgICAgICAgIGlmIChkZXBzKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBkZXBzLm1hcChnZXROZXN0ZWRTZXJ2aWNlLCBib3R0bGUuY29udGFpbmVyKTtcbiAgICAgICAgICAgICAgICBhcmdzLnVuc2hpZnQoU2VydmljZSk7XG4gICAgICAgICAgICAgICAgU2VydmljZUNvcHkgPSBTZXJ2aWNlLmJpbmQuYXBwbHkoU2VydmljZSwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmV3IFNlcnZpY2VDb3B5KCk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXIgYSB2YWx1ZVxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHBhcmFtIG1peGVkIHZhbFxuICAgICAqIEByZXR1cm4gQm90dGxlXG4gICAgICovXG4gICAgdmFyIHZhbHVlID0gZnVuY3Rpb24gdmFsdWUobmFtZSwgdmFsKSB7XG4gICAgICAgIHZhciBwYXJ0cztcbiAgICAgICAgcGFydHMgPSBuYW1lLnNwbGl0KCcuJyk7XG4gICAgICAgIG5hbWUgPSBwYXJ0cy5wb3AoKTtcbiAgICAgICAgZGVmaW5lVmFsdWUuY2FsbChwYXJ0cy5yZWR1Y2Uoc2V0VmFsdWVPYmplY3QsIHRoaXMuY29udGFpbmVyKSwgbmFtZSwgdmFsKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBJdGVyYXRvciBmb3Igc2V0dGluZyBhIHBsYWluIG9iamVjdCBsaXRlcmFsIHZpYSBkZWZpbmVWYWx1ZVxuICAgICAqXG4gICAgICogQHBhcmFtIE9iamVjdCBjb250YWluZXJcbiAgICAgKiBAcGFyYW0gc3RyaW5nIG5hbWVcbiAgICAgKi9cbiAgICB2YXIgc2V0VmFsdWVPYmplY3QgPSBmdW5jdGlvbiBzZXRWYWx1ZU9iamVjdChjb250YWluZXIsIG5hbWUpIHtcbiAgICAgICAgdmFyIG5lc3RlZENvbnRhaW5lciA9IGNvbnRhaW5lcltuYW1lXTtcbiAgICAgICAgaWYgKCFuZXN0ZWRDb250YWluZXIpIHtcbiAgICAgICAgICAgIG5lc3RlZENvbnRhaW5lciA9IHt9O1xuICAgICAgICAgICAgZGVmaW5lVmFsdWUuY2FsbChjb250YWluZXIsIG5hbWUsIG5lc3RlZENvbnRhaW5lcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5lc3RlZENvbnRhaW5lcjtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIERlZmluZSBhIG11dGFibGUgcHJvcGVydHkgb24gdGhlIGNvbnRhaW5lci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgbmFtZVxuICAgICAqIEBwYXJhbSBtaXhlZCB2YWxcbiAgICAgKiBAcmV0dXJuIHZvaWRcbiAgICAgKiBAc2NvcGUgY29udGFpbmVyXG4gICAgICovXG4gICAgdmFyIGRlZmluZVZhbHVlID0gZnVuY3Rpb24gZGVmaW5lVmFsdWUobmFtZSwgdmFsKSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBuYW1lLCB7XG4gICAgICAgICAgICBjb25maWd1cmFibGUgOiB0cnVlLFxuICAgICAgICAgICAgZW51bWVyYWJsZSA6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZSA6IHZhbCxcbiAgICAgICAgICAgIHdyaXRhYmxlIDogdHJ1ZVxuICAgICAgICB9KTtcbiAgICB9O1xuICAgIFxuICAgIFxuICAgIC8qKlxuICAgICAqIEJvdHRsZSBjb25zdHJ1Y3RvclxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lIE9wdGlvbmFsIG5hbWUgZm9yIGZ1bmN0aW9uYWwgY29uc3RydWN0aW9uXG4gICAgICovXG4gICAgdmFyIEJvdHRsZSA9IGZ1bmN0aW9uIEJvdHRsZShuYW1lKSB7XG4gICAgICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCb3R0bGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gQm90dGxlLnBvcChuYW1lKTtcbiAgICAgICAgfVxuICAgIFxuICAgICAgICB0aGlzLmlkID0gaWQrKztcbiAgICBcbiAgICAgICAgdGhpcy5kZWNvcmF0b3JzID0ge307XG4gICAgICAgIHRoaXMubWlkZGxld2FyZXMgPSB7fTtcbiAgICAgICAgdGhpcy5uZXN0ZWQgPSB7fTtcbiAgICAgICAgdGhpcy5wcm92aWRlck1hcCA9IHt9O1xuICAgICAgICB0aGlzLm9yaWdpbmFsUHJvdmlkZXJzID0ge307XG4gICAgICAgIHRoaXMuZGVmZXJyZWQgPSBbXTtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSB7XG4gICAgICAgICAgICAkZGVjb3JhdG9yIDogZGVjb3JhdG9yLmJpbmQodGhpcyksXG4gICAgICAgICAgICAkcmVnaXN0ZXIgOiByZWdpc3Rlci5iaW5kKHRoaXMpLFxuICAgICAgICAgICAgJGxpc3QgOiBsaXN0LmJpbmQodGhpcylcbiAgICAgICAgfTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEJvdHRsZSBwcm90b3R5cGVcbiAgICAgKi9cbiAgICBCb3R0bGUucHJvdG90eXBlID0ge1xuICAgICAgICBjb25zdGFudCA6IGNvbnN0YW50LFxuICAgICAgICBkZWNvcmF0b3IgOiBkZWNvcmF0b3IsXG4gICAgICAgIGRlZmVyIDogZGVmZXIsXG4gICAgICAgIGRpZ2VzdCA6IGRpZ2VzdCxcbiAgICAgICAgZmFjdG9yeSA6IGZhY3RvcnksXG4gICAgICAgIGluc3RhbmNlRmFjdG9yeTogaW5zdGFuY2VGYWN0b3J5LFxuICAgICAgICBsaXN0IDogbGlzdCxcbiAgICAgICAgbWlkZGxld2FyZSA6IG1pZGRsZXdhcmUsXG4gICAgICAgIHByb3ZpZGVyIDogcHJvdmlkZXIsXG4gICAgICAgIHJlc2V0UHJvdmlkZXJzIDogcmVzZXRQcm92aWRlcnMsXG4gICAgICAgIHJlZ2lzdGVyIDogcmVnaXN0ZXIsXG4gICAgICAgIHJlc29sdmUgOiByZXNvbHZlLFxuICAgICAgICBzZXJ2aWNlIDogc2VydmljZSxcbiAgICAgICAgdmFsdWUgOiB2YWx1ZVxuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogQm90dGxlIHN0YXRpY1xuICAgICAqL1xuICAgIEJvdHRsZS5wb3AgPSBwb3A7XG4gICAgQm90dGxlLmNsZWFyID0gY2xlYXI7XG4gICAgQm90dGxlLmxpc3QgPSBsaXN0O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEdsb2JhbCBjb25maWdcbiAgICAgKi9cbiAgICB2YXIgZ2xvYmFsQ29uZmlnID0gQm90dGxlLmNvbmZpZyA9IHtcbiAgICAgICAgc3RyaWN0IDogZmFsc2VcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEV4cG9ydHMgc2NyaXB0IGFkYXB0ZWQgZnJvbSBsb2Rhc2ggdjIuNC4xIE1vZGVybiBCdWlsZFxuICAgICAqXG4gICAgICogQHNlZSBodHRwOi8vbG9kYXNoLmNvbS9cbiAgICAgKi9cbiAgICBcbiAgICAvKipcbiAgICAgKiBWYWxpZCBvYmplY3QgdHlwZSBtYXBcbiAgICAgKlxuICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAqL1xuICAgIHZhciBvYmplY3RUeXBlcyA9IHtcbiAgICAgICAgJ2Z1bmN0aW9uJyA6IHRydWUsXG4gICAgICAgICdvYmplY3QnIDogdHJ1ZVxuICAgIH07XG4gICAgXG4gICAgKGZ1bmN0aW9uIGV4cG9ydEJvdHRsZShyb290KSB7XG4gICAgXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBGcmVlIHZhcmlhYmxlIGV4cG9ydHNcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUgRnVuY3Rpb25cbiAgICAgICAgICovXG4gICAgICAgIHZhciBmcmVlRXhwb3J0cyA9IG9iamVjdFR5cGVzW3R5cGVvZiBleHBvcnRzXSAmJiBleHBvcnRzICYmICFleHBvcnRzLm5vZGVUeXBlICYmIGV4cG9ydHM7XG4gICAgXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBGcmVlIHZhcmlhYmxlIG1vZHVsZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgICAgICovXG4gICAgICAgIHZhciBmcmVlTW9kdWxlID0gb2JqZWN0VHlwZXNbdHlwZW9mIG1vZHVsZV0gJiYgbW9kdWxlICYmICFtb2R1bGUubm9kZVR5cGUgJiYgbW9kdWxlO1xuICAgIFxuICAgICAgICAvKipcbiAgICAgICAgICogQ29tbW9uSlMgbW9kdWxlLmV4cG9ydHNcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUgRnVuY3Rpb25cbiAgICAgICAgICovXG4gICAgICAgIHZhciBtb2R1bGVFeHBvcnRzID0gZnJlZU1vZHVsZSAmJiBmcmVlTW9kdWxlLmV4cG9ydHMgPT09IGZyZWVFeHBvcnRzICYmIGZyZWVFeHBvcnRzO1xuICAgIFxuICAgICAgICAvKipcbiAgICAgICAgICogRnJlZSB2YXJpYWJsZSBgZ2xvYmFsYFxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgICAgICovXG4gICAgICAgIHZhciBmcmVlR2xvYmFsID0gb2JqZWN0VHlwZXNbdHlwZW9mIGdsb2JhbF0gJiYgZ2xvYmFsO1xuICAgICAgICBpZiAoZnJlZUdsb2JhbCAmJiAoZnJlZUdsb2JhbC5nbG9iYWwgPT09IGZyZWVHbG9iYWwgfHwgZnJlZUdsb2JhbC53aW5kb3cgPT09IGZyZWVHbG9iYWwpKSB7XG4gICAgICAgICAgICByb290ID0gZnJlZUdsb2JhbDtcbiAgICAgICAgfVxuICAgIFxuICAgICAgICAvKipcbiAgICAgICAgICogRXhwb3J0XG4gICAgICAgICAqL1xuICAgICAgICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gJ29iamVjdCcgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgICAgICAgcm9vdC5Cb3R0bGUgPSBCb3R0bGU7XG4gICAgICAgICAgICBkZWZpbmUoZnVuY3Rpb24oKSB7IHJldHVybiBCb3R0bGU7IH0pO1xuICAgICAgICB9IGVsc2UgaWYgKGZyZWVFeHBvcnRzICYmIGZyZWVNb2R1bGUpIHtcbiAgICAgICAgICAgIGlmIChtb2R1bGVFeHBvcnRzKSB7XG4gICAgICAgICAgICAgICAgKGZyZWVNb2R1bGUuZXhwb3J0cyA9IEJvdHRsZSkuQm90dGxlID0gQm90dGxlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmcmVlRXhwb3J0cy5Cb3R0bGUgPSBCb3R0bGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByb290LkJvdHRsZSA9IEJvdHRsZTtcbiAgICAgICAgfVxuICAgIH0oKG9iamVjdFR5cGVzW3R5cGVvZiB3aW5kb3ddICYmIHdpbmRvdykgfHwgdGhpcykpO1xuICAgIFxufS5jYWxsKHRoaXMpKTsiLCIndXNlIHN0cmljdCc7XG5cbnZhciBhc3NpZ24gICAgICAgID0gcmVxdWlyZSgnZXM1LWV4dC9vYmplY3QvYXNzaWduJylcbiAgLCBub3JtYWxpemVPcHRzID0gcmVxdWlyZSgnZXM1LWV4dC9vYmplY3Qvbm9ybWFsaXplLW9wdGlvbnMnKVxuICAsIGlzQ2FsbGFibGUgICAgPSByZXF1aXJlKCdlczUtZXh0L29iamVjdC9pcy1jYWxsYWJsZScpXG4gICwgY29udGFpbnMgICAgICA9IHJlcXVpcmUoJ2VzNS1leHQvc3RyaW5nLyMvY29udGFpbnMnKVxuXG4gICwgZDtcblxuZCA9IG1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKGRzY3IsIHZhbHVlLyosIG9wdGlvbnMqLykge1xuXHR2YXIgYywgZSwgdywgb3B0aW9ucywgZGVzYztcblx0aWYgKChhcmd1bWVudHMubGVuZ3RoIDwgMikgfHwgKHR5cGVvZiBkc2NyICE9PSAnc3RyaW5nJykpIHtcblx0XHRvcHRpb25zID0gdmFsdWU7XG5cdFx0dmFsdWUgPSBkc2NyO1xuXHRcdGRzY3IgPSBudWxsO1xuXHR9IGVsc2Uge1xuXHRcdG9wdGlvbnMgPSBhcmd1bWVudHNbMl07XG5cdH1cblx0aWYgKGRzY3IgPT0gbnVsbCkge1xuXHRcdGMgPSB3ID0gdHJ1ZTtcblx0XHRlID0gZmFsc2U7XG5cdH0gZWxzZSB7XG5cdFx0YyA9IGNvbnRhaW5zLmNhbGwoZHNjciwgJ2MnKTtcblx0XHRlID0gY29udGFpbnMuY2FsbChkc2NyLCAnZScpO1xuXHRcdHcgPSBjb250YWlucy5jYWxsKGRzY3IsICd3Jyk7XG5cdH1cblxuXHRkZXNjID0geyB2YWx1ZTogdmFsdWUsIGNvbmZpZ3VyYWJsZTogYywgZW51bWVyYWJsZTogZSwgd3JpdGFibGU6IHcgfTtcblx0cmV0dXJuICFvcHRpb25zID8gZGVzYyA6IGFzc2lnbihub3JtYWxpemVPcHRzKG9wdGlvbnMpLCBkZXNjKTtcbn07XG5cbmQuZ3MgPSBmdW5jdGlvbiAoZHNjciwgZ2V0LCBzZXQvKiwgb3B0aW9ucyovKSB7XG5cdHZhciBjLCBlLCBvcHRpb25zLCBkZXNjO1xuXHRpZiAodHlwZW9mIGRzY3IgIT09ICdzdHJpbmcnKSB7XG5cdFx0b3B0aW9ucyA9IHNldDtcblx0XHRzZXQgPSBnZXQ7XG5cdFx0Z2V0ID0gZHNjcjtcblx0XHRkc2NyID0gbnVsbDtcblx0fSBlbHNlIHtcblx0XHRvcHRpb25zID0gYXJndW1lbnRzWzNdO1xuXHR9XG5cdGlmIChnZXQgPT0gbnVsbCkge1xuXHRcdGdldCA9IHVuZGVmaW5lZDtcblx0fSBlbHNlIGlmICghaXNDYWxsYWJsZShnZXQpKSB7XG5cdFx0b3B0aW9ucyA9IGdldDtcblx0XHRnZXQgPSBzZXQgPSB1bmRlZmluZWQ7XG5cdH0gZWxzZSBpZiAoc2V0ID09IG51bGwpIHtcblx0XHRzZXQgPSB1bmRlZmluZWQ7XG5cdH0gZWxzZSBpZiAoIWlzQ2FsbGFibGUoc2V0KSkge1xuXHRcdG9wdGlvbnMgPSBzZXQ7XG5cdFx0c2V0ID0gdW5kZWZpbmVkO1xuXHR9XG5cdGlmIChkc2NyID09IG51bGwpIHtcblx0XHRjID0gdHJ1ZTtcblx0XHRlID0gZmFsc2U7XG5cdH0gZWxzZSB7XG5cdFx0YyA9IGNvbnRhaW5zLmNhbGwoZHNjciwgJ2MnKTtcblx0XHRlID0gY29udGFpbnMuY2FsbChkc2NyLCAnZScpO1xuXHR9XG5cblx0ZGVzYyA9IHsgZ2V0OiBnZXQsIHNldDogc2V0LCBjb25maWd1cmFibGU6IGMsIGVudW1lcmFibGU6IGUgfTtcblx0cmV0dXJuICFvcHRpb25zID8gZGVzYyA6IGFzc2lnbihub3JtYWxpemVPcHRzKG9wdGlvbnMpLCBkZXNjKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9pcy1pbXBsZW1lbnRlZCcpKClcblx0PyBPYmplY3QuYXNzaWduXG5cdDogcmVxdWlyZSgnLi9zaGltJyk7XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuXHR2YXIgYXNzaWduID0gT2JqZWN0LmFzc2lnbiwgb2JqO1xuXHRpZiAodHlwZW9mIGFzc2lnbiAhPT0gJ2Z1bmN0aW9uJykgcmV0dXJuIGZhbHNlO1xuXHRvYmogPSB7IGZvbzogJ3JheicgfTtcblx0YXNzaWduKG9iaiwgeyBiYXI6ICdkd2EnIH0sIHsgdHJ6eTogJ3RyenknIH0pO1xuXHRyZXR1cm4gKG9iai5mb28gKyBvYmouYmFyICsgb2JqLnRyenkpID09PSAncmF6ZHdhdHJ6eSc7XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG52YXIga2V5cyAgPSByZXF1aXJlKCcuLi9rZXlzJylcbiAgLCB2YWx1ZSA9IHJlcXVpcmUoJy4uL3ZhbGlkLXZhbHVlJylcblxuICAsIG1heCA9IE1hdGgubWF4O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChkZXN0LCBzcmMvKiwg4oCmc3JjbiovKSB7XG5cdHZhciBlcnJvciwgaSwgbCA9IG1heChhcmd1bWVudHMubGVuZ3RoLCAyKSwgYXNzaWduO1xuXHRkZXN0ID0gT2JqZWN0KHZhbHVlKGRlc3QpKTtcblx0YXNzaWduID0gZnVuY3Rpb24gKGtleSkge1xuXHRcdHRyeSB7IGRlc3Rba2V5XSA9IHNyY1trZXldOyB9IGNhdGNoIChlKSB7XG5cdFx0XHRpZiAoIWVycm9yKSBlcnJvciA9IGU7XG5cdFx0fVxuXHR9O1xuXHRmb3IgKGkgPSAxOyBpIDwgbDsgKytpKSB7XG5cdFx0c3JjID0gYXJndW1lbnRzW2ldO1xuXHRcdGtleXMoc3JjKS5mb3JFYWNoKGFzc2lnbik7XG5cdH1cblx0aWYgKGVycm9yICE9PSB1bmRlZmluZWQpIHRocm93IGVycm9yO1xuXHRyZXR1cm4gZGVzdDtcbn07XG4iLCIvLyBEZXByZWNhdGVkXG5cbid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqKSB7IHJldHVybiB0eXBlb2Ygb2JqID09PSAnZnVuY3Rpb24nOyB9O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoJy4vaXMtaW1wbGVtZW50ZWQnKSgpXG5cdD8gT2JqZWN0LmtleXNcblx0OiByZXF1aXJlKCcuL3NoaW0nKTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoKSB7XG5cdHRyeSB7XG5cdFx0T2JqZWN0LmtleXMoJ3ByaW1pdGl2ZScpO1xuXHRcdHJldHVybiB0cnVlO1xuXHR9IGNhdGNoIChlKSB7IHJldHVybiBmYWxzZTsgfVxufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGtleXMgPSBPYmplY3Qua2V5cztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG5cdHJldHVybiBrZXlzKG9iamVjdCA9PSBudWxsID8gb2JqZWN0IDogT2JqZWN0KG9iamVjdCkpO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGZvckVhY2ggPSBBcnJheS5wcm90b3R5cGUuZm9yRWFjaCwgY3JlYXRlID0gT2JqZWN0LmNyZWF0ZTtcblxudmFyIHByb2Nlc3MgPSBmdW5jdGlvbiAoc3JjLCBvYmopIHtcblx0dmFyIGtleTtcblx0Zm9yIChrZXkgaW4gc3JjKSBvYmpba2V5XSA9IHNyY1trZXldO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAob3B0aW9ucy8qLCDigKZvcHRpb25zKi8pIHtcblx0dmFyIHJlc3VsdCA9IGNyZWF0ZShudWxsKTtcblx0Zm9yRWFjaC5jYWxsKGFyZ3VtZW50cywgZnVuY3Rpb24gKG9wdGlvbnMpIHtcblx0XHRpZiAob3B0aW9ucyA9PSBudWxsKSByZXR1cm47XG5cdFx0cHJvY2VzcyhPYmplY3Qob3B0aW9ucyksIHJlc3VsdCk7XG5cdH0pO1xuXHRyZXR1cm4gcmVzdWx0O1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiAoZm4pIHtcblx0aWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykgdGhyb3cgbmV3IFR5cGVFcnJvcihmbiArIFwiIGlzIG5vdCBhIGZ1bmN0aW9uXCIpO1xuXHRyZXR1cm4gZm47XG59O1xuIiwiJ3VzZSBzdHJpY3QnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuXHRpZiAodmFsdWUgPT0gbnVsbCkgdGhyb3cgbmV3IFR5cGVFcnJvcihcIkNhbm5vdCB1c2UgbnVsbCBvciB1bmRlZmluZWRcIik7XG5cdHJldHVybiB2YWx1ZTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbm1vZHVsZS5leHBvcnRzID0gcmVxdWlyZSgnLi9pcy1pbXBsZW1lbnRlZCcpKClcblx0PyBTdHJpbmcucHJvdG90eXBlLmNvbnRhaW5zXG5cdDogcmVxdWlyZSgnLi9zaGltJyk7XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBzdHIgPSAncmF6ZHdhdHJ6eSc7XG5cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gKCkge1xuXHRpZiAodHlwZW9mIHN0ci5jb250YWlucyAhPT0gJ2Z1bmN0aW9uJykgcmV0dXJuIGZhbHNlO1xuXHRyZXR1cm4gKChzdHIuY29udGFpbnMoJ2R3YScpID09PSB0cnVlKSAmJiAoc3RyLmNvbnRhaW5zKCdmb28nKSA9PT0gZmFsc2UpKTtcbn07XG4iLCIndXNlIHN0cmljdCc7XG5cbnZhciBpbmRleE9mID0gU3RyaW5nLnByb3RvdHlwZS5pbmRleE9mO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uIChzZWFyY2hTdHJpbmcvKiwgcG9zaXRpb24qLykge1xuXHRyZXR1cm4gaW5kZXhPZi5jYWxsKHRoaXMsIHNlYXJjaFN0cmluZywgYXJndW1lbnRzWzFdKSA+IC0xO1xufTtcbiIsIid1c2Ugc3RyaWN0JztcblxudmFyIGQgICAgICAgID0gcmVxdWlyZSgnZCcpXG4gICwgY2FsbGFibGUgPSByZXF1aXJlKCdlczUtZXh0L29iamVjdC92YWxpZC1jYWxsYWJsZScpXG5cbiAgLCBhcHBseSA9IEZ1bmN0aW9uLnByb3RvdHlwZS5hcHBseSwgY2FsbCA9IEZ1bmN0aW9uLnByb3RvdHlwZS5jYWxsXG4gICwgY3JlYXRlID0gT2JqZWN0LmNyZWF0ZSwgZGVmaW5lUHJvcGVydHkgPSBPYmplY3QuZGVmaW5lUHJvcGVydHlcbiAgLCBkZWZpbmVQcm9wZXJ0aWVzID0gT2JqZWN0LmRlZmluZVByb3BlcnRpZXNcbiAgLCBoYXNPd25Qcm9wZXJ0eSA9IE9iamVjdC5wcm90b3R5cGUuaGFzT3duUHJvcGVydHlcbiAgLCBkZXNjcmlwdG9yID0geyBjb25maWd1cmFibGU6IHRydWUsIGVudW1lcmFibGU6IGZhbHNlLCB3cml0YWJsZTogdHJ1ZSB9XG5cbiAgLCBvbiwgb25jZSwgb2ZmLCBlbWl0LCBtZXRob2RzLCBkZXNjcmlwdG9ycywgYmFzZTtcblxub24gPSBmdW5jdGlvbiAodHlwZSwgbGlzdGVuZXIpIHtcblx0dmFyIGRhdGE7XG5cblx0Y2FsbGFibGUobGlzdGVuZXIpO1xuXG5cdGlmICghaGFzT3duUHJvcGVydHkuY2FsbCh0aGlzLCAnX19lZV9fJykpIHtcblx0XHRkYXRhID0gZGVzY3JpcHRvci52YWx1ZSA9IGNyZWF0ZShudWxsKTtcblx0XHRkZWZpbmVQcm9wZXJ0eSh0aGlzLCAnX19lZV9fJywgZGVzY3JpcHRvcik7XG5cdFx0ZGVzY3JpcHRvci52YWx1ZSA9IG51bGw7XG5cdH0gZWxzZSB7XG5cdFx0ZGF0YSA9IHRoaXMuX19lZV9fO1xuXHR9XG5cdGlmICghZGF0YVt0eXBlXSkgZGF0YVt0eXBlXSA9IGxpc3RlbmVyO1xuXHRlbHNlIGlmICh0eXBlb2YgZGF0YVt0eXBlXSA9PT0gJ29iamVjdCcpIGRhdGFbdHlwZV0ucHVzaChsaXN0ZW5lcik7XG5cdGVsc2UgZGF0YVt0eXBlXSA9IFtkYXRhW3R5cGVdLCBsaXN0ZW5lcl07XG5cblx0cmV0dXJuIHRoaXM7XG59O1xuXG5vbmNlID0gZnVuY3Rpb24gKHR5cGUsIGxpc3RlbmVyKSB7XG5cdHZhciBvbmNlLCBzZWxmO1xuXG5cdGNhbGxhYmxlKGxpc3RlbmVyKTtcblx0c2VsZiA9IHRoaXM7XG5cdG9uLmNhbGwodGhpcywgdHlwZSwgb25jZSA9IGZ1bmN0aW9uICgpIHtcblx0XHRvZmYuY2FsbChzZWxmLCB0eXBlLCBvbmNlKTtcblx0XHRhcHBseS5jYWxsKGxpc3RlbmVyLCB0aGlzLCBhcmd1bWVudHMpO1xuXHR9KTtcblxuXHRvbmNlLl9fZWVPbmNlTGlzdGVuZXJfXyA9IGxpc3RlbmVyO1xuXHRyZXR1cm4gdGhpcztcbn07XG5cbm9mZiA9IGZ1bmN0aW9uICh0eXBlLCBsaXN0ZW5lcikge1xuXHR2YXIgZGF0YSwgbGlzdGVuZXJzLCBjYW5kaWRhdGUsIGk7XG5cblx0Y2FsbGFibGUobGlzdGVuZXIpO1xuXG5cdGlmICghaGFzT3duUHJvcGVydHkuY2FsbCh0aGlzLCAnX19lZV9fJykpIHJldHVybiB0aGlzO1xuXHRkYXRhID0gdGhpcy5fX2VlX187XG5cdGlmICghZGF0YVt0eXBlXSkgcmV0dXJuIHRoaXM7XG5cdGxpc3RlbmVycyA9IGRhdGFbdHlwZV07XG5cblx0aWYgKHR5cGVvZiBsaXN0ZW5lcnMgPT09ICdvYmplY3QnKSB7XG5cdFx0Zm9yIChpID0gMDsgKGNhbmRpZGF0ZSA9IGxpc3RlbmVyc1tpXSk7ICsraSkge1xuXHRcdFx0aWYgKChjYW5kaWRhdGUgPT09IGxpc3RlbmVyKSB8fFxuXHRcdFx0XHRcdChjYW5kaWRhdGUuX19lZU9uY2VMaXN0ZW5lcl9fID09PSBsaXN0ZW5lcikpIHtcblx0XHRcdFx0aWYgKGxpc3RlbmVycy5sZW5ndGggPT09IDIpIGRhdGFbdHlwZV0gPSBsaXN0ZW5lcnNbaSA/IDAgOiAxXTtcblx0XHRcdFx0ZWxzZSBsaXN0ZW5lcnMuc3BsaWNlKGksIDEpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRpZiAoKGxpc3RlbmVycyA9PT0gbGlzdGVuZXIpIHx8XG5cdFx0XHRcdChsaXN0ZW5lcnMuX19lZU9uY2VMaXN0ZW5lcl9fID09PSBsaXN0ZW5lcikpIHtcblx0XHRcdGRlbGV0ZSBkYXRhW3R5cGVdO1xuXHRcdH1cblx0fVxuXG5cdHJldHVybiB0aGlzO1xufTtcblxuZW1pdCA9IGZ1bmN0aW9uICh0eXBlKSB7XG5cdHZhciBpLCBsLCBsaXN0ZW5lciwgbGlzdGVuZXJzLCBhcmdzO1xuXG5cdGlmICghaGFzT3duUHJvcGVydHkuY2FsbCh0aGlzLCAnX19lZV9fJykpIHJldHVybjtcblx0bGlzdGVuZXJzID0gdGhpcy5fX2VlX19bdHlwZV07XG5cdGlmICghbGlzdGVuZXJzKSByZXR1cm47XG5cblx0aWYgKHR5cGVvZiBsaXN0ZW5lcnMgPT09ICdvYmplY3QnKSB7XG5cdFx0bCA9IGFyZ3VtZW50cy5sZW5ndGg7XG5cdFx0YXJncyA9IG5ldyBBcnJheShsIC0gMSk7XG5cdFx0Zm9yIChpID0gMTsgaSA8IGw7ICsraSkgYXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cblx0XHRsaXN0ZW5lcnMgPSBsaXN0ZW5lcnMuc2xpY2UoKTtcblx0XHRmb3IgKGkgPSAwOyAobGlzdGVuZXIgPSBsaXN0ZW5lcnNbaV0pOyArK2kpIHtcblx0XHRcdGFwcGx5LmNhbGwobGlzdGVuZXIsIHRoaXMsIGFyZ3MpO1xuXHRcdH1cblx0fSBlbHNlIHtcblx0XHRzd2l0Y2ggKGFyZ3VtZW50cy5sZW5ndGgpIHtcblx0XHRjYXNlIDE6XG5cdFx0XHRjYWxsLmNhbGwobGlzdGVuZXJzLCB0aGlzKTtcblx0XHRcdGJyZWFrO1xuXHRcdGNhc2UgMjpcblx0XHRcdGNhbGwuY2FsbChsaXN0ZW5lcnMsIHRoaXMsIGFyZ3VtZW50c1sxXSk7XG5cdFx0XHRicmVhaztcblx0XHRjYXNlIDM6XG5cdFx0XHRjYWxsLmNhbGwobGlzdGVuZXJzLCB0aGlzLCBhcmd1bWVudHNbMV0sIGFyZ3VtZW50c1syXSk7XG5cdFx0XHRicmVhaztcblx0XHRkZWZhdWx0OlxuXHRcdFx0bCA9IGFyZ3VtZW50cy5sZW5ndGg7XG5cdFx0XHRhcmdzID0gbmV3IEFycmF5KGwgLSAxKTtcblx0XHRcdGZvciAoaSA9IDE7IGkgPCBsOyArK2kpIHtcblx0XHRcdFx0YXJnc1tpIC0gMV0gPSBhcmd1bWVudHNbaV07XG5cdFx0XHR9XG5cdFx0XHRhcHBseS5jYWxsKGxpc3RlbmVycywgdGhpcywgYXJncyk7XG5cdFx0fVxuXHR9XG59O1xuXG5tZXRob2RzID0ge1xuXHRvbjogb24sXG5cdG9uY2U6IG9uY2UsXG5cdG9mZjogb2ZmLFxuXHRlbWl0OiBlbWl0XG59O1xuXG5kZXNjcmlwdG9ycyA9IHtcblx0b246IGQob24pLFxuXHRvbmNlOiBkKG9uY2UpLFxuXHRvZmY6IGQob2ZmKSxcblx0ZW1pdDogZChlbWl0KVxufTtcblxuYmFzZSA9IGRlZmluZVByb3BlcnRpZXMoe30sIGRlc2NyaXB0b3JzKTtcblxubW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzID0gZnVuY3Rpb24gKG8pIHtcblx0cmV0dXJuIChvID09IG51bGwpID8gY3JlYXRlKGJhc2UpIDogZGVmaW5lUHJvcGVydGllcyhPYmplY3QobyksIGRlc2NyaXB0b3JzKTtcbn07XG5leHBvcnRzLm1ldGhvZHMgPSBtZXRob2RzO1xuIiwiLypqc2hpbnQgLVcwNTQgKi9cbihmdW5jdGlvbiAoZXhwb3J0cykge1xuICAndXNlIHN0cmljdCc7XG5cbiAgLy8gaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy8yNDUwOTU0L2hvdy10by1yYW5kb21pemUtc2h1ZmZsZS1hLWphdmFzY3JpcHQtYXJyYXlcbiAgZnVuY3Rpb24gc2h1ZmZsZShhcnJheSkge1xuICAgIHZhciBjdXJyZW50SW5kZXggPSBhcnJheS5sZW5ndGhcbiAgICAgICwgdGVtcG9yYXJ5VmFsdWVcbiAgICAgICwgcmFuZG9tSW5kZXhcbiAgICAgIDtcblxuICAgIC8vIFdoaWxlIHRoZXJlIHJlbWFpbiBlbGVtZW50cyB0byBzaHVmZmxlLi4uXG4gICAgd2hpbGUgKDAgIT09IGN1cnJlbnRJbmRleCkge1xuXG4gICAgICAvLyBQaWNrIGEgcmVtYWluaW5nIGVsZW1lbnQuLi5cbiAgICAgIHJhbmRvbUluZGV4ID0gTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogY3VycmVudEluZGV4KTtcbiAgICAgIGN1cnJlbnRJbmRleCAtPSAxO1xuXG4gICAgICAvLyBBbmQgc3dhcCBpdCB3aXRoIHRoZSBjdXJyZW50IGVsZW1lbnQuXG4gICAgICB0ZW1wb3JhcnlWYWx1ZSA9IGFycmF5W2N1cnJlbnRJbmRleF07XG4gICAgICBhcnJheVtjdXJyZW50SW5kZXhdID0gYXJyYXlbcmFuZG9tSW5kZXhdO1xuICAgICAgYXJyYXlbcmFuZG9tSW5kZXhdID0gdGVtcG9yYXJ5VmFsdWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGFycmF5O1xuICB9XG5cbiAgZXhwb3J0cy5rbnV0aFNodWZmbGUgPSBzaHVmZmxlO1xufSgndW5kZWZpbmVkJyAhPT0gdHlwZW9mIGV4cG9ydHMgJiYgZXhwb3J0cyB8fCAndW5kZWZpbmVkJyAhPT0gdHlwZW9mIHdpbmRvdyAmJiB3aW5kb3cgfHwgZ2xvYmFsKSk7XG4iLCIvKlxuICogQSBzcGVlZC1pbXByb3ZlZCBwZXJsaW4gYW5kIHNpbXBsZXggbm9pc2UgYWxnb3JpdGhtcyBmb3IgMkQuXG4gKlxuICogQmFzZWQgb24gZXhhbXBsZSBjb2RlIGJ5IFN0ZWZhbiBHdXN0YXZzb24gKHN0ZWd1QGl0bi5saXUuc2UpLlxuICogT3B0aW1pc2F0aW9ucyBieSBQZXRlciBFYXN0bWFuIChwZWFzdG1hbkBkcml6emxlLnN0YW5mb3JkLmVkdSkuXG4gKiBCZXR0ZXIgcmFuayBvcmRlcmluZyBtZXRob2QgYnkgU3RlZmFuIEd1c3RhdnNvbiBpbiAyMDEyLlxuICogQ29udmVydGVkIHRvIEphdmFzY3JpcHQgYnkgSm9zZXBoIEdlbnRsZS5cbiAqXG4gKiBWZXJzaW9uIDIwMTItMDMtMDlcbiAqXG4gKiBUaGlzIGNvZGUgd2FzIHBsYWNlZCBpbiB0aGUgcHVibGljIGRvbWFpbiBieSBpdHMgb3JpZ2luYWwgYXV0aG9yLFxuICogU3RlZmFuIEd1c3RhdnNvbi4gWW91IG1heSB1c2UgaXQgYXMgeW91IHNlZSBmaXQsIGJ1dFxuICogYXR0cmlidXRpb24gaXMgYXBwcmVjaWF0ZWQuXG4gKlxuICovXG5cbihmdW5jdGlvbihnbG9iYWwpe1xuICB2YXIgbW9kdWxlID0gZ2xvYmFsLm5vaXNlID0ge307XG5cbiAgZnVuY3Rpb24gR3JhZCh4LCB5LCB6KSB7XG4gICAgdGhpcy54ID0geDsgdGhpcy55ID0geTsgdGhpcy56ID0gejtcbiAgfVxuICBcbiAgR3JhZC5wcm90b3R5cGUuZG90MiA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICByZXR1cm4gdGhpcy54KnggKyB0aGlzLnkqeTtcbiAgfTtcblxuICBHcmFkLnByb3RvdHlwZS5kb3QzID0gZnVuY3Rpb24oeCwgeSwgeikge1xuICAgIHJldHVybiB0aGlzLngqeCArIHRoaXMueSp5ICsgdGhpcy56Kno7XG4gIH07XG5cbiAgdmFyIGdyYWQzID0gW25ldyBHcmFkKDEsMSwwKSxuZXcgR3JhZCgtMSwxLDApLG5ldyBHcmFkKDEsLTEsMCksbmV3IEdyYWQoLTEsLTEsMCksXG4gICAgICAgICAgICAgICBuZXcgR3JhZCgxLDAsMSksbmV3IEdyYWQoLTEsMCwxKSxuZXcgR3JhZCgxLDAsLTEpLG5ldyBHcmFkKC0xLDAsLTEpLFxuICAgICAgICAgICAgICAgbmV3IEdyYWQoMCwxLDEpLG5ldyBHcmFkKDAsLTEsMSksbmV3IEdyYWQoMCwxLC0xKSxuZXcgR3JhZCgwLC0xLC0xKV07XG5cbiAgdmFyIHAgPSBbMTUxLDE2MCwxMzcsOTEsOTAsMTUsXG4gIDEzMSwxMywyMDEsOTUsOTYsNTMsMTk0LDIzMyw3LDIyNSwxNDAsMzYsMTAzLDMwLDY5LDE0Miw4LDk5LDM3LDI0MCwyMSwxMCwyMyxcbiAgMTkwLCA2LDE0OCwyNDcsMTIwLDIzNCw3NSwwLDI2LDE5Nyw2Miw5NCwyNTIsMjE5LDIwMywxMTcsMzUsMTEsMzIsNTcsMTc3LDMzLFxuICA4OCwyMzcsMTQ5LDU2LDg3LDE3NCwyMCwxMjUsMTM2LDE3MSwxNjgsIDY4LDE3NSw3NCwxNjUsNzEsMTM0LDEzOSw0OCwyNywxNjYsXG4gIDc3LDE0NiwxNTgsMjMxLDgzLDExMSwyMjksMTIyLDYwLDIxMSwxMzMsMjMwLDIyMCwxMDUsOTIsNDEsNTUsNDYsMjQ1LDQwLDI0NCxcbiAgMTAyLDE0Myw1NCwgNjUsMjUsNjMsMTYxLCAxLDIxNiw4MCw3MywyMDksNzYsMTMyLDE4NywyMDgsIDg5LDE4LDE2OSwyMDAsMTk2LFxuICAxMzUsMTMwLDExNiwxODgsMTU5LDg2LDE2NCwxMDAsMTA5LDE5OCwxNzMsMTg2LCAzLDY0LDUyLDIxNywyMjYsMjUwLDEyNCwxMjMsXG4gIDUsMjAyLDM4LDE0NywxMTgsMTI2LDI1NSw4Miw4NSwyMTIsMjA3LDIwNiw1OSwyMjcsNDcsMTYsNTgsMTcsMTgyLDE4OSwyOCw0MixcbiAgMjIzLDE4MywxNzAsMjEzLDExOSwyNDgsMTUyLCAyLDQ0LDE1NCwxNjMsIDcwLDIyMSwxNTMsMTAxLDE1NSwxNjcsIDQzLDE3Miw5LFxuICAxMjksMjIsMzksMjUzLCAxOSw5OCwxMDgsMTEwLDc5LDExMywyMjQsMjMyLDE3OCwxODUsIDExMiwxMDQsMjE4LDI0Niw5NywyMjgsXG4gIDI1MSwzNCwyNDIsMTkzLDIzOCwyMTAsMTQ0LDEyLDE5MSwxNzksMTYyLDI0MSwgODEsNTEsMTQ1LDIzNSwyNDksMTQsMjM5LDEwNyxcbiAgNDksMTkyLDIxNCwgMzEsMTgxLDE5OSwxMDYsMTU3LDE4NCwgODQsMjA0LDE3NiwxMTUsMTIxLDUwLDQ1LDEyNywgNCwxNTAsMjU0LFxuICAxMzgsMjM2LDIwNSw5MywyMjIsMTE0LDY3LDI5LDI0LDcyLDI0MywxNDEsMTI4LDE5NSw3OCw2NiwyMTUsNjEsMTU2LDE4MF07XG4gIC8vIFRvIHJlbW92ZSB0aGUgbmVlZCBmb3IgaW5kZXggd3JhcHBpbmcsIGRvdWJsZSB0aGUgcGVybXV0YXRpb24gdGFibGUgbGVuZ3RoXG4gIHZhciBwZXJtID0gbmV3IEFycmF5KDUxMik7XG4gIHZhciBncmFkUCA9IG5ldyBBcnJheSg1MTIpO1xuXG4gIC8vIFRoaXMgaXNuJ3QgYSB2ZXJ5IGdvb2Qgc2VlZGluZyBmdW5jdGlvbiwgYnV0IGl0IHdvcmtzIG9rLiBJdCBzdXBwb3J0cyAyXjE2XG4gIC8vIGRpZmZlcmVudCBzZWVkIHZhbHVlcy4gV3JpdGUgc29tZXRoaW5nIGJldHRlciBpZiB5b3UgbmVlZCBtb3JlIHNlZWRzLlxuICBtb2R1bGUuc2VlZCA9IGZ1bmN0aW9uKHNlZWQpIHtcbiAgICBpZihzZWVkID4gMCAmJiBzZWVkIDwgMSkge1xuICAgICAgLy8gU2NhbGUgdGhlIHNlZWQgb3V0XG4gICAgICBzZWVkICo9IDY1NTM2O1xuICAgIH1cblxuICAgIHNlZWQgPSBNYXRoLmZsb29yKHNlZWQpO1xuICAgIGlmKHNlZWQgPCAyNTYpIHtcbiAgICAgIHNlZWQgfD0gc2VlZCA8PCA4O1xuICAgIH1cblxuICAgIGZvcih2YXIgaSA9IDA7IGkgPCAyNTY7IGkrKykge1xuICAgICAgdmFyIHY7XG4gICAgICBpZiAoaSAmIDEpIHtcbiAgICAgICAgdiA9IHBbaV0gXiAoc2VlZCAmIDI1NSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB2ID0gcFtpXSBeICgoc2VlZD4+OCkgJiAyNTUpO1xuICAgICAgfVxuXG4gICAgICBwZXJtW2ldID0gcGVybVtpICsgMjU2XSA9IHY7XG4gICAgICBncmFkUFtpXSA9IGdyYWRQW2kgKyAyNTZdID0gZ3JhZDNbdiAlIDEyXTtcbiAgICB9XG4gIH07XG5cbiAgbW9kdWxlLnNlZWQoMCk7XG5cbiAgLypcbiAgZm9yKHZhciBpPTA7IGk8MjU2OyBpKyspIHtcbiAgICBwZXJtW2ldID0gcGVybVtpICsgMjU2XSA9IHBbaV07XG4gICAgZ3JhZFBbaV0gPSBncmFkUFtpICsgMjU2XSA9IGdyYWQzW3Blcm1baV0gJSAxMl07XG4gIH0qL1xuXG4gIC8vIFNrZXdpbmcgYW5kIHVuc2tld2luZyBmYWN0b3JzIGZvciAyLCAzLCBhbmQgNCBkaW1lbnNpb25zXG4gIHZhciBGMiA9IDAuNSooTWF0aC5zcXJ0KDMpLTEpO1xuICB2YXIgRzIgPSAoMy1NYXRoLnNxcnQoMykpLzY7XG5cbiAgdmFyIEYzID0gMS8zO1xuICB2YXIgRzMgPSAxLzY7XG5cbiAgLy8gMkQgc2ltcGxleCBub2lzZVxuICBtb2R1bGUuc2ltcGxleDIgPSBmdW5jdGlvbih4aW4sIHlpbikge1xuICAgIHZhciBuMCwgbjEsIG4yOyAvLyBOb2lzZSBjb250cmlidXRpb25zIGZyb20gdGhlIHRocmVlIGNvcm5lcnNcbiAgICAvLyBTa2V3IHRoZSBpbnB1dCBzcGFjZSB0byBkZXRlcm1pbmUgd2hpY2ggc2ltcGxleCBjZWxsIHdlJ3JlIGluXG4gICAgdmFyIHMgPSAoeGluK3lpbikqRjI7IC8vIEhhaXJ5IGZhY3RvciBmb3IgMkRcbiAgICB2YXIgaSA9IE1hdGguZmxvb3IoeGluK3MpO1xuICAgIHZhciBqID0gTWF0aC5mbG9vcih5aW4rcyk7XG4gICAgdmFyIHQgPSAoaStqKSpHMjtcbiAgICB2YXIgeDAgPSB4aW4taSt0OyAvLyBUaGUgeCx5IGRpc3RhbmNlcyBmcm9tIHRoZSBjZWxsIG9yaWdpbiwgdW5za2V3ZWQuXG4gICAgdmFyIHkwID0geWluLWordDtcbiAgICAvLyBGb3IgdGhlIDJEIGNhc2UsIHRoZSBzaW1wbGV4IHNoYXBlIGlzIGFuIGVxdWlsYXRlcmFsIHRyaWFuZ2xlLlxuICAgIC8vIERldGVybWluZSB3aGljaCBzaW1wbGV4IHdlIGFyZSBpbi5cbiAgICB2YXIgaTEsIGoxOyAvLyBPZmZzZXRzIGZvciBzZWNvbmQgKG1pZGRsZSkgY29ybmVyIG9mIHNpbXBsZXggaW4gKGksaikgY29vcmRzXG4gICAgaWYoeDA+eTApIHsgLy8gbG93ZXIgdHJpYW5nbGUsIFhZIG9yZGVyOiAoMCwwKS0+KDEsMCktPigxLDEpXG4gICAgICBpMT0xOyBqMT0wO1xuICAgIH0gZWxzZSB7ICAgIC8vIHVwcGVyIHRyaWFuZ2xlLCBZWCBvcmRlcjogKDAsMCktPigwLDEpLT4oMSwxKVxuICAgICAgaTE9MDsgajE9MTtcbiAgICB9XG4gICAgLy8gQSBzdGVwIG9mICgxLDApIGluIChpLGopIG1lYW5zIGEgc3RlcCBvZiAoMS1jLC1jKSBpbiAoeCx5KSwgYW5kXG4gICAgLy8gYSBzdGVwIG9mICgwLDEpIGluIChpLGopIG1lYW5zIGEgc3RlcCBvZiAoLWMsMS1jKSBpbiAoeCx5KSwgd2hlcmVcbiAgICAvLyBjID0gKDMtc3FydCgzKSkvNlxuICAgIHZhciB4MSA9IHgwIC0gaTEgKyBHMjsgLy8gT2Zmc2V0cyBmb3IgbWlkZGxlIGNvcm5lciBpbiAoeCx5KSB1bnNrZXdlZCBjb29yZHNcbiAgICB2YXIgeTEgPSB5MCAtIGoxICsgRzI7XG4gICAgdmFyIHgyID0geDAgLSAxICsgMiAqIEcyOyAvLyBPZmZzZXRzIGZvciBsYXN0IGNvcm5lciBpbiAoeCx5KSB1bnNrZXdlZCBjb29yZHNcbiAgICB2YXIgeTIgPSB5MCAtIDEgKyAyICogRzI7XG4gICAgLy8gV29yayBvdXQgdGhlIGhhc2hlZCBncmFkaWVudCBpbmRpY2VzIG9mIHRoZSB0aHJlZSBzaW1wbGV4IGNvcm5lcnNcbiAgICBpICY9IDI1NTtcbiAgICBqICY9IDI1NTtcbiAgICB2YXIgZ2kwID0gZ3JhZFBbaStwZXJtW2pdXTtcbiAgICB2YXIgZ2kxID0gZ3JhZFBbaStpMStwZXJtW2orajFdXTtcbiAgICB2YXIgZ2kyID0gZ3JhZFBbaSsxK3Blcm1baisxXV07XG4gICAgLy8gQ2FsY3VsYXRlIHRoZSBjb250cmlidXRpb24gZnJvbSB0aGUgdGhyZWUgY29ybmVyc1xuICAgIHZhciB0MCA9IDAuNSAtIHgwKngwLXkwKnkwO1xuICAgIGlmKHQwPDApIHtcbiAgICAgIG4wID0gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgdDAgKj0gdDA7XG4gICAgICBuMCA9IHQwICogdDAgKiBnaTAuZG90Mih4MCwgeTApOyAgLy8gKHgseSkgb2YgZ3JhZDMgdXNlZCBmb3IgMkQgZ3JhZGllbnRcbiAgICB9XG4gICAgdmFyIHQxID0gMC41IC0geDEqeDEteTEqeTE7XG4gICAgaWYodDE8MCkge1xuICAgICAgbjEgPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICB0MSAqPSB0MTtcbiAgICAgIG4xID0gdDEgKiB0MSAqIGdpMS5kb3QyKHgxLCB5MSk7XG4gICAgfVxuICAgIHZhciB0MiA9IDAuNSAtIHgyKngyLXkyKnkyO1xuICAgIGlmKHQyPDApIHtcbiAgICAgIG4yID0gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgdDIgKj0gdDI7XG4gICAgICBuMiA9IHQyICogdDIgKiBnaTIuZG90Mih4MiwgeTIpO1xuICAgIH1cbiAgICAvLyBBZGQgY29udHJpYnV0aW9ucyBmcm9tIGVhY2ggY29ybmVyIHRvIGdldCB0aGUgZmluYWwgbm9pc2UgdmFsdWUuXG4gICAgLy8gVGhlIHJlc3VsdCBpcyBzY2FsZWQgdG8gcmV0dXJuIHZhbHVlcyBpbiB0aGUgaW50ZXJ2YWwgWy0xLDFdLlxuICAgIHJldHVybiA3MCAqIChuMCArIG4xICsgbjIpO1xuICB9O1xuXG4gIC8vIDNEIHNpbXBsZXggbm9pc2VcbiAgbW9kdWxlLnNpbXBsZXgzID0gZnVuY3Rpb24oeGluLCB5aW4sIHppbikge1xuICAgIHZhciBuMCwgbjEsIG4yLCBuMzsgLy8gTm9pc2UgY29udHJpYnV0aW9ucyBmcm9tIHRoZSBmb3VyIGNvcm5lcnNcblxuICAgIC8vIFNrZXcgdGhlIGlucHV0IHNwYWNlIHRvIGRldGVybWluZSB3aGljaCBzaW1wbGV4IGNlbGwgd2UncmUgaW5cbiAgICB2YXIgcyA9ICh4aW4reWluK3ppbikqRjM7IC8vIEhhaXJ5IGZhY3RvciBmb3IgMkRcbiAgICB2YXIgaSA9IE1hdGguZmxvb3IoeGluK3MpO1xuICAgIHZhciBqID0gTWF0aC5mbG9vcih5aW4rcyk7XG4gICAgdmFyIGsgPSBNYXRoLmZsb29yKHppbitzKTtcblxuICAgIHZhciB0ID0gKGkraitrKSpHMztcbiAgICB2YXIgeDAgPSB4aW4taSt0OyAvLyBUaGUgeCx5IGRpc3RhbmNlcyBmcm9tIHRoZSBjZWxsIG9yaWdpbiwgdW5za2V3ZWQuXG4gICAgdmFyIHkwID0geWluLWordDtcbiAgICB2YXIgejAgPSB6aW4tayt0O1xuXG4gICAgLy8gRm9yIHRoZSAzRCBjYXNlLCB0aGUgc2ltcGxleCBzaGFwZSBpcyBhIHNsaWdodGx5IGlycmVndWxhciB0ZXRyYWhlZHJvbi5cbiAgICAvLyBEZXRlcm1pbmUgd2hpY2ggc2ltcGxleCB3ZSBhcmUgaW4uXG4gICAgdmFyIGkxLCBqMSwgazE7IC8vIE9mZnNldHMgZm9yIHNlY29uZCBjb3JuZXIgb2Ygc2ltcGxleCBpbiAoaSxqLGspIGNvb3Jkc1xuICAgIHZhciBpMiwgajIsIGsyOyAvLyBPZmZzZXRzIGZvciB0aGlyZCBjb3JuZXIgb2Ygc2ltcGxleCBpbiAoaSxqLGspIGNvb3Jkc1xuICAgIGlmKHgwID49IHkwKSB7XG4gICAgICBpZih5MCA+PSB6MCkgICAgICB7IGkxPTE7IGoxPTA7IGsxPTA7IGkyPTE7IGoyPTE7IGsyPTA7IH1cbiAgICAgIGVsc2UgaWYoeDAgPj0gejApIHsgaTE9MTsgajE9MDsgazE9MDsgaTI9MTsgajI9MDsgazI9MTsgfVxuICAgICAgZWxzZSAgICAgICAgICAgICAgeyBpMT0wOyBqMT0wOyBrMT0xOyBpMj0xOyBqMj0wOyBrMj0xOyB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmKHkwIDwgejApICAgICAgeyBpMT0wOyBqMT0wOyBrMT0xOyBpMj0wOyBqMj0xOyBrMj0xOyB9XG4gICAgICBlbHNlIGlmKHgwIDwgejApIHsgaTE9MDsgajE9MTsgazE9MDsgaTI9MDsgajI9MTsgazI9MTsgfVxuICAgICAgZWxzZSAgICAgICAgICAgICB7IGkxPTA7IGoxPTE7IGsxPTA7IGkyPTE7IGoyPTE7IGsyPTA7IH1cbiAgICB9XG4gICAgLy8gQSBzdGVwIG9mICgxLDAsMCkgaW4gKGksaixrKSBtZWFucyBhIHN0ZXAgb2YgKDEtYywtYywtYykgaW4gKHgseSx6KSxcbiAgICAvLyBhIHN0ZXAgb2YgKDAsMSwwKSBpbiAoaSxqLGspIG1lYW5zIGEgc3RlcCBvZiAoLWMsMS1jLC1jKSBpbiAoeCx5LHopLCBhbmRcbiAgICAvLyBhIHN0ZXAgb2YgKDAsMCwxKSBpbiAoaSxqLGspIG1lYW5zIGEgc3RlcCBvZiAoLWMsLWMsMS1jKSBpbiAoeCx5LHopLCB3aGVyZVxuICAgIC8vIGMgPSAxLzYuXG4gICAgdmFyIHgxID0geDAgLSBpMSArIEczOyAvLyBPZmZzZXRzIGZvciBzZWNvbmQgY29ybmVyXG4gICAgdmFyIHkxID0geTAgLSBqMSArIEczO1xuICAgIHZhciB6MSA9IHowIC0gazEgKyBHMztcblxuICAgIHZhciB4MiA9IHgwIC0gaTIgKyAyICogRzM7IC8vIE9mZnNldHMgZm9yIHRoaXJkIGNvcm5lclxuICAgIHZhciB5MiA9IHkwIC0gajIgKyAyICogRzM7XG4gICAgdmFyIHoyID0gejAgLSBrMiArIDIgKiBHMztcblxuICAgIHZhciB4MyA9IHgwIC0gMSArIDMgKiBHMzsgLy8gT2Zmc2V0cyBmb3IgZm91cnRoIGNvcm5lclxuICAgIHZhciB5MyA9IHkwIC0gMSArIDMgKiBHMztcbiAgICB2YXIgejMgPSB6MCAtIDEgKyAzICogRzM7XG5cbiAgICAvLyBXb3JrIG91dCB0aGUgaGFzaGVkIGdyYWRpZW50IGluZGljZXMgb2YgdGhlIGZvdXIgc2ltcGxleCBjb3JuZXJzXG4gICAgaSAmPSAyNTU7XG4gICAgaiAmPSAyNTU7XG4gICAgayAmPSAyNTU7XG4gICAgdmFyIGdpMCA9IGdyYWRQW2krICAgcGVybVtqKyAgIHBlcm1bayAgIF1dXTtcbiAgICB2YXIgZ2kxID0gZ3JhZFBbaStpMStwZXJtW2orajErcGVybVtrK2sxXV1dO1xuICAgIHZhciBnaTIgPSBncmFkUFtpK2kyK3Blcm1baitqMitwZXJtW2srazJdXV07XG4gICAgdmFyIGdpMyA9IGdyYWRQW2krIDErcGVybVtqKyAxK3Blcm1baysgMV1dXTtcblxuICAgIC8vIENhbGN1bGF0ZSB0aGUgY29udHJpYnV0aW9uIGZyb20gdGhlIGZvdXIgY29ybmVyc1xuICAgIHZhciB0MCA9IDAuNSAtIHgwKngwLXkwKnkwLXowKnowO1xuICAgIGlmKHQwPDApIHtcbiAgICAgIG4wID0gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgdDAgKj0gdDA7XG4gICAgICBuMCA9IHQwICogdDAgKiBnaTAuZG90Myh4MCwgeTAsIHowKTsgIC8vICh4LHkpIG9mIGdyYWQzIHVzZWQgZm9yIDJEIGdyYWRpZW50XG4gICAgfVxuICAgIHZhciB0MSA9IDAuNSAtIHgxKngxLXkxKnkxLXoxKnoxO1xuICAgIGlmKHQxPDApIHtcbiAgICAgIG4xID0gMDtcbiAgICB9IGVsc2Uge1xuICAgICAgdDEgKj0gdDE7XG4gICAgICBuMSA9IHQxICogdDEgKiBnaTEuZG90Myh4MSwgeTEsIHoxKTtcbiAgICB9XG4gICAgdmFyIHQyID0gMC41IC0geDIqeDIteTIqeTItejIqejI7XG4gICAgaWYodDI8MCkge1xuICAgICAgbjIgPSAwO1xuICAgIH0gZWxzZSB7XG4gICAgICB0MiAqPSB0MjtcbiAgICAgIG4yID0gdDIgKiB0MiAqIGdpMi5kb3QzKHgyLCB5MiwgejIpO1xuICAgIH1cbiAgICB2YXIgdDMgPSAwLjUgLSB4Myp4My15Myp5My16Myp6MztcbiAgICBpZih0MzwwKSB7XG4gICAgICBuMyA9IDA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHQzICo9IHQzO1xuICAgICAgbjMgPSB0MyAqIHQzICogZ2kzLmRvdDMoeDMsIHkzLCB6Myk7XG4gICAgfVxuICAgIC8vIEFkZCBjb250cmlidXRpb25zIGZyb20gZWFjaCBjb3JuZXIgdG8gZ2V0IHRoZSBmaW5hbCBub2lzZSB2YWx1ZS5cbiAgICAvLyBUaGUgcmVzdWx0IGlzIHNjYWxlZCB0byByZXR1cm4gdmFsdWVzIGluIHRoZSBpbnRlcnZhbCBbLTEsMV0uXG4gICAgcmV0dXJuIDMyICogKG4wICsgbjEgKyBuMiArIG4zKTtcblxuICB9O1xuXG4gIC8vICMjIyMjIFBlcmxpbiBub2lzZSBzdHVmZlxuXG4gIGZ1bmN0aW9uIGZhZGUodCkge1xuICAgIHJldHVybiB0KnQqdCoodCoodCo2LTE1KSsxMCk7XG4gIH1cblxuICBmdW5jdGlvbiBsZXJwKGEsIGIsIHQpIHtcbiAgICByZXR1cm4gKDEtdCkqYSArIHQqYjtcbiAgfVxuXG4gIC8vIDJEIFBlcmxpbiBOb2lzZVxuICBtb2R1bGUucGVybGluMiA9IGZ1bmN0aW9uKHgsIHkpIHtcbiAgICAvLyBGaW5kIHVuaXQgZ3JpZCBjZWxsIGNvbnRhaW5pbmcgcG9pbnRcbiAgICB2YXIgWCA9IE1hdGguZmxvb3IoeCksIFkgPSBNYXRoLmZsb29yKHkpO1xuICAgIC8vIEdldCByZWxhdGl2ZSB4eSBjb29yZGluYXRlcyBvZiBwb2ludCB3aXRoaW4gdGhhdCBjZWxsXG4gICAgeCA9IHggLSBYOyB5ID0geSAtIFk7XG4gICAgLy8gV3JhcCB0aGUgaW50ZWdlciBjZWxscyBhdCAyNTUgKHNtYWxsZXIgaW50ZWdlciBwZXJpb2QgY2FuIGJlIGludHJvZHVjZWQgaGVyZSlcbiAgICBYID0gWCAmIDI1NTsgWSA9IFkgJiAyNTU7XG5cbiAgICAvLyBDYWxjdWxhdGUgbm9pc2UgY29udHJpYnV0aW9ucyBmcm9tIGVhY2ggb2YgdGhlIGZvdXIgY29ybmVyc1xuICAgIHZhciBuMDAgPSBncmFkUFtYK3Blcm1bWV1dLmRvdDIoeCwgeSk7XG4gICAgdmFyIG4wMSA9IGdyYWRQW1grcGVybVtZKzFdXS5kb3QyKHgsIHktMSk7XG4gICAgdmFyIG4xMCA9IGdyYWRQW1grMStwZXJtW1ldXS5kb3QyKHgtMSwgeSk7XG4gICAgdmFyIG4xMSA9IGdyYWRQW1grMStwZXJtW1krMV1dLmRvdDIoeC0xLCB5LTEpO1xuXG4gICAgLy8gQ29tcHV0ZSB0aGUgZmFkZSBjdXJ2ZSB2YWx1ZSBmb3IgeFxuICAgIHZhciB1ID0gZmFkZSh4KTtcblxuICAgIC8vIEludGVycG9sYXRlIHRoZSBmb3VyIHJlc3VsdHNcbiAgICByZXR1cm4gbGVycChcbiAgICAgICAgbGVycChuMDAsIG4xMCwgdSksXG4gICAgICAgIGxlcnAobjAxLCBuMTEsIHUpLFxuICAgICAgIGZhZGUoeSkpO1xuICB9O1xuXG4gIC8vIDNEIFBlcmxpbiBOb2lzZVxuICBtb2R1bGUucGVybGluMyA9IGZ1bmN0aW9uKHgsIHksIHopIHtcbiAgICAvLyBGaW5kIHVuaXQgZ3JpZCBjZWxsIGNvbnRhaW5pbmcgcG9pbnRcbiAgICB2YXIgWCA9IE1hdGguZmxvb3IoeCksIFkgPSBNYXRoLmZsb29yKHkpLCBaID0gTWF0aC5mbG9vcih6KTtcbiAgICAvLyBHZXQgcmVsYXRpdmUgeHl6IGNvb3JkaW5hdGVzIG9mIHBvaW50IHdpdGhpbiB0aGF0IGNlbGxcbiAgICB4ID0geCAtIFg7IHkgPSB5IC0gWTsgeiA9IHogLSBaO1xuICAgIC8vIFdyYXAgdGhlIGludGVnZXIgY2VsbHMgYXQgMjU1IChzbWFsbGVyIGludGVnZXIgcGVyaW9kIGNhbiBiZSBpbnRyb2R1Y2VkIGhlcmUpXG4gICAgWCA9IFggJiAyNTU7IFkgPSBZICYgMjU1OyBaID0gWiAmIDI1NTtcblxuICAgIC8vIENhbGN1bGF0ZSBub2lzZSBjb250cmlidXRpb25zIGZyb20gZWFjaCBvZiB0aGUgZWlnaHQgY29ybmVyc1xuICAgIHZhciBuMDAwID0gZ3JhZFBbWCsgIHBlcm1bWSsgIHBlcm1bWiAgXV1dLmRvdDMoeCwgICB5LCAgICAgeik7XG4gICAgdmFyIG4wMDEgPSBncmFkUFtYKyAgcGVybVtZKyAgcGVybVtaKzFdXV0uZG90Myh4LCAgIHksICAgei0xKTtcbiAgICB2YXIgbjAxMCA9IGdyYWRQW1grICBwZXJtW1krMStwZXJtW1ogIF1dXS5kb3QzKHgsICAgeS0xLCAgIHopO1xuICAgIHZhciBuMDExID0gZ3JhZFBbWCsgIHBlcm1bWSsxK3Blcm1bWisxXV1dLmRvdDMoeCwgICB5LTEsIHotMSk7XG4gICAgdmFyIG4xMDAgPSBncmFkUFtYKzErcGVybVtZKyAgcGVybVtaICBdXV0uZG90Myh4LTEsICAgeSwgICB6KTtcbiAgICB2YXIgbjEwMSA9IGdyYWRQW1grMStwZXJtW1krICBwZXJtW1orMV1dXS5kb3QzKHgtMSwgICB5LCB6LTEpO1xuICAgIHZhciBuMTEwID0gZ3JhZFBbWCsxK3Blcm1bWSsxK3Blcm1bWiAgXV1dLmRvdDMoeC0xLCB5LTEsICAgeik7XG4gICAgdmFyIG4xMTEgPSBncmFkUFtYKzErcGVybVtZKzErcGVybVtaKzFdXV0uZG90Myh4LTEsIHktMSwgei0xKTtcblxuICAgIC8vIENvbXB1dGUgdGhlIGZhZGUgY3VydmUgdmFsdWUgZm9yIHgsIHksIHpcbiAgICB2YXIgdSA9IGZhZGUoeCk7XG4gICAgdmFyIHYgPSBmYWRlKHkpO1xuICAgIHZhciB3ID0gZmFkZSh6KTtcblxuICAgIC8vIEludGVycG9sYXRlXG4gICAgcmV0dXJuIGxlcnAoXG4gICAgICAgIGxlcnAoXG4gICAgICAgICAgbGVycChuMDAwLCBuMTAwLCB1KSxcbiAgICAgICAgICBsZXJwKG4wMDEsIG4xMDEsIHUpLCB3KSxcbiAgICAgICAgbGVycChcbiAgICAgICAgICBsZXJwKG4wMTAsIG4xMTAsIHUpLFxuICAgICAgICAgIGxlcnAobjAxMSwgbjExMSwgdSksIHcpLFxuICAgICAgIHYpO1xuICB9O1xuXG59KSh0eXBlb2YgbW9kdWxlID09PSBcInVuZGVmaW5lZFwiID8gdGhpcyA6IG1vZHVsZS5leHBvcnRzKTsiLCJjb25zdCBjb250YWluZXIgPSByZXF1aXJlKCcuLi9jb250YWluZXInKTtcbmNvbnN0IHJhbmRvbVF1YXRlcm5pb24gPSByZXF1aXJlKCcuLi91dGlscy9tYXRoJykucmFuZG9tUXVhdGVybmlvbjtcbmNvbnN0IHJhbmRvbVVuaXRWZWN0b3IgPSByZXF1aXJlKCcuLi91dGlscy9tYXRoJykucmFuZG9tVW5pdFZlY3RvcjtcblxuY2xhc3MgQXN0ZXJvaWQge1xuXHRjb25zdHJ1Y3Rvcihwcm9wcykge1xuXHRcdHByb3BzID0gcHJvcHMgfHwge307XG5cdFx0dGhpcy5fX2lzQXN0ZXJvaWQgPSB0cnVlO1xuXHRcdHRoaXMuc2l6ZSA9IHByb3BzLnNpemUgfHwgMTtcblx0XHR0aGlzLnNjZW5lID0gY29udGFpbmVyLnNjZW5lO1xuXHRcdHRoaXMuY29sbGlzaW9ucyA9IGNvbnRhaW5lci5jb2xsaXNpb25zO1xuXG5cdFx0Ly8gY29uc3QgZ2VvbWV0cnkgPSBuZXcgVEhSRUUuSWNvc2FoZWRyb25HZW9tZXRyeSgzLjUgKiB0aGlzLnNpemUpO1xuXHRcdGNvbnN0IGdlb21ldHJ5ID0gcHJvcHMuZ2VvbWV0cnkgfHwgbmV3IFRIUkVFLkJveEdlb21ldHJ5KDMuNSwgMy41LCAzLjUpO1xuXHRcdGdlb21ldHJ5LmNvbXB1dGVGbGF0VmVydGV4Tm9ybWFscygpO1xuXHRcdGNvbnN0IG1hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hMYW1iZXJ0TWF0ZXJpYWwoe1xuXHRcdFx0Y29sb3I6IDB4OTk5OTk5XG5cdFx0fSk7XG5cdFx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuTWVzaChnZW9tZXRyeSwgbWF0ZXJpYWwpO1xuXHRcdHRoaXMub2JqZWN0LnNjYWxlLnNldCh0aGlzLnNpemUsIHRoaXMuc2l6ZSwgdGhpcy5zaXplKTtcblx0XHR0aGlzLm9iamVjdC5xdWF0ZXJuaW9uLmNvcHkocmFuZG9tUXVhdGVybmlvbigpKTtcblx0XHRpZiAocHJvcHMucG9zaXRpb24gIT0gbnVsbCkge1xuXHRcdFx0dGhpcy5vYmplY3QucG9zaXRpb24uY29weShwcm9wcy5wb3NpdGlvbik7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3BlZWQgPSBNYXRoLnJhbmRvbSgpICogMC4wMyAvIHRoaXMuc2l6ZSAvIHRoaXMuc2l6ZTtcblx0XHR0aGlzLnJvdGF0aW9uU3BlZWQgPSBcblx0XHRcdG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCkuc2V0RnJvbUF4aXNBbmdsZShyYW5kb21Vbml0VmVjdG9yKCksIHNwZWVkKTtcblxuXHRcdHRoaXMuYm9keSA9IHtcblx0XHRcdHR5cGU6ICdtZXNoJyxcblx0XHRcdG9uQ29sbGlzaW9uOiB0aGlzLm9uQ29sbGlzaW9uLFxuXHRcdFx0bWVzaDogdGhpcy5vYmplY3QsXG5cdFx0XHRlbnRpdHk6IHRoaXMsXG5cdFx0XHRtYXNrOiBbXSxcblx0XHRcdHN0YXRpYzogdHJ1ZVxuXHRcdH07XG5cdH1cblxuXHRnZXQgcG9zaXRpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMub2JqZWN0LnBvc2l0aW9uO1xuXHR9XG5cblx0c3RhcnQoKSB7XG5cdFx0dGhpcy5zY2VuZS5hZGQodGhpcy5vYmplY3QpO1xuXHRcdHRoaXMuY29sbGlzaW9ucy5hZGQodGhpcy5ib2R5KTtcblx0fVxuXG5cdHRpY2soZHQpIHtcblx0XHR0aGlzLm9iamVjdC5xdWF0ZXJuaW9uLm11bHRpcGx5KHRoaXMucm90YXRpb25TcGVlZCk7XG5cdH1cblxuXHRkZXN0cm95KCkge1xuXHRcdHRoaXMuc2NlbmUucmVtb3ZlKHRoaXMub2JqZWN0KTtcdFxuXHRcdHRoaXMuY29sbGlzaW9ucy5yZW1vdmUodGhpcy5ib2R5KTtcblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IEFzdGVyb2lkOyIsImNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uL2NvbnRhaW5lcicpO1xuY29uc3QgbGluZWFyQmlsbGJvYXJkID0gcmVxdWlyZSgnLi4vdXRpbHMvbWF0aCcpLmxpbmVhckJpbGxib2FyZDtcblxuY2xhc3MgQmVhbSB7XG5cdGNvbnN0cnVjdG9yKHByb3BzKSB7XG5cdFx0dGhpcy50YXJnZXQgPSBwcm9wcy50YXJnZXQ7XG5cdFx0dGhpcy50dXJyZW50ID0gcHJvcHMudHVycmVudDtcblxuXHRcdHRoaXMuc2NlbmUgPSBjb250YWluZXIuc2NlbmU7XHRcdFxuXHRcdHRoaXMuY2FtZXJhID0gY29udGFpbmVyLmNhbWVyYTtcblx0XHR0aGlzLmFwcCA9IGNvbnRhaW5lci5hcHA7XG5cblx0XHR0aGlzLmxlbmd0aCA9IDA7XG5cdFx0Y29uc3QgaGVpZ2h0ID0gMC41O1xuXG5cdFx0dGhpcy5kaXIgPSB0aGlzLnRhcmdldC5wb3NpdGlvbi5jbG9uZSgpLnN1Yih0aGlzLnR1cnJlbnQucG9zaXRpb24pLm5vcm1hbGl6ZSgpO1xuXHRcdHRoaXMucXVhdGVybmlvbiA9IG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCkuc2V0RnJvbVVuaXRWZWN0b3JzKG5ldyBUSFJFRS5WZWN0b3IzKDEsIDAsIDApLCB0aGlzLmRpcik7XG5cblx0XHR0aGlzLmdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCk7XG5cdFx0dGhpcy5nZW9tZXRyeS52ZXJ0aWNlcy5wdXNoKFxuXHRcdFx0bmV3IFRIUkVFLlZlY3RvcjMoMCwgLWhlaWdodCwgMCksXG5cdFx0XHRuZXcgVEhSRUUuVmVjdG9yMygwLCBoZWlnaHQsIDApLFxuXHRcdFx0bmV3IFRIUkVFLlZlY3RvcjMoMSwgaGVpZ2h0LCAwKSxcblx0XHRcdG5ldyBUSFJFRS5WZWN0b3IzKDEsIC1oZWlnaHQsIDApXG5cdFx0KTtcblxuXHRcdHRoaXMuZ2VvbWV0cnkuZmFjZXMucHVzaChcblx0XHRcdG5ldyBUSFJFRS5GYWNlMygyLCAxLCAwKSxcblx0XHRcdG5ldyBUSFJFRS5GYWNlMygyLCAwLCAzKVxuXHRcdCk7XG5cblx0XHR0aGlzLm1hdGVyaWFsID0gbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHtcblx0XHRcdGNvbG9yOiAweGZmZmZmZixcblx0XHRcdHNpZGU6IFRIUkVFLkRvdWJsZVNpZGVcblx0XHR9KTtcblxuXHRcdHRoaXMubWVzaCA9IG5ldyBUSFJFRS5NZXNoKHRoaXMuZ2VvbWV0cnksIHRoaXMubWF0ZXJpYWwpO1xuXHRcdFxuXHRcdHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLk9iamVjdDNEKCk7XG5cdFx0dGhpcy5vYmplY3QuYWRkKHRoaXMubWVzaCk7XG5cblx0XHR0aGlzLnIgPSBNYXRoLnJhbmRvbSgpICogTWF0aC5QSSAvIDI7XG5cblx0XHR0aGlzLmxpZmUgPSAxLjA7XG5cdFx0dGhpcy5jb3VudGVyID0gMDtcblxuXHRcdHRoaXMuc3BlZWQgPSA1MDtcblx0fVxuXG5cdHN0YXJ0KCkge1xuXHRcdHRoaXMuc2NlbmUuYWRkKHRoaXMub2JqZWN0KTtcblx0fVxuXG5cdHRpY2soZHQpIHtcblx0XHR0aGlzLmRpciA9IHRoaXMudGFyZ2V0LnBvc2l0aW9uLmNsb25lKCkuc3ViKHRoaXMudHVycmVudC5wb3NpdGlvbikubm9ybWFsaXplKCk7XG5cdFx0dGhpcy5xdWF0ZXJuaW9uID0gbmV3IFRIUkVFLlF1YXRlcm5pb24oKS5zZXRGcm9tVW5pdFZlY3RvcnMobmV3IFRIUkVFLlZlY3RvcjMoMSwgMCwgMCksIHRoaXMuZGlyKTtcblx0XHR0aGlzLmxlbmd0aCArPSB0aGlzLnNwZWVkO1xuXG5cdFx0bGluZWFyQmlsbGJvYXJkKHRoaXMuY2FtZXJhLCB0aGlzLm9iamVjdCwgdGhpcy5kaXIsIHRoaXMucXVhdGVybmlvbik7XG5cblx0XHRjb25zdCBkYXRlID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG5cblx0XHRjb25zdCB3aWR0aE5vaXNlID1cblx0ICAgIE1hdGguc2luKGRhdGUgLyAxNyArIHRoaXMucikgKiAwLjMgK1xuICBcdCAgTWF0aC5zaW4oKGRhdGUgKyAxMjMgKyB0aGlzLnIpIC8gMjcpICogMC40ICtcbiAgICBcdE1hdGguc2luKChkYXRlICsgMjM0ICsgdGhpcy5yKSAvIDEzKSAqIDAuNDtcblxuICAgIGNvbnN0IHQgPSB0aGlzLmNvdW50ZXIgLyB0aGlzLmxpZmU7XG4gICAgY29uc3Qgd2lkdGggPSAyO1xuXG5cdFx0dGhpcy5tZXNoLnNjYWxlLnkgPSBNYXRoLnNpbih0ICogTWF0aC5QSSkgKiB3aWR0aCArIHdpZHRoTm9pc2U7XG5cdFx0dGhpcy5tZXNoLnNjYWxlLnkgKj0gMC43O1xuXHRcdHRoaXMubWVzaC5zY2FsZS54ID0gdGhpcy5sZW5ndGg7XG5cblx0XHR0aGlzLm9iamVjdC5wb3NpdGlvbi5jb3B5KHRoaXMudHVycmVudC5wb3NpdGlvbik7XG5cblx0XHR0aGlzLmNvdW50ZXIgKz0gZHQ7XG5cdFx0aWYgKHRoaXMuY291bnRlciA+IHRoaXMubGlmZSkge1xuXHRcdFx0dGhpcy5hcHAuZGVzdHJveSh0aGlzKTtcblx0XHR9XG5cdH1cblxuXHRkZXN0cm95KCkge1xuXHRcdHRoaXMuc2NlbmUucmVtb3ZlKHRoaXMub2JqZWN0KTtcdFxuXHR9XG59XHRcblxubW9kdWxlLmV4cG9ydHMgPSBCZWFtOyIsImNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uL2NvbnRhaW5lcicpO1xuXG5jbGFzcyBEcmFnQ2FtZXJhIHtcblx0Y29uc3RydWN0b3IocHJvcHMpIHtcblx0XHR0aGlzLnJvdGF0aW9uID0gbmV3IFRIUkVFLkV1bGVyKC1NYXRoLlBJIC8gNCwgTWF0aC5QSSAvIDQsIDAsICdZWFonKTtcblx0XHR0aGlzLmRpc3RhbmNlID0gNTA7XG5cdFx0dGhpcy50YXJnZXQgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcdHRoaXMuY2FtZXJhID0gY29udGFpbmVyLmNhbWVyYTtcblx0XHR0aGlzLnVwID0gbmV3IFRIUkVFLlZlY3RvcjMoMCwgMSwgMCk7XG5cdFx0dGhpcy5pc0RyYWcgPSBmYWxzZTtcblx0XHR0aGlzLmxhc3RYID0gMDtcblx0XHR0aGlzLmxhc3RZID0gMDtcblx0XHR0aGlzLnhTcGVlZCA9IDAuMDE7XG5cdFx0dGhpcy55U3BlZWQgPSAwLjAxO1xuXG5cdFx0dGhpcy5vbk1vdXNlV2hlZWwgPSB0aGlzLm9uTW91c2VXaGVlbC5iaW5kKHRoaXMpO1xuXHRcdHRoaXMub25Nb3VzZURvd24gPSB0aGlzLm9uTW91c2VEb3duLmJpbmQodGhpcyk7XG5cdFx0dGhpcy5vbk1vdXNlVXAgPSB0aGlzLm9uTW91c2VVcC5iaW5kKHRoaXMpO1xuXHRcdHRoaXMub25Nb3VzZU1vdmUgPSB0aGlzLm9uTW91c2VNb3ZlLmJpbmQodGhpcyk7XG5cdH1cblxuXHRzdGFydCgpIHtcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V3aGVlbCcsIHRoaXMub25Nb3VzZVdoZWVsKTtcblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2Vkb3duJywgdGhpcy5vbk1vdXNlRG93bik7XG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNldXAnLCB0aGlzLm9uTW91c2VVcCk7XG5cdFx0d2luZG93LmFkZEV2ZW50TGlzdGVuZXIoJ21vdXNlbW92ZScsIHRoaXMub25Nb3VzZU1vdmUpO1xuXHR9XG5cblx0b25Nb3VzZVdoZWVsKGUpIHtcblx0XHRjb25zdCBzY2FsZSA9IDEgKyBlLmRlbHRhWSAvIDEwMDA7XG5cdFx0dGhpcy5kaXN0YW5jZSAqPSBzY2FsZTtcblx0fVxuXG5cdG9uTW91c2VEb3duKGUpIHtcblx0XHR0aGlzLmlzRHJhZyA9IHRydWU7XG5cdH1cblxuXHRvbk1vdXNlVXAoZSkge1xuXHRcdHRoaXMuaXNEcmFnID0gZmFsc2U7XG5cdH1cblxuXHRvbk1vdXNlTW92ZShlKSB7XG5cdFx0aWYgKHRoaXMuaXNEcmFnKSB7XG5cdFx0XHRjb25zdCBkaWZmWCA9IGUuY2xpZW50WCAtIHRoaXMubGFzdFg7XG5cdFx0XHRjb25zdCBkaWZmWSA9IGUuY2xpZW50WSAtIHRoaXMubGFzdFk7XG5cblx0XHRcdHRoaXMucm90YXRpb24ueCArPSBkaWZmWSAqIHRoaXMueVNwZWVkO1xuXHRcdFx0dGhpcy5yb3RhdGlvbi55ICs9IGRpZmZYICogdGhpcy54U3BlZWQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5sYXN0WCA9IGUuY2xpZW50WDtcblx0XHR0aGlzLmxhc3RZID0gZS5jbGllbnRZO1xuXHR9XG5cdFxuXHR0aWNrKCkge1xuXHRcdGNvbnN0IHBvc2l0aW9uID0gdGhpcy50YXJnZXQuY2xvbmUoKVxuXHRcdFx0LmFkZChuZXcgVEhSRUUuVmVjdG9yMygwLCAwLCAxKVxuXHRcdFx0XHQuYXBwbHlFdWxlcih0aGlzLnJvdGF0aW9uKVxuXHRcdFx0XHQubXVsdGlwbHlTY2FsYXIodGhpcy5kaXN0YW5jZSkpO1xuXHRcdHRoaXMuY2FtZXJhLnBvc2l0aW9uLmNvcHkocG9zaXRpb24pO1xuXHRcdHRoaXMuY2FtZXJhLmxvb2tBdCh0aGlzLnRhcmdldCwgdGhpcy51cCk7XG5cdH1cblxuXHRkZXN0cm95KCkge1xuXHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXdoZWVsJywgdGhpcy5vbk1vdXNlV2hlZWwpO1xuXHR9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IERyYWdDYW1lcmE7IiwiY29uc3QgY29udGFpbmVyID0gcmVxdWlyZSgnLi4vY29udGFpbmVyJyk7XG5jb25zdCBQYXJ0aWNsZVN5c3RlbSA9IHJlcXVpcmUoJy4vcGFydGljbGVzeXN0ZW0nKTtcblxuY2xhc3MgRW5naW5lIHtcbiAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICB0aGlzLnByb3BzID0gcHJvcHM7XG4gICAgdGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcbiAgICB0aGlzLnNjZW5lID0gY29udGFpbmVyLnNjZW5lO1xuICAgIHRoaXMuYXBwID0gY29udGFpbmVyLmFwcDtcbiAgICB0aGlzLnBhcnRpY2xlVmVsb2NpdHkgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuICAgIHRoaXMuYW1vdW50ID0gMDtcblxuICAgIHRoaXMucGFydGljbGVTeXN0ZW0gPSB0aGlzLmFwcC5hZGQoUGFydGljbGVTeXN0ZW0sIHtcbiAgICAgIHNjYWxlOiBbICgocCkgPT4ge1xuICAgICAgXHRyZXR1cm4gcC5fc2l6ZTtcbiAgICAgIH0pLCAwXSxcbiAgICAgIGxpZmU6ICgocCkgPT4ge1xuICAgICAgICByZXR1cm4gcC5fc2l6ZSAqIDE1MDtcbiAgICAgIH0pLFxuICAgICAgaW50ZXJ2YWw6IDMwLFxuICAgICAgdmVsb2NpdHk6IHRoaXMucGFydGljbGVWZWxvY2l0eSxcbiAgICAgIGF1dG9QbGF5OiBmYWxzZSxcbiAgICAgIG9uUGFydGljbGU6IChwKSA9PiB7XG4gICAgICAgIHAuX3NpemUgPSBNYXRoLnJhbmRvbSgpICsgMTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfVxuXG4gIHN0YXJ0KCkge1xuICAgIGNvbnN0IHNoaXAgPSB0aGlzLnByb3BzLnNoaXA7XG4gICAgY29uc3QgY29vcmQgPSB0aGlzLnByb3BzLmNvb3JkO1xuICAgIHNoaXAuaW5uZXJPYmplY3QuYWRkKHRoaXMub2JqZWN0KTtcbiAgICB0aGlzLm9iamVjdC5wb3NpdGlvblxuICAgICAgLmZyb21BcnJheShjb29yZClcbiAgICAgIC5hZGQobmV3IFRIUkVFLlZlY3RvcjMoMC41LCAwLjUsIDAuNSkpXG4gICAgICAuYWRkKG5ldyBUSFJFRS5WZWN0b3IzKDAsIDAsIDEpKTtcblxuICAgIHRoaXMudXBkYXRlUGFydGljbGVTeXN0ZW0oKTtcbiAgfVxuXG4gIHRpY2soZHQpIHtcbiAgICB0aGlzLnVwZGF0ZVBhcnRpY2xlU3lzdGVtKCk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICAgIHRoaXMuYXBwLmRlc3Ryb3kodGhpcy5wYXJ0aWNsZVN5c3RlbSk7XG4gIH1cblxuICB1cGRhdGVQYXJ0aWNsZVN5c3RlbSgpIHtcbiAgICB0aGlzLnBhcnRpY2xlU3lzdGVtLmFtb3VudCA9IE1hdGguYWJzKHRoaXMuYW1vdW50KTtcbiAgICBpZiAodGhpcy5hbW91bnQgPT09IDAgJiYgdGhpcy5wYXJ0aWNsZVN5c3RlbS5wbGF5aW5nKSB7XG4gICAgICB0aGlzLnBhcnRpY2xlU3lzdGVtLnBhdXNlKCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmFtb3VudCA+IDAgJiYgIXRoaXMucGFydGljbGVTeXN0ZW0ucGxheWluZykge1xuICAgICAgdGhpcy5wYXJ0aWNsZVN5c3RlbS5wbGF5KCk7XG4gICAgfVxuICAgIHRoaXMucGFydGljbGVTeXN0ZW0ucG9zaXRpb24uY29weSh0aGlzLm9iamVjdC5nZXRXb3JsZFBvc2l0aW9uKCkpO1xuICAgIGNvbnN0IHJvdGF0aW9uID0gdGhpcy5vYmplY3QuZ2V0V29ybGRSb3RhdGlvbigpO1xuICAgIGNvbnN0IGRpcmVjdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKDAsIDAsIDEpLmFwcGx5RXVsZXIocm90YXRpb24pO1xuICAgIHRoaXMucGFydGljbGVWZWxvY2l0eS5jb3B5KGRpcmVjdGlvbi5tdWx0aXBseVNjYWxhcigxMCkpO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVuZ2luZTtcbiIsImNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uL2NvbnRhaW5lcicpO1xuXG5jbGFzcyBHcmlkIHtcbiAgLy8gMDEgMDIgMDMgMDQgMDVcbiAgLy8gICAxMSAxMiAxMyAxNCAxNVxuICAvLyAyMSAyMiAyMyAyNCAyNVxuICAvLyAgIDMxIDMyIDMzIDM0IDM1XG4gIC8vICAgXG4gIC8vIDAwMFxuICAvLyAxMDBcbiAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICBwcm9wcyA9IHByb3BzIHx8IHt9O1xuICAgIHRoaXMuYXhpcyA9IFsxLCBNYXRoLnNxcnQoMykgLyAyXTtcbiAgICB0aGlzLnNjZW5lID0gY29udGFpbmVyLnNjZW5lO1xuICAgIHRoaXMud2lkdGggPSBwcm9wcy53aWR0aCB8fCAxMDA7XG4gICAgdGhpcy5oZWlnaHQgPSBwcm9wcy5oZWlnaHQgfHwgMTAwO1xuICAgIHRoaXMuc2l6ZSA9IHByb3BzLnNpemUgfHwgMTI7XG4gIH1cblxuICBoZXhUb0Nvb3JkKGksIGopIHtcbiAgICBpIC09IHRoaXMud2lkdGggLyAyO1xuICAgIGogLT0gdGhpcy5oZWlnaHQgLyAyO1xuICAgIHJldHVybiBbXG4gICAgICAodGhpcy5heGlzWzBdICogaSArICgoaiAlIDIgPT09IDApID8gdGhpcy5heGlzWzFdIC8gMiA6IDApKSAqIHRoaXMuc2l6ZSxcbiAgICAgIHRoaXMuYXhpc1sxXSAqIGogKiB0aGlzLnNpemVcbiAgICBdO1xuICB9XG5cbiAgZ2V0U3Vycm91bmRpbmdDb29yZHMoY29vcmQpIHtcbiAgICBjb25zdCBpID0gY29vcmRbMF07XG4gICAgY29uc3QgaiA9IGNvb3JkWzFdO1xuXG4gICAgaWYgKGogJSAyID09PSAwKSB7XG4gICAgICByZXR1cm4gW1xuICAgICAgICBbaSAtIDEsIGogLSAxXSxcbiAgICAgICAgW2ksIGogLSAxXSxcbiAgICAgICAgW2kgLSAxLCBqXSxcbiAgICAgICAgW2kgKyAxLCBqXSxcbiAgICAgICAgW2ksIGogKyAxXSxcbiAgICAgICAgW2kgLSAxLCBqICsgMV0sXG4gICAgICBdO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gW1xuICAgICAgICBbaSArIDEsIGogLSAxXSxcbiAgICAgICAgW2ksIGogLSAxXSxcbiAgICAgICAgW2kgLSAxLCBqXSxcbiAgICAgICAgW2kgKyAxLCBqXSxcbiAgICAgICAgW2ksIGogKyAxXSxcbiAgICAgICAgW2kgKyAxLCBqICsgMV0sXG4gICAgICBdO1xuICAgIH1cbiAgfVxuXG4gIHN0YXJ0KCkge1xuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy53aWR0aDsgaSsrKSB7XG4gICAgICBmb3IgKGxldCBqID0gMDsgaiA8IHRoaXMuaGVpZ2h0OyBqKyspIHtcblxuICAgICAgICBjb25zdCBzcHJpdGUgPSBuZXcgVEhSRUUuU3ByaXRlKCk7XG4gICAgICAgIGNvbnN0IHNjcmVlbiA9IHRoaXMuaGV4VG9Db29yZChpLCBqKTtcbiAgICAgICAgc3ByaXRlLnBvc2l0aW9uLnggPSBzY3JlZW5bMF07XG4gICAgICAgIHNwcml0ZS5wb3NpdGlvbi56ID0gc2NyZWVuWzFdO1xuXG4gICAgICAgIC8vIHRoaXMuc2NlbmUuYWRkKHNwcml0ZSk7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgcGxhY2Uoc2hpcHMsIHNpZGUpIHtcblxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gR3JpZDtcbiIsImNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uL2NvbnRhaW5lcicpO1xuXG5jbGFzcyBMYXNlciB7XG4gIGNvbnN0cnVjdG9yKHByb3BzKSB7XG4gICAgdGhpcy50YXJnZXQgPSBwcm9wcy50YXJnZXQ7XG4gICAgdGhpcy50dXJyZW50ID0gcHJvcHMudHVycmVudDtcblxuICAgIHRoaXMuc2NlbmUgPSBjb250YWluZXIuc2NlbmU7XG4gICAgdGhpcy5hcHAgPSBjb250YWluZXIuYXBwO1xuICAgIHRoaXMuY29sbGlzaW9ucyA9IGNvbnRhaW5lci5jb2xsaXNpb25zO1xuXG4gICAgdGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuU3ByaXRlKCk7XG4gICAgdGhpcy5vYmplY3Quc2NhbGUuc2V0KDIsIDIsIDIpO1xuXG4gICAgdGhpcy5zcGVlZCA9IDIwMDtcblxuICAgIHRoaXMubGlmZSA9IDEwMDA7XG5cbiAgICB0aGlzLm9uQ29sbGlzaW9uID0gdGhpcy5vbkNvbGxpc2lvbi5iaW5kKHRoaXMpO1xuXG4gICAgdGhpcy5ib2R5ID0ge1xuICAgICAgdHlwZTogJ3JheScsXG4gICAgICByYXljYXN0ZXI6IG5ldyBUSFJFRS5SYXljYXN0ZXIoKSxcbiAgICAgIG9uQ29sbGlzaW9uOiB0aGlzLm9uQ29sbGlzaW9uLFxuICAgICAgZW50aXR5OiB0aGlzXG4gICAgfTtcbiAgfVxuXG4gIG9uQ29sbGlzaW9uKGNvbGxpc2lvbikge1xuICAgIGNvbnN0IGVudGl0eSA9IGNvbGxpc2lvbi5ib2R5LmVudGl0eTtcbiAgICBpZiAoZW50aXR5ID09PSB0aGlzLnR1cnJlbnQuc2hpcCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEV4cGxvc2lvblxuICAgIHRoaXMuYXBwLmRlc3Ryb3kodGhpcyk7XG4gIH1cblxuICBzdGFydCgpIHtcbiAgXHR0aGlzLm9iamVjdC5wb3NpdGlvbi5jb3B5KHRoaXMudHVycmVudC5wb3NpdGlvbik7XG4gIFx0dGhpcy5zY2VuZS5hZGQodGhpcy5vYmplY3QpO1xuXG4gICAgY29uc3QgZGlzID0gdGhpcy50dXJyZW50LnBvc2l0aW9uLmRpc3RhbmNlVG8odGhpcy50YXJnZXQucG9zaXRpb24pO1xuICAgIGNvbnN0IHRpbWUgPSBkaXMgLyB0aGlzLnNwZWVkO1xuICAgIGNvbnN0IGxlYWRpbmcgPSB0aGlzLnRhcmdldC52ZWxvY2l0eS5jbG9uZSgpLm11bHRpcGx5U2NhbGFyKHRpbWUpO1xuICBcdHRoaXMudmVsb2NpdHkgPSB0aGlzLnRhcmdldC5wb3NpdGlvbi5jbG9uZSgpXG4gICAgICAuYWRkKGxlYWRpbmcpXG4gICAgICAuc3ViKHRoaXMudHVycmVudC5wb3NpdGlvbilcbiAgICAgIC5ub3JtYWxpemUoKVxuICAgICAgLm11bHRpcGx5U2NhbGFyKHRoaXMuc3BlZWQpO1xuXG4gIFx0dGhpcy5kaWVUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgKyB0aGlzLmxpZmU7XG5cbiAgICB0aGlzLmNvbGxpc2lvbnMuYWRkKHRoaXMuYm9keSk7XG4gIH1cblxuICBkZXN0cm95KCkge1xuICBcdHRoaXMuc2NlbmUucmVtb3ZlKHRoaXMub2JqZWN0KTtcbiAgICB0aGlzLmNvbGxpc2lvbnMucmVtb3ZlKHRoaXMuYm9keSk7XG4gIH1cblxuICB0aWNrKGR0KSB7XG4gICAgY29uc3QgdmVsb2NpdHkgPSB0aGlzLnZlbG9jaXR5LmNsb25lKCkubXVsdGlwbHlTY2FsYXIoZHQpO1xuICBcdHRoaXMub2JqZWN0LnBvc2l0aW9uLmFkZCh2ZWxvY2l0eSk7XG5cbiAgXHRpZiAobmV3IERhdGUoKS5nZXRUaW1lKCkgPiB0aGlzLmRpZVRpbWUpIHtcbiAgXHRcdHRoaXMuYXBwLmRlc3Ryb3kodGhpcyk7XG4gIFx0fVxuXG4gICAgdGhpcy5ib2R5LnJheWNhc3RlciA9IG5ldyBUSFJFRS5SYXljYXN0ZXIoXG4gICAgICB0aGlzLm9iamVjdC5wb3NpdGlvbiwgXG4gICAgICB2ZWxvY2l0eS5jbG9uZSgpLm5vcm1hbGl6ZSgpLFxuICAgICAgMCxcbiAgICAgIHZlbG9jaXR5Lmxlbmd0aCgpKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IExhc2VyO1xuIiwiY29uc3QgY29udGFpbmVyID0gcmVxdWlyZSgnLi4vY29udGFpbmVyJyk7XG5cbmNsYXNzIFZhbHVlIHtcblx0Y29uc3RydWN0b3IodmFsdWUsIG9iamVjdCkge1xuXHRcdHRoaXMudmFsdWUgPSB2YWx1ZTtcblx0XHR0aGlzLm9iamVjdCA9IG9iamVjdDtcblxuXHRcdHRoaXMuaXNOdW1iZXIgPSB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInO1xuXHRcdHRoaXMuaXNGdW5jID0gdHlwZW9mIHZhbHVlID09PSAnZnVuY3Rpb24nO1xuXHRcdC8vIExpbmVhciBpbnRlcnZhbHNcblx0XHR0aGlzLmludGVydmFscyA9IFtdO1xuXG5cdFx0aWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG5cdFx0XHRjb25zdCB2YWx1ZXMgPSB2YWx1ZS5tYXAoKHYpID0+IHtcblx0XHRcdFx0aWYgKHR5cGVvZiB2ID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHYodGhpcy5vYmplY3QpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB2O1xuXHRcdFx0fSk7XG5cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGludGVydmFsID0ge1xuXHRcdFx0XHRcdHQ6IGkgLyB2YWx1ZXMubGVuZ3RoLFxuXHRcdFx0XHRcdHY6IHZhbHVlc1tpXVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRpZiAoaSA8IHZhbHVlcy5sZW5ndGggLSAxKSB7XG5cdFx0XHRcdFx0aW50ZXJ2YWwudmQgPSB2YWx1ZXNbaSArIDFdIC0gdmFsdWVzW2ldO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuaW50ZXJ2YWxzLnB1c2goaW50ZXJ2YWwpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGdldCh0KSB7XG5cdFx0dCA9IHQgfHwgMDtcblx0XHRpZiAodGhpcy5pc051bWJlcikge1xuXHRcdFx0cmV0dXJuIHRoaXMudmFsdWU7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmlzRnVuYykge1xuXHRcdFx0cmV0dXJuIHRoaXMudmFsdWUodGhpcy5vYmplY3QpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5pbnRlcnZhbHMubGVuZ3RoID4gMCkge1xuXHRcdFx0bGV0IGludGVydmFsO1xuXHRcdFx0aWYgKHQgPiAxKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmludGVydmFsc1t0aGlzLmludGVydmFscy5sZW5ndGggLSAxXS52O1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuaW50ZXJ2YWxzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGludGVydmFsID0gdGhpcy5pbnRlcnZhbHNbaV07XG5cdFx0XHRcdGlmICh0IDwgaW50ZXJ2YWwudCkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgdGQgPSB0IC0gaW50ZXJ2YWwudDtcblx0XHRcdFx0Y29uc3QgdmQgPSBpbnRlcnZhbC52ZDtcblx0XHRcdFx0cmV0dXJuIGludGVydmFsLnYgKyB0ZCAqIHZkO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBQYXJ0aWNsZSB7XG5cdGNvbnN0cnVjdG9yKHByb3BzKSB7XG5cdFx0dGhpcy5wcm9wcyA9IHByb3BzO1xuXG5cdFx0dGhpcy5wYXJlbnQgPSBwcm9wcy5wYXJlbnQ7XG5cdFx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuU3ByaXRlKHByb3BzLm1hdGVyaWFsKTtcblx0XHR0aGlzLmFwcCA9IGNvbnRhaW5lci5hcHA7XG5cdH1cblxuXHRpbml0UHJvcHMoKSB7XG5cdFx0dGhpcy5saWZlID0gbmV3IFZhbHVlKHRoaXMucHJvcHMubGlmZSwgdGhpcyk7XG5cdFx0dGhpcy52ZWxvY2l0eSA9IHRoaXMucHJvcHMudmVsb2NpdHk7XG5cdFx0dGhpcy5zY2FsZSA9IG5ldyBWYWx1ZSh0aGlzLnByb3BzLnNjYWxlLCB0aGlzKTtcblx0fVxuXG5cdHN0YXJ0KCkge1xuXHRcdHRoaXMucGFyZW50LmFkZCh0aGlzLm9iamVjdCk7XG5cdFx0dGhpcy5zdGFydFRpbWVyID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG5cdFx0dGhpcy50aW1lciA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpICsgdGhpcy5saWZlLmdldCgpO1xuXHR9XG5cblx0dGljayhkdCkge1xuXHRcdHRoaXMub2JqZWN0LnBvc2l0aW9uLmFkZCh0aGlzLnZlbG9jaXR5LmNsb25lKCkubXVsdGlwbHlTY2FsYXIoZHQpKTtcblx0XHRjb25zdCB0ID0gKG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gdGhpcy5zdGFydFRpbWVyKSAvIHRoaXMubGlmZS5nZXQoKTtcblx0XHRjb25zdCBzY2FsZSA9IHRoaXMuc2NhbGUuZ2V0KHQpO1xuXHRcdHRoaXMub2JqZWN0LnNjYWxlLnNldChzY2FsZSwgc2NhbGUsIHNjYWxlKTtcblxuXHRcdGlmIChuZXcgRGF0ZSgpLmdldFRpbWUoKSA+IHRoaXMudGltZXIpIHtcblx0XHRcdHRoaXMuYXBwLmRlc3Ryb3kodGhpcyk7XG5cdFx0fVxuXHR9XG5cblx0ZGVzdHJveSgpIHtcblx0XHR0aGlzLm9iamVjdC5wYXJlbnQucmVtb3ZlKHRoaXMub2JqZWN0KTtcblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBhcnRpY2xlOyIsImNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uL2NvbnRhaW5lcicpO1xuY29uc3QgUGFydGljbGUgPSByZXF1aXJlKCcuL3BhcnRpY2xlJyk7XG5cbmNvbnN0IGRlZmF1bHRNYXRlcmlhbCA9IG5ldyBUSFJFRS5TcHJpdGVNYXRlcmlhbCgpO1xuXG5jbGFzcyBQYXJ0aWNsZVN5c3RlbSB7XG5cdGNvbnN0cnVjdG9yKHByb3BzKSB7XG5cdFx0cHJvcHMgPSBwcm9wcyB8fCB7fTtcblxuXHRcdHRoaXMubWF0ZXJpYWwgPSBwcm9wcy5tYXRlcmlhbCB8fCBkZWZhdWx0TWF0ZXJpYWw7XG5cdFx0dGhpcy5tYXRlcmlhbHMgPSB0aGlzLm1hdGVyaWFsLmxlbmd0aCA+IDAgPyB0aGlzLm1hdGVyaWFsIDogW107XG5cdFx0dGhpcy5wYXJlbnQgPSBwcm9wcy5wYXJlbnQgfHwgY29udGFpbmVyLnNjZW5lO1xuXHRcdHRoaXMuYXV0b1BsYXkgPSBwcm9wcy5hdXRvUGxheSA9PT0gdW5kZWZpbmVkID8gdHJ1ZSA6IHByb3BzLmF1dG9QbGF5O1xuXHRcdHRoaXMub25QYXJ0aWNsZSA9IHByb3BzLm9uUGFydGljbGU7XG5cblx0XHR0aGlzLnBhcnRpY2xlUHJvcHMgPSBwcm9wcy5wYXJ0aWNsZVByb3BzO1xuXG5cdFx0aWYgKHRoaXMucGFydGljbGVQcm9wcyA9PSBudWxsKSB7XG5cdFx0XHR0aGlzLmxpZmUgPSBwcm9wcy5saWZlO1xuXHRcdFx0dGhpcy5pbnRlcnZhbCA9IHByb3BzLmludGVydmFsO1xuXHRcdFx0dGhpcy52ZWxvY2l0eSA9IHByb3BzLnZlbG9jaXR5O1xuXHRcdFx0dGhpcy5zY2FsZSA9IHByb3BzLnNjYWxlO1xuXHRcdFx0dGhpcy5kZWZhdWx0UGFydGljbGVQcm9wcyh0aGlzKTtcblx0XHR9XG5cblx0XHR0aGlzLl90aW1lb3V0ID0gbnVsbDtcblx0XHR0aGlzLmVtaXQgPSB0aGlzLmVtaXQuYmluZCh0aGlzKTtcblx0XHR0aGlzLmFwcCA9IGNvbnRhaW5lci5hcHA7XG5cdFx0dGhpcy5wb3NpdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cblx0XHR0aGlzLnBsYXlpbmcgPSBmYWxzZTtcblxuXHRcdHRoaXMuYW1vdW50ID0gMTtcblx0fVxuXG5cdGRlZmF1bHRQYXJ0aWNsZVByb3BzKG9iaikge1xuXHRcdG9iai5saWZlID0gb2JqLmxpZmUgfHwgNTAwMDtcblx0XHRvYmouaW50ZXJ2YWwgPSBvYmouaW50ZXJ2YWwgfHwgMTAwMDtcblx0XHRvYmoudmVsb2NpdHkgPSBvYmoudmVsb2NpdHkgfHwgbmV3IFRIUkVFLlZlY3RvcjMoMCwgMiwgMCk7XG5cdFx0b2JqLnNjYWxlID0gb2JqLnNjYWxlIHx8IDE7XHRcblx0XHRvYmoucGFyZW50ID0gb2JqLnBhcmVudCB8fCBjb250YWluZXIuc2NlbmU7XG5cdFx0cmV0dXJuIG9iajtcblx0fVxuXG5cdHN0YXJ0KCkge1xuXHRcdGlmICh0aGlzLmF1dG9QbGF5KSB7XG5cdFx0XHR0aGlzLnBsYXkoKTtcdFxuXHRcdH1cblx0fVxuXG5cdHBsYXkoKSB7XG5cdFx0dGhpcy5lbWl0KCk7XG5cdFx0dGhpcy5wbGF5aW5nID0gdHJ1ZTtcblx0fVxuXG5cdHBhdXNlKCkge1xuXHRcdGlmICh0aGlzLl90aW1lb3V0ICE9IG51bGwpIHtcblx0XHRcdGNsZWFyVGltZW91dCh0aGlzLl90aW1lb3V0KTtcblx0XHR9XG5cdFx0dGhpcy5wbGF5aW5nID0gZmFsc2U7XG5cdH1cblxuXHRlbWl0KCkge1xuXHRcdGxldCBwcm9wcztcblx0XHRjb25zdCBtYXRlcmlhbCA9IHRoaXMubWF0ZXJpYWxzLmxlbmd0aCA+IDAgPyB0aGlzLm1hdGVyaWFsc1tNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiB0aGlzLm1hdGVyaWFscy5sZW5ndGgpXSA6IHRoaXMubWF0ZXJpYWw7XG5cdFx0aWYgKHRoaXMucGFydGljbGVQcm9wcyA9PSBudWxsKSB7XG5cdFx0XHRwcm9wcyA9IHtcblx0XHRcdFx0bGlmZTogdGhpcy5saWZlLFxuXHRcdFx0XHR2ZWxvY2l0eTogdGhpcy52ZWxvY2l0eSxcblx0XHRcdFx0bWF0ZXJpYWw6IG1hdGVyaWFsLFxuXHRcdFx0XHRwYXJlbnQ6IHRoaXMucGFyZW50LFxuXHRcdFx0XHRzY2FsZTogdGhpcy5zY2FsZVxuXHRcdFx0fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cHJvcHMgPSB0aGlzLmRlZmF1bHRQYXJ0aWNsZVByb3BzKHRoaXMucGFydGljbGVQcm9wcygpKTtcblx0XHR9XG5cdFx0Y29uc3QgcGFydGljbGUgPSB0aGlzLmFwcC5hZGQoUGFydGljbGUsIHByb3BzKTtcblx0XHRpZiAodGhpcy5vblBhcnRpY2xlICE9IG51bGwpIHtcblx0XHRcdHRoaXMub25QYXJ0aWNsZShwYXJ0aWNsZSk7XG5cdFx0fVxuXHRcdHBhcnRpY2xlLmluaXRQcm9wcygpO1xuXHRcdHBhcnRpY2xlLm9iamVjdC5wb3NpdGlvbi5jb3B5KHRoaXMucG9zaXRpb24pO1xuXHRcdHRoaXMuX3RpbWVvdXQgPSBzZXRUaW1lb3V0KHRoaXMuZW1pdCwgdGhpcy5pbnRlcnZhbCAvIHRoaXMuYW1vdW50KTtcblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBhcnRpY2xlU3lzdGVtOyIsImNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uLy4uL2NvbnRhaW5lcicpO1xuXG5jbGFzcyBBSSB7XG5cdGNvbnN0cnVjdG9yKHByb3BzKSB7XG5cdFx0dGhpcy5zaGlwcyA9IGNvbnRhaW5lci5zaGlwcztcblxuXHRcdHRoaXMuc2hpcCA9IHByb3BzLnNoaXA7XG5cdFx0dGhpcy50aGlua0Nvb2xkb3duID0gMC4xO1xuXHRcdHRoaXMubmV4dFRoaW5rID0gMDtcblx0XHR0aGlzLnRhcmdldCA9IG51bGw7XG5cdH1cblxuXHR0aGluaygpIHtcblx0XHR0aGlzLnNoaXAub3JiaXQobmV3IFRIUkVFLlZlY3RvcjMoMCwgMCwgMCksIDEwMCk7XG5cblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuc2hpcC50dXJyZW50cy5sZW5ndGg7IGkgKyspIHtcblx0XHRcdGNvbnN0IHR1cnJlbnQgPSB0aGlzLnNoaXAudHVycmVudHNbaV07XG5cdFx0XHR0dXJyZW50LmZpcmUoe1xuXHRcdFx0XHRwb3NpdGlvbjogbmV3IFRIUkVFLlZlY3RvcjMoKSxcblx0XHRcdFx0dmVsb2NpdHk6IG5ldyBUSFJFRS5WZWN0b3IzKClcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnRhcmdldCA9PSBudWxsKSB7XG5cdFx0XHRjb25zdCBzaGlwcyA9IHRoaXMuc2hpcHMuZ2V0VGFyZ2V0cyh0aGlzLnNoaXApO1xuXG5cdFx0XHRpZiAoc2hpcHMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRzaGlwcy5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIGEucG9zaXRpb24uZGlzdGFuY2VUbyh0aGlzLnNoaXAucG9zaXRpb24pIC0gXG5cdFx0XHRcdFx0XHRiLnBvc2l0aW9uLmRpc3RhbmNlVG8odGhpcy5zaGlwLnBvc2l0aW9uKTtcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHRoaXMudGFyZ2V0ID0gc2hpcHNbMF07XG5cdFx0XHR9IFxuXHRcdH1cblxuXHRcdGlmICh0aGlzLnRhcmdldCA9PSBudWxsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5zaGlwLm9yYml0KHRoaXMudGFyZ2V0LnBvc2l0aW9uLCAxMDApO1xuXG5cdFx0Ly8gZGVtb1xuXHRcdC8vIHRoaXMuYXNjZW5kKDEwKTtcblx0XHRcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMuc2hpcC50dXJyZW50cy5sZW5ndGg7IGkgKyspIHtcblx0XHRcdGNvbnN0IHR1cnJlbnQgPSB0aGlzLnNoaXAudHVycmVudHNbaV07XG5cdFx0XHR0dXJyZW50LmZpcmUoe1xuXHRcdFx0XHRwb3NpdGlvbjogdGhpcy50YXJnZXQucG9zaXRpb24sXG5cdFx0XHRcdHZlbG9jaXR5OiB0aGlzLnRhcmdldC52ZWxvY2l0eVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0c3RhcnQoKSB7XG5cdFx0dGhpcy5uZXh0VGhpbmsgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSArIHRoaXMudGhpbmtDb29sZG93bjtcblx0fVxuXG5cdHRpY2soZHQpIHtcblx0XHRpZiAobmV3IERhdGUoKS5nZXRUaW1lKCkgPiB0aGlzLm5leHRUaGluaykge1xuXHRcdFx0dGhpcy50aGluaygpO1xuXHRcdFx0dGhpcy5uZXh0VGhpbmsgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSArIHRoaXMudGhpbmtDb29sZG93bjtcblx0XHR9XG5cdH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQUk7IiwiY29uc3QgY29udGFpbmVyID0gcmVxdWlyZSgnLi4vLi4vY29udGFpbmVyJyk7XG5jb25zdCBUSFJFRSA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydUSFJFRSddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnVEhSRUUnXSA6IG51bGwpO1xuY29uc3QgQ2h1bmtzID0gcmVxdWlyZSgnLi4vLi4vdm94ZWwvY2h1bmtzJyk7XG5jb25zdCBtZXNoZXIgPSByZXF1aXJlKCcuLi8uLi92b3hlbC9tZXNoZXInKTtcbmNvbnN0IHJlYWRlciA9IHJlcXVpcmUoJy4vcmVhZGVyJyk7XG5jb25zdCBub3JtYWxpemVBbmdsZSA9IHJlcXVpcmUoJy4uLy4uL3V0aWxzL21hdGgnKS5ub3JtYWxpemVBbmdsZTtcbmNvbnN0IGNsYW1wID0gcmVxdWlyZSgnLi4vLi4vdXRpbHMvbWF0aCcpLmNsYW1wO1xuY29uc3QgQUkgPSByZXF1aXJlKCcuL2FpJyk7XG5cbmNsYXNzIFNoaXAge1xuXHRjb25zdHJ1Y3Rvcihwcm9wcykge1xuXHRcdHRoaXMuX19pc1NoaXAgPSB0cnVlO1xuXG5cdFx0dGhpcy5wcm9wcyA9IHByb3BzO1xuXHRcdHRoaXMuc2NlbmUgPSBjb250YWluZXIuc2NlbmU7XG5cdFx0dGhpcy5hcHAgPSBjb250YWluZXIuYXBwO1xuXHRcdHRoaXMuY29sbGlzaW9ucyA9IGNvbnRhaW5lci5jb2xsaXNpb25zO1xuXG5cdFx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcblx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi5vcmRlciA9ICdZWFonO1xuXG5cdFx0aWYgKHByb3BzLnJvdGF0aW9uICE9IG51bGwpIHtcblx0XHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLmNvcHkocHJvcHMucm90YXRpb24pO1xuXHRcdH1cblxuXHRcdHRoaXMuaW5uZXJPYmplY3QgPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcblx0XHR0aGlzLmlubmVyT2JqZWN0LnJvdGF0aW9uLm9yZGVyID0gJ1lYWic7XG5cdFx0dGhpcy5vYmplY3QuYWRkKHRoaXMuaW5uZXJPYmplY3QpO1xuXHRcdHRoaXMuY2h1bmtzID0gbmV3IENodW5rcygpO1xuXG5cdFx0dGhpcy5lbmdpbmVzID0gW107XG5cdFx0dGhpcy50dXJyZW50cyA9IFtdO1xuXG5cdFx0dGhpcy50dXJuU3BlZWQgPSAwO1xuXG5cdFx0dGhpcy50dXJuQW1vdW50ID0gMDtcblx0XHR0aGlzLmZvcndhcmRBbW91bnQgPSAwO1xuXHRcdHRoaXMubWF4VHVyblNwZWVkID0gMC4wMztcblx0XHR0aGlzLnBvd2VyID0gMTA7XG5cblx0XHR0aGlzLnZlbG9jaXR5ID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblxuXHRcdHRoaXMuZnJpY3Rpb24gPSAwLjU7XG5cblx0XHR0aGlzLmh1bGwgPSBbXTtcblxuXHRcdHRoaXMuYWkgPSBuZXcgQUkoe1xuXHRcdFx0c2hpcDogdGhpc1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5zaWRlID0gcHJvcHMuc2lkZSB8fCAwO1xuXG5cdFx0dGhpcy5odWxsID0gW107XG5cdFx0dGhpcy5jZW50ZXIgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXG5cdFx0dGhpcy5vbkNvbGxpc2lvbiA9IHRoaXMub25Db2xsaXNpb24uYmluZCh0aGlzKTtcblx0XHR0aGlzLmJvZHkgPSB7XG5cdFx0XHR0eXBlOiAnbWVzaCcsXG5cdFx0XHRvbkNvbGxpc2lvbjogdGhpcy5vbkNvbGxpc2lvbixcblx0XHRcdGVudGl0eTogdGhpc1xuXHRcdH1cblx0fVxuXG5cdG9uQ29sbGlzaW9uKGNvbGxpc2lvbikge1xuXHRcdGNvbnN0IGR0ID0gdGhpcy5hcHAuZGVsdGE7XG5cdFx0Y29uc3QgZW50aXR5ID0gY29sbGlzaW9uLmJvZHkuZW50aXR5O1xuXHRcdGlmIChlbnRpdHkuX19pc0FzdGVyb2lkIHx8IGVudGl0eS5fX2lzU2hpcCkge1xuXHRcdFx0dGhpcy52ZWxvY2l0eS5hZGQoXG5cdFx0XHRcdHRoaXMucG9zaXRpb24uY2xvbmUoKS5zdWIoZW50aXR5LnBvc2l0aW9uKS5ub3JtYWxpemUoKVxuXHRcdFx0XHQubXVsdGlwbHlTY2FsYXIoKGNvbGxpc2lvbi5taW5EaXMgLSBjb2xsaXNpb24uZGlzKSAqIGR0ICogMTApXG5cdFx0XHQpO1xuXHRcdH1cblx0fVxuXG5cdGdldCBwb3NpdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5vYmplY3QucG9zaXRpb247XG5cdH1cblxuXHRnZXQgcm90YXRpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMub2JqZWN0LnJvdGF0aW9uO1xuXHR9XG5cblx0c3RhcnQoKSB7XG5cdFx0dGhpcy5tYXRlcmlhbCA9IFsgbnVsbCwgbmV3IFRIUkVFLk1lc2hCYXNpY01hdGVyaWFsKHtcblx0XHRcdGNvbG9yOiAweGZmZmZmZlxuXHRcdH0pIF07XG5cblx0XHR0aGlzLnNjZW5lLmFkZCh0aGlzLm9iamVjdCk7XG5cdFxuXHRcdGNvbnN0IHJlc3VsdCA9IHJlYWRlcih0aGlzLnByb3BzLmRhdGEsIHRoaXMpO1xuXG5cdFx0dGhpcy5haS5zdGFydCgpO1xuXG5cdFx0dGhpcy5jb2xsaXNpb25zLmFkZCh0aGlzLmJvZHkpO1xuXG5cdFx0bWVzaGVyKHRoaXMuY2h1bmtzLCB0aGlzLmlubmVyT2JqZWN0LCB0aGlzLm1hdGVyaWFsKTtcblxuXHRcdGNvbnN0IGNvbGxpc2lvbkdlb21ldHJ5ID0gbmV3IFRIUkVFLkdlb21ldHJ5KCk7XG5cblx0XHR0aGlzLmlubmVyT2JqZWN0LmNoaWxkcmVuLmZvckVhY2goKG1lc2gpID0+IHtcblx0XHRcdGNvbGxpc2lvbkdlb21ldHJ5Lm1lcmdlTWVzaChtZXNoKTtcblx0XHR9KTtcblxuXHRcdHRoaXMuYm9keS5tZXNoID0gbmV3IFRIUkVFLk1lc2goY29sbGlzaW9uR2VvbWV0cnkpO1xuXHR9XG5cblx0ZGVzdHJveSgpIHtcblx0XHR0aGlzLnNjZW5lLnJlbW92ZSh0aGlzLm9iamVjdCk7XG5cdFx0dGhpcy5jb2xsaXNpb25zLnJlbW92ZSh0aGlzLmJvZHkpO1xuXHR9XG5cblx0dGljaygpIHtcblx0XHRjb25zdCBkdCA9IHRoaXMuYXBwLmRlbHRhO1xuXHRcdHRoaXMuYWkudGljayhkdCk7XG5cdFx0bWVzaGVyKHRoaXMuY2h1bmtzLCB0aGlzLmlubmVyT2JqZWN0LCB0aGlzLm1hdGVyaWFsKTtcblxuXHRcdC8vIFN0ZXAgdHVycmVudHNcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMudHVycmVudHMubGVuZ3RoOyBpICsrKSB7XG5cdFx0XHRjb25zdCB0dXJyZW50ID0gdGhpcy50dXJyZW50c1tpXTtcblx0XHRcdHR1cnJlbnQudGljayhkdCk7XG5cdFx0fVxuXG5cdFx0Ly8gU3RlcCB5YXdcblx0XHRjb25zdCB0dXJuQWNjZWxlcmF0aW9uID0gMC4xO1xuXHRcdGNvbnN0IGRlc2lyZWRUdXJuU3BlZWQgPSB0aGlzLnR1cm5BbW91bnQgKiB0aGlzLm1heFR1cm5TcGVlZDtcblxuXHRcdGlmICh0aGlzLnR1cm5TcGVlZCA8IGRlc2lyZWRUdXJuU3BlZWQpIHtcblx0XHRcdHRoaXMudHVyblNwZWVkICs9IHR1cm5BY2NlbGVyYXRpb24gKiBkdDtcblx0XHR9IGVsc2UgaWYgKHRoaXMudHVyblNwZWVkID4gZGVzaXJlZFR1cm5TcGVlZCkge1xuXHRcdFx0dGhpcy50dXJuU3BlZWQgLT0gdHVybkFjY2VsZXJhdGlvbiAqIGR0O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnR1cm5TcGVlZCA8IC10aGlzLm1heFR1cm5TcGVlZCkge1xuXHRcdFx0dGhpcy50dXJuU3BlZWQgPSAtdGhpcy5tYXhUdXJuU3BlZWQ7XG5cdFx0fSBlbHNlIGlmICh0aGlzLnR1cm5TcGVlZCA+IHRoaXMubWF4VHVyblNwZWVkKSB7XG5cdFx0XHR0aGlzLnR1cm5TcGVlZCA9IHRoaXMubWF4VHVyblNwZWVkO1xuXHRcdH1cblxuXHRcdC8vIFN0ZXAgcm9sbFxuXHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnkgKz0gdGhpcy50dXJuU3BlZWQ7XG5cblx0XHRjb25zdCByYXRpbyA9IHRoaXMudHVyblNwZWVkIC8gdGhpcy5tYXhUdXJuU3BlZWQ7XG5cblx0XHRjb25zdCBtYXhSb2xsQW1vdW50ID0gTWF0aC5QSSAvIDQ7XG5cdFx0Y29uc3QgYW5nbGUgPSByYXRpbyAqIG1heFJvbGxBbW91bnQ7XG5cblx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi56ICs9IChhbmdsZSAtIHRoaXMub2JqZWN0LnJvdGF0aW9uLnopICogMC4wMTtcblxuXHRcdC8vIHRoaXMudHVybkFtb3VudCA9IDA7XG5cblx0XHQvLyBTdGVwIGZvcndhcmRcblx0XHRjb25zdCBhY2MgPSBuZXcgVEhSRUUuVmVjdG9yMygwLCAwLCAtMSlcblx0XHRcdC5hcHBseUV1bGVyKHRoaXMub2JqZWN0LnJvdGF0aW9uKVxuXHRcdFx0Lm11bHRpcGx5U2NhbGFyKHRoaXMuZm9yd2FyZEFtb3VudCAqIHRoaXMucG93ZXIgKiBkdCk7XG5cblx0XHR0aGlzLnZlbG9jaXR5LmFkZChhY2MpO1xuXHRcdHRoaXMub2JqZWN0LnBvc2l0aW9uLmFkZCh0aGlzLnZlbG9jaXR5LmNsb25lKCkubXVsdGlwbHlTY2FsYXIoZHQpKTtcblxuXHRcdHRoaXMudmVsb2NpdHkubXVsdGlwbHlTY2FsYXIoTWF0aC5wb3codGhpcy5mcmljdGlvbiwgZHQpKTtcblxuXHRcdHRoaXMuZW5naW5lcy5mb3JFYWNoKChlbmdpbmUpID0+IHtcblx0XHRcdGVuZ2luZS5hbW91bnQgPSB0aGlzLmZvcndhcmRBbW91bnQ7XG5cdFx0fSk7XG5cblx0XHR0aGlzLmJvZHkubWVzaC5wb3NpdGlvbi5jb3B5KHRoaXMucG9zaXRpb24pO1xuXHR9XG5cblx0YXNjZW5kKHkpIHtcblx0XHRjb25zdCB5RGlmZiA9IHkgLSB0aGlzLm9iamVjdC5wb3NpdGlvbi55O1xuXHRcdGNvbnN0IGRlc2lyZWRZU3BlZWQgPSB5RGlmZiAqIDAuMTtcblx0XHRjb25zdCB5U3BlZWREaWZmID0gZGVzaXJlZFlTcGVlZCAtIHRoaXMudmVsb2NpdHkueTtcblx0XHRjb25zdCBkZXNpcmVkWUFjYyA9IHlTcGVlZERpZmYgKiAwLjE7XG5cblx0XHRsZXQgcmF0aW8gPSBkZXNpcmVkWUFjYyAvIHRoaXMucG93ZXI7XG5cdFx0aWYgKHJhdGlvID4gMS4wKSB7XG5cdFx0XHRyYXRpbyA9IDEuMDtcblx0XHR9IGVsc2UgaWYgKHJhdGlvIDwgLTEuMCkge1xuXHRcdFx0cmF0aW8gPSAtMS4wO1xuXHRcdH1cblxuXHRcdGxldCBkZXNpcmVkUGl0Y2ggPSBNYXRoLmFzaW4ocmF0aW8pO1xuXG5cdFx0Y29uc3QgbWF4UGl0Y2ggPSAwLjNcblxuXHRcdGlmIChkZXNpcmVkUGl0Y2ggPiBtYXhQaXRjaCkge1xuXHRcdFx0ZGVzaXJlZFBpdGNoID0gbWF4UGl0Y2g7XG5cdFx0fSBlbHNlIGlmIChkZXNpcmVkUGl0Y2ggPCAtbWF4UGl0Y2gpIHtcblx0XHRcdGRlc2lyZWRQaXRjaCA9IC1tYXhQaXRjaDtcblx0XHR9XG5cblx0XHRjb25zdCBwaXRjaERpZmYgPSBkZXNpcmVkUGl0Y2ggLSB0aGlzLnJvdGF0aW9uLng7XG5cblx0XHRjb25zdCBkZXNpcmVkUGl0Y2hTcGVlZCA9IHBpdGNoRGlmZjtcblxuXHRcdGNvbnN0IG1heFBpdGNoU3BlZWQgPSAwLjAzO1xuXG5cblx0XHR0aGlzLnJvdGF0aW9uLnggKz0gY2xhbXAoZGVzaXJlZFBpdGNoU3BlZWQsIC1tYXhQaXRjaFNwZWVkLCBtYXhQaXRjaFNwZWVkKTtcblx0fVxuXG5cdHR1cm4oYW1vdW50KSB7XG5cdFx0dGhpcy50dXJuQW1vdW50ID0gYW1vdW50O1xuXHR9XG5cblx0Zm9yd2FyZChhbW91bnQpIHtcblx0XHR0aGlzLmZvcndhcmRBbW91bnQgPSBhbW91bnQ7XG5cdH1cblxuXHRhbGlnbihwb2ludCkge1xuXHRcdGNvbnN0IGFuZ2xlRGlmZiA9IHRoaXMuZ2V0QW5nbGVEaWZmKHBvaW50KTtcblx0XHRjb25zdCBkZXNpcmVkVHVyblNwZWVkID0gYW5nbGVEaWZmICogMC4xO1xuXG5cdFx0bGV0IGRlc2lyZWRUdXJuQW1vdW50ID0gZGVzaXJlZFR1cm5TcGVlZCAvIHRoaXMubWF4VHVyblNwZWVkO1xuXHRcdGlmIChkZXNpcmVkVHVybkFtb3VudCA+IDEpIHtcblx0XHRcdGRlc2lyZWRUdXJuQW1vdW50ID0gMTtcblx0XHR9IGVsc2UgaWYgKGRlc2lyZWRUdXJuQW1vdW50IDwgLTEpIHtcblx0XHRcdGRlc2lyZWRUdXJuQW1vdW50ID0gLTE7XG5cdFx0fVxuXG5cdFx0dGhpcy50dXJuKGRlc2lyZWRUdXJuQW1vdW50KTtcblx0fVxuXG5cdG9yYml0KHBvaW50LCBkaXN0YW5jZSkge1xuXHRcdGxldCBkaXMgPSB0aGlzLm9iamVjdC5wb3NpdGlvbi5jbG9uZSgpLnN1Yihwb2ludCk7XG5cdFx0ZGlzLnkgPSAwO1xuXHRcdGRpcyA9IGRpcy5ub3JtYWxpemUoKS5tdWx0aXBseVNjYWxhcihkaXN0YW5jZSk7XG5cdFx0Y29uc3QgYSA9IHBvaW50LmNsb25lKCkuYWRkKFxuXHRcdFx0ZGlzLmNsb25lKCkuYXBwbHlFdWxlcihuZXcgVEhSRUUuRXVsZXIoMCwgTWF0aC5QSSAvIDMsIDApKSk7XG5cdFx0Y29uc3QgYiA9IHBvaW50LmNsb25lKCkuYWRkKFxuXHRcdFx0ZGlzLmNsb25lKCkuYXBwbHlFdWxlcihuZXcgVEhSRUUuRXVsZXIoMCwgLU1hdGguUEkgLyAzLCAwKSkpO1xuXG5cdFx0Y29uc3QgZGlmZkEgPSB0aGlzLmdldEFuZ2xlRGlmZihhKTtcblx0XHRjb25zdCBkaWZmQiA9IHRoaXMuZ2V0QW5nbGVEaWZmKGIpO1xuXG5cdFx0aWYgKE1hdGguYWJzKGRpZmZBKSA8IE1hdGguYWJzKGRpZmZCKSkge1xuXHRcdFx0dGhpcy5hbGlnbihhKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5hbGlnbihiKTtcblx0XHR9XG5cblx0XHR0aGlzLmZvcndhcmQoMS4wKTtcblx0fVxuXG5cdGdldEFuZ2xlRGlmZihwb2ludCkge1xuXHRcdGNvbnN0IGFuZ2xlID0gTWF0aC5hdGFuMihwb2ludC54IC0gdGhpcy5vYmplY3QucG9zaXRpb24ueCwgcG9pbnQueiAtIHRoaXMub2JqZWN0LnBvc2l0aW9uLnopIC0gTWF0aC5QSTtcblx0XHRjb25zdCBhbmdsZURpZmYgPSBhbmdsZSAtIHRoaXMub2JqZWN0LnJvdGF0aW9uLnk7XG5cdFx0cmV0dXJuIG5vcm1hbGl6ZUFuZ2xlKGFuZ2xlRGlmZik7XG5cdH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBTaGlwOyIsImNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uLy4uL2NvbnRhaW5lcicpO1xuY29uc3QgRW5naW5lID0gcmVxdWlyZSgnLi4vZW5naW5lJyk7XG5jb25zdCBUdXJyZW50ID0gcmVxdWlyZSgnLi90dXJyZW50Jyk7XG5jb25zdCBCZWFtID0gcmVxdWlyZSgnLi4vYmVhbScpO1xuY29uc3QgTGFzZXIgPSByZXF1aXJlKCcuLi9sYXNlcicpO1xuXG5jb25zdCByZWFkZXIgPSAoZGF0YSwgc2hpcCkgPT4ge1xuXHRjb25zdCBsaW5lcyA9IGRhdGEuc3BsaXQoJ1xcbicpO1xuXHRjb25zdCBjaHVua3MgPSBzaGlwLmNodW5rcztcblx0Y29uc3QgZW5naW5lcyA9IHNoaXAuZW5naW5lcztcblxuXHRsZXQgbGluZTtcblx0bGV0IGN1cnJlbnQ7XG5cdGxldCB6ID0gMDtcblx0bGV0IGNoYXI7XG5cblx0Y29uc3QgcmVzdWx0ID0ge1xuXHRcdG1vZHVsZXM6IFtdXG5cdH07XG5cblx0Y29uc3QgYXBwID0gY29udGFpbmVyLmFwcDtcblxuXHRmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0bGluZSA9IGxpbmVzW2ldO1xuXG5cdFx0aWYgKGxpbmUgPT09ICdIVUxMJykge1xuXHRcdFx0Y3VycmVudCA9ICdIVUxMJztcblx0XHRcdHogPSAwO1xuXHRcdH0gZWxzZSBpZiAobGluZSA9PT0gJ01PRFVMRVMnKSB7XG5cdFx0XHRjdXJyZW50ID0gJ01PRFVMRVMnO1xuXHRcdFx0eiA9IDA7XG5cdFx0fSBlbHNlIGlmIChjdXJyZW50ID09PSAnSFVMTCcpIHtcblx0XHRcdGZvciAobGV0IHggPSAwOyB4IDwgbGluZS5sZW5ndGg7IHgrKykge1xuXHRcdFx0XHRjaGFyID0gbGluZVt4XTtcblxuXHRcdFx0XHRpZiAoY2hhciA9PT0gJzAnKSB7XG5cdFx0XHRcdFx0Y2h1bmtzLnNldCh4LCAwLCB6LCAxKTtcblx0XHRcdFx0XHRzaGlwLmh1bGwucHVzaChbeCwgMCwgeiwgMV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR6Kys7XG5cdFx0fSBlbHNlIGlmIChjdXJyZW50ID09PSAnTU9EVUxFUycpIHtcblx0XHRcdGZvciAobGV0IHggPSAwOyB4IDwgbGluZS5sZW5ndGg7IHgrKykge1xuXHRcdFx0XHRjaGFyID0gbGluZVt4XTtcblx0XHRcdFx0aWYgKGNoYXIgPT09ICdFJykge1xuXHRcdFx0XHRcdGNvbnN0IGVuZ2luZSA9IGFwcC5hZGQoRW5naW5lLCB7XG5cdFx0XHRcdFx0XHRzaGlwOiBzaGlwLFxuXHRcdFx0XHRcdFx0Y29vcmQ6IFt4LCAwLCB6XVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGVuZ2luZXMucHVzaChlbmdpbmUpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGNoYXIgPT09ICdMJyB8fCBjaGFyID09PSAnbCcpIHtcblx0XHRcdFx0XHRjb25zdCB0eXBlID0gTGFzZXI7XG5cdFx0XHRcdFx0Y29uc3QgY29vbGRvd24gPSAwLjE7XG5cdFx0XHRcdFx0Y29uc3QgcmVsb2FkVGltZSA9IDEuMDtcblx0XHRcdFx0XHRjb25zdCBjbGlwID0gMztcblxuXHRcdFx0XHRcdHNoaXAudHVycmVudHMucHVzaChuZXcgVHVycmVudCh7XG5cdFx0XHRcdFx0XHRjb29yZDogW3gsIDAsIHpdLFxuXHRcdFx0XHRcdFx0c2hpcDogc2hpcCxcblx0XHRcdFx0XHRcdHR5cGUsIGNvb2xkb3duLCByZWxvYWRUaW1lLCBjbGlwXG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR6Kys7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgY2VudGVyID0gWyAwLCAwLCAwIF07XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgc2hpcC5odWxsLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgdiA9IHNoaXAuaHVsbFtpXTtcblx0XHRjZW50ZXJbMF0gKz0gdlswXTtcblx0XHRjZW50ZXJbMV0gKz0gdlsxXTtcblx0XHRjZW50ZXJbMl0gKz0gdlsyXTtcblx0fVxuXHRjZW50ZXJbMF0gLz0gc2hpcC5odWxsLmxlbmd0aDtcblx0Y2VudGVyWzFdIC89IHNoaXAuaHVsbC5sZW5ndGg7XG5cdGNlbnRlclsyXSAvPSBzaGlwLmh1bGwubGVuZ3RoO1xuXHRcblx0Y2VudGVyWzBdICs9IDAuNTtcblx0Y2VudGVyWzFdICs9IDAuNTtcblx0Y2VudGVyWzJdICs9IDAuNTtcblxuXHRzaGlwLmNlbnRlci5mcm9tQXJyYXkoY2VudGVyKTtcblxuXHRzaGlwLmlubmVyT2JqZWN0LnBvc2l0aW9uLmZyb21BcnJheShjZW50ZXIpLm11bHRpcGx5U2NhbGFyKC0xKTtcblxuXHRyZXR1cm4gcmVzdWx0O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSByZWFkZXI7IiwiY29uc3QgY29udGFpbmVyID0gcmVxdWlyZSgnLi4vLi4vY29udGFpbmVyJyk7XG5cbmNsYXNzIFNoaXBzIHtcbiAgY29uc3RydWN0b3IoKSB7XG4gICAgdGhpcy5hcHAgPSBjb250YWluZXIuYXBwO1xuICAgIGNvbnRhaW5lci5zaGlwcyA9IHRoaXM7XG4gICAgdGhpcy5vbkFkZCA9IHRoaXMub25BZGQuYmluZCh0aGlzKTtcbiAgICB0aGlzLm9uRGVzdHJveSA9IHRoaXMub25EZXN0cm95LmJpbmQodGhpcyk7XG5cbiAgICB0aGlzLnNpZGVzID0ge307XG4gIH1cblxuICBnZXRUYXJnZXRzKHNoaXApIHtcbiAgXHRjb25zdCB0YXJnZXRzID0gW107XG4gIFx0Zm9yIChsZXQgc2lkZSBpbiB0aGlzLnNpZGVzKSB7XG4gICAgICBpZiAoc2lkZSA9PT0gc2hpcC5zaWRlKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuICBcdFx0Zm9yIChsZXQgaWQgaW4gdGhpcy5zaWRlc1tzaWRlXSkge1xuICBcdFx0XHR0YXJnZXRzLnB1c2godGhpcy5zaWRlc1tzaWRlXVtpZF0pO1xuICBcdFx0fVxuICBcdH1cblxuICBcdHJldHVybiB0YXJnZXRzO1xuICB9XG5cbiAgb25BZGQoY29tcG9uZW50KSB7XG4gICAgaWYgKCFjb21wb25lbnQuX19pc1NoaXApIHtcblx0XHRcdHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5zaWRlc1tjb21wb25lbnQuc2lkZV0gPT0gbnVsbCkge1xuICAgIFx0dGhpcy5zaWRlc1tjb21wb25lbnQuc2lkZV0gPSB7fTtcbiAgICB9XG5cbiAgICB0aGlzLnNpZGVzW2NvbXBvbmVudC5zaWRlXVtjb21wb25lbnQuX2lkXSA9IGNvbXBvbmVudDtcbiAgfVxuXG4gIG9uRGVzdHJveShjb21wb25lbnQpIHtcbiAgICBpZiAoIWNvbXBvbmVudC5fX2lzU2hpcCkge1xuXHRcdFx0cmV0dXJuO1xuICAgIH1cblxuICAgIGRlbGV0ZSB0aGlzLnNpZGVzW2NvbXBvbmVudC5zaWRlXVtjb21wb25lbnQuX2lkXTtcbiAgfVxuXG4gIHN0YXJ0KCkge1xuICAgIGZvciAobGV0IGlkIGluIHRoaXMuYXBwLm1hcCkge1xuICAgICAgdGhpcy5vbkFkZCh0aGlzLmFwcC5tYXBbaWRdKTtcbiAgICB9XG4gICAgdGhpcy5hcHAub24oJ2FkZCcsIHRoaXMub25BZGQpO1xuICAgIHRoaXMuYXBwLm9uKCdkZXN0b3J5JywgdGhpcy5vbkRlc3Ryb3kpO1xuICB9XG5cbiAgZGVzdHJveSgpIHtcbiAgXHR0aGlzLmFwcC5vZmYoJ2FkZCcsIHRoaXMub25BZGQpO1xuICBcdHRoaXMuYXBwLm9mZignZGVzdG9yeScsIHRoaXMub25EZXN0cm95KTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFNoaXBzO1xuIiwiY29uc3QgY29udGFpbmVyID0gcmVxdWlyZSgnLi4vLi4vY29udGFpbmVyJyk7XG5cbmNsYXNzIFR1cnJlbnQge1xuXHRjb25zdHJ1Y3Rvcihwcm9wcykge1xuXHRcdHRoaXMuYXBwID0gY29udGFpbmVyLmFwcDtcblxuXHRcdHRoaXMubG9jYWxQb3NpdGlvbiA9IFxuXHRcdFx0bmV3IFRIUkVFLlZlY3RvcjMoKVxuXHRcdFx0XHQuZnJvbUFycmF5KHByb3BzLmNvb3JkKVxuXHRcdFx0XHQuYWRkKG5ldyBUSFJFRS5WZWN0b3IzKDAuNSwgMC41LCAwLjUpKTtcblx0XHR0aGlzLnNoaXAgPSBwcm9wcy5zaGlwO1xuXG5cdFx0dGhpcy50eXBlID0gcHJvcHMudHlwZTtcblxuXHRcdHRoaXMuY29vbGRvd24gPSBwcm9wcy5jb29sZG93biB8fCAwO1xuXHRcdHRoaXMuY2xpcCA9IHByb3BzLmNsaXAgfHwgMDtcblx0XHR0aGlzLnJlbG9hZFRpbWUgPSBwcm9wcy5yZWxvYWRUaW1lIHx8IDE7XG5cblx0XHR0aGlzLmFtbW8gPSB0aGlzLmNsaXA7XG5cblx0XHR0aGlzLl9jb3VudGVyID0gMDtcblx0XHR0aGlzLl9yZWxvYWRUaW1lciA9IDA7XG5cdH1cblxuXHR0aWNrKGR0KSB7XG5cdFx0aWYgKHRoaXMuY29vbGRvd24gPT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fY291bnRlciA+IHRoaXMuY29vbGRvd24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fY291bnRlciArPSBkdDtcblx0fVxuXG5cdGZpcmUodGFyZ2V0KSB7XG5cdFx0aWYgKHRoaXMuYW1tbyA8PSAwKSB7XG5cdFx0XHRpZiAodGhpcy5fcmVsb2FkVGltZXIgPT09IDApIHtcblx0XHRcdFx0Ly8gU2V0IHJlbG9hZCB0aW1lclxuXHRcdFx0XHR0aGlzLl9yZWxvYWRUaW1lciA9IHRoaXMuYXBwLnRpbWUgKyB0aGlzLnJlbG9hZFRpbWU7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH0gZWxzZSBpZiAodGhpcy5hcHAudGltZSA+IHRoaXMuX3JlbG9hZFRpbWVyKSB7XG5cdFx0XHRcdC8vIFJlbG9hZCBkb25lXG5cdFx0XHRcdHRoaXMuX3JlbG9hZFRpbWVyID0gMDtcblx0XHRcdFx0dGhpcy5hbW1vID0gdGhpcy5jbGlwO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gUmVsb2FkaW5nLi4uXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGhpcy5jb29sZG93biA9PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2NvdW50ZXIgPiB0aGlzLmNvb2xkb3duKSB7XG5cdFx0XHR0aGlzLl9maXJlKHRhcmdldCk7XG5cdFx0XHR0aGlzLmFtbW8tLTtcblx0XHRcdHRoaXMuX2NvdW50ZXIgLT0gdGhpcy5jb29sZG93bjtcblx0XHR9XG5cdH1cblxuXHRnZXQgcG9zaXRpb24oKSB7XG5cdFx0cmV0dXJuIHRoaXMuc2hpcC5pbm5lck9iamVjdC5sb2NhbFRvV29ybGQodGhpcy5sb2NhbFBvc2l0aW9uLmNsb25lKCkpO1xuXHR9XG5cblx0Ly8gdGFyZ2V0IHsgcG9zaXRpb24gfVxuXHRfZmlyZSh0YXJnZXQpIHtcblx0XHRjb25zdCB2ZWN0b3IgPSB0YXJnZXQucG9zaXRpb24uY2xvbmUoKS5zdWIodGhpcy5wb3NpdGlvbik7XG5cblx0XHR0aGlzLmFwcC5hZGQodGhpcy50eXBlLCB7XG5cdFx0XHR0YXJnZXQ6IHRhcmdldCxcblx0XHRcdHR1cnJlbnQ6IHRoaXNcblx0XHR9KTtcblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFR1cnJlbnQ7IiwidmFyIHJhbmRvbVVuaXRWZWN0b3IgPSByZXF1aXJlKCcuLi91dGlscy9tYXRoJykucmFuZG9tVW5pdFZlY3RvcjtcbmNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uL2NvbnRhaW5lcicpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc2NlbmUgPSBjb250YWluZXIuc2NlbmU7XG4gIHZhciBkcmFnQ2FtZXJhID0gY29udGFpbmVyLmRyYWdDYW1lcmE7XG4gIHZhciBvYmplY3QgPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcblxuICBmdW5jdGlvbiBzdGFydCgpIHtcbiAgICB2YXIgc3ByZWFkID0gMTAwMDtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IDEyMDsgaSsrKSB7XG4gICAgICB2YXIgc2l6ZSA9IDIgKyBNYXRoLnBvdyhNYXRoLnJhbmRvbSgpLCAzKSAqIDg7XG4gICAgICB2YXIgc3ByaXRlID0gbmV3IFRIUkVFLlNwcml0ZSgpO1xuICAgICAgc3ByaXRlLnNjYWxlLnNldChzaXplLCBzaXplLCBzaXplKTtcbiAgICAgIHZhciBwb3NpdGlvbiA9IHJhbmRvbVVuaXRWZWN0b3IoKS5tdWx0aXBseVNjYWxhcigxMDAwKTtcbiAgICAgIHNwcml0ZS5wb3NpdGlvbi5jb3B5KHBvc2l0aW9uKTtcbiAgICAgIG9iamVjdC5hZGQoc3ByaXRlKTtcbiAgICB9XG4gICAgc2NlbmUuYWRkKG9iamVjdCk7XG4gIH07XG5cbiAgZnVuY3Rpb24gdGljayhkdCkge1xuICAgIG9iamVjdC5wb3NpdGlvbi5jb3B5KGRyYWdDYW1lcmEudGFyZ2V0KTtcblxuICAgIGNvbnN0IHNjYWxlID0gZHJhZ0NhbWVyYS5kaXN0YW5jZSAvIDIwMDtcbiAgICBvYmplY3Quc2NhbGUuc2V0KHNjYWxlLCBzY2FsZSwgc2NhbGUpO1xuICB9O1xuXG4gIGZ1bmN0aW9uIGRlc3Ryb3koKSB7XG4gICAgc2NlbmUucmVtb3ZlKG9iamVjdCk7XG4gIH07XG5cbiAgZnVuY3Rpb24gcmFuZG9tKCkge1xuICAgIHJldHVybiBNYXRoLnJhbmRvbSgpIC0gMC41O1xuICB9XG5cbiAgcmV0dXJuIHtcbiAgICBzdGFydDogc3RhcnQsXG4gICAgdGljazogdGljayxcbiAgICBkZXN0cm95OiBkZXN0cm95XG4gIH07XG59O1xuIiwiY29uc3QgQm90dGxlID0gcmVxdWlyZSgnYm90dGxlanMnKTtcbmNvbnN0IGFwcCA9IHJlcXVpcmUoJy4vY29yZS9hcHAnKTtcblxuY29uc3QgYm90dGxlID0gbmV3IEJvdHRsZSgpO1xuY29uc3QgY29udGFpbmVyID0gYm90dGxlLmNvbnRhaW5lcjtcblxuY29udGFpbmVyLmFwcCA9IGFwcDtcbmNvbnRhaW5lci5yZW5kZXJlciA9IGFwcC5yZW5kZXJlcjtcbmNvbnRhaW5lci5jb2xsaXNpb25zID0gYXBwLmNvbGxpc2lvbnM7XG5jb250YWluZXIuc2NlbmUgPSBhcHAucmVuZGVyZXIuc2NlbmU7XG5jb250YWluZXIuY2FtZXJhID0gYXBwLnJlbmRlcmVyLmNhbWVyYTtcblxubW9kdWxlLmV4cG9ydHMgPSBjb250YWluZXI7IiwiY29uc3QgZ3VpZCA9IHJlcXVpcmUoJy4vZ3VpZCcpO1xuY29uc3QgZWUgPSByZXF1aXJlKCdldmVudC1lbWl0dGVyJyk7XG5jb25zdCByZW5kZXJlciA9IHJlcXVpcmUoJy4vcmVuZGVyZXInKTtcbmNvbnN0IENvbGxpc2lvbnMgPSByZXF1aXJlKCcuL2NvbGxpc2lvbnMnKTtcblxuY29uc3QgY2xvbmUgPSAob2JqKSA9PiB7XG5cdGNvbnN0IGMgPSB7fTtcblx0Zm9yIChsZXQga2V5IGluIG9iaikge1xuXHRcdGNba2V5XSA9IG9ialtrZXldO1xuXHR9XG5cdHJldHVybiBjO1xufTtcblxuY2xhc3MgQXBwIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5tYXAgPSB7fTtcblx0XHR0aGlzLl9zdGFydE1hcCA9IHt9O1xuXHRcdHRoaXMuX2Rlc3Ryb3lNYXAgPSB7fTtcblxuXHRcdHRoaXMucmVuZGVyZXIgPSByZW5kZXJlcjtcblx0XHR0aGlzLmNvbGxpc2lvbnMgPSBuZXcgQ29sbGlzaW9ucyh7IGFwcDogdGhpcyB9KTtcblxuXHRcdHRoaXMuYW5pbWF0ZSA9IHRoaXMuYW5pbWF0ZS5iaW5kKHRoaXMpO1xuXHRcdFxuXHRcdHRoaXMudGltZSA9IDA7XG5cdFx0dGhpcy5kZWx0YSA9IDEwMDAgLyA2MDtcblx0fVxuXG5cdGFkZCh0eXBlLCBwcm9wcykge1xuXHRcdGNvbnN0IGNvbXBvbmVudCA9IG5ldyB0eXBlKHByb3BzKTtcblx0XHRjb21wb25lbnQuX2lkID0gZ3VpZCgpO1xuXHRcdHRoaXMubWFwW2NvbXBvbmVudC5faWRdID0gY29tcG9uZW50O1xuXHRcdHRoaXMuX3N0YXJ0TWFwW2NvbXBvbmVudC5faWRdID0gY29tcG9uZW50O1xuXHRcdHRoaXMuZW1pdCgnYWRkJywgY29tcG9uZW50KTtcblx0XHRyZXR1cm4gY29tcG9uZW50O1xuXHR9XG5cblx0ZGVzdHJveShjb21wb25lbnQpIHtcblx0XHR0aGlzLl9kZXN0cm95TWFwW2NvbXBvbmVudC5faWRdID0gY29tcG9uZW50O1xuXHRcdHRoaXMuZW1pdCgnZGVzdHJveScsIGNvbXBvbmVudCk7XG5cdH1cblxuXHR0aWNrKGR0KSB7XG5cdFx0dGhpcy5jb2xsaXNpb25zLnRpY2soKTtcblx0XHRcblx0XHRsZXQgaWQsIGNvbXBvbmVudDtcblxuXHRcdGNvbnN0IF9zdGFydE1hcCA9IGNsb25lKHRoaXMuX3N0YXJ0TWFwKTtcblx0XHR0aGlzLl9zdGFydE1hcCA9IHt9O1xuXG5cdFx0Zm9yIChpZCBpbiBfc3RhcnRNYXApIHtcblx0XHRcdGNvbXBvbmVudCA9IF9zdGFydE1hcFtpZF07XG5cdFx0XHRpZiAoY29tcG9uZW50LnN0YXJ0ICE9IG51bGwpIHtcblx0XHRcdFx0Y29tcG9uZW50LnN0YXJ0KCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Zm9yIChpZCBpbiB0aGlzLm1hcCkge1xuXHRcdFx0Y29tcG9uZW50ID0gdGhpcy5tYXBbaWRdO1xuXHRcdFx0aWYgKGNvbXBvbmVudC50aWNrICE9IG51bGwpIHtcblx0XHRcdFx0Y29tcG9uZW50LnRpY2soZHQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IF9kZXN0cm95TWFwID0gY2xvbmUodGhpcy5fZGVzdHJveU1hcCk7XG5cdFx0dGhpcy5fZGVzdHJveU1hcCA9IHt9O1xuXHRcdFxuXHRcdGZvciAoaWQgaW4gX2Rlc3Ryb3lNYXApIHtcblx0XHRcdGNvbXBvbmVudCA9IF9kZXN0cm95TWFwW2lkXTtcblx0XHRcdGlmIChjb21wb25lbnQuZGVzdHJveSAhPSBudWxsKSB7XG5cdFx0XHRcdGNvbXBvbmVudC5kZXN0cm95KCk7XG5cdFx0XHR9XG5cdFx0XHRkZWxldGUgdGhpcy5tYXBbY29tcG9uZW50Ll9pZF07XG5cdFx0fVxuXG5cdFx0dGhpcy5yZW5kZXJlci5yZW5kZXIoKTtcblx0fVxuXG5cdGFuaW1hdGUoKSB7XG5cdFx0Y29uc3QgZnJhbWVSYXRlID0gMSAvIDYwO1xuXHRcdFxuXHRcdHRoaXMudGljayhmcmFtZVJhdGUpO1xuXG5cdFx0dGhpcy50aW1lICs9IGZyYW1lUmF0ZTtcblx0XHR0aGlzLmRlbHRhID0gZnJhbWVSYXRlO1xuXG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMuYW5pbWF0ZSk7XG5cdH1cblxuXHRzdGFydCgpIHtcblx0XHR0aGlzLmFuaW1hdGUoKTtcblx0fVxufTtcblxuZWUoQXBwLnByb3RvdHlwZSk7XG5cbm1vZHVsZS5leHBvcnRzID0gbmV3IEFwcCgpOyIsImNvbnN0IGd1aWQgPSByZXF1aXJlKCcuL2d1aWQnKTtcblxuY2xhc3MgQ29sbGlzaW9ucyB7XG4gIGNvbnN0cnVjdG9yKHByb3BzKSB7XG4gICAgdGhpcy5tYXAgPSB7fTtcbiAgICB0aGlzLmFwcCA9IHByb3BzLmFwcDtcbiAgfVxuXG4gIGFkZChib2R5KSB7XG4gICAgaWYgKGJvZHkuX2lkID09IG51bGwpIHtcbiAgICAgIGJvZHkuX2lkID0gZ3VpZCgpO1xuICAgIH1cblxuICAgIGJvZHkuZ3JvdXAgPSBib2R5Lmdyb3VwIHx8ICdkZWZhdWx0JztcbiAgICBib2R5Lm1hc2sgPSBib2R5Lm1hc2sgfHwgWydkZWZhdWx0J107XG5cbiAgICBpZiAodGhpcy5tYXBbYm9keS5ncm91cF0gPT0gbnVsbCkge1xuICAgICAgdGhpcy5tYXBbYm9keS5ncm91cF0gPSB7fTtcbiAgICB9XG4gICAgdGhpcy5tYXBbYm9keS5ncm91cF1bYm9keS5faWRdID0gYm9keTtcbiAgfVxuXG4gIHJlbW92ZShib2R5KSB7XG4gICAgZGVsZXRlIHRoaXMubWFwW2JvZHkuZ3JvdXBdW2JvZHkuX2lkXTtcbiAgfVxuXG4gIHRpY2soKSB7XG4gICAgbGV0IGEsIGIsIGdyb3VwMjtcblxuICAgIGNvbnN0IHJlc29sdmVkID0ge307XG5cbiAgICBmb3IgKGxldCBncm91cCBpbiB0aGlzLm1hcCkge1xuICAgICAgZm9yIChsZXQgaWQgaW4gdGhpcy5tYXBbZ3JvdXBdKSB7XG4gICAgICAgIGEgPSB0aGlzLm1hcFtncm91cF1baWRdO1xuXG4gICAgICAgIGlmIChhLnN0YXRpYykge1xuICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBhLm1hc2subGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICBncm91cDIgPSB0aGlzLm1hcFthLm1hc2tbaV1dO1xuICAgICAgICAgIGZvciAobGV0IGlkMiBpbiBncm91cDIpIHtcbiAgICAgICAgICAgIGIgPSBncm91cDJbaWQyXTtcblxuICAgICAgICAgICAgaWYgKGEgPT09IGIpIHtcbiAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChyZXNvbHZlZFthLl9pZF0gIT0gbnVsbCAmJiByZXNvbHZlZFthLl9pZF1bYi5faWRdKSB7XG4gICAgICAgICAgICBcdGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBSZXNvbHZlIGEsIGJcdFx0XHRcdFxuICAgICAgICAgICAgaWYgKGEudHlwZSA9PT0gJ3JheScgJiYgYi50eXBlID09PSAnbWVzaCcpIHtcbiAgICAgICAgICAgICAgdGhpcy5oaXRUZXN0UmF5TWVzaChhLCBiKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoYS50eXBlID09PSAnbWVzaCcgJiYgYi50eXBlID09PSAncmF5Jykge1xuICAgICAgICAgICAgICB0aGlzLmhpdFRlc3RSYXlNZXNoKGIsIGEpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChhLnR5cGUgPT09ICdtZXNoJyAmJiBiLnR5cGUgPT09ICdtZXNoJykge1xuICAgICAgICAgICAgICB0aGlzLmhpdFRlc3RNZXNoTWVzaChhLCBiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gTWFyayByZXNvbHZlZFxuICAgICAgICAgICAgaWYgKHJlc29sdmVkW2EuX2lkXSA9PSBudWxsKSB7XG4gICAgICAgICAgICBcdHJlc29sdmVkW2EuX2lkXSA9IHt9O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmVzb2x2ZWRbYS5faWRdW2IuX2lkXSA9IHRydWU7XG4gICAgICAgICAgICBpZiAocmVzb2x2ZWRbYi5faWRdID09IG51bGwpIHtcbiAgICAgICAgICAgIFx0cmVzb2x2ZWRbYi5faWRdID0ge307XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXNvbHZlZFtiLl9pZF1bYS5faWRdID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBoaXRUZXN0UmF5TWVzaChyYXksIG1lc2gpIHtcbiAgICBjb25zdCBkZWx0YSA9IHRoaXMuYXBwLmRlbHRhO1xuXG4gICAgY29uc3QgcmF5Y2FzdGVyID0gcmF5LnJheWNhc3RlcjtcbiAgICBjb25zdCByZXN1bHRzID0gcmF5Y2FzdGVyLmludGVyc2VjdE9iamVjdChtZXNoLm1lc2gsIHRydWUpO1xuXG4gICAgaWYgKHJlc3VsdHMubGVuZ3RoID09PSAwKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKHJheS5vbkNvbGxpc2lvbiAhPSBudWxsKSB7XG4gICAgICByYXkub25Db2xsaXNpb24oe1xuICAgICAgICByZXN1bHRzOiByZXN1bHRzLFxuICAgICAgICBib2R5OiBtZXNoXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAobWVzaC5vbkNvbGxpc2lvbiAhPSBudWxsKSB7XG4gICAgICBtZXNoLm9uQ29sbGlzaW9uKHtcbiAgICAgICAgcmVzdWx0czogcmVzdWx0cyxcbiAgICAgICAgYm9keTogcmF5XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICBoaXRUZXN0TWVzaE1lc2goYSwgYikge1xuICAgIGlmIChhLm1lc2guZ2VvbWV0cnkuYm91bmRpbmdTcGhlcmUgPT0gbnVsbCkge1xuICAgICAgYS5tZXNoLmdlb21ldHJ5LmNvbXB1dGVCb3VuZGluZ1NwaGVyZSgpO1xuICAgIH1cbiAgICBpZiAoYi5tZXNoLmdlb21ldHJ5LmJvdW5kaW5nU3BoZXJlID09IG51bGwpIHtcbiAgICAgIGIubWVzaC5nZW9tZXRyeS5jb21wdXRlQm91bmRpbmdTcGhlcmUoKTtcbiAgICB9XG5cbiAgICBjb25zdCBkaXMgPSBhLm1lc2gucG9zaXRpb24uZGlzdGFuY2VUbyhiLm1lc2gucG9zaXRpb24pO1xuICAgIGNvbnN0IG1pbkRpcyA9IGEubWVzaC5nZW9tZXRyeS5ib3VuZGluZ1NwaGVyZS5yYWRpdXMgKyBiLm1lc2guZ2VvbWV0cnkuYm91bmRpbmdTcGhlcmUucmFkaXVzO1xuICAgIFxuICAgIGlmIChkaXMgPiBtaW5EaXMpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoYS5vbkNvbGxpc2lvbiAhPSBudWxsKSB7XG4gICAgICBhLm9uQ29sbGlzaW9uKHtcbiAgICAgICAgZGlzOiBkaXMsXG4gICAgICAgIG1pbkRpczogbWluRGlzLFxuICAgICAgICBib2R5OiBiXG4gICAgICB9KTtcbiAgICB9XG5cbiAgICBpZiAoYi5vbkNvbGxpc2lvbiAhPSBudWxsKSB7XG4gICAgICBiLm9uQ29sbGlzaW9uKHtcbiAgICAgICAgZGlzOiBkaXMsXG4gICAgICAgIG1pbkRpczogbWluRGlzLFxuICAgICAgICBib2R5OiBhXG4gICAgICB9KTtcbiAgICB9IFxuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbGxpc2lvbnM7XG4iLCJmdW5jdGlvbiBndWlkKCkge1xuICBmdW5jdGlvbiBzNCgpIHtcbiAgICByZXR1cm4gTWF0aC5mbG9vcigoMSArIE1hdGgucmFuZG9tKCkpICogMHgxMDAwMClcbiAgICAgIC50b1N0cmluZygxNilcbiAgICAgIC5zdWJzdHJpbmcoMSk7XG4gIH1cbiAgcmV0dXJuIHM0KCkgKyBzNCgpICsgJy0nICsgczQoKSArICctJyArIHM0KCkgKyAnLScgK1xuICAgIHM0KCkgKyAnLScgKyBzNCgpICsgczQoKSArIHM0KCk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gZ3VpZDsiLCJjb25zdCBUSFJFRSA9ICh0eXBlb2Ygd2luZG93ICE9PSBcInVuZGVmaW5lZFwiID8gd2luZG93WydUSFJFRSddIDogdHlwZW9mIGdsb2JhbCAhPT0gXCJ1bmRlZmluZWRcIiA/IGdsb2JhbFsnVEhSRUUnXSA6IG51bGwpO1xuXG5jb25zdCByZW5kZXJlciA9IG5ldyBUSFJFRS5XZWJHTFJlbmRlcmVyKCk7XG5yZW5kZXJlci5zZXRTaXplKHdpbmRvdy5pbm5lcldpZHRoLCB3aW5kb3cuaW5uZXJIZWlnaHQpO1xuZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChyZW5kZXJlci5kb21FbGVtZW50KTtcbmNvbnN0IHNjZW5lID0gbmV3IFRIUkVFLlNjZW5lKCk7XG5jb25zdCBjYW1lcmEgPSBuZXcgVEhSRUUuUGVyc3BlY3RpdmVDYW1lcmEoNjAsIHdpbmRvdy5pbm5lcldpZHRoIC8gd2luZG93LmlubmVySGVpZ2h0LCAwLjEsIDUwMDAwKTtcbmNhbWVyYS5wb3NpdGlvbi56ID0gNTtcblxuY29uc3QgcmVuZGVyID0gKCkgPT4ge1xuXHRyZW5kZXJlci5yZW5kZXIoc2NlbmUsIGNhbWVyYSk7XG59O1xuXG5jb25zdCBhbmltYXRlID0gKCkgPT4ge1xuXHRyZW5kZXIoKTtcblx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lKGFuaW1hdGUpO1xufTtcblxuY29uc3Qgb25SZXNpemUgPSAoKSA9PiB7XG5cdHJlbmRlcmVyLnNldFNpemUod2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCk7XG5cdGNhbWVyYS5hc3BlY3QgPSB3aW5kb3cuaW5uZXJXaWR0aCAvIHdpbmRvdy5pbm5lckhlaWdodDtcblx0Y2FtZXJhLnVwZGF0ZVByb2plY3Rpb25NYXRyaXgoKTtcbn07XG5cbndpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdyZXNpemUnLCBvblJlc2l6ZSk7XG5cbmFuaW1hdGUoKTtcblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdHJlbmRlcixcblx0c2NlbmUsXG5cdGNhbWVyYVxufTsiLCJjb25zdCBhcHAgPSByZXF1aXJlKCcuL2NvcmUvYXBwJyk7XG5jb25zdCBjb250YWluZXIgPSByZXF1aXJlKCcuL2NvbnRhaW5lcicpO1xuY29uc3QgU2hpcCA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy9zaGlwJyk7XG5jb25zdCBEcmFnQ2FtZXJhID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL2RyYWdjYW1lcmEnKTtcbmNvbnN0IEFzdGVyb2lkID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL2FzdGVyb2lkJyk7XG5jb25zdCBHcmlkID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL2dyaWQnKTtcbmNvbnN0IFNoaXBzID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL3NoaXAvc2hpcHMnKTtcbmNvbnN0IFN0YXJzID0gcmVxdWlyZSgnLi9jb21wb25lbnRzL3N0YXJzJyk7XG5cbmFwcC5zdGFydCgpO1xuYXBwLmFkZChTaGlwcyk7XG5cbmNvbnN0IGRyYWdDYW1lcmEgPSBhcHAuYWRkKERyYWdDYW1lcmEpO1xuY29udGFpbmVyLmRyYWdDYW1lcmEgPSBkcmFnQ2FtZXJhO1xuZHJhZ0NhbWVyYS5kaXN0YW5jZSA9IDIwMDtcblxuYXBwLmFkZChTdGFycyk7XG5cbmNvbnN0IGZyaWdhdGUgPSByZXF1aXJlKCcuL3NoaXBzL2ZyaWdhdGUnKTtcbmFwcC5hZGQoU2hpcCwgeyBcblx0ZGF0YTogZnJpZ2F0ZSwgXG5cdHNpZGU6ICcwJyB9KTtcblxuLy8gYXBwLmFkZChTaGlwLCB7IFxuLy8gXHRkYXRhOiBmcmlnYXRlLCBcbi8vIFx0c2lkZTogJzEnIH0pO1xuXG5jb25zdCBncmlkID0gYXBwLmFkZChHcmlkKTtcblxuY29uc3Qgbm9pc2UgPSByZXF1aXJlKCdwZXJsaW4nKS5ub2lzZTtcbm5vaXNlLnNlZWQoTWF0aC5yYW5kb20oKSk7XG5cbmNvbnN0IGFzdGVyb2lkcyA9IHt9O1xuXG5mb3IgKGxldCBpID0gMDsgaSA8IGdyaWQud2lkdGg7IGkrKykge1xuXHRmb3IgKGxldCBqID0gMDsgaiA8IGdyaWQuaGVpZ2h0OyBqKyspIHtcblx0XHRjb25zdCBjb29yZCA9IGdyaWQuaGV4VG9Db29yZChpLCBqKTtcblx0XHRjb25zdCBkaXMgPSBNYXRoLnNxcnQoY29vcmRbMF0gKiBjb29yZFswXSArIGNvb3JkWzFdICogY29vcmRbMV0pO1xuXG5cdFx0bGV0IHJhdGlvID0gTWF0aC5wb3coKC1kaXMgKyA1MDApIC8gNTAwLCAwLjUpO1xuXHRcdGlmIChyYXRpbyA+IDEpIHtcblx0XHRcdHJhdGlvID0gMTtcblx0XHR9IGVsc2UgaWYgKHJhdGlvIDwgMCkge1xuXHRcdFx0cmF0aW8gPSAwO1xuXHRcdH1cblxuXHRcdGNvbnN0IG4xID0gbm9pc2Uuc2ltcGxleDIoY29vcmRbMF0gKiAwLjAwNSwgY29vcmRbMV0gKiAwLjAwNSkgKiAwLjc7XG5cdFx0Y29uc3QgbjIgPSBub2lzZS5zaW1wbGV4Mihjb29yZFswXSAqIDAuMSwgY29vcmRbMV0gKiAwLjEpICogMC43O1xuXG5cdFx0Y29uc3QgbjMgPSBub2lzZS5zaW1wbGV4Mihjb29yZFswXSAqIDAuMDAyNSwgY29vcmRbMV0gKiAwLjAwMjUpICogMC43O1xuXHRcdGNvbnN0IG4gPSAobjEgKyBuMiArIG4zKSAqIHJhdGlvO1xuXG5cdFx0aWYgKG4gPiAwLjcpIHtcblx0XHRcdGNvbnN0IHNpemUgPSBuID4gMC45NSA/IDQgOiBuID4gMC45ID8gMyA6IG4gPiAwLjggPyAyIDogMTtcblxuXHRcdFx0Y29uc3QgaWQgPSBbaSwgal0uam9pbignLCcpO1xuXHRcdFx0YXN0ZXJvaWRzW2lkXSA9IHtcblx0XHRcdFx0c2l6ZTogc2l6ZSxcblx0XHRcdFx0cG9zaXRpb246IG5ldyBUSFJFRS5WZWN0b3IzKGNvb3JkWzBdLCAwLCBjb29yZFsxXSksXG5cdFx0XHRcdGNvb3JkOiBbaSwgal1cblx0XHRcdH07XG5cdFx0fVxuXHR9XG59XG5cbmNvbnN0IHNodWZmbGUgPSByZXF1aXJlKCdrbnV0aC1zaHVmZmxlJykua251dGhTaHVmZmxlO1xuY29uc3QgaWRzID0gc2h1ZmZsZShPYmplY3Qua2V5cyhhc3Rlcm9pZHMpKTtcbmZvciAobGV0IGkgPSAwOyBpIDwgaWRzLmxlbmd0aDsgaSsrKSB7XG5cdGNvbnN0IGFzdGVyb2lkID0gYXN0ZXJvaWRzW2lkc1tpXV07XG5cdGlmIChhc3Rlcm9pZC5yZW1vdmVkKSB7XG5cdFx0Y29udGludWU7XG5cdH1cblx0aWYgKGFzdGVyb2lkLnNpemUgPj0gMykge1xuXHRcdC8vIFJlbW92ZSBhc3Rlcm9pZCBhcm91bmRcblx0XHRjb25zdCBjb29yZHMgPSBncmlkLmdldFN1cnJvdW5kaW5nQ29vcmRzKGFzdGVyb2lkLmNvb3JkKTtcblxuXHRcdGZvciAobGV0IGogPSAwOyBqIDwgY29vcmRzLmxlbmd0aDsgaisrKSB7XG5cdFx0XHRjb25zdCBjb29yZCA9IGNvb3Jkc1tqXTtcblx0XHRcdGNvbnN0IGlkID0gY29vcmQuam9pbignLCcpO1xuXHRcdFx0aWYgKGFzdGVyb2lkc1tpZF0gPT0gbnVsbCkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdGFzdGVyb2lkc1tpZF0ucmVtb3ZlZCA9IHRydWU7XG5cdFx0fVxuXHR9XG59XG5cbmZvciAobGV0IGlkIGluIGFzdGVyb2lkcykge1xuXHRjb25zdCBhc3Rlcm9pZCA9IGFzdGVyb2lkc1tpZF07XG5cdGlmIChhc3Rlcm9pZC5yZW1vdmVkKSB7XG5cdFx0Y29udGludWU7XG5cdH1cblx0YXBwLmFkZChBc3Rlcm9pZCwge1xuXHRcdHBvc2l0aW9uOiBhc3Rlcm9pZC5wb3NpdGlvbixcblx0XHRzaXplOiBhc3Rlcm9pZC5zaXplXG5cdH0pO1xufVxuXG5jb25zdCBhbWJpZW50TGlnaHQgPSBuZXcgVEhSRUUuQW1iaWVudExpZ2h0KDB4QUFBQUFBKTtcbmNvbnN0IGRpcmVjdGlvbmFsTGlnaHQgPSBuZXcgVEhSRUUuRGlyZWN0aW9uYWxMaWdodCgweGZmZmZmZiwgMC43KTtcbmRpcmVjdGlvbmFsTGlnaHQucG9zaXRpb24uc2V0KDAuNSwgMS4wLCAwLjMpO1xuXG5jb25zdCBzY2VuZSA9IGFwcC5yZW5kZXJlci5zY2VuZTtcblxuc2NlbmUuYWRkKGFtYmllbnRMaWdodCk7XG5zY2VuZS5hZGQoZGlyZWN0aW9uYWxMaWdodCk7IiwibW9kdWxlLmV4cG9ydHMgPSBgXG5IVUxMXG4gMCAgICAgICAgIDBcbiAwICAgMCAwICAgMFxuMDAwMDAwMDAwMDAwMFxuMDAwMDAwMDAwMDAwMFxuIDAgICAwIDAgICAwXG4gICAgICAgICAgXG5cbk1PRFVMRVNcbiAwICAgICAgICAgMFxuIDAgICAwbDAgICAwXG4wMDAwMDAwMDAwMDAwXG4wMDAwMDBDMDAwMDAwXG4gRSAgIDAgMCAgIEVcbiAgICAgICAgICBcbmAiLCJjb25zdCByYW5kb21Vbml0VmVjdG9yID0gKCkgPT4ge1xuICBjb25zdCB0aGV0YSA9IE1hdGgucmFuZG9tKCkgKiAyLjAgKiBNYXRoLlBJO1xuXG4gIGNvbnN0IHJhd1ggPSBNYXRoLnNpbih0aGV0YSk7XG5cbiAgY29uc3QgcmF3WSA9IE1hdGguY29zKHRoZXRhKTtcblxuICBjb25zdCB6ID0gTWF0aC5yYW5kb20oKSAqIDIuMCAtIDEuMDtcblxuICBjb25zdCBwaGkgPSBNYXRoLmFzaW4oeik7XG5cbiAgY29uc3Qgc2NhbGFyID0gTWF0aC5jb3MocGhpKTtcblxuICBjb25zdCB4ID0gcmF3WCAqIHNjYWxhcjtcblxuICBjb25zdCB5ID0gcmF3WSAqIHNjYWxhcjtcblxuICByZXR1cm4gbmV3IFRIUkVFLlZlY3RvcjMoeCwgeSwgeik7ICBcbn1cblxuY29uc3QgcmFuZG9tUXVhdGVybmlvbiA9ICgpID0+IHtcblx0Y29uc3QgdmVjdG9yID0gcmFuZG9tVW5pdFZlY3RvcigpO1xuXHRyZXR1cm4gbmV3IFRIUkVFLlF1YXRlcm5pb24oKS5zZXRGcm9tVW5pdFZlY3RvcnMobmV3IFRIUkVFLlZlY3RvcjMoMCwgMCwgMSksIHZlY3Rvcik7XG59O1xuXG5jb25zdCBub3JtYWxpemVBbmdsZSA9IChhbmdsZSkgPT4ge1xuXHRhbmdsZSAlPSAoTWF0aC5QSSAqIDIpO1xuXHRpZiAoYW5nbGUgPiBNYXRoLlBJKSB7XG5cdFx0YW5nbGUgLT0gTWF0aC5QSSAqIDI7XG5cdH0gZWxzZSBpZiAoYW5nbGUgPCAtTWF0aC5QSSkge1xuXHRcdGFuZ2xlICs9IE1hdGguUEkgKiAyO1xuXHR9XG5cblx0cmV0dXJuIGFuZ2xlO1xufTtcblxuY29uc3QgY2xhbXAgPSAodiwgbWluLCBtYXgpID0+IHtcblx0aWYgKHYgPCBtaW4pIHtcblx0XHRyZXR1cm4gbWluO1xuXHR9IGVsc2UgaWYgKHYgPiBtYXgpIHtcblx0XHRyZXR1cm4gbWF4O1xuXHR9XG5cdHJldHVybiB2O1xufTtcblxuY29uc3QgbGluZWFyQmlsbGJvYXJkID0gKGNhbWVyYSwgb2JqZWN0LCBkaXIsIHF1YXRlcm5pb24pID0+IHtcblx0Y29uc3QgYSA9IG9iamVjdC5wb3NpdGlvbi5jbG9uZSgpLnN1YihjYW1lcmEucG9zaXRpb24pLm5vcm1hbGl6ZSgpO1xuXHRjb25zdCBiID0gYS5jbG9uZSgpLnByb2plY3RPblBsYW5lKGRpcikubm9ybWFsaXplKCk7XG5cdGNvbnN0IGMgPSBuZXcgVEhSRUUuVmVjdG9yMygwLCAwLCAxKS5hcHBseVF1YXRlcm5pb24ocXVhdGVybmlvbik7XG5cblx0Y29uc3QgcXVhdDIgPSBuZXcgVEhSRUUuUXVhdGVybmlvbigpLnNldEZyb21Vbml0VmVjdG9ycyhjLCBiKTtcblxuXHRvYmplY3QucXVhdGVybmlvbi5jb3B5KG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCkpO1xuXHRvYmplY3QucXVhdGVybmlvbi5tdWx0aXBseShxdWF0Mik7XG5cdG9iamVjdC5xdWF0ZXJuaW9uLm11bHRpcGx5KHF1YXRlcm5pb24pO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHsgcmFuZG9tVW5pdFZlY3RvciwgcmFuZG9tUXVhdGVybmlvbiwgbm9ybWFsaXplQW5nbGUsIGNsYW1wLCBsaW5lYXJCaWxsYm9hcmQgfTtcbiIsImNsYXNzIENodW5rIHtcblx0Y29uc3RydWN0b3Ioc2l6ZSkge1xuXHRcdHRoaXMuc2l6ZSA9IHNpemU7XG5cdFx0dGhpcy55eiA9IHNpemUgKiBzaXplO1xuXHRcdHRoaXMuZGF0YSA9IFtdO1xuXHR9XG5cblx0Z2V0KGksIGosIGspIHtcblx0XHRjb25zdCBpbmRleCA9IGkgKiB0aGlzLnl6ICsgaiAqIHRoaXMuc2l6ZSArIGs7XG5cdFx0cmV0dXJuIHRoaXMuZGF0YVtpbmRleF07XG5cdH1cblxuXHRzZXQoaSwgaiwgaywgdikge1xuXHRcdGNvbnN0IGluZGV4ID0gaSAqIHRoaXMueXogKyBqICogdGhpcy5zaXplICsgaztcblx0XHR0aGlzLmRhdGFbaW5kZXhdID0gdjtcblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IENodW5rOyIsImNvbnN0IENodW5rID0gcmVxdWlyZSgnLi9jaHVuaycpO1xuXG5jbGFzcyBDaHVua3Mge1xuXHRjb25zdHJ1Y3RvcihzaXplKSB7XG5cdFx0dGhpcy5zaXplID0gc2l6ZSB8fCAxNjtcblx0XHR0aGlzLm1hcCA9IHt9O1xuXHR9XG5cblx0Z2V0KGksIGosIGspIHtcblx0XHRjb25zdCBvcmlnaW4gPSB0aGlzLmdldE9yaWdpbihpLCBqLCBrKTtcblx0XHRjb25zdCBpZCA9IG9yaWdpbi5qb2luKCcsJyk7XG5cblx0XHRjb25zdCByZWdpb24gPSB0aGlzLm1hcFtpZF07XG5cdFx0aWYgKHJlZ2lvbiA9PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9IFxuXG5cdFx0cmV0dXJuIHJlZ2lvbi5jaHVuay5nZXQoaSAtIG9yaWdpblswXSwgaiAtIG9yaWdpblsxXSwgayAtIG9yaWdpblsyXSk7XG5cdH1cblxuXHRzZXQoaSwgaiwgaywgdikge1xuXHRcdGNvbnN0IG9yaWdpbiA9IHRoaXMuZ2V0T3JpZ2luKGksIGosIGspO1xuXHRcdGNvbnN0IGlkID0gb3JpZ2luLmpvaW4oJywnKTtcblxuXHRcdGxldCByZWdpb24gPSB0aGlzLm1hcFtpZF07XG5cdFx0aWYgKHJlZ2lvbiA9PSBudWxsKSB7XG5cdFx0XHRyZWdpb24gPSB0aGlzLm1hcFtpZF0gPSB7XG5cdFx0XHRcdGNodW5rOiBuZXcgQ2h1bmsodGhpcy5zaXplKSxcblx0XHRcdFx0b3JpZ2luOiBvcmlnaW5cblx0XHRcdH07XG5cdFx0fVxuXHRcdHJlZ2lvbi5kaXJ0eSA9IHRydWU7XG5cdFx0dGhpcy5kaXJ0eSA9IHRydWU7XG5cblx0XHRyZWdpb24uY2h1bmsuc2V0KGkgLSBvcmlnaW5bMF0sIGogLSBvcmlnaW5bMV0sIGsgLSBvcmlnaW5bMl0sIHYpO1xuXHR9XG5cblx0Z2V0T3JpZ2luKGksIGosIGspIHtcblx0XHRyZXR1cm4gWyBcblx0XHRcdE1hdGguZmxvb3IoaSAvIHRoaXMuc2l6ZSkgKiB0aGlzLnNpemUsXG5cdFx0XHRNYXRoLmZsb29yKGogLyB0aGlzLnNpemUpICogdGhpcy5zaXplLFxuXHRcdFx0TWF0aC5mbG9vcihrIC8gdGhpcy5zaXplKSAqIHRoaXMuc2l6ZVxuXHRcdF1cblx0fVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDaHVua3M7IiwiY29uc3QgbWVzaGVyID0gcmVxdWlyZSgnLi9tb25vdG9uZScpLm1lc2hlcjtcblxuY29uc3QgbWVzaFJlZ2lvbiA9IChyZWdpb24sIG9iamVjdCwgbWF0ZXJpYWwpID0+IHtcblx0aWYgKHJlZ2lvbi5tZXNoICE9IG51bGwpIHtcblx0XHRvYmplY3QucmVtb3ZlKHJlZ2lvbi5tZXNoKTtcblx0XHRyZWdpb24ubWVzaC5nZW9tZXRyeS5kaXNwb3NlKCk7XG5cdH1cblxuXHRjb25zdCBnZW9tZXRyeSA9IG5ldyBUSFJFRS5HZW9tZXRyeSgpO1xuXHRjb25zdCBtZXNoID0gbmV3IFRIUkVFLk1lc2goZ2VvbWV0cnksIG1hdGVyaWFsKTtcblxuXHRjb25zdCBjaHVuayA9IHJlZ2lvbi5jaHVuaztcblxuXHRjb25zdCBmID0gY2h1bmsuZ2V0LmJpbmQoY2h1bmspO1xuXHRjb25zdCBkaW1zID0gWyBjaHVuay5zaXplLCBjaHVuay5zaXplLCBjaHVuay5zaXplIF07XG5cblx0Y29uc3QgcmVzdWx0ID0gbWVzaGVyKGYsIGRpbXMpO1xuXG5cdHJlc3VsdC52ZXJ0aWNlcy5mb3JFYWNoKCh2KSA9PiB7XG5cdFx0Z2VvbWV0cnkudmVydGljZXMucHVzaChuZXcgVEhSRUUuVmVjdG9yMyh2WzBdLCB2WzFdLCB2WzJdKSk7XG5cdH0pO1xuXG5cdHJlc3VsdC5mYWNlcy5mb3JFYWNoKChmKSA9PiB7XG5cdFx0Y29uc3QgZmFjZSA9IG5ldyBUSFJFRS5GYWNlMyhmWzBdLCBmWzFdLCBmWzJdKTtcblx0XHRmYWNlLm1hdGVyaWFsSW5kZXggPSBmWzNdO1xuXHRcdGdlb21ldHJ5LmZhY2VzLnB1c2goZmFjZSk7XG5cdH0pO1xuXG5cdG9iamVjdC5hZGQobWVzaCk7XG5cdHJlZ2lvbi5tZXNoID0gbWVzaDtcbn07XG5cbmNvbnN0IG1lc2hDaHVua3MgPSAoY2h1bmtzLCBvYmplY3QsIG1hdGVyaWFsKSA9PiB7XG5cdGlmICghY2h1bmtzLmRpcnR5KSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdFxuXHRsZXQgaWQsIHJlZ2lvbjtcblx0Zm9yIChpZCBpbiBjaHVua3MubWFwKSB7XG5cdFx0cmVnaW9uID0gY2h1bmtzLm1hcFtpZF07XG5cdFx0aWYgKHJlZ2lvbi5kaXJ0eSkge1xuXHRcdFx0bWVzaFJlZ2lvbihyZWdpb24sIG9iamVjdCwgbWF0ZXJpYWwpO1xuXHRcdFx0cmVnaW9uLmRpcnR5ID0gZmFsc2U7XG5cdFx0fVxuXHR9XG5cdGNodW5rcy5kaXJ0eSA9IGZhbHNlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBtZXNoQ2h1bmtzOyIsIlwidXNlIHN0cmljdFwiO1xuXG52YXIgTW9ub3RvbmVNZXNoID0gKGZ1bmN0aW9uKCl7XG5cbmZ1bmN0aW9uIE1vbm90b25lUG9seWdvbihjLCB2LCB1bCwgdXIpIHtcbiAgdGhpcy5jb2xvciAgPSBjO1xuICB0aGlzLmxlZnQgICA9IFtbdWwsIHZdXTtcbiAgdGhpcy5yaWdodCAgPSBbW3VyLCB2XV07XG59O1xuXG5Nb25vdG9uZVBvbHlnb24ucHJvdG90eXBlLmNsb3NlX29mZiA9IGZ1bmN0aW9uKHYpIHtcbiAgdGhpcy5sZWZ0LnB1c2goWyB0aGlzLmxlZnRbdGhpcy5sZWZ0Lmxlbmd0aC0xXVswXSwgdiBdKTtcbiAgdGhpcy5yaWdodC5wdXNoKFsgdGhpcy5yaWdodFt0aGlzLnJpZ2h0Lmxlbmd0aC0xXVswXSwgdiBdKTtcbn07XG5cbk1vbm90b25lUG9seWdvbi5wcm90b3R5cGUubWVyZ2VfcnVuID0gZnVuY3Rpb24odiwgdV9sLCB1X3IpIHtcbiAgdmFyIGwgPSB0aGlzLmxlZnRbdGhpcy5sZWZ0Lmxlbmd0aC0xXVswXVxuICAgICwgciA9IHRoaXMucmlnaHRbdGhpcy5yaWdodC5sZW5ndGgtMV1bMF07IFxuICBpZihsICE9PSB1X2wpIHtcbiAgICB0aGlzLmxlZnQucHVzaChbIGwsIHYgXSk7XG4gICAgdGhpcy5sZWZ0LnB1c2goWyB1X2wsIHYgXSk7XG4gIH1cbiAgaWYociAhPT0gdV9yKSB7XG4gICAgdGhpcy5yaWdodC5wdXNoKFsgciwgdiBdKTtcbiAgICB0aGlzLnJpZ2h0LnB1c2goWyB1X3IsIHYgXSk7XG4gIH1cbn07XG5cblxucmV0dXJuIGZ1bmN0aW9uKGYsIGRpbXMpIHtcbiAgLy9Td2VlcCBvdmVyIDMtYXhlc1xuICB2YXIgdmVydGljZXMgPSBbXSwgZmFjZXMgPSBbXTtcbiAgZm9yKHZhciBkPTA7IGQ8MzsgKytkKSB7XG4gICAgdmFyIGksIGosIGtcbiAgICAgICwgdSA9IChkKzEpJTMgICAvL3UgYW5kIHYgYXJlIG9ydGhvZ29uYWwgZGlyZWN0aW9ucyB0byBkXG4gICAgICAsIHYgPSAoZCsyKSUzXG4gICAgICAsIHggPSBuZXcgSW50MzJBcnJheSgzKVxuICAgICAgLCBxID0gbmV3IEludDMyQXJyYXkoMylcbiAgICAgICwgcnVucyA9IG5ldyBJbnQzMkFycmF5KDIgKiAoZGltc1t1XSsxKSlcbiAgICAgICwgZnJvbnRpZXIgPSBuZXcgSW50MzJBcnJheShkaW1zW3VdKSAgLy9Gcm9udGllciBpcyBsaXN0IG9mIHBvaW50ZXJzIHRvIHBvbHlnb25zXG4gICAgICAsIG5leHRfZnJvbnRpZXIgPSBuZXcgSW50MzJBcnJheShkaW1zW3VdKVxuICAgICAgLCBsZWZ0X2luZGV4ID0gbmV3IEludDMyQXJyYXkoMiAqIGRpbXNbdl0pXG4gICAgICAsIHJpZ2h0X2luZGV4ID0gbmV3IEludDMyQXJyYXkoMiAqIGRpbXNbdl0pXG4gICAgICAsIHN0YWNrID0gbmV3IEludDMyQXJyYXkoMjQgKiBkaW1zW3ZdKVxuICAgICAgLCBkZWx0YSA9IFtbMCwwXSwgWzAsMF1dO1xuICAgIC8vcSBwb2ludHMgYWxvbmcgZC1kaXJlY3Rpb25cbiAgICBxW2RdID0gMTtcbiAgICAvL0luaXRpYWxpemUgc2VudGluZWxcbiAgICBmb3IoeFtkXT0tMTsgeFtkXTxkaW1zW2RdOyApIHtcbiAgICAgIC8vIC0tLSBQZXJmb3JtIG1vbm90b25lIHBvbHlnb24gc3ViZGl2aXNpb24gLS0tXG4gICAgICB2YXIgbiA9IDBcbiAgICAgICAgLCBwb2x5Z29ucyA9IFtdXG4gICAgICAgICwgbmYgPSAwO1xuICAgICAgZm9yKHhbdl09MDsgeFt2XTxkaW1zW3ZdOyArK3hbdl0pIHtcbiAgICAgICAgLy9NYWtlIG9uZSBwYXNzIG92ZXIgdGhlIHUtc2NhbiBsaW5lIG9mIHRoZSB2b2x1bWUgdG8gcnVuLWxlbmd0aCBlbmNvZGUgcG9seWdvblxuICAgICAgICB2YXIgbnIgPSAwLCBwID0gMCwgYyA9IDA7XG4gICAgICAgIGZvcih4W3VdPTA7IHhbdV08ZGltc1t1XTsgKyt4W3VdLCBwID0gYykge1xuICAgICAgICAgIC8vQ29tcHV0ZSB0aGUgdHlwZSBmb3IgdGhpcyBmYWNlXG4gICAgICAgICAgdmFyIGEgPSAoMCAgICA8PSB4W2RdICAgICAgPyBmKHhbMF0sICAgICAgeFsxXSwgICAgICB4WzJdKSAgICAgIDogMClcbiAgICAgICAgICAgICwgYiA9ICh4W2RdIDwgIGRpbXNbZF0tMSA/IGYoeFswXStxWzBdLCB4WzFdK3FbMV0sIHhbMl0rcVsyXSkgOiAwKTtcbiAgICAgICAgICBjID0gYTtcbiAgICAgICAgICBpZigoIWEpID09PSAoIWIpKSB7XG4gICAgICAgICAgICBjID0gMDtcbiAgICAgICAgICB9IGVsc2UgaWYoIWEpIHtcbiAgICAgICAgICAgIGMgPSAtYjtcbiAgICAgICAgICB9XG4gICAgICAgICAgLy9JZiBjZWxsIHR5cGUgZG9lc24ndCBtYXRjaCwgc3RhcnQgYSBuZXcgcnVuXG4gICAgICAgICAgaWYocCAhPT0gYykge1xuICAgICAgICAgICAgcnVuc1tucisrXSA9IHhbdV07XG4gICAgICAgICAgICBydW5zW25yKytdID0gYztcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy9BZGQgc2VudGluZWwgcnVuXG4gICAgICAgIHJ1bnNbbnIrK10gPSBkaW1zW3VdO1xuICAgICAgICBydW5zW25yKytdID0gMDtcbiAgICAgICAgLy9VcGRhdGUgZnJvbnRpZXIgYnkgbWVyZ2luZyBydW5zXG4gICAgICAgIHZhciBmcCA9IDA7XG4gICAgICAgIGZvcih2YXIgaT0wLCBqPTA7IGk8bmYgJiYgajxuci0yOyApIHtcbiAgICAgICAgICB2YXIgcCAgICA9IHBvbHlnb25zW2Zyb250aWVyW2ldXVxuICAgICAgICAgICAgLCBwX2wgID0gcC5sZWZ0W3AubGVmdC5sZW5ndGgtMV1bMF1cbiAgICAgICAgICAgICwgcF9yICA9IHAucmlnaHRbcC5yaWdodC5sZW5ndGgtMV1bMF1cbiAgICAgICAgICAgICwgcF9jICA9IHAuY29sb3JcbiAgICAgICAgICAgICwgcl9sICA9IHJ1bnNbal0gICAgLy9TdGFydCBvZiBydW5cbiAgICAgICAgICAgICwgcl9yICA9IHJ1bnNbaisyXSAgLy9FbmQgb2YgcnVuXG4gICAgICAgICAgICAsIHJfYyAgPSBydW5zW2orMV07IC8vQ29sb3Igb2YgcnVuXG4gICAgICAgICAgLy9DaGVjayBpZiB3ZSBjYW4gbWVyZ2UgcnVuIHdpdGggcG9seWdvblxuICAgICAgICAgIGlmKHJfciA+IHBfbCAmJiBwX3IgPiByX2wgJiYgcl9jID09PSBwX2MpIHtcbiAgICAgICAgICAgIC8vTWVyZ2UgcnVuXG4gICAgICAgICAgICBwLm1lcmdlX3J1bih4W3ZdLCByX2wsIHJfcik7XG4gICAgICAgICAgICAvL0luc2VydCBwb2x5Z29uIGludG8gZnJvbnRpZXJcbiAgICAgICAgICAgIG5leHRfZnJvbnRpZXJbZnArK10gPSBmcm9udGllcltpXTtcbiAgICAgICAgICAgICsraTtcbiAgICAgICAgICAgIGogKz0gMjtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy9DaGVjayBpZiB3ZSBuZWVkIHRvIGFkdmFuY2UgdGhlIHJ1biBwb2ludGVyXG4gICAgICAgICAgICBpZihyX3IgPD0gcF9yKSB7XG4gICAgICAgICAgICAgIGlmKCEhcl9jKSB7XG4gICAgICAgICAgICAgICAgdmFyIG5fcG9seSA9IG5ldyBNb25vdG9uZVBvbHlnb24ocl9jLCB4W3ZdLCByX2wsIHJfcik7XG4gICAgICAgICAgICAgICAgbmV4dF9mcm9udGllcltmcCsrXSA9IHBvbHlnb25zLmxlbmd0aDtcbiAgICAgICAgICAgICAgICBwb2x5Z29ucy5wdXNoKG5fcG9seSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgaiArPSAyO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgLy9DaGVjayBpZiB3ZSBuZWVkIHRvIGFkdmFuY2UgdGhlIGZyb250aWVyIHBvaW50ZXJcbiAgICAgICAgICAgIGlmKHBfciA8PSByX3IpIHtcbiAgICAgICAgICAgICAgcC5jbG9zZV9vZmYoeFt2XSk7XG4gICAgICAgICAgICAgICsraTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy9DbG9zZSBvZmYgYW55IHJlc2lkdWFsIHBvbHlnb25zXG4gICAgICAgIGZvcig7IGk8bmY7ICsraSkge1xuICAgICAgICAgIHBvbHlnb25zW2Zyb250aWVyW2ldXS5jbG9zZV9vZmYoeFt2XSk7XG4gICAgICAgIH1cbiAgICAgICAgLy9BZGQgYW55IGV4dHJhIHJ1bnMgdG8gZnJvbnRpZXJcbiAgICAgICAgZm9yKDsgajxuci0yOyBqKz0yKSB7XG4gICAgICAgICAgdmFyIHJfbCAgPSBydW5zW2pdXG4gICAgICAgICAgICAsIHJfciAgPSBydW5zW2orMl1cbiAgICAgICAgICAgICwgcl9jICA9IHJ1bnNbaisxXTtcbiAgICAgICAgICBpZighIXJfYykge1xuICAgICAgICAgICAgdmFyIG5fcG9seSA9IG5ldyBNb25vdG9uZVBvbHlnb24ocl9jLCB4W3ZdLCByX2wsIHJfcik7XG4gICAgICAgICAgICBuZXh0X2Zyb250aWVyW2ZwKytdID0gcG9seWdvbnMubGVuZ3RoO1xuICAgICAgICAgICAgcG9seWdvbnMucHVzaChuX3BvbHkpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICAvL1N3YXAgZnJvbnRpZXJzXG4gICAgICAgIHZhciB0bXAgPSBuZXh0X2Zyb250aWVyO1xuICAgICAgICBuZXh0X2Zyb250aWVyID0gZnJvbnRpZXI7XG4gICAgICAgIGZyb250aWVyID0gdG1wO1xuICAgICAgICBuZiA9IGZwO1xuICAgICAgfVxuICAgICAgLy9DbG9zZSBvZmYgZnJvbnRpZXJcbiAgICAgIGZvcih2YXIgaT0wOyBpPG5mOyArK2kpIHtcbiAgICAgICAgdmFyIHAgPSBwb2x5Z29uc1tmcm9udGllcltpXV07XG4gICAgICAgIHAuY2xvc2Vfb2ZmKGRpbXNbdl0pO1xuICAgICAgfVxuICAgICAgLy8gLS0tIE1vbm90b25lIHN1YmRpdmlzaW9uIG9mIHBvbHlnb24gaXMgY29tcGxldGUgYXQgdGhpcyBwb2ludCAtLS1cbiAgICAgIFxuICAgICAgeFtkXSsrO1xuICAgICAgXG4gICAgICAvL05vdyB3ZSBqdXN0IG5lZWQgdG8gdHJpYW5ndWxhdGUgZWFjaCBtb25vdG9uZSBwb2x5Z29uXG4gICAgICBmb3IodmFyIGk9MDsgaTxwb2x5Z29ucy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgcCA9IHBvbHlnb25zW2ldXG4gICAgICAgICAgLCBjID0gcC5jb2xvclxuICAgICAgICAgICwgZmxpcHBlZCA9IGZhbHNlO1xuICAgICAgICBpZihjIDwgMCkge1xuICAgICAgICAgIGZsaXBwZWQgPSB0cnVlO1xuICAgICAgICAgIGMgPSAtYztcbiAgICAgICAgfVxuICAgICAgICBmb3IodmFyIGo9MDsgajxwLmxlZnQubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICBsZWZ0X2luZGV4W2pdID0gdmVydGljZXMubGVuZ3RoO1xuICAgICAgICAgIHZhciB5ID0gWzAuMCwwLjAsMC4wXVxuICAgICAgICAgICAgLCB6ID0gcC5sZWZ0W2pdO1xuICAgICAgICAgIHlbZF0gPSB4W2RdO1xuICAgICAgICAgIHlbdV0gPSB6WzBdO1xuICAgICAgICAgIHlbdl0gPSB6WzFdO1xuICAgICAgICAgIHZlcnRpY2VzLnB1c2goeSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yKHZhciBqPTA7IGo8cC5yaWdodC5sZW5ndGg7ICsraikge1xuICAgICAgICAgIHJpZ2h0X2luZGV4W2pdID0gdmVydGljZXMubGVuZ3RoO1xuICAgICAgICAgIHZhciB5ID0gWzAuMCwwLjAsMC4wXVxuICAgICAgICAgICAgLCB6ID0gcC5yaWdodFtqXTtcbiAgICAgICAgICB5W2RdID0geFtkXTtcbiAgICAgICAgICB5W3VdID0gelswXTtcbiAgICAgICAgICB5W3ZdID0gelsxXTtcbiAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKHkpO1xuICAgICAgICB9XG4gICAgICAgIC8vVHJpYW5ndWxhdGUgdGhlIG1vbm90b25lIHBvbHlnb25cbiAgICAgICAgdmFyIGJvdHRvbSA9IDBcbiAgICAgICAgICAsIHRvcCA9IDBcbiAgICAgICAgICAsIGxfaSA9IDFcbiAgICAgICAgICAsIHJfaSA9IDFcbiAgICAgICAgICAsIHNpZGUgPSB0cnVlOyAgLy90cnVlID0gcmlnaHQsIGZhbHNlID0gbGVmdFxuICAgICAgICBcbiAgICAgICAgc3RhY2tbdG9wKytdID0gbGVmdF9pbmRleFswXTtcbiAgICAgICAgc3RhY2tbdG9wKytdID0gcC5sZWZ0WzBdWzBdO1xuICAgICAgICBzdGFja1t0b3ArK10gPSBwLmxlZnRbMF1bMV07XG4gICAgICAgIFxuICAgICAgICBzdGFja1t0b3ArK10gPSByaWdodF9pbmRleFswXTtcbiAgICAgICAgc3RhY2tbdG9wKytdID0gcC5yaWdodFswXVswXTtcbiAgICAgICAgc3RhY2tbdG9wKytdID0gcC5yaWdodFswXVsxXTtcbiAgICAgICAgXG4gICAgICAgIHdoaWxlKGxfaSA8IHAubGVmdC5sZW5ndGggfHwgcl9pIDwgcC5yaWdodC5sZW5ndGgpIHtcbiAgICAgICAgICAvL0NvbXB1dGUgbmV4dCBzaWRlXG4gICAgICAgICAgdmFyIG5fc2lkZSA9IGZhbHNlO1xuICAgICAgICAgIGlmKGxfaSA9PT0gcC5sZWZ0Lmxlbmd0aCkge1xuICAgICAgICAgICAgbl9zaWRlID0gdHJ1ZTtcbiAgICAgICAgICB9IGVsc2UgaWYocl9pICE9PSBwLnJpZ2h0Lmxlbmd0aCkge1xuICAgICAgICAgICAgdmFyIGwgPSBwLmxlZnRbbF9pXVxuICAgICAgICAgICAgICAsIHIgPSBwLnJpZ2h0W3JfaV07XG4gICAgICAgICAgICBuX3NpZGUgPSBsWzFdID4gclsxXTtcbiAgICAgICAgICB9XG4gICAgICAgICAgdmFyIGlkeCA9IG5fc2lkZSA/IHJpZ2h0X2luZGV4W3JfaV0gOiBsZWZ0X2luZGV4W2xfaV1cbiAgICAgICAgICAgICwgdmVydCA9IG5fc2lkZSA/IHAucmlnaHRbcl9pXSA6IHAubGVmdFtsX2ldO1xuICAgICAgICAgIGlmKG5fc2lkZSAhPT0gc2lkZSkge1xuICAgICAgICAgICAgLy9PcHBvc2l0ZSBzaWRlXG4gICAgICAgICAgICB3aGlsZShib3R0b20rMyA8IHRvcCkge1xuICAgICAgICAgICAgICBpZihmbGlwcGVkID09PSBuX3NpZGUpIHtcbiAgICAgICAgICAgICAgICBmYWNlcy5wdXNoKFsgc3RhY2tbYm90dG9tXSwgc3RhY2tbYm90dG9tKzNdLCBpZHgsIGNdKTtcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmYWNlcy5wdXNoKFsgc3RhY2tbYm90dG9tKzNdLCBzdGFja1tib3R0b21dLCBpZHgsIGNdKTsgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGJvdHRvbSArPSAzO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAvL1NhbWUgc2lkZVxuICAgICAgICAgICAgd2hpbGUoYm90dG9tKzMgPCB0b3ApIHtcbiAgICAgICAgICAgICAgLy9Db21wdXRlIGNvbnZleGl0eVxuICAgICAgICAgICAgICBmb3IodmFyIGo9MDsgajwyOyArK2opXG4gICAgICAgICAgICAgIGZvcih2YXIgaz0wOyBrPDI7ICsraykge1xuICAgICAgICAgICAgICAgIGRlbHRhW2pdW2tdID0gc3RhY2tbdG9wLTMqKGorMSkraysxXSAtIHZlcnRba107XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdmFyIGRldCA9IGRlbHRhWzBdWzBdICogZGVsdGFbMV1bMV0gLSBkZWx0YVsxXVswXSAqIGRlbHRhWzBdWzFdO1xuICAgICAgICAgICAgICBpZihuX3NpZGUgPT09IChkZXQgPiAwKSkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGlmKGRldCAhPT0gMCkge1xuICAgICAgICAgICAgICAgIGlmKGZsaXBwZWQgPT09IG5fc2lkZSkge1xuICAgICAgICAgICAgICAgICAgZmFjZXMucHVzaChbIHN0YWNrW3RvcC0zXSwgc3RhY2tbdG9wLTZdLCBpZHgsIGMgXSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGZhY2VzLnB1c2goWyBzdGFja1t0b3AtNl0sIHN0YWNrW3RvcC0zXSwgaWR4LCBjIF0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB0b3AgLT0gMztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgICAgLy9QdXNoIHZlcnRleFxuICAgICAgICAgIHN0YWNrW3RvcCsrXSA9IGlkeDtcbiAgICAgICAgICBzdGFja1t0b3ArK10gPSB2ZXJ0WzBdO1xuICAgICAgICAgIHN0YWNrW3RvcCsrXSA9IHZlcnRbMV07XG4gICAgICAgICAgLy9VcGRhdGUgbG9vcCBpbmRleFxuICAgICAgICAgIGlmKG5fc2lkZSkge1xuICAgICAgICAgICAgKytyX2k7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICsrbF9pO1xuICAgICAgICAgIH1cbiAgICAgICAgICBzaWRlID0gbl9zaWRlO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiB7IHZlcnRpY2VzOnZlcnRpY2VzLCBmYWNlczpmYWNlcyB9O1xufVxufSkoKTtcblxuaWYoZXhwb3J0cykge1xuICBleHBvcnRzLm1lc2hlciA9IE1vbm90b25lTWVzaDtcbn1cbiJdfQ==
