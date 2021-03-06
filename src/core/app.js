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