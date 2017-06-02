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
const guid = require('./guid');
const container = require('./container');

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

		this.renderer = container.renderer;
		this.animate = this.animate.bind(this);
		
		container.app = this;
	}

	add(type, props) {
		const component = new type(props);
		component._id = guid();
		this.map[component._id] = component;
		this._startMap[component._id] = component;
		return component;
	}

	destroy(component) {
		this._destroyMap[component._id] = component;
	}

	tick(dt) {
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
		const frameRate = 1000 / 60;
		this.tick(frameRate / 1000);
		requestAnimationFrame(this.animate);
	}

	start() {
		this.animate();
	}
};

module.exports = new App();
},{"./container":11,"./guid":12}],3:[function(require,module,exports){
const container = require('../container');
const randomQuaternion = require('../utils/math').randomQuaternion;

class Asteroid {
	constructor(props) {
		this.scene = container.scene;
		const geometry = new THREE.BoxGeometry(10, 10, 10);
		this.object = new THREE.Mesh(geometry);
		this.object.quaternion.copy(randomQuaternion());
	}

	start() {
		this.scene.add(this.object);
	}

	tick(dt) {

	}

	destroy() {
		this.scene.remove(this.object);	
	}
}

module.exports = Asteroid;
},{"../container":11,"../utils/math":17}],4:[function(require,module,exports){
const container = require('../container');

class DragCamera {
	start() {
		this.rotation = new THREE.Euler(-Math.PI / 4, Math.PI / 4, 0, 'YXZ');
		this.distance = 50;
		this.target = new THREE.Vector3();
		this.camera = container.camera;
		this.up = new THREE.Vector3(0, 1, 0);

		this.onMouseWheel = this.onMouseWheel.bind(this);

		window.addEventListener('mousewheel', this.onMouseWheel);
	}

	onMouseWheel(e) {
		const scale = 1 + e.deltaY / 1000;
		this.distance *= scale;
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
},{"../container":11}],5:[function(require,module,exports){
const container = require('../container');
const ParticleSystem = require('./particlesystem');

class Engine {
  constructor(props) {
    this.props = props;
    this.object = new THREE.Object3D();
    this.scene = container.scene;
    this.app = container.app;
    this.particleVelocity = new THREE.Vector3();

    
    this.particleSystem = this.app.add(ParticleSystem, {
      scale: [ ((r) => {
      	return r + 1;
      }), 0],
      life: ((r) => {
        return (r + 1) * 200;
      }),
      interval: 20,
      velocity: this.particleVelocity,
      autoPlay: false
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
    this.particleSystem.play();
  }

  tick(dt) {
    this.updateParticleSystem();
  }

  destroy() {
    this.app.destroy(this.particleSystem);
  }

  updateParticleSystem() {
    this.particleSystem.position.copy(this.object.getWorldPosition());
    const rotation = this.object.getWorldRotation();
    const direction = new THREE.Vector3(0, 0, 1).applyEuler(rotation);
    this.particleVelocity.copy(direction.multiplyScalar(10));
  }
};

module.exports = Engine;

},{"../container":11,"./particlesystem":8}],6:[function(require,module,exports){
const container = require('../container');

class Grid {
  constructor(props) {
    this.axis = [ 1, Math.sqrt(3) / 2, Math.sqrt(3) / 4 ];
    this.scene = container.scene;
  }

  hexToScreen(i, j) {
  	return [ this.axis[0] * i + ((j % 2 === 0) ? this.axis[2] : 0), this.axis[1] * j ];
  }

  start() {
    // for (let i = 0; i < 10; i++) {
    //   for (let j = 0; j < 10; j++) {

    //     const sprite = new THREE.Sprite();
    //     const screen = this.hexToScreen(i, j);
    //     sprite.position.x = screen[0] * 10;
    //     sprite.position.z = screen[1] * 10;

    //     this.scene.add(sprite);

    //   }
    // }
  }
}

module.exports = Grid;

},{"../container":11}],7:[function(require,module,exports){
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
					const r = this.object.r;
					return v(r);
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
			const r = this.object.r;
			return this.value(r);
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
		this.r = Math.random();
		this.life = new Value(props.life, this);
		this.velocity = props.velocity;
		this.parent = props.parent;
		this.scale = new Value(props.scale, this);
		this.object = new THREE.Sprite(props.material);
		this.app = container.app;
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

		this.r = Math.random();
	}

	destroy() {
		this.object.parent.remove(this.object);
	}
}

module.exports = Particle;
},{"../container":11}],8:[function(require,module,exports){
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
	}

	pause() {
		if (this._timeout != null) {
			clearTimeout(this._timeout);
		}
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
		particle.object.position.copy(this.position);
		this._timeout = setTimeout(this.emit, this.interval);
	}
}

module.exports = ParticleSystem;
},{"../container":11,"./particle":7}],9:[function(require,module,exports){
(function (global){
const container = require('../../container');
const THREE = (typeof window !== "undefined" ? window['THREE'] : typeof global !== "undefined" ? global['THREE'] : null);
const Chunks = require('../../voxel/chunks');
const mesher = require('../../voxel/mesher');
const reader = require('../../ships/reader');

class Ship {
	constructor(props) {
		this.props = props;
		this.scene = container.scene;
		this.object = new THREE.Object3D();
		this.object.rotation.order = 'YXZ';
		this.innerObject = new THREE.Object3D();
		this.innerObject.rotation.order = 'YXZ';
		this.object.add(this.innerObject);
		this.chunks = new Chunks();

		this.engines = [];
		this.turrents = [];

		this.turnSpeed = 0;

		this.turnAmount = 0;
		this.forwardAmount = 0;

		this.speed = new THREE.Vector3();
	}

	start() {
		this.material = [ null, new THREE.MeshBasicMaterial({
			color: 0xffffff
		}) ];

		this.scene.add(this.object);
	
		reader(this.props.data, this);
	}

	tick(dt) {
		mesher(this.chunks, this.innerObject, this.material);

		// demo
		this.forward(1);
		this.turn(1);

		for (let i = 0; i < this.turrents.length; i ++) {

		}

		// Step yaw
		const turnAcceleration = 0.1;
		const maxTurnSpeed = 0.01;
		const desiredTurnSpeed = this.turnAmount * maxTurnSpeed;

		if (this.turnSpeed < desiredTurnSpeed) {
			this.turnSpeed += turnAcceleration * dt;
		} else if (this.turnSpeed > desiredTurnSpeed) {
			this.turnSpeed -= turnAcceleration * dt;
		}

		if (this.turnSpeed < -maxTurnSpeed) {
			this.turnSpeed = -maxTurnSpeed;
		} else if (this.turnSpeed > maxTurnSpeed) {
			this.turnSpeed = maxTurnSpeed;
		}

		// Step roll
		this.object.rotation.y += this.turnSpeed;

		const ratio = this.turnSpeed / maxTurnSpeed;

		const maxRollAmount = Math.PI / 8;
		const angle = ratio * maxRollAmount;

		this.object.rotation.z += (angle - this.object.rotation.z) * 0.01;

		this.turnAmount = 0;

		// Step forward
		const power = 1;
		const acc = new THREE.Vector3(0, 0, -1)
			.applyEuler(this.object.rotation)
			.multiplyScalar(this.forwardAmount * power * dt);

		this.speed.add(acc);
		this.object.position.add(this.speed);

		this.speed.multiplyScalar(0.97);

		this.forwardAmount = 0;
	}

	turn(amount) {
		this.turnAmount = amount;
	}

	forward(amount) {
		this.forwardAmount = amount;
	}

	orbit(point) {

	}

	destroy() {

	}
}

module.exports = Ship;
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"../../container":11,"../../ships/reader":16,"../../voxel/chunks":19,"../../voxel/mesher":20}],10:[function(require,module,exports){
class Turrent {
	constructor(props) {
		this.position = 
			new THREE.Vector3()
				.fromArray(props.coord)
				.add(new THREE.Vector3(0.5, 0.5, 0.5));
		this.ship = props.ship;
		this.direction = new THREE.Vector3(0, 0, 1);

		this.type = props.type;

		this.cooldown = 0;

		switch(this.type) {
			case 'L': {
				this.cooldown = 1.0;
			} break;
		}

		this._counter = 0;
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

	fire() {
		if (this.cooldown == 0) {
			return;
		}

		if (this._counter > this.cooldown) {
			this._fire();
			this._counter -= this.cooldown;
		}
	}

	_fire() {
		const position = this.ship.innerObject.localToWorld(this.position.clone());
		const direction = this.direction.clone().applyEuler(this.ship.innerObject.getWorldRotation());
	}
}

module.exports = Turrent;
},{}],11:[function(require,module,exports){
const Bottle = require('bottlejs');
const renderer = require('./renderer');

const bottle = new Bottle();
const container = bottle.container;

container.renderer = renderer;
container.scene = renderer.scene;
container.camera = renderer.camera;

module.exports = container;
},{"./renderer":14,"bottlejs":1}],12:[function(require,module,exports){
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
},{}],13:[function(require,module,exports){
const app = require('./app');
const Ship = require('./components/ship');
const DragCamera = require('./components/dragcamera');
const Asteroid = require('./components/asteroid');
const Grid = require('./components/grid');

app.start();

const frigate = require('./ships/frigate');
const ship = app.add(Ship, { data: frigate });
// app.add(Asteroid);
const dragCamera = app.add(DragCamera);

app.add(Grid);
},{"./app":2,"./components/asteroid":3,"./components/dragcamera":4,"./components/grid":6,"./components/ship":9,"./ships/frigate":15}],14:[function(require,module,exports){
(function (global){
const THREE = (typeof window !== "undefined" ? window['THREE'] : typeof global !== "undefined" ? global['THREE'] : null);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
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

},{}],15:[function(require,module,exports){
module.exports = `
HULL
 0         0
 0   0 0   0
0000000000000
0000000000000
 0   0 0   0
          

MODULES
 0         0
 0   0 0   0
0000L0L0L0000
000000C000000
 E   0 0   E
          
`
},{}],16:[function(require,module,exports){
const container = require('../container');
const Engine = require('../components/engine');
const Turrent = require('../components/ship/turrent');

const reader = (data, ship) => {
	const lines = data.split('\n');
	const chunks = ship.chunks;
	const engines = ship.engines;

	let line;
	let current;
	let z = 0;
	let char;

	const result = {
		hull: [],
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
					result.hull.push([x, 0, z, 1]);
				}
			}
			z++;
		} else if (current === 'MODULES') {
			for (let x = 0; x < line.length; x++) {
				char = line[x];
				if (char === 'E') {
					app.add(Engine, {
						ship: ship,
						coord: [x, 0, z]
					});
				} else if (char === 'L') {
					ship.turrents.push(new Turrent({
						coord: [x, 0, z],
						ship: ship,
						type: 'L'
					}));
				}
			}
			z++;
		}
	}

	const center = [ 0, 0, 0 ];
	for (let i = 0; i < result.hull.length; i++) {
		const v = result.hull[i];
		center[0] += v[0];
		center[1] += v[1];
		center[2] += v[2];
	}
	center[0] /= -result.hull.length;
	center[1] /= -result.hull.length;
	center[2] /= -result.hull.length;
	
	center[0] -= 0.5;
	center[1] -= 0.5;
	center[2] -= 0.5;

	result.center = center;

	ship.innerObject.position.fromArray(center);

	return result;
};

module.exports = reader;
},{"../components/engine":5,"../components/ship/turrent":10,"../container":11}],17:[function(require,module,exports){
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

module.exports = { randomUnitVector, randomQuaternion };

},{}],18:[function(require,module,exports){
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
},{}],19:[function(require,module,exports){
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
},{"./chunk":18}],20:[function(require,module,exports){
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
	let id, region;
	for (id in chunks.map) {
		region = chunks.map[id];
		if (region.dirty) {
			meshRegion(region, object, material);
			region.dirty = false;
		}
	}
};

module.exports = meshChunks;
},{"./monotone":21}],21:[function(require,module,exports){
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

},{}]},{},[13])
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3Vzci9sb2NhbC9saWIvbm9kZV9tb2R1bGVzL3dhdGNoaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvYm90dGxlanMvZGlzdC9ib3R0bGUuanMiLCJzcmMvYXBwLmpzIiwic3JjL2NvbXBvbmVudHMvYXN0ZXJvaWQuanMiLCJzcmMvY29tcG9uZW50cy9kcmFnY2FtZXJhLmpzIiwic3JjL2NvbXBvbmVudHMvZW5naW5lLmpzIiwic3JjL2NvbXBvbmVudHMvZ3JpZC5qcyIsInNyYy9jb21wb25lbnRzL3BhcnRpY2xlLmpzIiwic3JjL2NvbXBvbmVudHMvcGFydGljbGVzeXN0ZW0uanMiLCJzcmMvY29tcG9uZW50cy9zaGlwL2luZGV4LmpzIiwic3JjL2NvbXBvbmVudHMvc2hpcC90dXJyZW50LmpzIiwic3JjL2NvbnRhaW5lci5qcyIsInNyYy9ndWlkLmpzIiwic3JjL2luZGV4LmpzIiwic3JjL3JlbmRlcmVyLmpzIiwic3JjL3NoaXBzL2ZyaWdhdGUuanMiLCJzcmMvc2hpcHMvcmVhZGVyLmpzIiwic3JjL3V0aWxzL21hdGguanMiLCJzcmMvdm94ZWwvY2h1bmsuanMiLCJzcmMvdm94ZWwvY2h1bmtzLmpzIiwic3JjL3ZveGVsL21lc2hlci5qcyIsInNyYy92b3hlbC9tb25vdG9uZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDbHBCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDaEZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDN0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDM0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7Ozs7QUM3R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNWQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ1ZBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ2JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQ2hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2xCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIjsoZnVuY3Rpb24odW5kZWZpbmVkKSB7XG4gICAgJ3VzZSBzdHJpY3QnO1xuICAgIC8qKlxuICAgICAqIEJvdHRsZUpTIHYxLjYuMSAtIDIwMTctMDUtMTdcbiAgICAgKiBBIHBvd2VyZnVsIGRlcGVuZGVuY3kgaW5qZWN0aW9uIG1pY3JvIGNvbnRhaW5lclxuICAgICAqXG4gICAgICogQ29weXJpZ2h0IChjKSAyMDE3IFN0ZXBoZW4gWW91bmdcbiAgICAgKiBMaWNlbnNlZCBNSVRcbiAgICAgKi9cbiAgICBcbiAgICAvKipcbiAgICAgKiBVbmlxdWUgaWQgY291bnRlcjtcbiAgICAgKlxuICAgICAqIEB0eXBlIE51bWJlclxuICAgICAqL1xuICAgIHZhciBpZCA9IDA7XG4gICAgXG4gICAgLyoqXG4gICAgICogTG9jYWwgc2xpY2UgYWxpYXNcbiAgICAgKlxuICAgICAqIEB0eXBlIEZ1bmN0aW9uc1xuICAgICAqL1xuICAgIHZhciBzbGljZSA9IEFycmF5LnByb3RvdHlwZS5zbGljZTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBJdGVyYXRvciB1c2VkIHRvIHdhbGsgZG93biBhIG5lc3RlZCBvYmplY3QuXG4gICAgICpcbiAgICAgKiBJZiBCb3R0bGUuY29uZmlnLnN0cmljdCBpcyB0cnVlLCB0aGlzIG1ldGhvZCB3aWxsIHRocm93IGFuIGV4Y2VwdGlvbiBpZiBpdCBlbmNvdW50ZXJzIGFuXG4gICAgICogdW5kZWZpbmVkIHBhdGhcbiAgICAgKlxuICAgICAqIEBwYXJhbSBPYmplY3Qgb2JqXG4gICAgICogQHBhcmFtIFN0cmluZyBwcm9wXG4gICAgICogQHJldHVybiBtaXhlZFxuICAgICAqIEB0aHJvd3MgRXJyb3IgaWYgQm90dGxlIGlzIHVuYWJsZSB0byByZXNvbHZlIHRoZSByZXF1ZXN0ZWQgc2VydmljZS5cbiAgICAgKi9cbiAgICB2YXIgZ2V0TmVzdGVkID0gZnVuY3Rpb24gZ2V0TmVzdGVkKG9iaiwgcHJvcCkge1xuICAgICAgICB2YXIgc2VydmljZSA9IG9ialtwcm9wXTtcbiAgICAgICAgaWYgKHNlcnZpY2UgPT09IHVuZGVmaW5lZCAmJiBnbG9iYWxDb25maWcuc3RyaWN0KSB7XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ0JvdHRsZSB3YXMgdW5hYmxlIHRvIHJlc29sdmUgYSBzZXJ2aWNlLiAgYCcgKyBwcm9wICsgJ2AgaXMgdW5kZWZpbmVkLicpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBzZXJ2aWNlO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogR2V0IGEgbmVzdGVkIGJvdHRsZS4gV2lsbCBzZXQgYW5kIHJldHVybiBpZiBub3Qgc2V0LlxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgZ2V0TmVzdGVkQm90dGxlID0gZnVuY3Rpb24gZ2V0TmVzdGVkQm90dGxlKG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubmVzdGVkW25hbWVdIHx8ICh0aGlzLm5lc3RlZFtuYW1lXSA9IEJvdHRsZS5wb3AoKSk7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBHZXQgYSBzZXJ2aWNlIHN0b3JlZCB1bmRlciBhIG5lc3RlZCBrZXlcbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgZnVsbG5hbWVcbiAgICAgKiBAcmV0dXJuIFNlcnZpY2VcbiAgICAgKi9cbiAgICB2YXIgZ2V0TmVzdGVkU2VydmljZSA9IGZ1bmN0aW9uIGdldE5lc3RlZFNlcnZpY2UoZnVsbG5hbWUpIHtcbiAgICAgICAgcmV0dXJuIGZ1bGxuYW1lLnNwbGl0KCcuJykucmVkdWNlKGdldE5lc3RlZCwgdGhpcyk7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBSZWdpc3RlciBhIGNvbnN0YW50XG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWVcbiAgICAgKiBAcGFyYW0gbWl4ZWQgdmFsdWVcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciBjb25zdGFudCA9IGZ1bmN0aW9uIGNvbnN0YW50KG5hbWUsIHZhbHVlKSB7XG4gICAgICAgIHZhciBwYXJ0cyA9IG5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgbmFtZSA9IHBhcnRzLnBvcCgpO1xuICAgICAgICBkZWZpbmVDb25zdGFudC5jYWxsKHBhcnRzLnJlZHVjZShzZXRWYWx1ZU9iamVjdCwgdGhpcy5jb250YWluZXIpLCBuYW1lLCB2YWx1ZSk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG4gICAgXG4gICAgdmFyIGRlZmluZUNvbnN0YW50ID0gZnVuY3Rpb24gZGVmaW5lQ29uc3RhbnQobmFtZSwgdmFsdWUpIHtcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHRoaXMsIG5hbWUsIHtcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZSA6IGZhbHNlLFxuICAgICAgICAgICAgZW51bWVyYWJsZSA6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZSA6IHZhbHVlLFxuICAgICAgICAgICAgd3JpdGFibGUgOiBmYWxzZVxuICAgICAgICB9KTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyIGRlY29yYXRvci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgZnVsbG5hbWVcbiAgICAgKiBAcGFyYW0gRnVuY3Rpb24gZnVuY1xuICAgICAqIEByZXR1cm4gQm90dGxlXG4gICAgICovXG4gICAgdmFyIGRlY29yYXRvciA9IGZ1bmN0aW9uIGRlY29yYXRvcihmdWxsbmFtZSwgZnVuYykge1xuICAgICAgICB2YXIgcGFydHMsIG5hbWU7XG4gICAgICAgIGlmICh0eXBlb2YgZnVsbG5hbWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgICAgICAgIGZ1bmMgPSBmdWxsbmFtZTtcbiAgICAgICAgICAgIGZ1bGxuYW1lID0gJ19fZ2xvYmFsX18nO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIHBhcnRzID0gZnVsbG5hbWUuc3BsaXQoJy4nKTtcbiAgICAgICAgbmFtZSA9IHBhcnRzLnNoaWZ0KCk7XG4gICAgICAgIGlmIChwYXJ0cy5sZW5ndGgpIHtcbiAgICAgICAgICAgIGdldE5lc3RlZEJvdHRsZS5jYWxsKHRoaXMsIG5hbWUpLmRlY29yYXRvcihwYXJ0cy5qb2luKCcuJyksIGZ1bmMpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKCF0aGlzLmRlY29yYXRvcnNbbmFtZV0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLmRlY29yYXRvcnNbbmFtZV0gPSBbXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMuZGVjb3JhdG9yc1tuYW1lXS5wdXNoKGZ1bmMpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXIgYSBmdW5jdGlvbiB0aGF0IHdpbGwgYmUgZXhlY3V0ZWQgd2hlbiBCb3R0bGUjcmVzb2x2ZSBpcyBjYWxsZWQuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gRnVuY3Rpb24gZnVuY1xuICAgICAqIEByZXR1cm4gQm90dGxlXG4gICAgICovXG4gICAgdmFyIGRlZmVyID0gZnVuY3Rpb24gZGVmZXIoZnVuYykge1xuICAgICAgICB0aGlzLmRlZmVycmVkLnB1c2goZnVuYyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG4gICAgXG4gICAgXG4gICAgLyoqXG4gICAgICogSW1tZWRpYXRlbHkgaW5zdGFudGlhdGVzIHRoZSBwcm92aWRlZCBsaXN0IG9mIHNlcnZpY2VzIGFuZCByZXR1cm5zIHRoZW0uXG4gICAgICpcbiAgICAgKiBAcGFyYW0gQXJyYXkgc2VydmljZXNcbiAgICAgKiBAcmV0dXJuIEFycmF5IEFycmF5IG9mIGluc3RhbmNlcyAoaW4gdGhlIG9yZGVyIHRoZXkgd2VyZSBwcm92aWRlZClcbiAgICAgKi9cbiAgICB2YXIgZGlnZXN0ID0gZnVuY3Rpb24gZGlnZXN0KHNlcnZpY2VzKSB7XG4gICAgICAgIHJldHVybiAoc2VydmljZXMgfHwgW10pLm1hcChnZXROZXN0ZWRTZXJ2aWNlLCB0aGlzLmNvbnRhaW5lcik7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBSZWdpc3RlciBhIGZhY3RvcnkgaW5zaWRlIGEgZ2VuZXJpYyBwcm92aWRlci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgbmFtZVxuICAgICAqIEBwYXJhbSBGdW5jdGlvbiBGYWN0b3J5XG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgZmFjdG9yeSA9IGZ1bmN0aW9uIGZhY3RvcnkobmFtZSwgRmFjdG9yeSkge1xuICAgICAgICByZXR1cm4gcHJvdmlkZXIuY2FsbCh0aGlzLCBuYW1lLCBmdW5jdGlvbiBHZW5lcmljUHJvdmlkZXIoKSB7XG4gICAgICAgICAgICB0aGlzLiRnZXQgPSBGYWN0b3J5O1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyIGFuIGluc3RhbmNlIGZhY3RvcnkgaW5zaWRlIGEgZ2VuZXJpYyBmYWN0b3J5LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtTdHJpbmd9IG5hbWUgLSBUaGUgbmFtZSBvZiB0aGUgc2VydmljZVxuICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IEZhY3RvcnkgLSBUaGUgZmFjdG9yeSBmdW5jdGlvbiwgbWF0Y2hlcyB0aGUgc2lnbmF0dXJlIHJlcXVpcmVkIGZvciB0aGVcbiAgICAgKiBgZmFjdG9yeWAgbWV0aG9kXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgaW5zdGFuY2VGYWN0b3J5ID0gZnVuY3Rpb24gaW5zdGFuY2VGYWN0b3J5KG5hbWUsIEZhY3RvcnkpIHtcbiAgICAgICAgcmV0dXJuIGZhY3RvcnkuY2FsbCh0aGlzLCBuYW1lLCBmdW5jdGlvbiBHZW5lcmljSW5zdGFuY2VGYWN0b3J5KGNvbnRhaW5lcikge1xuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZSA6IEZhY3RvcnkuYmluZChGYWN0b3J5LCBjb250YWluZXIpXG4gICAgICAgICAgICB9O1xuICAgICAgICB9KTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEEgZmlsdGVyIGZ1bmN0aW9uIGZvciByZW1vdmluZyBib3R0bGUgY29udGFpbmVyIG1ldGhvZHMgYW5kIHByb3ZpZGVycyBmcm9tIGEgbGlzdCBvZiBrZXlzXG4gICAgICovXG4gICAgdmFyIGJ5TWV0aG9kID0gZnVuY3Rpb24gYnlNZXRob2QobmFtZSkge1xuICAgICAgICByZXR1cm4gIS9eXFwkKD86ZGVjb3JhdG9yfHJlZ2lzdGVyfGxpc3QpJHxQcm92aWRlciQvLnRlc3QobmFtZSk7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBMaXN0IHRoZSBzZXJ2aWNlcyByZWdpc3RlcmVkIG9uIHRoZSBjb250YWluZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gT2JqZWN0IGNvbnRhaW5lclxuICAgICAqIEByZXR1cm4gQXJyYXlcbiAgICAgKi9cbiAgICB2YXIgbGlzdCA9IGZ1bmN0aW9uIGxpc3QoY29udGFpbmVyKSB7XG4gICAgICAgIHJldHVybiBPYmplY3Qua2V5cyhjb250YWluZXIgfHwgdGhpcy5jb250YWluZXIgfHwge30pLmZpbHRlcihieU1ldGhvZCk7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBGdW5jdGlvbiB1c2VkIGJ5IHByb3ZpZGVyIHRvIHNldCB1cCBtaWRkbGV3YXJlIGZvciBlYWNoIHJlcXVlc3QuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gTnVtYmVyIGlkXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHBhcmFtIE9iamVjdCBpbnN0YW5jZVxuICAgICAqIEBwYXJhbSBPYmplY3QgY29udGFpbmVyXG4gICAgICogQHJldHVybiB2b2lkXG4gICAgICovXG4gICAgdmFyIGFwcGx5TWlkZGxld2FyZSA9IGZ1bmN0aW9uIGFwcGx5TWlkZGxld2FyZShtaWRkbGV3YXJlLCBuYW1lLCBpbnN0YW5jZSwgY29udGFpbmVyKSB7XG4gICAgICAgIHZhciBkZXNjcmlwdG9yID0ge1xuICAgICAgICAgICAgY29uZmlndXJhYmxlIDogdHJ1ZSxcbiAgICAgICAgICAgIGVudW1lcmFibGUgOiB0cnVlXG4gICAgICAgIH07XG4gICAgICAgIGlmIChtaWRkbGV3YXJlLmxlbmd0aCkge1xuICAgICAgICAgICAgZGVzY3JpcHRvci5nZXQgPSBmdW5jdGlvbiBnZXRXaXRoTWlkZGxld2VhcigpIHtcbiAgICAgICAgICAgICAgICB2YXIgaW5kZXggPSAwO1xuICAgICAgICAgICAgICAgIHZhciBuZXh0ID0gZnVuY3Rpb24gbmV4dE1pZGRsZXdhcmUoZXJyKSB7XG4gICAgICAgICAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRocm93IGVycjtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICBpZiAobWlkZGxld2FyZVtpbmRleF0pIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIG1pZGRsZXdhcmVbaW5kZXgrK10oaW5zdGFuY2UsIG5leHQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICBuZXh0KCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGluc3RhbmNlO1xuICAgICAgICAgICAgfTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGRlc2NyaXB0b3IudmFsdWUgPSBpbnN0YW5jZTtcbiAgICAgICAgICAgIGRlc2NyaXB0b3Iud3JpdGFibGUgPSB0cnVlO1xuICAgICAgICB9XG4gICAgXG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShjb250YWluZXIsIG5hbWUsIGRlc2NyaXB0b3IpO1xuICAgIFxuICAgICAgICByZXR1cm4gY29udGFpbmVyW25hbWVdO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXIgbWlkZGxld2FyZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgbmFtZVxuICAgICAqIEBwYXJhbSBGdW5jdGlvbiBmdW5jXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgbWlkZGxld2FyZSA9IGZ1bmN0aW9uIG1pZGRsZXdhcmUoZnVsbG5hbWUsIGZ1bmMpIHtcbiAgICAgICAgdmFyIHBhcnRzLCBuYW1lO1xuICAgICAgICBpZiAodHlwZW9mIGZ1bGxuYW1lID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICBmdW5jID0gZnVsbG5hbWU7XG4gICAgICAgICAgICBmdWxsbmFtZSA9ICdfX2dsb2JhbF9fJztcbiAgICAgICAgfVxuICAgIFxuICAgICAgICBwYXJ0cyA9IGZ1bGxuYW1lLnNwbGl0KCcuJyk7XG4gICAgICAgIG5hbWUgPSBwYXJ0cy5zaGlmdCgpO1xuICAgICAgICBpZiAocGFydHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBnZXROZXN0ZWRCb3R0bGUuY2FsbCh0aGlzLCBuYW1lKS5taWRkbGV3YXJlKHBhcnRzLmpvaW4oJy4nKSwgZnVuYyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAoIXRoaXMubWlkZGxld2FyZXNbbmFtZV0pIHtcbiAgICAgICAgICAgICAgICB0aGlzLm1pZGRsZXdhcmVzW25hbWVdID0gW107XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLm1pZGRsZXdhcmVzW25hbWVdLnB1c2goZnVuYyk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBOYW1lZCBib3R0bGUgaW5zdGFuY2VzXG4gICAgICpcbiAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgKi9cbiAgICB2YXIgYm90dGxlcyA9IHt9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEdldCBhbiBpbnN0YW5jZSBvZiBib3R0bGUuXG4gICAgICpcbiAgICAgKiBJZiBhIG5hbWUgaXMgcHJvdmlkZWQgdGhlIGluc3RhbmNlIHdpbGwgYmUgc3RvcmVkIGluIGEgbG9jYWwgaGFzaC4gIENhbGxpbmcgQm90dGxlLnBvcCBtdWx0aXBsZVxuICAgICAqIHRpbWVzIHdpdGggdGhlIHNhbWUgbmFtZSB3aWxsIHJldHVybiB0aGUgc2FtZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgbmFtZVxuICAgICAqIEByZXR1cm4gQm90dGxlXG4gICAgICovXG4gICAgdmFyIHBvcCA9IGZ1bmN0aW9uIHBvcChuYW1lKSB7XG4gICAgICAgIHZhciBpbnN0YW5jZTtcbiAgICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSAnc3RyaW5nJykge1xuICAgICAgICAgICAgaW5zdGFuY2UgPSBib3R0bGVzW25hbWVdO1xuICAgICAgICAgICAgaWYgKCFpbnN0YW5jZSkge1xuICAgICAgICAgICAgICAgIGJvdHRsZXNbbmFtZV0gPSBpbnN0YW5jZSA9IG5ldyBCb3R0bGUoKTtcbiAgICAgICAgICAgICAgICBpbnN0YW5jZS5jb25zdGFudCgnQk9UVExFX05BTUUnLCBuYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gbmV3IEJvdHRsZSgpO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogQ2xlYXIgYWxsIG5hbWVkIGJvdHRsZXMuXG4gICAgICovXG4gICAgdmFyIGNsZWFyID0gZnVuY3Rpb24gY2xlYXIobmFtZSkge1xuICAgICAgICBpZiAodHlwZW9mIG5hbWUgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgICBkZWxldGUgYm90dGxlc1tuYW1lXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGJvdHRsZXMgPSB7fTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogVXNlZCB0byBwcm9jZXNzIGRlY29yYXRvcnMgaW4gdGhlIHByb3ZpZGVyXG4gICAgICpcbiAgICAgKiBAcGFyYW0gT2JqZWN0IGluc3RhbmNlXG4gICAgICogQHBhcmFtIEZ1bmN0aW9uIGZ1bmNcbiAgICAgKiBAcmV0dXJuIE1peGVkXG4gICAgICovXG4gICAgdmFyIHJlZHVjZXIgPSBmdW5jdGlvbiByZWR1Y2VyKGluc3RhbmNlLCBmdW5jKSB7XG4gICAgICAgIHJldHVybiBmdW5jKGluc3RhbmNlKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyIGEgcHJvdmlkZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIGZ1bGxuYW1lXG4gICAgICogQHBhcmFtIEZ1bmN0aW9uIFByb3ZpZGVyXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgcHJvdmlkZXIgPSBmdW5jdGlvbiBwcm92aWRlcihmdWxsbmFtZSwgUHJvdmlkZXIpIHtcbiAgICAgICAgdmFyIHBhcnRzLCBuYW1lO1xuICAgICAgICBwYXJ0cyA9IGZ1bGxuYW1lLnNwbGl0KCcuJyk7XG4gICAgICAgIGlmICh0aGlzLnByb3ZpZGVyTWFwW2Z1bGxuYW1lXSAmJiBwYXJ0cy5sZW5ndGggPT09IDEgJiYgIXRoaXMuY29udGFpbmVyW2Z1bGxuYW1lICsgJ1Byb3ZpZGVyJ10pIHtcbiAgICAgICAgICAgIHJldHVybiBjb25zb2xlLmVycm9yKGZ1bGxuYW1lICsgJyBwcm92aWRlciBhbHJlYWR5IGluc3RhbnRpYXRlZC4nKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLm9yaWdpbmFsUHJvdmlkZXJzW2Z1bGxuYW1lXSA9IFByb3ZpZGVyO1xuICAgICAgICB0aGlzLnByb3ZpZGVyTWFwW2Z1bGxuYW1lXSA9IHRydWU7XG4gICAgXG4gICAgICAgIG5hbWUgPSBwYXJ0cy5zaGlmdCgpO1xuICAgIFxuICAgICAgICBpZiAocGFydHMubGVuZ3RoKSB7XG4gICAgICAgICAgICBjcmVhdGVTdWJQcm92aWRlci5jYWxsKHRoaXMsIG5hbWUsIFByb3ZpZGVyLCBwYXJ0cyk7XG4gICAgICAgICAgICByZXR1cm4gdGhpcztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gY3JlYXRlUHJvdmlkZXIuY2FsbCh0aGlzLCBuYW1lLCBQcm92aWRlcik7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBHZXQgZGVjb3JhdG9ycyBhbmQgbWlkZGxld2FyZSBpbmNsdWRpbmcgZ2xvYmFsc1xuICAgICAqXG4gICAgICogQHJldHVybiBhcnJheVxuICAgICAqL1xuICAgIHZhciBnZXRXaXRoR2xvYmFsID0gZnVuY3Rpb24gZ2V0V2l0aEdsb2JhbChjb2xsZWN0aW9uLCBuYW1lKSB7XG4gICAgICAgIHJldHVybiAoY29sbGVjdGlvbltuYW1lXSB8fCBbXSkuY29uY2F0KGNvbGxlY3Rpb24uX19nbG9iYWxfXyB8fCBbXSk7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBDcmVhdGUgdGhlIHByb3ZpZGVyIHByb3BlcnRpZXMgb24gdGhlIGNvbnRhaW5lclxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHBhcmFtIEZ1bmN0aW9uIFByb3ZpZGVyXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgY3JlYXRlUHJvdmlkZXIgPSBmdW5jdGlvbiBjcmVhdGVQcm92aWRlcihuYW1lLCBQcm92aWRlcikge1xuICAgICAgICB2YXIgcHJvdmlkZXJOYW1lLCBwcm9wZXJ0aWVzLCBjb250YWluZXIsIGlkLCBkZWNvcmF0b3JzLCBtaWRkbGV3YXJlcztcbiAgICBcbiAgICAgICAgaWQgPSB0aGlzLmlkO1xuICAgICAgICBjb250YWluZXIgPSB0aGlzLmNvbnRhaW5lcjtcbiAgICAgICAgZGVjb3JhdG9ycyA9IHRoaXMuZGVjb3JhdG9ycztcbiAgICAgICAgbWlkZGxld2FyZXMgPSB0aGlzLm1pZGRsZXdhcmVzO1xuICAgICAgICBwcm92aWRlck5hbWUgPSBuYW1lICsgJ1Byb3ZpZGVyJztcbiAgICBcbiAgICAgICAgcHJvcGVydGllcyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gICAgICAgIHByb3BlcnRpZXNbcHJvdmlkZXJOYW1lXSA9IHtcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZSA6IHRydWUsXG4gICAgICAgICAgICBlbnVtZXJhYmxlIDogdHJ1ZSxcbiAgICAgICAgICAgIGdldCA6IGZ1bmN0aW9uIGdldFByb3ZpZGVyKCkge1xuICAgICAgICAgICAgICAgIHZhciBpbnN0YW5jZSA9IG5ldyBQcm92aWRlcigpO1xuICAgICAgICAgICAgICAgIGRlbGV0ZSBjb250YWluZXJbcHJvdmlkZXJOYW1lXTtcbiAgICAgICAgICAgICAgICBjb250YWluZXJbcHJvdmlkZXJOYW1lXSA9IGluc3RhbmNlO1xuICAgICAgICAgICAgICAgIHJldHVybiBpbnN0YW5jZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICBcbiAgICAgICAgcHJvcGVydGllc1tuYW1lXSA9IHtcbiAgICAgICAgICAgIGNvbmZpZ3VyYWJsZSA6IHRydWUsXG4gICAgICAgICAgICBlbnVtZXJhYmxlIDogdHJ1ZSxcbiAgICAgICAgICAgIGdldCA6IGZ1bmN0aW9uIGdldFNlcnZpY2UoKSB7XG4gICAgICAgICAgICAgICAgdmFyIHByb3ZpZGVyID0gY29udGFpbmVyW3Byb3ZpZGVyTmFtZV07XG4gICAgICAgICAgICAgICAgdmFyIGluc3RhbmNlO1xuICAgICAgICAgICAgICAgIGlmIChwcm92aWRlcikge1xuICAgICAgICAgICAgICAgICAgICAvLyBmaWx0ZXIgdGhyb3VnaCBkZWNvcmF0b3JzXG4gICAgICAgICAgICAgICAgICAgIGluc3RhbmNlID0gZ2V0V2l0aEdsb2JhbChkZWNvcmF0b3JzLCBuYW1lKS5yZWR1Y2UocmVkdWNlciwgcHJvdmlkZXIuJGdldChjb250YWluZXIpKTtcbiAgICBcbiAgICAgICAgICAgICAgICAgICAgZGVsZXRlIGNvbnRhaW5lcltwcm92aWRlck5hbWVdO1xuICAgICAgICAgICAgICAgICAgICBkZWxldGUgY29udGFpbmVyW25hbWVdO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gaW5zdGFuY2UgPT09IHVuZGVmaW5lZCA/IGluc3RhbmNlIDogYXBwbHlNaWRkbGV3YXJlKGdldFdpdGhHbG9iYWwobWlkZGxld2FyZXMsIG5hbWUpLFxuICAgICAgICAgICAgICAgICAgICBuYW1lLCBpbnN0YW5jZSwgY29udGFpbmVyKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfTtcbiAgICBcbiAgICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoY29udGFpbmVyLCBwcm9wZXJ0aWVzKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBDcmVhdGVzIGEgYm90dGxlIGNvbnRhaW5lciBvbiB0aGUgY3VycmVudCBib3R0bGUgY29udGFpbmVyLCBhbmQgcmVnaXN0ZXJzXG4gICAgICogdGhlIHByb3ZpZGVyIHVuZGVyIHRoZSBzdWIgY29udGFpbmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHBhcmFtIEZ1bmN0aW9uIFByb3ZpZGVyXG4gICAgICogQHBhcmFtIEFycmF5IHBhcnRzXG4gICAgICogQHJldHVybiBCb3R0bGVcbiAgICAgKi9cbiAgICB2YXIgY3JlYXRlU3ViUHJvdmlkZXIgPSBmdW5jdGlvbiBjcmVhdGVTdWJQcm92aWRlcihuYW1lLCBQcm92aWRlciwgcGFydHMpIHtcbiAgICAgICAgdmFyIGJvdHRsZTtcbiAgICAgICAgYm90dGxlID0gZ2V0TmVzdGVkQm90dGxlLmNhbGwodGhpcywgbmFtZSk7XG4gICAgICAgIHRoaXMuZmFjdG9yeShuYW1lLCBmdW5jdGlvbiBTdWJQcm92aWRlckZhY3RvcnkoKSB7XG4gICAgICAgICAgICByZXR1cm4gYm90dGxlLmNvbnRhaW5lcjtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiBib3R0bGUucHJvdmlkZXIocGFydHMuam9pbignLicpLCBQcm92aWRlcik7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBSZWdpc3RlciBhIHNlcnZpY2UsIGZhY3RvcnksIHByb3ZpZGVyLCBvciB2YWx1ZSBiYXNlZCBvbiBwcm9wZXJ0aWVzIG9uIHRoZSBvYmplY3QuXG4gICAgICpcbiAgICAgKiBwcm9wZXJ0aWVzOlxuICAgICAqICAqIE9iai4kbmFtZSAgIFN0cmluZyByZXF1aXJlZCBleDogYCdUaGluZydgXG4gICAgICogICogT2JqLiR0eXBlICAgU3RyaW5nIG9wdGlvbmFsICdzZXJ2aWNlJywgJ2ZhY3RvcnknLCAncHJvdmlkZXInLCAndmFsdWUnLiAgRGVmYXVsdDogJ3NlcnZpY2UnXG4gICAgICogICogT2JqLiRpbmplY3QgTWl4ZWQgIG9wdGlvbmFsIG9ubHkgdXNlZnVsIHdpdGggJHR5cGUgJ3NlcnZpY2UnIG5hbWUgb3IgYXJyYXkgb2YgbmFtZXNcbiAgICAgKiAgKiBPYmouJHZhbHVlICBNaXhlZCAgb3B0aW9uYWwgTm9ybWFsbHkgT2JqIGlzIHJlZ2lzdGVyZWQgb24gdGhlIGNvbnRhaW5lci4gIEhvd2V2ZXIsIGlmIHRoaXNcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgcHJvcGVydHkgaXMgaW5jbHVkZWQsIGl0J3MgdmFsdWUgd2lsbCBiZSByZWdpc3RlcmVkIG9uIHRoZSBjb250YWluZXJcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgaW5zdGVhZCBvZiB0aGUgb2JqZWN0IGl0c3NlbGYuICBVc2VmdWwgZm9yIHJlZ2lzdGVyaW5nIG9iamVjdHMgb24gdGhlXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgIGJvdHRsZSBjb250YWluZXIgd2l0aG91dCBtb2RpZnlpbmcgdGhvc2Ugb2JqZWN0cyB3aXRoIGJvdHRsZSBzcGVjaWZpYyBrZXlzLlxuICAgICAqXG4gICAgICogQHBhcmFtIEZ1bmN0aW9uIE9ialxuICAgICAqIEByZXR1cm4gQm90dGxlXG4gICAgICovXG4gICAgdmFyIHJlZ2lzdGVyID0gZnVuY3Rpb24gcmVnaXN0ZXIoT2JqKSB7XG4gICAgICAgIHZhciB2YWx1ZSA9IE9iai4kdmFsdWUgPT09IHVuZGVmaW5lZCA/IE9iaiA6IE9iai4kdmFsdWU7XG4gICAgICAgIHJldHVybiB0aGlzW09iai4kdHlwZSB8fCAnc2VydmljZSddLmFwcGx5KHRoaXMsIFtPYmouJG5hbWUsIHZhbHVlXS5jb25jYXQoT2JqLiRpbmplY3QgfHwgW10pKTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIERlbGV0ZXMgcHJvdmlkZXJzIGZyb20gdGhlIG1hcCBhbmQgY29udGFpbmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHJldHVybiB2b2lkXG4gICAgICovXG4gICAgdmFyIHJlbW92ZVByb3ZpZGVyTWFwID0gZnVuY3Rpb24gcmVzZXRQcm92aWRlcihuYW1lKSB7XG4gICAgICAgIGRlbGV0ZSB0aGlzLnByb3ZpZGVyTWFwW25hbWVdO1xuICAgICAgICBkZWxldGUgdGhpcy5jb250YWluZXJbbmFtZV07XG4gICAgICAgIGRlbGV0ZSB0aGlzLmNvbnRhaW5lcltuYW1lICsgJ1Byb3ZpZGVyJ107XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBSZXNldHMgYWxsIHByb3ZpZGVycyBvbiBhIGJvdHRsZSBpbnN0YW5jZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm4gdm9pZFxuICAgICAqL1xuICAgIHZhciByZXNldFByb3ZpZGVycyA9IGZ1bmN0aW9uIHJlc2V0UHJvdmlkZXJzKCkge1xuICAgICAgICB2YXIgcHJvdmlkZXJzID0gdGhpcy5vcmlnaW5hbFByb3ZpZGVycztcbiAgICAgICAgT2JqZWN0LmtleXModGhpcy5vcmlnaW5hbFByb3ZpZGVycykuZm9yRWFjaChmdW5jdGlvbiByZXNldFBydmlkZXIocHJvdmlkZXIpIHtcbiAgICAgICAgICAgIHZhciBwYXJ0cyA9IHByb3ZpZGVyLnNwbGl0KCcuJyk7XG4gICAgICAgICAgICBpZiAocGFydHMubGVuZ3RoID4gMSkge1xuICAgICAgICAgICAgICAgIHJlbW92ZVByb3ZpZGVyTWFwLmNhbGwodGhpcywgcGFydHNbMF0pO1xuICAgICAgICAgICAgICAgIHBhcnRzLmZvckVhY2gocmVtb3ZlUHJvdmlkZXJNYXAsIGdldE5lc3RlZEJvdHRsZS5jYWxsKHRoaXMsIHBhcnRzWzBdKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZW1vdmVQcm92aWRlck1hcC5jYWxsKHRoaXMsIHByb3ZpZGVyKTtcbiAgICAgICAgICAgIHRoaXMucHJvdmlkZXIocHJvdmlkZXIsIHByb3ZpZGVyc1twcm92aWRlcl0pO1xuICAgICAgICB9LCB0aGlzKTtcbiAgICB9O1xuICAgIFxuICAgIFxuICAgIC8qKlxuICAgICAqIEV4ZWN1dGUgYW55IGRlZmVycmVkIGZ1bmN0aW9uc1xuICAgICAqXG4gICAgICogQHBhcmFtIE1peGVkIGRhdGFcbiAgICAgKiBAcmV0dXJuIEJvdHRsZVxuICAgICAqL1xuICAgIHZhciByZXNvbHZlID0gZnVuY3Rpb24gcmVzb2x2ZShkYXRhKSB7XG4gICAgICAgIHRoaXMuZGVmZXJyZWQuZm9yRWFjaChmdW5jdGlvbiBkZWZlcnJlZEl0ZXJhdG9yKGZ1bmMpIHtcbiAgICAgICAgICAgIGZ1bmMoZGF0YSk7XG4gICAgICAgIH0pO1xuICAgIFxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIFJlZ2lzdGVyIGEgc2VydmljZSBpbnNpZGUgYSBnZW5lcmljIGZhY3RvcnkuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gU3RyaW5nIG5hbWVcbiAgICAgKiBAcGFyYW0gRnVuY3Rpb24gU2VydmljZVxuICAgICAqIEByZXR1cm4gQm90dGxlXG4gICAgICovXG4gICAgdmFyIHNlcnZpY2UgPSBmdW5jdGlvbiBzZXJ2aWNlKG5hbWUsIFNlcnZpY2UpIHtcbiAgICAgICAgdmFyIGRlcHMgPSBhcmd1bWVudHMubGVuZ3RoID4gMiA/IHNsaWNlLmNhbGwoYXJndW1lbnRzLCAyKSA6IG51bGw7XG4gICAgICAgIHZhciBib3R0bGUgPSB0aGlzO1xuICAgICAgICByZXR1cm4gZmFjdG9yeS5jYWxsKHRoaXMsIG5hbWUsIGZ1bmN0aW9uIEdlbmVyaWNGYWN0b3J5KCkge1xuICAgICAgICAgICAgdmFyIFNlcnZpY2VDb3B5ID0gU2VydmljZTtcbiAgICAgICAgICAgIGlmIChkZXBzKSB7XG4gICAgICAgICAgICAgICAgdmFyIGFyZ3MgPSBkZXBzLm1hcChnZXROZXN0ZWRTZXJ2aWNlLCBib3R0bGUuY29udGFpbmVyKTtcbiAgICAgICAgICAgICAgICBhcmdzLnVuc2hpZnQoU2VydmljZSk7XG4gICAgICAgICAgICAgICAgU2VydmljZUNvcHkgPSBTZXJ2aWNlLmJpbmQuYXBwbHkoU2VydmljZSwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmV3IFNlcnZpY2VDb3B5KCk7XG4gICAgICAgIH0pO1xuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogUmVnaXN0ZXIgYSB2YWx1ZVxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lXG4gICAgICogQHBhcmFtIG1peGVkIHZhbFxuICAgICAqIEByZXR1cm4gQm90dGxlXG4gICAgICovXG4gICAgdmFyIHZhbHVlID0gZnVuY3Rpb24gdmFsdWUobmFtZSwgdmFsKSB7XG4gICAgICAgIHZhciBwYXJ0cztcbiAgICAgICAgcGFydHMgPSBuYW1lLnNwbGl0KCcuJyk7XG4gICAgICAgIG5hbWUgPSBwYXJ0cy5wb3AoKTtcbiAgICAgICAgZGVmaW5lVmFsdWUuY2FsbChwYXJ0cy5yZWR1Y2Uoc2V0VmFsdWVPYmplY3QsIHRoaXMuY29udGFpbmVyKSwgbmFtZSwgdmFsKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfTtcbiAgICBcbiAgICAvKipcbiAgICAgKiBJdGVyYXRvciBmb3Igc2V0dGluZyBhIHBsYWluIG9iamVjdCBsaXRlcmFsIHZpYSBkZWZpbmVWYWx1ZVxuICAgICAqXG4gICAgICogQHBhcmFtIE9iamVjdCBjb250YWluZXJcbiAgICAgKiBAcGFyYW0gc3RyaW5nIG5hbWVcbiAgICAgKi9cbiAgICB2YXIgc2V0VmFsdWVPYmplY3QgPSBmdW5jdGlvbiBzZXRWYWx1ZU9iamVjdChjb250YWluZXIsIG5hbWUpIHtcbiAgICAgICAgdmFyIG5lc3RlZENvbnRhaW5lciA9IGNvbnRhaW5lcltuYW1lXTtcbiAgICAgICAgaWYgKCFuZXN0ZWRDb250YWluZXIpIHtcbiAgICAgICAgICAgIG5lc3RlZENvbnRhaW5lciA9IHt9O1xuICAgICAgICAgICAgZGVmaW5lVmFsdWUuY2FsbChjb250YWluZXIsIG5hbWUsIG5lc3RlZENvbnRhaW5lcik7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5lc3RlZENvbnRhaW5lcjtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIERlZmluZSBhIG11dGFibGUgcHJvcGVydHkgb24gdGhlIGNvbnRhaW5lci5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBTdHJpbmcgbmFtZVxuICAgICAqIEBwYXJhbSBtaXhlZCB2YWxcbiAgICAgKiBAcmV0dXJuIHZvaWRcbiAgICAgKiBAc2NvcGUgY29udGFpbmVyXG4gICAgICovXG4gICAgdmFyIGRlZmluZVZhbHVlID0gZnVuY3Rpb24gZGVmaW5lVmFsdWUobmFtZSwgdmFsKSB7XG4gICAgICAgIE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0aGlzLCBuYW1lLCB7XG4gICAgICAgICAgICBjb25maWd1cmFibGUgOiB0cnVlLFxuICAgICAgICAgICAgZW51bWVyYWJsZSA6IHRydWUsXG4gICAgICAgICAgICB2YWx1ZSA6IHZhbCxcbiAgICAgICAgICAgIHdyaXRhYmxlIDogdHJ1ZVxuICAgICAgICB9KTtcbiAgICB9O1xuICAgIFxuICAgIFxuICAgIC8qKlxuICAgICAqIEJvdHRsZSBjb25zdHJ1Y3RvclxuICAgICAqXG4gICAgICogQHBhcmFtIFN0cmluZyBuYW1lIE9wdGlvbmFsIG5hbWUgZm9yIGZ1bmN0aW9uYWwgY29uc3RydWN0aW9uXG4gICAgICovXG4gICAgdmFyIEJvdHRsZSA9IGZ1bmN0aW9uIEJvdHRsZShuYW1lKSB7XG4gICAgICAgIGlmICghKHRoaXMgaW5zdGFuY2VvZiBCb3R0bGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gQm90dGxlLnBvcChuYW1lKTtcbiAgICAgICAgfVxuICAgIFxuICAgICAgICB0aGlzLmlkID0gaWQrKztcbiAgICBcbiAgICAgICAgdGhpcy5kZWNvcmF0b3JzID0ge307XG4gICAgICAgIHRoaXMubWlkZGxld2FyZXMgPSB7fTtcbiAgICAgICAgdGhpcy5uZXN0ZWQgPSB7fTtcbiAgICAgICAgdGhpcy5wcm92aWRlck1hcCA9IHt9O1xuICAgICAgICB0aGlzLm9yaWdpbmFsUHJvdmlkZXJzID0ge307XG4gICAgICAgIHRoaXMuZGVmZXJyZWQgPSBbXTtcbiAgICAgICAgdGhpcy5jb250YWluZXIgPSB7XG4gICAgICAgICAgICAkZGVjb3JhdG9yIDogZGVjb3JhdG9yLmJpbmQodGhpcyksXG4gICAgICAgICAgICAkcmVnaXN0ZXIgOiByZWdpc3Rlci5iaW5kKHRoaXMpLFxuICAgICAgICAgICAgJGxpc3QgOiBsaXN0LmJpbmQodGhpcylcbiAgICAgICAgfTtcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEJvdHRsZSBwcm90b3R5cGVcbiAgICAgKi9cbiAgICBCb3R0bGUucHJvdG90eXBlID0ge1xuICAgICAgICBjb25zdGFudCA6IGNvbnN0YW50LFxuICAgICAgICBkZWNvcmF0b3IgOiBkZWNvcmF0b3IsXG4gICAgICAgIGRlZmVyIDogZGVmZXIsXG4gICAgICAgIGRpZ2VzdCA6IGRpZ2VzdCxcbiAgICAgICAgZmFjdG9yeSA6IGZhY3RvcnksXG4gICAgICAgIGluc3RhbmNlRmFjdG9yeTogaW5zdGFuY2VGYWN0b3J5LFxuICAgICAgICBsaXN0IDogbGlzdCxcbiAgICAgICAgbWlkZGxld2FyZSA6IG1pZGRsZXdhcmUsXG4gICAgICAgIHByb3ZpZGVyIDogcHJvdmlkZXIsXG4gICAgICAgIHJlc2V0UHJvdmlkZXJzIDogcmVzZXRQcm92aWRlcnMsXG4gICAgICAgIHJlZ2lzdGVyIDogcmVnaXN0ZXIsXG4gICAgICAgIHJlc29sdmUgOiByZXNvbHZlLFxuICAgICAgICBzZXJ2aWNlIDogc2VydmljZSxcbiAgICAgICAgdmFsdWUgOiB2YWx1ZVxuICAgIH07XG4gICAgXG4gICAgLyoqXG4gICAgICogQm90dGxlIHN0YXRpY1xuICAgICAqL1xuICAgIEJvdHRsZS5wb3AgPSBwb3A7XG4gICAgQm90dGxlLmNsZWFyID0gY2xlYXI7XG4gICAgQm90dGxlLmxpc3QgPSBsaXN0O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEdsb2JhbCBjb25maWdcbiAgICAgKi9cbiAgICB2YXIgZ2xvYmFsQ29uZmlnID0gQm90dGxlLmNvbmZpZyA9IHtcbiAgICAgICAgc3RyaWN0IDogZmFsc2VcbiAgICB9O1xuICAgIFxuICAgIC8qKlxuICAgICAqIEV4cG9ydHMgc2NyaXB0IGFkYXB0ZWQgZnJvbSBsb2Rhc2ggdjIuNC4xIE1vZGVybiBCdWlsZFxuICAgICAqXG4gICAgICogQHNlZSBodHRwOi8vbG9kYXNoLmNvbS9cbiAgICAgKi9cbiAgICBcbiAgICAvKipcbiAgICAgKiBWYWxpZCBvYmplY3QgdHlwZSBtYXBcbiAgICAgKlxuICAgICAqIEB0eXBlIE9iamVjdFxuICAgICAqL1xuICAgIHZhciBvYmplY3RUeXBlcyA9IHtcbiAgICAgICAgJ2Z1bmN0aW9uJyA6IHRydWUsXG4gICAgICAgICdvYmplY3QnIDogdHJ1ZVxuICAgIH07XG4gICAgXG4gICAgKGZ1bmN0aW9uIGV4cG9ydEJvdHRsZShyb290KSB7XG4gICAgXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBGcmVlIHZhcmlhYmxlIGV4cG9ydHNcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUgRnVuY3Rpb25cbiAgICAgICAgICovXG4gICAgICAgIHZhciBmcmVlRXhwb3J0cyA9IG9iamVjdFR5cGVzW3R5cGVvZiBleHBvcnRzXSAmJiBleHBvcnRzICYmICFleHBvcnRzLm5vZGVUeXBlICYmIGV4cG9ydHM7XG4gICAgXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBGcmVlIHZhcmlhYmxlIG1vZHVsZVxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgICAgICovXG4gICAgICAgIHZhciBmcmVlTW9kdWxlID0gb2JqZWN0VHlwZXNbdHlwZW9mIG1vZHVsZV0gJiYgbW9kdWxlICYmICFtb2R1bGUubm9kZVR5cGUgJiYgbW9kdWxlO1xuICAgIFxuICAgICAgICAvKipcbiAgICAgICAgICogQ29tbW9uSlMgbW9kdWxlLmV4cG9ydHNcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUgRnVuY3Rpb25cbiAgICAgICAgICovXG4gICAgICAgIHZhciBtb2R1bGVFeHBvcnRzID0gZnJlZU1vZHVsZSAmJiBmcmVlTW9kdWxlLmV4cG9ydHMgPT09IGZyZWVFeHBvcnRzICYmIGZyZWVFeHBvcnRzO1xuICAgIFxuICAgICAgICAvKipcbiAgICAgICAgICogRnJlZSB2YXJpYWJsZSBgZ2xvYmFsYFxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSBPYmplY3RcbiAgICAgICAgICovXG4gICAgICAgIHZhciBmcmVlR2xvYmFsID0gb2JqZWN0VHlwZXNbdHlwZW9mIGdsb2JhbF0gJiYgZ2xvYmFsO1xuICAgICAgICBpZiAoZnJlZUdsb2JhbCAmJiAoZnJlZUdsb2JhbC5nbG9iYWwgPT09IGZyZWVHbG9iYWwgfHwgZnJlZUdsb2JhbC53aW5kb3cgPT09IGZyZWVHbG9iYWwpKSB7XG4gICAgICAgICAgICByb290ID0gZnJlZUdsb2JhbDtcbiAgICAgICAgfVxuICAgIFxuICAgICAgICAvKipcbiAgICAgICAgICogRXhwb3J0XG4gICAgICAgICAqL1xuICAgICAgICBpZiAodHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiB0eXBlb2YgZGVmaW5lLmFtZCA9PT0gJ29iamVjdCcgJiYgZGVmaW5lLmFtZCkge1xuICAgICAgICAgICAgcm9vdC5Cb3R0bGUgPSBCb3R0bGU7XG4gICAgICAgICAgICBkZWZpbmUoZnVuY3Rpb24oKSB7IHJldHVybiBCb3R0bGU7IH0pO1xuICAgICAgICB9IGVsc2UgaWYgKGZyZWVFeHBvcnRzICYmIGZyZWVNb2R1bGUpIHtcbiAgICAgICAgICAgIGlmIChtb2R1bGVFeHBvcnRzKSB7XG4gICAgICAgICAgICAgICAgKGZyZWVNb2R1bGUuZXhwb3J0cyA9IEJvdHRsZSkuQm90dGxlID0gQm90dGxlO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBmcmVlRXhwb3J0cy5Cb3R0bGUgPSBCb3R0bGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByb290LkJvdHRsZSA9IEJvdHRsZTtcbiAgICAgICAgfVxuICAgIH0oKG9iamVjdFR5cGVzW3R5cGVvZiB3aW5kb3ddICYmIHdpbmRvdykgfHwgdGhpcykpO1xuICAgIFxufS5jYWxsKHRoaXMpKTsiLCJjb25zdCBndWlkID0gcmVxdWlyZSgnLi9ndWlkJyk7XG5jb25zdCBjb250YWluZXIgPSByZXF1aXJlKCcuL2NvbnRhaW5lcicpO1xuXG5jb25zdCBjbG9uZSA9IChvYmopID0+IHtcblx0Y29uc3QgYyA9IHt9O1xuXHRmb3IgKGxldCBrZXkgaW4gb2JqKSB7XG5cdFx0Y1trZXldID0gb2JqW2tleV07XG5cdH1cblx0cmV0dXJuIGM7XG59O1xuXG5jbGFzcyBBcHAge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHR0aGlzLm1hcCA9IHt9O1xuXHRcdHRoaXMuX3N0YXJ0TWFwID0ge307XG5cdFx0dGhpcy5fZGVzdHJveU1hcCA9IHt9O1xuXG5cdFx0dGhpcy5yZW5kZXJlciA9IGNvbnRhaW5lci5yZW5kZXJlcjtcblx0XHR0aGlzLmFuaW1hdGUgPSB0aGlzLmFuaW1hdGUuYmluZCh0aGlzKTtcblx0XHRcblx0XHRjb250YWluZXIuYXBwID0gdGhpcztcblx0fVxuXG5cdGFkZCh0eXBlLCBwcm9wcykge1xuXHRcdGNvbnN0IGNvbXBvbmVudCA9IG5ldyB0eXBlKHByb3BzKTtcblx0XHRjb21wb25lbnQuX2lkID0gZ3VpZCgpO1xuXHRcdHRoaXMubWFwW2NvbXBvbmVudC5faWRdID0gY29tcG9uZW50O1xuXHRcdHRoaXMuX3N0YXJ0TWFwW2NvbXBvbmVudC5faWRdID0gY29tcG9uZW50O1xuXHRcdHJldHVybiBjb21wb25lbnQ7XG5cdH1cblxuXHRkZXN0cm95KGNvbXBvbmVudCkge1xuXHRcdHRoaXMuX2Rlc3Ryb3lNYXBbY29tcG9uZW50Ll9pZF0gPSBjb21wb25lbnQ7XG5cdH1cblxuXHR0aWNrKGR0KSB7XG5cdFx0bGV0IGlkLCBjb21wb25lbnQ7XG5cblx0XHRjb25zdCBfc3RhcnRNYXAgPSBjbG9uZSh0aGlzLl9zdGFydE1hcCk7XG5cdFx0dGhpcy5fc3RhcnRNYXAgPSB7fTtcblxuXHRcdGZvciAoaWQgaW4gX3N0YXJ0TWFwKSB7XG5cdFx0XHRjb21wb25lbnQgPSBfc3RhcnRNYXBbaWRdO1xuXHRcdFx0aWYgKGNvbXBvbmVudC5zdGFydCAhPSBudWxsKSB7XG5cdFx0XHRcdGNvbXBvbmVudC5zdGFydCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAoaWQgaW4gdGhpcy5tYXApIHtcblx0XHRcdGNvbXBvbmVudCA9IHRoaXMubWFwW2lkXTtcblx0XHRcdGlmIChjb21wb25lbnQudGljayAhPSBudWxsKSB7XG5cdFx0XHRcdGNvbXBvbmVudC50aWNrKGR0KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBfZGVzdHJveU1hcCA9IGNsb25lKHRoaXMuX2Rlc3Ryb3lNYXApO1xuXHRcdHRoaXMuX2Rlc3Ryb3lNYXAgPSB7fTtcblx0XHRcblx0XHRmb3IgKGlkIGluIF9kZXN0cm95TWFwKSB7XG5cdFx0XHRjb21wb25lbnQgPSBfZGVzdHJveU1hcFtpZF07XG5cdFx0XHRpZiAoY29tcG9uZW50LmRlc3Ryb3kgIT0gbnVsbCkge1xuXHRcdFx0XHRjb21wb25lbnQuZGVzdHJveSgpO1xuXHRcdFx0fVxuXHRcdFx0ZGVsZXRlIHRoaXMubWFwW2NvbXBvbmVudC5faWRdO1xuXHRcdH1cblxuXHRcdHRoaXMucmVuZGVyZXIucmVuZGVyKCk7XG5cdH1cblxuXHRhbmltYXRlKCkge1xuXHRcdGNvbnN0IGZyYW1lUmF0ZSA9IDEwMDAgLyA2MDtcblx0XHR0aGlzLnRpY2soZnJhbWVSYXRlIC8gMTAwMCk7XG5cdFx0cmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRoaXMuYW5pbWF0ZSk7XG5cdH1cblxuXHRzdGFydCgpIHtcblx0XHR0aGlzLmFuaW1hdGUoKTtcblx0fVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBuZXcgQXBwKCk7IiwiY29uc3QgY29udGFpbmVyID0gcmVxdWlyZSgnLi4vY29udGFpbmVyJyk7XG5jb25zdCByYW5kb21RdWF0ZXJuaW9uID0gcmVxdWlyZSgnLi4vdXRpbHMvbWF0aCcpLnJhbmRvbVF1YXRlcm5pb247XG5cbmNsYXNzIEFzdGVyb2lkIHtcblx0Y29uc3RydWN0b3IocHJvcHMpIHtcblx0XHR0aGlzLnNjZW5lID0gY29udGFpbmVyLnNjZW5lO1xuXHRcdGNvbnN0IGdlb21ldHJ5ID0gbmV3IFRIUkVFLkJveEdlb21ldHJ5KDEwLCAxMCwgMTApO1xuXHRcdHRoaXMub2JqZWN0ID0gbmV3IFRIUkVFLk1lc2goZ2VvbWV0cnkpO1xuXHRcdHRoaXMub2JqZWN0LnF1YXRlcm5pb24uY29weShyYW5kb21RdWF0ZXJuaW9uKCkpO1xuXHR9XG5cblx0c3RhcnQoKSB7XG5cdFx0dGhpcy5zY2VuZS5hZGQodGhpcy5vYmplY3QpO1xuXHR9XG5cblx0dGljayhkdCkge1xuXG5cdH1cblxuXHRkZXN0cm95KCkge1xuXHRcdHRoaXMuc2NlbmUucmVtb3ZlKHRoaXMub2JqZWN0KTtcdFxuXHR9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gQXN0ZXJvaWQ7IiwiY29uc3QgY29udGFpbmVyID0gcmVxdWlyZSgnLi4vY29udGFpbmVyJyk7XG5cbmNsYXNzIERyYWdDYW1lcmEge1xuXHRzdGFydCgpIHtcblx0XHR0aGlzLnJvdGF0aW9uID0gbmV3IFRIUkVFLkV1bGVyKC1NYXRoLlBJIC8gNCwgTWF0aC5QSSAvIDQsIDAsICdZWFonKTtcblx0XHR0aGlzLmRpc3RhbmNlID0gNTA7XG5cdFx0dGhpcy50YXJnZXQgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXHRcdHRoaXMuY2FtZXJhID0gY29udGFpbmVyLmNhbWVyYTtcblx0XHR0aGlzLnVwID0gbmV3IFRIUkVFLlZlY3RvcjMoMCwgMSwgMCk7XG5cblx0XHR0aGlzLm9uTW91c2VXaGVlbCA9IHRoaXMub25Nb3VzZVdoZWVsLmJpbmQodGhpcyk7XG5cblx0XHR3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignbW91c2V3aGVlbCcsIHRoaXMub25Nb3VzZVdoZWVsKTtcblx0fVxuXG5cdG9uTW91c2VXaGVlbChlKSB7XG5cdFx0Y29uc3Qgc2NhbGUgPSAxICsgZS5kZWx0YVkgLyAxMDAwO1xuXHRcdHRoaXMuZGlzdGFuY2UgKj0gc2NhbGU7XG5cdH1cblxuXHR0aWNrKCkge1xuXHRcdGNvbnN0IHBvc2l0aW9uID0gdGhpcy50YXJnZXQuY2xvbmUoKVxuXHRcdFx0LmFkZChuZXcgVEhSRUUuVmVjdG9yMygwLCAwLCAxKVxuXHRcdFx0XHQuYXBwbHlFdWxlcih0aGlzLnJvdGF0aW9uKVxuXHRcdFx0XHQubXVsdGlwbHlTY2FsYXIodGhpcy5kaXN0YW5jZSkpO1xuXHRcdHRoaXMuY2FtZXJhLnBvc2l0aW9uLmNvcHkocG9zaXRpb24pO1xuXHRcdHRoaXMuY2FtZXJhLmxvb2tBdCh0aGlzLnRhcmdldCwgdGhpcy51cCk7XG5cdH1cblxuXHRkZXN0cm95KCkge1xuXHRcdHdpbmRvdy5yZW1vdmVFdmVudExpc3RlbmVyKCdtb3VzZXdoZWVsJywgdGhpcy5vbk1vdXNlV2hlZWwpO1xuXHR9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IERyYWdDYW1lcmE7IiwiY29uc3QgY29udGFpbmVyID0gcmVxdWlyZSgnLi4vY29udGFpbmVyJyk7XG5jb25zdCBQYXJ0aWNsZVN5c3RlbSA9IHJlcXVpcmUoJy4vcGFydGljbGVzeXN0ZW0nKTtcblxuY2xhc3MgRW5naW5lIHtcbiAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICB0aGlzLnByb3BzID0gcHJvcHM7XG4gICAgdGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcbiAgICB0aGlzLnNjZW5lID0gY29udGFpbmVyLnNjZW5lO1xuICAgIHRoaXMuYXBwID0gY29udGFpbmVyLmFwcDtcbiAgICB0aGlzLnBhcnRpY2xlVmVsb2NpdHkgPSBuZXcgVEhSRUUuVmVjdG9yMygpO1xuXG4gICAgXG4gICAgdGhpcy5wYXJ0aWNsZVN5c3RlbSA9IHRoaXMuYXBwLmFkZChQYXJ0aWNsZVN5c3RlbSwge1xuICAgICAgc2NhbGU6IFsgKChyKSA9PiB7XG4gICAgICBcdHJldHVybiByICsgMTtcbiAgICAgIH0pLCAwXSxcbiAgICAgIGxpZmU6ICgocikgPT4ge1xuICAgICAgICByZXR1cm4gKHIgKyAxKSAqIDIwMDtcbiAgICAgIH0pLFxuICAgICAgaW50ZXJ2YWw6IDIwLFxuICAgICAgdmVsb2NpdHk6IHRoaXMucGFydGljbGVWZWxvY2l0eSxcbiAgICAgIGF1dG9QbGF5OiBmYWxzZVxuICAgIH0pO1xuICB9XG5cbiAgc3RhcnQoKSB7XG4gICAgY29uc3Qgc2hpcCA9IHRoaXMucHJvcHMuc2hpcDtcbiAgICBjb25zdCBjb29yZCA9IHRoaXMucHJvcHMuY29vcmQ7XG4gICAgc2hpcC5pbm5lck9iamVjdC5hZGQodGhpcy5vYmplY3QpO1xuICAgIHRoaXMub2JqZWN0LnBvc2l0aW9uXG4gICAgICAuZnJvbUFycmF5KGNvb3JkKVxuICAgICAgLmFkZChuZXcgVEhSRUUuVmVjdG9yMygwLjUsIDAuNSwgMC41KSlcbiAgICAgIC5hZGQobmV3IFRIUkVFLlZlY3RvcjMoMCwgMCwgMSkpO1xuXG4gICAgdGhpcy51cGRhdGVQYXJ0aWNsZVN5c3RlbSgpO1xuICAgIHRoaXMucGFydGljbGVTeXN0ZW0ucGxheSgpO1xuICB9XG5cbiAgdGljayhkdCkge1xuICAgIHRoaXMudXBkYXRlUGFydGljbGVTeXN0ZW0oKTtcbiAgfVxuXG4gIGRlc3Ryb3koKSB7XG4gICAgdGhpcy5hcHAuZGVzdHJveSh0aGlzLnBhcnRpY2xlU3lzdGVtKTtcbiAgfVxuXG4gIHVwZGF0ZVBhcnRpY2xlU3lzdGVtKCkge1xuICAgIHRoaXMucGFydGljbGVTeXN0ZW0ucG9zaXRpb24uY29weSh0aGlzLm9iamVjdC5nZXRXb3JsZFBvc2l0aW9uKCkpO1xuICAgIGNvbnN0IHJvdGF0aW9uID0gdGhpcy5vYmplY3QuZ2V0V29ybGRSb3RhdGlvbigpO1xuICAgIGNvbnN0IGRpcmVjdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKDAsIDAsIDEpLmFwcGx5RXVsZXIocm90YXRpb24pO1xuICAgIHRoaXMucGFydGljbGVWZWxvY2l0eS5jb3B5KGRpcmVjdGlvbi5tdWx0aXBseVNjYWxhcigxMCkpO1xuICB9XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IEVuZ2luZTtcbiIsImNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uL2NvbnRhaW5lcicpO1xuXG5jbGFzcyBHcmlkIHtcbiAgY29uc3RydWN0b3IocHJvcHMpIHtcbiAgICB0aGlzLmF4aXMgPSBbIDEsIE1hdGguc3FydCgzKSAvIDIsIE1hdGguc3FydCgzKSAvIDQgXTtcbiAgICB0aGlzLnNjZW5lID0gY29udGFpbmVyLnNjZW5lO1xuICB9XG5cbiAgaGV4VG9TY3JlZW4oaSwgaikge1xuICBcdHJldHVybiBbIHRoaXMuYXhpc1swXSAqIGkgKyAoKGogJSAyID09PSAwKSA/IHRoaXMuYXhpc1syXSA6IDApLCB0aGlzLmF4aXNbMV0gKiBqIF07XG4gIH1cblxuICBzdGFydCgpIHtcbiAgICAvLyBmb3IgKGxldCBpID0gMDsgaSA8IDEwOyBpKyspIHtcbiAgICAvLyAgIGZvciAobGV0IGogPSAwOyBqIDwgMTA7IGorKykge1xuXG4gICAgLy8gICAgIGNvbnN0IHNwcml0ZSA9IG5ldyBUSFJFRS5TcHJpdGUoKTtcbiAgICAvLyAgICAgY29uc3Qgc2NyZWVuID0gdGhpcy5oZXhUb1NjcmVlbihpLCBqKTtcbiAgICAvLyAgICAgc3ByaXRlLnBvc2l0aW9uLnggPSBzY3JlZW5bMF0gKiAxMDtcbiAgICAvLyAgICAgc3ByaXRlLnBvc2l0aW9uLnogPSBzY3JlZW5bMV0gKiAxMDtcblxuICAgIC8vICAgICB0aGlzLnNjZW5lLmFkZChzcHJpdGUpO1xuXG4gICAgLy8gICB9XG4gICAgLy8gfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gR3JpZDtcbiIsImNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uL2NvbnRhaW5lcicpO1xuXG5jbGFzcyBWYWx1ZSB7XG5cdGNvbnN0cnVjdG9yKHZhbHVlLCBvYmplY3QpIHtcblx0XHR0aGlzLnZhbHVlID0gdmFsdWU7XG5cdFx0dGhpcy5vYmplY3QgPSBvYmplY3Q7XG5cblx0XHR0aGlzLmlzTnVtYmVyID0gdHlwZW9mIHZhbHVlID09PSAnbnVtYmVyJztcblx0XHR0aGlzLmlzRnVuYyA9IHR5cGVvZiB2YWx1ZSA9PT0gJ2Z1bmN0aW9uJztcblx0XHQvLyBMaW5lYXIgaW50ZXJ2YWxzXG5cdFx0dGhpcy5pbnRlcnZhbHMgPSBbXTtcblxuXHRcdGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdFx0Y29uc3QgdmFsdWVzID0gdmFsdWUubWFwKCh2KSA9PiB7XG5cdFx0XHRcdGlmICh0eXBlb2YgdiA9PT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRcdGNvbnN0IHIgPSB0aGlzLm9iamVjdC5yO1xuXHRcdFx0XHRcdHJldHVybiB2KHIpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB2O1xuXHRcdFx0fSk7XG5cblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdmFsdWVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGludGVydmFsID0ge1xuXHRcdFx0XHRcdHQ6IGkgLyB2YWx1ZXMubGVuZ3RoLFxuXHRcdFx0XHRcdHY6IHZhbHVlc1tpXVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRpZiAoaSA8IHZhbHVlcy5sZW5ndGggLSAxKSB7XG5cdFx0XHRcdFx0aW50ZXJ2YWwudmQgPSB2YWx1ZXNbaSArIDFdIC0gdmFsdWVzW2ldO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuaW50ZXJ2YWxzLnB1c2goaW50ZXJ2YWwpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdGdldCh0KSB7XG5cdFx0dCA9IHQgfHwgMDtcblx0XHRpZiAodGhpcy5pc051bWJlcikge1xuXHRcdFx0cmV0dXJuIHRoaXMudmFsdWU7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmlzRnVuYykge1xuXHRcdFx0Y29uc3QgciA9IHRoaXMub2JqZWN0LnI7XG5cdFx0XHRyZXR1cm4gdGhpcy52YWx1ZShyKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuaW50ZXJ2YWxzLmxlbmd0aCA+IDApIHtcblx0XHRcdGxldCBpbnRlcnZhbDtcblx0XHRcdGlmICh0ID4gMSkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5pbnRlcnZhbHNbdGhpcy5pbnRlcnZhbHMubGVuZ3RoIC0gMV0udjtcblx0XHRcdH1cblxuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLmludGVydmFscy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRpbnRlcnZhbCA9IHRoaXMuaW50ZXJ2YWxzW2ldO1xuXHRcdFx0XHRpZiAodCA8IGludGVydmFsLnQpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHRkID0gdCAtIGludGVydmFsLnQ7XG5cdFx0XHRcdGNvbnN0IHZkID0gaW50ZXJ2YWwudmQ7XG5cdFx0XHRcdHJldHVybiBpbnRlcnZhbC52ICsgdGQgKiB2ZDtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgUGFydGljbGUge1xuXHRjb25zdHJ1Y3Rvcihwcm9wcykge1xuXHRcdHRoaXMuciA9IE1hdGgucmFuZG9tKCk7XG5cdFx0dGhpcy5saWZlID0gbmV3IFZhbHVlKHByb3BzLmxpZmUsIHRoaXMpO1xuXHRcdHRoaXMudmVsb2NpdHkgPSBwcm9wcy52ZWxvY2l0eTtcblx0XHR0aGlzLnBhcmVudCA9IHByb3BzLnBhcmVudDtcblx0XHR0aGlzLnNjYWxlID0gbmV3IFZhbHVlKHByb3BzLnNjYWxlLCB0aGlzKTtcblx0XHR0aGlzLm9iamVjdCA9IG5ldyBUSFJFRS5TcHJpdGUocHJvcHMubWF0ZXJpYWwpO1xuXHRcdHRoaXMuYXBwID0gY29udGFpbmVyLmFwcDtcblx0fVxuXG5cdHN0YXJ0KCkge1xuXHRcdHRoaXMucGFyZW50LmFkZCh0aGlzLm9iamVjdCk7XG5cdFx0dGhpcy5zdGFydFRpbWVyID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG5cdFx0dGhpcy50aW1lciA9IG5ldyBEYXRlKCkuZ2V0VGltZSgpICsgdGhpcy5saWZlLmdldCgpO1xuXHR9XG5cblx0dGljayhkdCkge1xuXHRcdHRoaXMub2JqZWN0LnBvc2l0aW9uLmFkZCh0aGlzLnZlbG9jaXR5LmNsb25lKCkubXVsdGlwbHlTY2FsYXIoZHQpKTtcblx0XHRjb25zdCB0ID0gKG5ldyBEYXRlKCkuZ2V0VGltZSgpIC0gdGhpcy5zdGFydFRpbWVyKSAvIHRoaXMubGlmZS5nZXQoKTtcblx0XHRjb25zdCBzY2FsZSA9IHRoaXMuc2NhbGUuZ2V0KHQpO1xuXHRcdHRoaXMub2JqZWN0LnNjYWxlLnNldChzY2FsZSwgc2NhbGUsIHNjYWxlKTtcblxuXHRcdGlmIChuZXcgRGF0ZSgpLmdldFRpbWUoKSA+IHRoaXMudGltZXIpIHtcblx0XHRcdHRoaXMuYXBwLmRlc3Ryb3kodGhpcyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5yID0gTWF0aC5yYW5kb20oKTtcblx0fVxuXG5cdGRlc3Ryb3koKSB7XG5cdFx0dGhpcy5vYmplY3QucGFyZW50LnJlbW92ZSh0aGlzLm9iamVjdCk7XG5cdH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBQYXJ0aWNsZTsiLCJjb25zdCBjb250YWluZXIgPSByZXF1aXJlKCcuLi9jb250YWluZXInKTtcbmNvbnN0IFBhcnRpY2xlID0gcmVxdWlyZSgnLi9wYXJ0aWNsZScpO1xuXG5jb25zdCBkZWZhdWx0TWF0ZXJpYWwgPSBuZXcgVEhSRUUuU3ByaXRlTWF0ZXJpYWwoKTtcblxuY2xhc3MgUGFydGljbGVTeXN0ZW0ge1xuXHRjb25zdHJ1Y3Rvcihwcm9wcykge1xuXHRcdHByb3BzID0gcHJvcHMgfHwge307XG5cblx0XHR0aGlzLm1hdGVyaWFsID0gcHJvcHMubWF0ZXJpYWwgfHwgZGVmYXVsdE1hdGVyaWFsO1xuXHRcdHRoaXMubWF0ZXJpYWxzID0gdGhpcy5tYXRlcmlhbC5sZW5ndGggPiAwID8gdGhpcy5tYXRlcmlhbCA6IFtdO1xuXHRcdHRoaXMucGFyZW50ID0gcHJvcHMucGFyZW50IHx8IGNvbnRhaW5lci5zY2VuZTtcblx0XHR0aGlzLmF1dG9QbGF5ID0gcHJvcHMuYXV0b1BsYXkgPT09IHVuZGVmaW5lZCA/IHRydWUgOiBwcm9wcy5hdXRvUGxheTtcblxuXHRcdHRoaXMucGFydGljbGVQcm9wcyA9IHByb3BzLnBhcnRpY2xlUHJvcHM7XG5cblx0XHRpZiAodGhpcy5wYXJ0aWNsZVByb3BzID09IG51bGwpIHtcblx0XHRcdHRoaXMubGlmZSA9IHByb3BzLmxpZmU7XG5cdFx0XHR0aGlzLmludGVydmFsID0gcHJvcHMuaW50ZXJ2YWw7XG5cdFx0XHR0aGlzLnZlbG9jaXR5ID0gcHJvcHMudmVsb2NpdHk7XG5cdFx0XHR0aGlzLnNjYWxlID0gcHJvcHMuc2NhbGU7XG5cdFx0XHR0aGlzLmRlZmF1bHRQYXJ0aWNsZVByb3BzKHRoaXMpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3RpbWVvdXQgPSBudWxsO1xuXHRcdHRoaXMuZW1pdCA9IHRoaXMuZW1pdC5iaW5kKHRoaXMpO1xuXHRcdHRoaXMuYXBwID0gY29udGFpbmVyLmFwcDtcblx0XHR0aGlzLnBvc2l0aW9uID0gbmV3IFRIUkVFLlZlY3RvcjMoKTtcblx0fVxuXG5cdGRlZmF1bHRQYXJ0aWNsZVByb3BzKG9iaikge1xuXHRcdG9iai5saWZlID0gb2JqLmxpZmUgfHwgNTAwMDtcblx0XHRvYmouaW50ZXJ2YWwgPSBvYmouaW50ZXJ2YWwgfHwgMTAwMDtcblx0XHRvYmoudmVsb2NpdHkgPSBvYmoudmVsb2NpdHkgfHwgbmV3IFRIUkVFLlZlY3RvcjMoMCwgMiwgMCk7XG5cdFx0b2JqLnNjYWxlID0gb2JqLnNjYWxlIHx8IDE7XHRcblx0XHRvYmoucGFyZW50ID0gb2JqLnBhcmVudCB8fCBjb250YWluZXIuc2NlbmU7XG5cdFx0cmV0dXJuIG9iajtcblx0fVxuXG5cdHN0YXJ0KCkge1xuXHRcdGlmICh0aGlzLmF1dG9QbGF5KSB7XG5cdFx0XHR0aGlzLnBsYXkoKTtcdFxuXHRcdH1cblx0fVxuXG5cdHBsYXkoKSB7XG5cdFx0dGhpcy5lbWl0KCk7XG5cdH1cblxuXHRwYXVzZSgpIHtcblx0XHRpZiAodGhpcy5fdGltZW91dCAhPSBudWxsKSB7XG5cdFx0XHRjbGVhclRpbWVvdXQodGhpcy5fdGltZW91dCk7XG5cdFx0fVxuXHR9XG5cblx0ZW1pdCgpIHtcblx0XHRsZXQgcHJvcHM7XG5cdFx0Y29uc3QgbWF0ZXJpYWwgPSB0aGlzLm1hdGVyaWFscy5sZW5ndGggPiAwID8gdGhpcy5tYXRlcmlhbHNbTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogdGhpcy5tYXRlcmlhbHMubGVuZ3RoKV0gOiB0aGlzLm1hdGVyaWFsO1xuXHRcdGlmICh0aGlzLnBhcnRpY2xlUHJvcHMgPT0gbnVsbCkge1xuXHRcdFx0cHJvcHMgPSB7XG5cdFx0XHRcdGxpZmU6IHRoaXMubGlmZSxcblx0XHRcdFx0dmVsb2NpdHk6IHRoaXMudmVsb2NpdHksXG5cdFx0XHRcdG1hdGVyaWFsOiBtYXRlcmlhbCxcblx0XHRcdFx0cGFyZW50OiB0aGlzLnBhcmVudCxcblx0XHRcdFx0c2NhbGU6IHRoaXMuc2NhbGVcblx0XHRcdH07XG5cdFx0fSBlbHNlIHtcblx0XHRcdHByb3BzID0gdGhpcy5kZWZhdWx0UGFydGljbGVQcm9wcyh0aGlzLnBhcnRpY2xlUHJvcHMoKSk7XG5cdFx0fVxuXHRcdGNvbnN0IHBhcnRpY2xlID0gdGhpcy5hcHAuYWRkKFBhcnRpY2xlLCBwcm9wcyk7XG5cdFx0cGFydGljbGUub2JqZWN0LnBvc2l0aW9uLmNvcHkodGhpcy5wb3NpdGlvbik7XG5cdFx0dGhpcy5fdGltZW91dCA9IHNldFRpbWVvdXQodGhpcy5lbWl0LCB0aGlzLmludGVydmFsKTtcblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFBhcnRpY2xlU3lzdGVtOyIsImNvbnN0IGNvbnRhaW5lciA9IHJlcXVpcmUoJy4uLy4uL2NvbnRhaW5lcicpO1xuY29uc3QgVEhSRUUgPSAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvd1snVEhSRUUnXSA6IHR5cGVvZiBnbG9iYWwgIT09IFwidW5kZWZpbmVkXCIgPyBnbG9iYWxbJ1RIUkVFJ10gOiBudWxsKTtcbmNvbnN0IENodW5rcyA9IHJlcXVpcmUoJy4uLy4uL3ZveGVsL2NodW5rcycpO1xuY29uc3QgbWVzaGVyID0gcmVxdWlyZSgnLi4vLi4vdm94ZWwvbWVzaGVyJyk7XG5jb25zdCByZWFkZXIgPSByZXF1aXJlKCcuLi8uLi9zaGlwcy9yZWFkZXInKTtcblxuY2xhc3MgU2hpcCB7XG5cdGNvbnN0cnVjdG9yKHByb3BzKSB7XG5cdFx0dGhpcy5wcm9wcyA9IHByb3BzO1xuXHRcdHRoaXMuc2NlbmUgPSBjb250YWluZXIuc2NlbmU7XG5cdFx0dGhpcy5vYmplY3QgPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcblx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi5vcmRlciA9ICdZWFonO1xuXHRcdHRoaXMuaW5uZXJPYmplY3QgPSBuZXcgVEhSRUUuT2JqZWN0M0QoKTtcblx0XHR0aGlzLmlubmVyT2JqZWN0LnJvdGF0aW9uLm9yZGVyID0gJ1lYWic7XG5cdFx0dGhpcy5vYmplY3QuYWRkKHRoaXMuaW5uZXJPYmplY3QpO1xuXHRcdHRoaXMuY2h1bmtzID0gbmV3IENodW5rcygpO1xuXG5cdFx0dGhpcy5lbmdpbmVzID0gW107XG5cdFx0dGhpcy50dXJyZW50cyA9IFtdO1xuXG5cdFx0dGhpcy50dXJuU3BlZWQgPSAwO1xuXG5cdFx0dGhpcy50dXJuQW1vdW50ID0gMDtcblx0XHR0aGlzLmZvcndhcmRBbW91bnQgPSAwO1xuXG5cdFx0dGhpcy5zcGVlZCA9IG5ldyBUSFJFRS5WZWN0b3IzKCk7XG5cdH1cblxuXHRzdGFydCgpIHtcblx0XHR0aGlzLm1hdGVyaWFsID0gWyBudWxsLCBuZXcgVEhSRUUuTWVzaEJhc2ljTWF0ZXJpYWwoe1xuXHRcdFx0Y29sb3I6IDB4ZmZmZmZmXG5cdFx0fSkgXTtcblxuXHRcdHRoaXMuc2NlbmUuYWRkKHRoaXMub2JqZWN0KTtcblx0XG5cdFx0cmVhZGVyKHRoaXMucHJvcHMuZGF0YSwgdGhpcyk7XG5cdH1cblxuXHR0aWNrKGR0KSB7XG5cdFx0bWVzaGVyKHRoaXMuY2h1bmtzLCB0aGlzLmlubmVyT2JqZWN0LCB0aGlzLm1hdGVyaWFsKTtcblxuXHRcdC8vIGRlbW9cblx0XHR0aGlzLmZvcndhcmQoMSk7XG5cdFx0dGhpcy50dXJuKDEpO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLnR1cnJlbnRzLmxlbmd0aDsgaSArKykge1xuXG5cdFx0fVxuXG5cdFx0Ly8gU3RlcCB5YXdcblx0XHRjb25zdCB0dXJuQWNjZWxlcmF0aW9uID0gMC4xO1xuXHRcdGNvbnN0IG1heFR1cm5TcGVlZCA9IDAuMDE7XG5cdFx0Y29uc3QgZGVzaXJlZFR1cm5TcGVlZCA9IHRoaXMudHVybkFtb3VudCAqIG1heFR1cm5TcGVlZDtcblxuXHRcdGlmICh0aGlzLnR1cm5TcGVlZCA8IGRlc2lyZWRUdXJuU3BlZWQpIHtcblx0XHRcdHRoaXMudHVyblNwZWVkICs9IHR1cm5BY2NlbGVyYXRpb24gKiBkdDtcblx0XHR9IGVsc2UgaWYgKHRoaXMudHVyblNwZWVkID4gZGVzaXJlZFR1cm5TcGVlZCkge1xuXHRcdFx0dGhpcy50dXJuU3BlZWQgLT0gdHVybkFjY2VsZXJhdGlvbiAqIGR0O1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnR1cm5TcGVlZCA8IC1tYXhUdXJuU3BlZWQpIHtcblx0XHRcdHRoaXMudHVyblNwZWVkID0gLW1heFR1cm5TcGVlZDtcblx0XHR9IGVsc2UgaWYgKHRoaXMudHVyblNwZWVkID4gbWF4VHVyblNwZWVkKSB7XG5cdFx0XHR0aGlzLnR1cm5TcGVlZCA9IG1heFR1cm5TcGVlZDtcblx0XHR9XG5cblx0XHQvLyBTdGVwIHJvbGxcblx0XHR0aGlzLm9iamVjdC5yb3RhdGlvbi55ICs9IHRoaXMudHVyblNwZWVkO1xuXG5cdFx0Y29uc3QgcmF0aW8gPSB0aGlzLnR1cm5TcGVlZCAvIG1heFR1cm5TcGVlZDtcblxuXHRcdGNvbnN0IG1heFJvbGxBbW91bnQgPSBNYXRoLlBJIC8gODtcblx0XHRjb25zdCBhbmdsZSA9IHJhdGlvICogbWF4Um9sbEFtb3VudDtcblxuXHRcdHRoaXMub2JqZWN0LnJvdGF0aW9uLnogKz0gKGFuZ2xlIC0gdGhpcy5vYmplY3Qucm90YXRpb24ueikgKiAwLjAxO1xuXG5cdFx0dGhpcy50dXJuQW1vdW50ID0gMDtcblxuXHRcdC8vIFN0ZXAgZm9yd2FyZFxuXHRcdGNvbnN0IHBvd2VyID0gMTtcblx0XHRjb25zdCBhY2MgPSBuZXcgVEhSRUUuVmVjdG9yMygwLCAwLCAtMSlcblx0XHRcdC5hcHBseUV1bGVyKHRoaXMub2JqZWN0LnJvdGF0aW9uKVxuXHRcdFx0Lm11bHRpcGx5U2NhbGFyKHRoaXMuZm9yd2FyZEFtb3VudCAqIHBvd2VyICogZHQpO1xuXG5cdFx0dGhpcy5zcGVlZC5hZGQoYWNjKTtcblx0XHR0aGlzLm9iamVjdC5wb3NpdGlvbi5hZGQodGhpcy5zcGVlZCk7XG5cblx0XHR0aGlzLnNwZWVkLm11bHRpcGx5U2NhbGFyKDAuOTcpO1xuXG5cdFx0dGhpcy5mb3J3YXJkQW1vdW50ID0gMDtcblx0fVxuXG5cdHR1cm4oYW1vdW50KSB7XG5cdFx0dGhpcy50dXJuQW1vdW50ID0gYW1vdW50O1xuXHR9XG5cblx0Zm9yd2FyZChhbW91bnQpIHtcblx0XHR0aGlzLmZvcndhcmRBbW91bnQgPSBhbW91bnQ7XG5cdH1cblxuXHRvcmJpdChwb2ludCkge1xuXG5cdH1cblxuXHRkZXN0cm95KCkge1xuXG5cdH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSBTaGlwOyIsImNsYXNzIFR1cnJlbnQge1xuXHRjb25zdHJ1Y3Rvcihwcm9wcykge1xuXHRcdHRoaXMucG9zaXRpb24gPSBcblx0XHRcdG5ldyBUSFJFRS5WZWN0b3IzKClcblx0XHRcdFx0LmZyb21BcnJheShwcm9wcy5jb29yZClcblx0XHRcdFx0LmFkZChuZXcgVEhSRUUuVmVjdG9yMygwLjUsIDAuNSwgMC41KSk7XG5cdFx0dGhpcy5zaGlwID0gcHJvcHMuc2hpcDtcblx0XHR0aGlzLmRpcmVjdGlvbiA9IG5ldyBUSFJFRS5WZWN0b3IzKDAsIDAsIDEpO1xuXG5cdFx0dGhpcy50eXBlID0gcHJvcHMudHlwZTtcblxuXHRcdHRoaXMuY29vbGRvd24gPSAwO1xuXG5cdFx0c3dpdGNoKHRoaXMudHlwZSkge1xuXHRcdFx0Y2FzZSAnTCc6IHtcblx0XHRcdFx0dGhpcy5jb29sZG93biA9IDEuMDtcblx0XHRcdH0gYnJlYWs7XG5cdFx0fVxuXG5cdFx0dGhpcy5fY291bnRlciA9IDA7XG5cdH1cblxuXHR0aWNrKGR0KSB7XG5cdFx0aWYgKHRoaXMuY29vbGRvd24gPT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fY291bnRlciA+IHRoaXMuY29vbGRvd24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fY291bnRlciArPSBkdDtcblx0fVxuXG5cdGZpcmUoKSB7XG5cdFx0aWYgKHRoaXMuY29vbGRvd24gPT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9jb3VudGVyID4gdGhpcy5jb29sZG93bikge1xuXHRcdFx0dGhpcy5fZmlyZSgpO1xuXHRcdFx0dGhpcy5fY291bnRlciAtPSB0aGlzLmNvb2xkb3duO1xuXHRcdH1cblx0fVxuXG5cdF9maXJlKCkge1xuXHRcdGNvbnN0IHBvc2l0aW9uID0gdGhpcy5zaGlwLmlubmVyT2JqZWN0LmxvY2FsVG9Xb3JsZCh0aGlzLnBvc2l0aW9uLmNsb25lKCkpO1xuXHRcdGNvbnN0IGRpcmVjdGlvbiA9IHRoaXMuZGlyZWN0aW9uLmNsb25lKCkuYXBwbHlFdWxlcih0aGlzLnNoaXAuaW5uZXJPYmplY3QuZ2V0V29ybGRSb3RhdGlvbigpKTtcblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFR1cnJlbnQ7IiwiY29uc3QgQm90dGxlID0gcmVxdWlyZSgnYm90dGxlanMnKTtcbmNvbnN0IHJlbmRlcmVyID0gcmVxdWlyZSgnLi9yZW5kZXJlcicpO1xuXG5jb25zdCBib3R0bGUgPSBuZXcgQm90dGxlKCk7XG5jb25zdCBjb250YWluZXIgPSBib3R0bGUuY29udGFpbmVyO1xuXG5jb250YWluZXIucmVuZGVyZXIgPSByZW5kZXJlcjtcbmNvbnRhaW5lci5zY2VuZSA9IHJlbmRlcmVyLnNjZW5lO1xuY29udGFpbmVyLmNhbWVyYSA9IHJlbmRlcmVyLmNhbWVyYTtcblxubW9kdWxlLmV4cG9ydHMgPSBjb250YWluZXI7IiwiZnVuY3Rpb24gZ3VpZCgpIHtcbiAgZnVuY3Rpb24gczQoKSB7XG4gICAgcmV0dXJuIE1hdGguZmxvb3IoKDEgKyBNYXRoLnJhbmRvbSgpKSAqIDB4MTAwMDApXG4gICAgICAudG9TdHJpbmcoMTYpXG4gICAgICAuc3Vic3RyaW5nKDEpO1xuICB9XG4gIHJldHVybiBzNCgpICsgczQoKSArICctJyArIHM0KCkgKyAnLScgKyBzNCgpICsgJy0nICtcbiAgICBzNCgpICsgJy0nICsgczQoKSArIHM0KCkgKyBzNCgpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IGd1aWQ7IiwiY29uc3QgYXBwID0gcmVxdWlyZSgnLi9hcHAnKTtcbmNvbnN0IFNoaXAgPSByZXF1aXJlKCcuL2NvbXBvbmVudHMvc2hpcCcpO1xuY29uc3QgRHJhZ0NhbWVyYSA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy9kcmFnY2FtZXJhJyk7XG5jb25zdCBBc3Rlcm9pZCA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy9hc3Rlcm9pZCcpO1xuY29uc3QgR3JpZCA9IHJlcXVpcmUoJy4vY29tcG9uZW50cy9ncmlkJyk7XG5cbmFwcC5zdGFydCgpO1xuXG5jb25zdCBmcmlnYXRlID0gcmVxdWlyZSgnLi9zaGlwcy9mcmlnYXRlJyk7XG5jb25zdCBzaGlwID0gYXBwLmFkZChTaGlwLCB7IGRhdGE6IGZyaWdhdGUgfSk7XG4vLyBhcHAuYWRkKEFzdGVyb2lkKTtcbmNvbnN0IGRyYWdDYW1lcmEgPSBhcHAuYWRkKERyYWdDYW1lcmEpO1xuXG5hcHAuYWRkKEdyaWQpOyIsImNvbnN0IFRIUkVFID0gKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgPyB3aW5kb3dbJ1RIUkVFJ10gOiB0eXBlb2YgZ2xvYmFsICE9PSBcInVuZGVmaW5lZFwiID8gZ2xvYmFsWydUSFJFRSddIDogbnVsbCk7XG5cbmNvbnN0IHJlbmRlcmVyID0gbmV3IFRIUkVFLldlYkdMUmVuZGVyZXIoKTtcbnJlbmRlcmVyLnNldFNpemUod2luZG93LmlubmVyV2lkdGgsIHdpbmRvdy5pbm5lckhlaWdodCk7XG5kb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHJlbmRlcmVyLmRvbUVsZW1lbnQpO1xuY29uc3Qgc2NlbmUgPSBuZXcgVEhSRUUuU2NlbmUoKTtcbmNvbnN0IGNhbWVyYSA9IG5ldyBUSFJFRS5QZXJzcGVjdGl2ZUNhbWVyYSg2MCwgd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQsIDAuMSwgMTAwMCk7XG5jYW1lcmEucG9zaXRpb24ueiA9IDU7XG5cbmNvbnN0IHJlbmRlciA9ICgpID0+IHtcblx0cmVuZGVyZXIucmVuZGVyKHNjZW5lLCBjYW1lcmEpO1xufTtcblxuY29uc3QgYW5pbWF0ZSA9ICgpID0+IHtcblx0cmVuZGVyKCk7XG5cdHJlcXVlc3RBbmltYXRpb25GcmFtZShhbmltYXRlKTtcbn07XG5cbmNvbnN0IG9uUmVzaXplID0gKCkgPT4ge1xuXHRyZW5kZXJlci5zZXRTaXplKHdpbmRvdy5pbm5lcldpZHRoLCB3aW5kb3cuaW5uZXJIZWlnaHQpO1xuXHRjYW1lcmEuYXNwZWN0ID0gd2luZG93LmlubmVyV2lkdGggLyB3aW5kb3cuaW5uZXJIZWlnaHQ7XG5cdGNhbWVyYS51cGRhdGVQcm9qZWN0aW9uTWF0cml4KCk7XG59O1xuXG53aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgb25SZXNpemUpO1xuXG5hbmltYXRlKCk7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuXHRyZW5kZXIsXG5cdHNjZW5lLFxuXHRjYW1lcmFcbn07IiwibW9kdWxlLmV4cG9ydHMgPSBgXG5IVUxMXG4gMCAgICAgICAgIDBcbiAwICAgMCAwICAgMFxuMDAwMDAwMDAwMDAwMFxuMDAwMDAwMDAwMDAwMFxuIDAgICAwIDAgICAwXG4gICAgICAgICAgXG5cbk1PRFVMRVNcbiAwICAgICAgICAgMFxuIDAgICAwIDAgICAwXG4wMDAwTDBMMEwwMDAwXG4wMDAwMDBDMDAwMDAwXG4gRSAgIDAgMCAgIEVcbiAgICAgICAgICBcbmAiLCJjb25zdCBjb250YWluZXIgPSByZXF1aXJlKCcuLi9jb250YWluZXInKTtcbmNvbnN0IEVuZ2luZSA9IHJlcXVpcmUoJy4uL2NvbXBvbmVudHMvZW5naW5lJyk7XG5jb25zdCBUdXJyZW50ID0gcmVxdWlyZSgnLi4vY29tcG9uZW50cy9zaGlwL3R1cnJlbnQnKTtcblxuY29uc3QgcmVhZGVyID0gKGRhdGEsIHNoaXApID0+IHtcblx0Y29uc3QgbGluZXMgPSBkYXRhLnNwbGl0KCdcXG4nKTtcblx0Y29uc3QgY2h1bmtzID0gc2hpcC5jaHVua3M7XG5cdGNvbnN0IGVuZ2luZXMgPSBzaGlwLmVuZ2luZXM7XG5cblx0bGV0IGxpbmU7XG5cdGxldCBjdXJyZW50O1xuXHRsZXQgeiA9IDA7XG5cdGxldCBjaGFyO1xuXG5cdGNvbnN0IHJlc3VsdCA9IHtcblx0XHRodWxsOiBbXSxcblx0XHRtb2R1bGVzOiBbXVxuXHR9O1xuXG5cdGNvbnN0IGFwcCA9IGNvbnRhaW5lci5hcHA7XG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7IGkrKykge1xuXHRcdGxpbmUgPSBsaW5lc1tpXTtcblxuXHRcdGlmIChsaW5lID09PSAnSFVMTCcpIHtcblx0XHRcdGN1cnJlbnQgPSAnSFVMTCc7XG5cdFx0XHR6ID0gMDtcblx0XHR9IGVsc2UgaWYgKGxpbmUgPT09ICdNT0RVTEVTJykge1xuXHRcdFx0Y3VycmVudCA9ICdNT0RVTEVTJztcblx0XHRcdHogPSAwO1xuXHRcdH0gZWxzZSBpZiAoY3VycmVudCA9PT0gJ0hVTEwnKSB7XG5cdFx0XHRmb3IgKGxldCB4ID0gMDsgeCA8IGxpbmUubGVuZ3RoOyB4KyspIHtcblx0XHRcdFx0Y2hhciA9IGxpbmVbeF07XG5cblx0XHRcdFx0aWYgKGNoYXIgPT09ICcwJykge1xuXHRcdFx0XHRcdGNodW5rcy5zZXQoeCwgMCwgeiwgMSk7XG5cdFx0XHRcdFx0cmVzdWx0Lmh1bGwucHVzaChbeCwgMCwgeiwgMV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR6Kys7XG5cdFx0fSBlbHNlIGlmIChjdXJyZW50ID09PSAnTU9EVUxFUycpIHtcblx0XHRcdGZvciAobGV0IHggPSAwOyB4IDwgbGluZS5sZW5ndGg7IHgrKykge1xuXHRcdFx0XHRjaGFyID0gbGluZVt4XTtcblx0XHRcdFx0aWYgKGNoYXIgPT09ICdFJykge1xuXHRcdFx0XHRcdGFwcC5hZGQoRW5naW5lLCB7XG5cdFx0XHRcdFx0XHRzaGlwOiBzaGlwLFxuXHRcdFx0XHRcdFx0Y29vcmQ6IFt4LCAwLCB6XVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGNoYXIgPT09ICdMJykge1xuXHRcdFx0XHRcdHNoaXAudHVycmVudHMucHVzaChuZXcgVHVycmVudCh7XG5cdFx0XHRcdFx0XHRjb29yZDogW3gsIDAsIHpdLFxuXHRcdFx0XHRcdFx0c2hpcDogc2hpcCxcblx0XHRcdFx0XHRcdHR5cGU6ICdMJ1xuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0eisrO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IGNlbnRlciA9IFsgMCwgMCwgMCBdO1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IHJlc3VsdC5odWxsLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgdiA9IHJlc3VsdC5odWxsW2ldO1xuXHRcdGNlbnRlclswXSArPSB2WzBdO1xuXHRcdGNlbnRlclsxXSArPSB2WzFdO1xuXHRcdGNlbnRlclsyXSArPSB2WzJdO1xuXHR9XG5cdGNlbnRlclswXSAvPSAtcmVzdWx0Lmh1bGwubGVuZ3RoO1xuXHRjZW50ZXJbMV0gLz0gLXJlc3VsdC5odWxsLmxlbmd0aDtcblx0Y2VudGVyWzJdIC89IC1yZXN1bHQuaHVsbC5sZW5ndGg7XG5cdFxuXHRjZW50ZXJbMF0gLT0gMC41O1xuXHRjZW50ZXJbMV0gLT0gMC41O1xuXHRjZW50ZXJbMl0gLT0gMC41O1xuXG5cdHJlc3VsdC5jZW50ZXIgPSBjZW50ZXI7XG5cblx0c2hpcC5pbm5lck9iamVjdC5wb3NpdGlvbi5mcm9tQXJyYXkoY2VudGVyKTtcblxuXHRyZXR1cm4gcmVzdWx0O1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSByZWFkZXI7IiwiY29uc3QgcmFuZG9tVW5pdFZlY3RvciA9ICgpID0+IHtcbiAgY29uc3QgdGhldGEgPSBNYXRoLnJhbmRvbSgpICogMi4wICogTWF0aC5QSTtcblxuICBjb25zdCByYXdYID0gTWF0aC5zaW4odGhldGEpO1xuXG4gIGNvbnN0IHJhd1kgPSBNYXRoLmNvcyh0aGV0YSk7XG5cbiAgY29uc3QgeiA9IE1hdGgucmFuZG9tKCkgKiAyLjAgLSAxLjA7XG5cbiAgY29uc3QgcGhpID0gTWF0aC5hc2luKHopO1xuXG4gIGNvbnN0IHNjYWxhciA9IE1hdGguY29zKHBoaSk7XG5cbiAgY29uc3QgeCA9IHJhd1ggKiBzY2FsYXI7XG5cbiAgY29uc3QgeSA9IHJhd1kgKiBzY2FsYXI7XG5cbiAgcmV0dXJuIG5ldyBUSFJFRS5WZWN0b3IzKHgsIHksIHopOyAgXG59XG5cbmNvbnN0IHJhbmRvbVF1YXRlcm5pb24gPSAoKSA9PiB7XG5cdGNvbnN0IHZlY3RvciA9IHJhbmRvbVVuaXRWZWN0b3IoKTtcblx0cmV0dXJuIG5ldyBUSFJFRS5RdWF0ZXJuaW9uKCkuc2V0RnJvbVVuaXRWZWN0b3JzKG5ldyBUSFJFRS5WZWN0b3IzKDAsIDAsIDEpLCB2ZWN0b3IpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSB7IHJhbmRvbVVuaXRWZWN0b3IsIHJhbmRvbVF1YXRlcm5pb24gfTtcbiIsImNsYXNzIENodW5rIHtcblx0Y29uc3RydWN0b3Ioc2l6ZSkge1xuXHRcdHRoaXMuc2l6ZSA9IHNpemU7XG5cdFx0dGhpcy55eiA9IHNpemUgKiBzaXplO1xuXHRcdHRoaXMuZGF0YSA9IFtdO1xuXHR9XG5cblx0Z2V0KGksIGosIGspIHtcblx0XHRjb25zdCBpbmRleCA9IGkgKiB0aGlzLnl6ICsgaiAqIHRoaXMuc2l6ZSArIGs7XG5cdFx0cmV0dXJuIHRoaXMuZGF0YVtpbmRleF07XG5cdH1cblxuXHRzZXQoaSwgaiwgaywgdikge1xuXHRcdGNvbnN0IGluZGV4ID0gaSAqIHRoaXMueXogKyBqICogdGhpcy5zaXplICsgaztcblx0XHR0aGlzLmRhdGFbaW5kZXhdID0gdjtcblx0fVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IENodW5rOyIsImNvbnN0IENodW5rID0gcmVxdWlyZSgnLi9jaHVuaycpO1xuXG5jbGFzcyBDaHVua3Mge1xuXHRjb25zdHJ1Y3RvcihzaXplKSB7XG5cdFx0dGhpcy5zaXplID0gc2l6ZSB8fCAxNjtcblx0XHR0aGlzLm1hcCA9IHt9O1xuXHR9XG5cblx0Z2V0KGksIGosIGspIHtcblx0XHRjb25zdCBvcmlnaW4gPSB0aGlzLmdldE9yaWdpbihpLCBqLCBrKTtcblx0XHRjb25zdCBpZCA9IG9yaWdpbi5qb2luKCcsJyk7XG5cblx0XHRjb25zdCByZWdpb24gPSB0aGlzLm1hcFtpZF07XG5cdFx0aWYgKHJlZ2lvbiA9PSBudWxsKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9IFxuXG5cdFx0cmV0dXJuIHJlZ2lvbi5jaHVuay5nZXQoaSAtIG9yaWdpblswXSwgaiAtIG9yaWdpblsxXSwgayAtIG9yaWdpblsyXSk7XG5cdH1cblxuXHRzZXQoaSwgaiwgaywgdikge1xuXHRcdGNvbnN0IG9yaWdpbiA9IHRoaXMuZ2V0T3JpZ2luKGksIGosIGspO1xuXHRcdGNvbnN0IGlkID0gb3JpZ2luLmpvaW4oJywnKTtcblxuXHRcdGxldCByZWdpb24gPSB0aGlzLm1hcFtpZF07XG5cdFx0aWYgKHJlZ2lvbiA9PSBudWxsKSB7XG5cdFx0XHRyZWdpb24gPSB0aGlzLm1hcFtpZF0gPSB7XG5cdFx0XHRcdGNodW5rOiBuZXcgQ2h1bmsodGhpcy5zaXplKSxcblx0XHRcdFx0b3JpZ2luOiBvcmlnaW5cblx0XHRcdH07XG5cdFx0fVxuXHRcdHJlZ2lvbi5kaXJ0eSA9IHRydWU7XG5cblx0XHRyZWdpb24uY2h1bmsuc2V0KGkgLSBvcmlnaW5bMF0sIGogLSBvcmlnaW5bMV0sIGsgLSBvcmlnaW5bMl0sIHYpO1xuXHR9XG5cblx0Z2V0T3JpZ2luKGksIGosIGspIHtcblx0XHRyZXR1cm4gWyBcblx0XHRcdE1hdGguZmxvb3IoaSAvIHRoaXMuc2l6ZSkgKiB0aGlzLnNpemUsXG5cdFx0XHRNYXRoLmZsb29yKGogLyB0aGlzLnNpemUpICogdGhpcy5zaXplLFxuXHRcdFx0TWF0aC5mbG9vcihrIC8gdGhpcy5zaXplKSAqIHRoaXMuc2l6ZVxuXHRcdF1cblx0fVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDaHVua3M7IiwiY29uc3QgbWVzaGVyID0gcmVxdWlyZSgnLi9tb25vdG9uZScpLm1lc2hlcjtcblxuY29uc3QgbWVzaFJlZ2lvbiA9IChyZWdpb24sIG9iamVjdCwgbWF0ZXJpYWwpID0+IHtcblx0aWYgKHJlZ2lvbi5tZXNoICE9IG51bGwpIHtcblx0XHRvYmplY3QucmVtb3ZlKHJlZ2lvbi5tZXNoKTtcblx0XHRyZWdpb24ubWVzaC5nZW9tZXRyeS5kaXNwb3NlKCk7XG5cdH1cblxuXHRjb25zdCBnZW9tZXRyeSA9IG5ldyBUSFJFRS5HZW9tZXRyeSgpO1xuXHRjb25zdCBtZXNoID0gbmV3IFRIUkVFLk1lc2goZ2VvbWV0cnksIG1hdGVyaWFsKTtcblxuXHRjb25zdCBjaHVuayA9IHJlZ2lvbi5jaHVuaztcblxuXHRjb25zdCBmID0gY2h1bmsuZ2V0LmJpbmQoY2h1bmspO1xuXHRjb25zdCBkaW1zID0gWyBjaHVuay5zaXplLCBjaHVuay5zaXplLCBjaHVuay5zaXplIF07XG5cblx0Y29uc3QgcmVzdWx0ID0gbWVzaGVyKGYsIGRpbXMpO1xuXG5cdHJlc3VsdC52ZXJ0aWNlcy5mb3JFYWNoKCh2KSA9PiB7XG5cdFx0Z2VvbWV0cnkudmVydGljZXMucHVzaChuZXcgVEhSRUUuVmVjdG9yMyh2WzBdLCB2WzFdLCB2WzJdKSk7XG5cdH0pO1xuXG5cdHJlc3VsdC5mYWNlcy5mb3JFYWNoKChmKSA9PiB7XG5cdFx0Y29uc3QgZmFjZSA9IG5ldyBUSFJFRS5GYWNlMyhmWzBdLCBmWzFdLCBmWzJdKTtcblx0XHRmYWNlLm1hdGVyaWFsSW5kZXggPSBmWzNdO1xuXHRcdGdlb21ldHJ5LmZhY2VzLnB1c2goZmFjZSk7XG5cdH0pO1xuXG5cdG9iamVjdC5hZGQobWVzaCk7XG5cdHJlZ2lvbi5tZXNoID0gbWVzaDtcbn07XG5cbmNvbnN0IG1lc2hDaHVua3MgPSAoY2h1bmtzLCBvYmplY3QsIG1hdGVyaWFsKSA9PiB7XG5cdGxldCBpZCwgcmVnaW9uO1xuXHRmb3IgKGlkIGluIGNodW5rcy5tYXApIHtcblx0XHRyZWdpb24gPSBjaHVua3MubWFwW2lkXTtcblx0XHRpZiAocmVnaW9uLmRpcnR5KSB7XG5cdFx0XHRtZXNoUmVnaW9uKHJlZ2lvbiwgb2JqZWN0LCBtYXRlcmlhbCk7XG5cdFx0XHRyZWdpb24uZGlydHkgPSBmYWxzZTtcblx0XHR9XG5cdH1cbn07XG5cbm1vZHVsZS5leHBvcnRzID0gbWVzaENodW5rczsiLCJcInVzZSBzdHJpY3RcIjtcblxudmFyIE1vbm90b25lTWVzaCA9IChmdW5jdGlvbigpe1xuXG5mdW5jdGlvbiBNb25vdG9uZVBvbHlnb24oYywgdiwgdWwsIHVyKSB7XG4gIHRoaXMuY29sb3IgID0gYztcbiAgdGhpcy5sZWZ0ICAgPSBbW3VsLCB2XV07XG4gIHRoaXMucmlnaHQgID0gW1t1ciwgdl1dO1xufTtcblxuTW9ub3RvbmVQb2x5Z29uLnByb3RvdHlwZS5jbG9zZV9vZmYgPSBmdW5jdGlvbih2KSB7XG4gIHRoaXMubGVmdC5wdXNoKFsgdGhpcy5sZWZ0W3RoaXMubGVmdC5sZW5ndGgtMV1bMF0sIHYgXSk7XG4gIHRoaXMucmlnaHQucHVzaChbIHRoaXMucmlnaHRbdGhpcy5yaWdodC5sZW5ndGgtMV1bMF0sIHYgXSk7XG59O1xuXG5Nb25vdG9uZVBvbHlnb24ucHJvdG90eXBlLm1lcmdlX3J1biA9IGZ1bmN0aW9uKHYsIHVfbCwgdV9yKSB7XG4gIHZhciBsID0gdGhpcy5sZWZ0W3RoaXMubGVmdC5sZW5ndGgtMV1bMF1cbiAgICAsIHIgPSB0aGlzLnJpZ2h0W3RoaXMucmlnaHQubGVuZ3RoLTFdWzBdOyBcbiAgaWYobCAhPT0gdV9sKSB7XG4gICAgdGhpcy5sZWZ0LnB1c2goWyBsLCB2IF0pO1xuICAgIHRoaXMubGVmdC5wdXNoKFsgdV9sLCB2IF0pO1xuICB9XG4gIGlmKHIgIT09IHVfcikge1xuICAgIHRoaXMucmlnaHQucHVzaChbIHIsIHYgXSk7XG4gICAgdGhpcy5yaWdodC5wdXNoKFsgdV9yLCB2IF0pO1xuICB9XG59O1xuXG5cbnJldHVybiBmdW5jdGlvbihmLCBkaW1zKSB7XG4gIC8vU3dlZXAgb3ZlciAzLWF4ZXNcbiAgdmFyIHZlcnRpY2VzID0gW10sIGZhY2VzID0gW107XG4gIGZvcih2YXIgZD0wOyBkPDM7ICsrZCkge1xuICAgIHZhciBpLCBqLCBrXG4gICAgICAsIHUgPSAoZCsxKSUzICAgLy91IGFuZCB2IGFyZSBvcnRob2dvbmFsIGRpcmVjdGlvbnMgdG8gZFxuICAgICAgLCB2ID0gKGQrMiklM1xuICAgICAgLCB4ID0gbmV3IEludDMyQXJyYXkoMylcbiAgICAgICwgcSA9IG5ldyBJbnQzMkFycmF5KDMpXG4gICAgICAsIHJ1bnMgPSBuZXcgSW50MzJBcnJheSgyICogKGRpbXNbdV0rMSkpXG4gICAgICAsIGZyb250aWVyID0gbmV3IEludDMyQXJyYXkoZGltc1t1XSkgIC8vRnJvbnRpZXIgaXMgbGlzdCBvZiBwb2ludGVycyB0byBwb2x5Z29uc1xuICAgICAgLCBuZXh0X2Zyb250aWVyID0gbmV3IEludDMyQXJyYXkoZGltc1t1XSlcbiAgICAgICwgbGVmdF9pbmRleCA9IG5ldyBJbnQzMkFycmF5KDIgKiBkaW1zW3ZdKVxuICAgICAgLCByaWdodF9pbmRleCA9IG5ldyBJbnQzMkFycmF5KDIgKiBkaW1zW3ZdKVxuICAgICAgLCBzdGFjayA9IG5ldyBJbnQzMkFycmF5KDI0ICogZGltc1t2XSlcbiAgICAgICwgZGVsdGEgPSBbWzAsMF0sIFswLDBdXTtcbiAgICAvL3EgcG9pbnRzIGFsb25nIGQtZGlyZWN0aW9uXG4gICAgcVtkXSA9IDE7XG4gICAgLy9Jbml0aWFsaXplIHNlbnRpbmVsXG4gICAgZm9yKHhbZF09LTE7IHhbZF08ZGltc1tkXTsgKSB7XG4gICAgICAvLyAtLS0gUGVyZm9ybSBtb25vdG9uZSBwb2x5Z29uIHN1YmRpdmlzaW9uIC0tLVxuICAgICAgdmFyIG4gPSAwXG4gICAgICAgICwgcG9seWdvbnMgPSBbXVxuICAgICAgICAsIG5mID0gMDtcbiAgICAgIGZvcih4W3ZdPTA7IHhbdl08ZGltc1t2XTsgKyt4W3ZdKSB7XG4gICAgICAgIC8vTWFrZSBvbmUgcGFzcyBvdmVyIHRoZSB1LXNjYW4gbGluZSBvZiB0aGUgdm9sdW1lIHRvIHJ1bi1sZW5ndGggZW5jb2RlIHBvbHlnb25cbiAgICAgICAgdmFyIG5yID0gMCwgcCA9IDAsIGMgPSAwO1xuICAgICAgICBmb3IoeFt1XT0wOyB4W3VdPGRpbXNbdV07ICsreFt1XSwgcCA9IGMpIHtcbiAgICAgICAgICAvL0NvbXB1dGUgdGhlIHR5cGUgZm9yIHRoaXMgZmFjZVxuICAgICAgICAgIHZhciBhID0gKDAgICAgPD0geFtkXSAgICAgID8gZih4WzBdLCAgICAgIHhbMV0sICAgICAgeFsyXSkgICAgICA6IDApXG4gICAgICAgICAgICAsIGIgPSAoeFtkXSA8ICBkaW1zW2RdLTEgPyBmKHhbMF0rcVswXSwgeFsxXStxWzFdLCB4WzJdK3FbMl0pIDogMCk7XG4gICAgICAgICAgYyA9IGE7XG4gICAgICAgICAgaWYoKCFhKSA9PT0gKCFiKSkge1xuICAgICAgICAgICAgYyA9IDA7XG4gICAgICAgICAgfSBlbHNlIGlmKCFhKSB7XG4gICAgICAgICAgICBjID0gLWI7XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vSWYgY2VsbCB0eXBlIGRvZXNuJ3QgbWF0Y2gsIHN0YXJ0IGEgbmV3IHJ1blxuICAgICAgICAgIGlmKHAgIT09IGMpIHtcbiAgICAgICAgICAgIHJ1bnNbbnIrK10gPSB4W3VdO1xuICAgICAgICAgICAgcnVuc1tucisrXSA9IGM7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vQWRkIHNlbnRpbmVsIHJ1blxuICAgICAgICBydW5zW25yKytdID0gZGltc1t1XTtcbiAgICAgICAgcnVuc1tucisrXSA9IDA7XG4gICAgICAgIC8vVXBkYXRlIGZyb250aWVyIGJ5IG1lcmdpbmcgcnVuc1xuICAgICAgICB2YXIgZnAgPSAwO1xuICAgICAgICBmb3IodmFyIGk9MCwgaj0wOyBpPG5mICYmIGo8bnItMjsgKSB7XG4gICAgICAgICAgdmFyIHAgICAgPSBwb2x5Z29uc1tmcm9udGllcltpXV1cbiAgICAgICAgICAgICwgcF9sICA9IHAubGVmdFtwLmxlZnQubGVuZ3RoLTFdWzBdXG4gICAgICAgICAgICAsIHBfciAgPSBwLnJpZ2h0W3AucmlnaHQubGVuZ3RoLTFdWzBdXG4gICAgICAgICAgICAsIHBfYyAgPSBwLmNvbG9yXG4gICAgICAgICAgICAsIHJfbCAgPSBydW5zW2pdICAgIC8vU3RhcnQgb2YgcnVuXG4gICAgICAgICAgICAsIHJfciAgPSBydW5zW2orMl0gIC8vRW5kIG9mIHJ1blxuICAgICAgICAgICAgLCByX2MgID0gcnVuc1tqKzFdOyAvL0NvbG9yIG9mIHJ1blxuICAgICAgICAgIC8vQ2hlY2sgaWYgd2UgY2FuIG1lcmdlIHJ1biB3aXRoIHBvbHlnb25cbiAgICAgICAgICBpZihyX3IgPiBwX2wgJiYgcF9yID4gcl9sICYmIHJfYyA9PT0gcF9jKSB7XG4gICAgICAgICAgICAvL01lcmdlIHJ1blxuICAgICAgICAgICAgcC5tZXJnZV9ydW4oeFt2XSwgcl9sLCByX3IpO1xuICAgICAgICAgICAgLy9JbnNlcnQgcG9seWdvbiBpbnRvIGZyb250aWVyXG4gICAgICAgICAgICBuZXh0X2Zyb250aWVyW2ZwKytdID0gZnJvbnRpZXJbaV07XG4gICAgICAgICAgICArK2k7XG4gICAgICAgICAgICBqICs9IDI7XG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIC8vQ2hlY2sgaWYgd2UgbmVlZCB0byBhZHZhbmNlIHRoZSBydW4gcG9pbnRlclxuICAgICAgICAgICAgaWYocl9yIDw9IHBfcikge1xuICAgICAgICAgICAgICBpZighIXJfYykge1xuICAgICAgICAgICAgICAgIHZhciBuX3BvbHkgPSBuZXcgTW9ub3RvbmVQb2x5Z29uKHJfYywgeFt2XSwgcl9sLCByX3IpO1xuICAgICAgICAgICAgICAgIG5leHRfZnJvbnRpZXJbZnArK10gPSBwb2x5Z29ucy5sZW5ndGg7XG4gICAgICAgICAgICAgICAgcG9seWdvbnMucHVzaChuX3BvbHkpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIGogKz0gMjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIC8vQ2hlY2sgaWYgd2UgbmVlZCB0byBhZHZhbmNlIHRoZSBmcm9udGllciBwb2ludGVyXG4gICAgICAgICAgICBpZihwX3IgPD0gcl9yKSB7XG4gICAgICAgICAgICAgIHAuY2xvc2Vfb2ZmKHhbdl0pO1xuICAgICAgICAgICAgICArK2k7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vQ2xvc2Ugb2ZmIGFueSByZXNpZHVhbCBwb2x5Z29uc1xuICAgICAgICBmb3IoOyBpPG5mOyArK2kpIHtcbiAgICAgICAgICBwb2x5Z29uc1tmcm9udGllcltpXV0uY2xvc2Vfb2ZmKHhbdl0pO1xuICAgICAgICB9XG4gICAgICAgIC8vQWRkIGFueSBleHRyYSBydW5zIHRvIGZyb250aWVyXG4gICAgICAgIGZvcig7IGo8bnItMjsgais9Mikge1xuICAgICAgICAgIHZhciByX2wgID0gcnVuc1tqXVxuICAgICAgICAgICAgLCByX3IgID0gcnVuc1tqKzJdXG4gICAgICAgICAgICAsIHJfYyAgPSBydW5zW2orMV07XG4gICAgICAgICAgaWYoISFyX2MpIHtcbiAgICAgICAgICAgIHZhciBuX3BvbHkgPSBuZXcgTW9ub3RvbmVQb2x5Z29uKHJfYywgeFt2XSwgcl9sLCByX3IpO1xuICAgICAgICAgICAgbmV4dF9mcm9udGllcltmcCsrXSA9IHBvbHlnb25zLmxlbmd0aDtcbiAgICAgICAgICAgIHBvbHlnb25zLnB1c2gobl9wb2x5KTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy9Td2FwIGZyb250aWVyc1xuICAgICAgICB2YXIgdG1wID0gbmV4dF9mcm9udGllcjtcbiAgICAgICAgbmV4dF9mcm9udGllciA9IGZyb250aWVyO1xuICAgICAgICBmcm9udGllciA9IHRtcDtcbiAgICAgICAgbmYgPSBmcDtcbiAgICAgIH1cbiAgICAgIC8vQ2xvc2Ugb2ZmIGZyb250aWVyXG4gICAgICBmb3IodmFyIGk9MDsgaTxuZjsgKytpKSB7XG4gICAgICAgIHZhciBwID0gcG9seWdvbnNbZnJvbnRpZXJbaV1dO1xuICAgICAgICBwLmNsb3NlX29mZihkaW1zW3ZdKTtcbiAgICAgIH1cbiAgICAgIC8vIC0tLSBNb25vdG9uZSBzdWJkaXZpc2lvbiBvZiBwb2x5Z29uIGlzIGNvbXBsZXRlIGF0IHRoaXMgcG9pbnQgLS0tXG4gICAgICBcbiAgICAgIHhbZF0rKztcbiAgICAgIFxuICAgICAgLy9Ob3cgd2UganVzdCBuZWVkIHRvIHRyaWFuZ3VsYXRlIGVhY2ggbW9ub3RvbmUgcG9seWdvblxuICAgICAgZm9yKHZhciBpPTA7IGk8cG9seWdvbnMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgdmFyIHAgPSBwb2x5Z29uc1tpXVxuICAgICAgICAgICwgYyA9IHAuY29sb3JcbiAgICAgICAgICAsIGZsaXBwZWQgPSBmYWxzZTtcbiAgICAgICAgaWYoYyA8IDApIHtcbiAgICAgICAgICBmbGlwcGVkID0gdHJ1ZTtcbiAgICAgICAgICBjID0gLWM7XG4gICAgICAgIH1cbiAgICAgICAgZm9yKHZhciBqPTA7IGo8cC5sZWZ0Lmxlbmd0aDsgKytqKSB7XG4gICAgICAgICAgbGVmdF9pbmRleFtqXSA9IHZlcnRpY2VzLmxlbmd0aDtcbiAgICAgICAgICB2YXIgeSA9IFswLjAsMC4wLDAuMF1cbiAgICAgICAgICAgICwgeiA9IHAubGVmdFtqXTtcbiAgICAgICAgICB5W2RdID0geFtkXTtcbiAgICAgICAgICB5W3VdID0gelswXTtcbiAgICAgICAgICB5W3ZdID0gelsxXTtcbiAgICAgICAgICB2ZXJ0aWNlcy5wdXNoKHkpO1xuICAgICAgICB9XG4gICAgICAgIGZvcih2YXIgaj0wOyBqPHAucmlnaHQubGVuZ3RoOyArK2opIHtcbiAgICAgICAgICByaWdodF9pbmRleFtqXSA9IHZlcnRpY2VzLmxlbmd0aDtcbiAgICAgICAgICB2YXIgeSA9IFswLjAsMC4wLDAuMF1cbiAgICAgICAgICAgICwgeiA9IHAucmlnaHRbal07XG4gICAgICAgICAgeVtkXSA9IHhbZF07XG4gICAgICAgICAgeVt1XSA9IHpbMF07XG4gICAgICAgICAgeVt2XSA9IHpbMV07XG4gICAgICAgICAgdmVydGljZXMucHVzaCh5KTtcbiAgICAgICAgfVxuICAgICAgICAvL1RyaWFuZ3VsYXRlIHRoZSBtb25vdG9uZSBwb2x5Z29uXG4gICAgICAgIHZhciBib3R0b20gPSAwXG4gICAgICAgICAgLCB0b3AgPSAwXG4gICAgICAgICAgLCBsX2kgPSAxXG4gICAgICAgICAgLCByX2kgPSAxXG4gICAgICAgICAgLCBzaWRlID0gdHJ1ZTsgIC8vdHJ1ZSA9IHJpZ2h0LCBmYWxzZSA9IGxlZnRcbiAgICAgICAgXG4gICAgICAgIHN0YWNrW3RvcCsrXSA9IGxlZnRfaW5kZXhbMF07XG4gICAgICAgIHN0YWNrW3RvcCsrXSA9IHAubGVmdFswXVswXTtcbiAgICAgICAgc3RhY2tbdG9wKytdID0gcC5sZWZ0WzBdWzFdO1xuICAgICAgICBcbiAgICAgICAgc3RhY2tbdG9wKytdID0gcmlnaHRfaW5kZXhbMF07XG4gICAgICAgIHN0YWNrW3RvcCsrXSA9IHAucmlnaHRbMF1bMF07XG4gICAgICAgIHN0YWNrW3RvcCsrXSA9IHAucmlnaHRbMF1bMV07XG4gICAgICAgIFxuICAgICAgICB3aGlsZShsX2kgPCBwLmxlZnQubGVuZ3RoIHx8IHJfaSA8IHAucmlnaHQubGVuZ3RoKSB7XG4gICAgICAgICAgLy9Db21wdXRlIG5leHQgc2lkZVxuICAgICAgICAgIHZhciBuX3NpZGUgPSBmYWxzZTtcbiAgICAgICAgICBpZihsX2kgPT09IHAubGVmdC5sZW5ndGgpIHtcbiAgICAgICAgICAgIG5fc2lkZSA9IHRydWU7XG4gICAgICAgICAgfSBlbHNlIGlmKHJfaSAhPT0gcC5yaWdodC5sZW5ndGgpIHtcbiAgICAgICAgICAgIHZhciBsID0gcC5sZWZ0W2xfaV1cbiAgICAgICAgICAgICAgLCByID0gcC5yaWdodFtyX2ldO1xuICAgICAgICAgICAgbl9zaWRlID0gbFsxXSA+IHJbMV07XG4gICAgICAgICAgfVxuICAgICAgICAgIHZhciBpZHggPSBuX3NpZGUgPyByaWdodF9pbmRleFtyX2ldIDogbGVmdF9pbmRleFtsX2ldXG4gICAgICAgICAgICAsIHZlcnQgPSBuX3NpZGUgPyBwLnJpZ2h0W3JfaV0gOiBwLmxlZnRbbF9pXTtcbiAgICAgICAgICBpZihuX3NpZGUgIT09IHNpZGUpIHtcbiAgICAgICAgICAgIC8vT3Bwb3NpdGUgc2lkZVxuICAgICAgICAgICAgd2hpbGUoYm90dG9tKzMgPCB0b3ApIHtcbiAgICAgICAgICAgICAgaWYoZmxpcHBlZCA9PT0gbl9zaWRlKSB7XG4gICAgICAgICAgICAgICAgZmFjZXMucHVzaChbIHN0YWNrW2JvdHRvbV0sIHN0YWNrW2JvdHRvbSszXSwgaWR4LCBjXSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZmFjZXMucHVzaChbIHN0YWNrW2JvdHRvbSszXSwgc3RhY2tbYm90dG9tXSwgaWR4LCBjXSk7ICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBib3R0b20gKz0gMztcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy9TYW1lIHNpZGVcbiAgICAgICAgICAgIHdoaWxlKGJvdHRvbSszIDwgdG9wKSB7XG4gICAgICAgICAgICAgIC8vQ29tcHV0ZSBjb252ZXhpdHlcbiAgICAgICAgICAgICAgZm9yKHZhciBqPTA7IGo8MjsgKytqKVxuICAgICAgICAgICAgICBmb3IodmFyIGs9MDsgazwyOyArK2spIHtcbiAgICAgICAgICAgICAgICBkZWx0YVtqXVtrXSA9IHN0YWNrW3RvcC0zKihqKzEpK2srMV0gLSB2ZXJ0W2tdO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHZhciBkZXQgPSBkZWx0YVswXVswXSAqIGRlbHRhWzFdWzFdIC0gZGVsdGFbMV1bMF0gKiBkZWx0YVswXVsxXTtcbiAgICAgICAgICAgICAgaWYobl9zaWRlID09PSAoZGV0ID4gMCkpIHtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBpZihkZXQgIT09IDApIHtcbiAgICAgICAgICAgICAgICBpZihmbGlwcGVkID09PSBuX3NpZGUpIHtcbiAgICAgICAgICAgICAgICAgIGZhY2VzLnB1c2goWyBzdGFja1t0b3AtM10sIHN0YWNrW3RvcC02XSwgaWR4LCBjIF0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBmYWNlcy5wdXNoKFsgc3RhY2tbdG9wLTZdLCBzdGFja1t0b3AtM10sIGlkeCwgYyBdKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgdG9wIC09IDM7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuICAgICAgICAgIC8vUHVzaCB2ZXJ0ZXhcbiAgICAgICAgICBzdGFja1t0b3ArK10gPSBpZHg7XG4gICAgICAgICAgc3RhY2tbdG9wKytdID0gdmVydFswXTtcbiAgICAgICAgICBzdGFja1t0b3ArK10gPSB2ZXJ0WzFdO1xuICAgICAgICAgIC8vVXBkYXRlIGxvb3AgaW5kZXhcbiAgICAgICAgICBpZihuX3NpZGUpIHtcbiAgICAgICAgICAgICsrcl9pO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICArK2xfaTtcbiAgICAgICAgICB9XG4gICAgICAgICAgc2lkZSA9IG5fc2lkZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4geyB2ZXJ0aWNlczp2ZXJ0aWNlcywgZmFjZXM6ZmFjZXMgfTtcbn1cbn0pKCk7XG5cbmlmKGV4cG9ydHMpIHtcbiAgZXhwb3J0cy5tZXNoZXIgPSBNb25vdG9uZU1lc2g7XG59XG4iXX0=
