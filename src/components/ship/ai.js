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