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