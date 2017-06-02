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