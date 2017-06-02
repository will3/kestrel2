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